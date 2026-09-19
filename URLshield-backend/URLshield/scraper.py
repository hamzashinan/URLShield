"""Web scraping and data extraction"""

import asyncio
import hashlib
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import dns.resolver
import imagehash
import tldextract
from bs4 import BeautifulSoup
from PIL import Image
from playwright.async_api import Browser, Page, async_playwright

from URLshield.config import Settings
from URLshield.logger import get_logger
from URLshield.models import DNSInfo, DOMSignals, RDAPInfo, ScrapedData
from URLshield.utils import mkdir_with_permissions

logger = get_logger(__name__)


def nan_to_null(obj):
    """Convert NaN, Inf, and datetime values to JSON-serializable formats"""
    if isinstance(obj, dict):
        return {k: nan_to_null(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [nan_to_null(item) for item in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj


class Scraper:
    """Web scraper with Playwright"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.browser: Optional[Browser] = None
        self._playwright = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()

    async def start(self):
        """Initialize browser"""
        self._playwright = await async_playwright().start()

        self.browser = await self._playwright.chromium.launch(
            headless=self.settings.headless,
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ]
        )

        logger.info("browser_started", headless=self.settings.headless)

    async def stop(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()

        if self._playwright:
            await self._playwright.stop()

        logger.info("browser_stopped")

    async def scrape_url(
        self,
        job_id: str,
        url: str,
        *,
        brand_hint: Optional[str] = None,
        legitimate_domain: Optional[str] = None,
        analysis_mode: Optional[str] = "full_analysis",
    ) -> ScrapedData:
        """Scrape URL and capture real screenshot"""

        start_time = time.time()

        # Normalize URL
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        logger.info("scrape_started", job_id=job_id, url=url)

        # Extract registered domain
        extracted = tldextract.extract(url)
        registered_domain = f"{extracted.domain}.{extracted.suffix}"

        # Create output directory
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        output_dir = (
            self.settings.data_root
            / registered_domain
            / timestamp
        )

        mkdir_with_permissions(output_dir)

        html_path = output_dir / "page.html"
        screenshot_path = output_dir / "screenshot.png"

        html_content = ""
        text_content = ""
        final_url = url
        status_code = 0
        headers = {}
        screenshot_hash = ""

        dom_signals = DOMSignals(
            text_length=0,
            form_count=0,
            password_field_count=0,
            email_mentions=0,
            outlink_count=0,
            outlinks=[],
        )

        page = await self.browser.new_page(
            viewport={"width": 1366, "height": 768},
            user_agent=self.settings.user_agent
        )

        try:
            logger.info("opening_page", url=url)

            response = await page.goto(
                url,
                wait_until="networkidle",
                timeout=60000
            )

            await asyncio.sleep(3)

            final_url = page.url

            if response:
                status_code = response.status
                headers = dict(response.headers)

            logger.info(
                "page_loaded",
                final_url=final_url,
                status=status_code
            )

            # Save HTML
            html_content = await page.content()

            html_path.write_text(
                html_content,
                encoding="utf-8"
            )

            logger.info(
                "html_saved",
                path=str(html_path)
            )

            # Take REAL screenshot
            await page.screenshot(
                path=str(screenshot_path),
                full_page=True
            )

            logger.info(
                "screenshot_saved",
                path=str(screenshot_path)
            )

            # Compute image hash
            screenshot_hash = self._compute_image_hash(
                screenshot_path
            )

            # Extract DOM signals
            dom_signals = await self._extract_dom_signals(
                page,
                html_content,
                final_url
            )

            text_content = BeautifulSoup(
                html_content,
                "html.parser"
            ).get_text()

        except Exception as e:
            logger.error(
                "scrape_failed",
                url=url,
                error=str(e)
            )

            # Save error HTML
            html_path.write_text(
                f"""
        <html>
            <body>
                <h1>Scrape Failed</h1>
                <p>{str(e)}</p>
            </body>
        </html>
        """,
                encoding="utf-8"
            )

            # Generate placeholder so evidence thumbnails remain available
            screenshot_hash = self._generate_placeholder_screenshot(
                screenshot_path, url, str(e)
            )

        finally:
            await page.close()

        # Collect DNS info
        try:
            dns_info = await self._collect_dns_info(
                registered_domain
            )
        except Exception as e:
            logger.warning(
                "dns_collection_failed",
                error=str(e)
            )
            dns_info = DNSInfo()

        # Collect RDAP info
        try:
            rdap_info = await self._collect_rdap_info(
                registered_domain
            )
        except Exception as e:
            logger.warning(
                "rdap_collection_failed",
                error=str(e)
            )
            rdap_info = None

        duration_ms = (time.time() - start_time) * 1000

        scraped_data = ScrapedData(
            job_id=job_id,
            input_url=url,
            final_url=final_url,
            status_code=status_code,
            headers=headers,
            html_content=html_content,
            text_content=text_content,
            html_path=html_path,
            screenshot_path=screenshot_path if screenshot_path else None,
            screenshot_hash=screenshot_hash if screenshot_path else None,
            dns_info=dns_info,
            rdap_info=rdap_info,
            dom_signals=dom_signals,
            registered_domain=registered_domain,
            scraped_at=datetime.now(timezone.utc),
            duration_ms=duration_ms
        )

        # Save features
        try:
            self._save_features(
                scraped_data,
                output_dir / "features.json"
            )
        except Exception as e:
            logger.warning(
                "feature_save_failed",
                error=str(e)
            )

        logger.info(
            "scrape_completed",
            job_id=job_id,
            url=url,
            final_url=final_url,
            status_code=status_code,
            duration_ms=duration_ms
        )

        return scraped_data

    async def capture_screenshot_for_evidence(
        self,
        output_dir: Path,
        *,
        url: Optional[str] = None,
    ) -> bool:
        """Capture or regenerate screenshot.png for an existing evidence pack."""
        if not self.browser:
            raise RuntimeError("Browser not started")

        screenshot_path = output_dir / "screenshot.png"
        html_path = output_dir / "page.html"
        features_path = output_dir / "features.json"

        target_url = url
        if not target_url and features_path.exists():
            try:
                with open(features_path, encoding="utf-8") as f:
                    features = json.load(f)
                target_url = features.get("final_url") or features.get("input_url")
            except Exception as e:
                logger.warning(
                    "evidence_features_read_failed",
                    path=str(features_path),
                    error=str(e),
                )

        if not target_url:
            domain = output_dir.parent.name
            target_url = f"https://{domain}"

        if not target_url.startswith(("http://", "https://")):
            target_url = "https://" + target_url

        page = await self.browser.new_page(
            viewport={"width": 1366, "height": 768},
            user_agent=self.settings.user_agent,
        )

        captured = False
        last_error = "Unknown error"

        try:
            logger.info(
                "evidence_screenshot_capture_started",
                url=target_url,
                output_dir=str(output_dir),
            )

            try:
                response = await page.goto(
                    target_url,
                    wait_until="networkidle",
                    timeout=60000,
                )
                await asyncio.sleep(2)

                if response and response.status >= 400:
                    raise RuntimeError(f"HTTP {response.status}")

                await page.screenshot(
                    path=str(screenshot_path),
                    full_page=True,
                )
                captured = (
                    screenshot_path.exists()
                    and screenshot_path.stat().st_size > 0
                )
            except Exception as live_error:
                last_error = str(live_error)
                logger.warning(
                    "evidence_live_screenshot_failed",
                    url=target_url,
                    error=last_error,
                )

                if html_path.exists():
                    try:
                        await page.goto(
                            html_path.resolve().as_uri(),
                            wait_until="load",
                            timeout=30000,
                        )
                        await asyncio.sleep(1)
                        await page.screenshot(
                            path=str(screenshot_path),
                            full_page=True,
                        )
                        captured = (
                            screenshot_path.exists()
                            and screenshot_path.stat().st_size > 0
                        )
                    except Exception as html_error:
                        last_error = str(html_error)
                        logger.warning(
                            "evidence_html_screenshot_failed",
                            path=str(html_path),
                            error=last_error,
                        )

            if not captured:
                self._generate_placeholder_screenshot(
                    screenshot_path,
                    target_url,
                    last_error,
                )
                captured = (
                    screenshot_path.exists()
                    and screenshot_path.stat().st_size > 0
                )

            if captured and features_path.exists():
                try:
                    with open(features_path, encoding="utf-8") as f:
                        features = json.load(f)
                    features["screenshot_hash"] = self._compute_image_hash(
                        screenshot_path
                    )
                    features["screenshot_recaptured_at"] = datetime.now(
                        timezone.utc
                    ).isoformat()
                    with open(features_path, "w", encoding="utf-8") as f:
                        json.dump(nan_to_null(features), f, indent=2)
                except Exception as e:
                    logger.warning(
                        "evidence_features_update_failed",
                        path=str(features_path),
                        error=str(e),
                    )

            logger.info(
                "evidence_screenshot_capture_completed",
                output_dir=str(output_dir),
                captured=captured,
            )
            return captured

        finally:
            await page.close()

    def _generate_placeholder_screenshot(self, screenshot_path: Path, url: str, error_message: str) -> str:
        """Generate a placeholder screenshot when page fails to load"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            import textwrap
            
            # Create a 1200x800 image with dark background
            width, height = 1200, 800
            image = Image.new('RGB', (width, height), color='#1a1a1a')
            draw = ImageDraw.Draw(image)
            
            # Use default font to avoid font path issues
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()
            
            # Title
            title = "Screenshot Failed"
            draw.text((width//2, 150), title, fill='#ff4444', font=font_large, anchor='mm')
            
            # URL
            draw.text((width//2, 220), f"URL: {url}", fill='#ffffff', font=font_medium, anchor='mm')
            
            # Error message (wrapped)
            error_title = "Error:"
            draw.text((width//2, 300), error_title, fill='#ffaa00', font=font_medium, anchor='mm')
            
            # Wrap error message to fit width
            max_width = width - 100
            wrapped_error = textwrap.fill(error_message, width=60)
            y_offset = 340
            
            for line in wrapped_error.split('\n'):
                draw.text((width//2, y_offset), line, fill='#cccccc', font=font_small, anchor='mm')
                y_offset += 25
            
            # Footer
            footer = "URLShield - Phishing Detection System"
            draw.text((width//2, height - 50), footer, fill='#666666', font=font_small, anchor='mm')
            
            # Save the image
            image.save(screenshot_path, 'PNG')
            
            # Compute and return hash
            return self._compute_image_hash(screenshot_path)
            
        except Exception as e:
            logger.error(
                "placeholder_screenshot_failed",
                error=str(e)
            )
            return ""

    async def analyze_url_only(
        self,
        job_id: str,
        url: str,
        output_dir: Path,
        error_message: str,
        brand_hint: Optional[str] = None,
        legitimate_domain: Optional[str] = None,
    ) -> ScrapedData:
        """Perform URL-only analysis when full scrape fails"""
        
        start_time = time.time()
        
        # Create a minimal HTML file with error information
        html_content = f"""
        <html>
        <head><title>Analysis Failed - {url}</title></head>
        <body>
        <h1>URL Analysis Failed</h1>
        <p><strong>URL:</strong> {url}</p>
        <p><strong>Error:</strong> {error_message}</p>
        <p><strong>Analysis Type:</strong> URL-only (fallback)</p>
        </body>
        </html>
        """
        
        # Save HTML file
        html_path = output_dir / "page.html"
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Get basic domain info
        import tldextract
        ext = tldextract.extract(url)
        registered_domain = ext.registered_domain or "unknown"
        
        # Collect DNS info (this might work even if the page doesn't load)
        try:
            dns_info = await self._collect_dns_info(registered_domain)
        except Exception:
            dns_info = DNSInfo()  # Empty DNS info
        
        # Create minimal DOM signals
        dom_signals = DOMSignals(
            text_length=len(html_content),
            form_count=0,
            password_field_count=0,
            email_mentions=html_content.lower().count('@'),
            outlink_count=0,
            outlinks=[]
        )
        
        duration_ms = (time.time() - start_time) * 1000
        
        # Generate placeholder screenshot
        screenshot_hash = self._generate_placeholder_screenshot(
            screenshot_path, url, error_message
        )
        
        # Create ScrapedData with placeholder screenshot
        scraped_data = ScrapedData(
            job_id=job_id,
            input_url=url,
            final_url=url,  # Use input URL as final URL since we couldn't resolve it
            status_code=0,  # No status code for failed requests
            headers={},  # Empty headers
            html_path=html_path,
            screenshot_path=screenshot_path,  # Include placeholder screenshot
            screenshot_hash=screenshot_hash,  # Include hash of placeholder
            dns_info=dns_info,
            rdap_info=None,
            dom_signals=dom_signals,
            registered_domain=registered_domain,
            scraped_at=datetime.now(timezone.utc),
            duration_ms=duration_ms,
            is_partial=True
        )
        
        return scraped_data

    def _compute_image_hash(self, image_path: Path) -> str:
        """Compute perceptual hash"""

        try:
            from PIL import Image
            img = Image.open(image_path)
            phash = imagehash.phash(img)
            return str(phash)

        except Exception as e:
            logger.error(
                "image_hash_failed",
                path=str(image_path),
                error=str(e)
            )
            return ""

    async def _extract_dom_signals(
        self,
        page: Page,
        html_content: str,
        base_url: str
    ) -> DOMSignals:
        """Extract DOM-based signals"""

        soup = BeautifulSoup(
            html_content,
            "lxml"
        )

        text = soup.get_text(
            separator=" ",
            strip=True
        )

        text_length = len(text)

        forms = soup.find_all("form")
        form_count = len(forms)

        password_fields = soup.find_all(
            "input",
            {"type": "password"}
        )

        password_field_count = len(password_fields)

        email_mentions = text.lower().count("@")

        links = soup.find_all("a", href=True)

        outlinks = []

        for link in links[:200]:
            href = link["href"]

            absolute_url = urljoin(
                base_url,
                href
            )

            if absolute_url.startswith(
                ("http://", "https://")
            ):
                outlinks.append(absolute_url)

        return DOMSignals(
            text_length=text_length,
            form_count=form_count,
            password_field_count=password_field_count,
            email_mentions=email_mentions,
            outlink_count=len(outlinks),
            outlinks=outlinks
        )

    async def _collect_dns_info(
        self,
        domain: str
    ) -> DNSInfo:
        """Collect DNS records"""

        dns_info = DNSInfo()

        try:
            answers = dns.resolver.resolve(domain, "A")

            dns_info.a_records = [
                str(rdata)
                for rdata in answers
            ]

        except Exception:
            pass

        try:
            answers = dns.resolver.resolve(domain, "MX")

            dns_info.mx_records = [
                str(rdata.exchange)
                for rdata in answers
            ]

        except Exception:
            pass

        try:
            answers = dns.resolver.resolve(domain, "NS")

            dns_info.ns_records = [
                str(rdata)
                for rdata in answers
            ]

        except Exception:
            pass

        return dns_info

    async def _collect_rdap_info(
        self,
        domain: str
    ) -> Optional[RDAPInfo]:
        """Collect WHOIS/RDAP info"""

        try:
            import whois

            w = whois.whois(domain)

            return RDAPInfo(
                registrar=getattr(w, "registrar", None),
                creation_date=getattr(w, "creation_date", None),
                expiration_date=getattr(w, "expiration_date", None),
            )

        except Exception as e:
            logger.warning(
                "rdap_lookup_failed",
                domain=domain,
                error=str(e)
            )

            return None

    def _save_features(
        self,
        scraped_data: ScrapedData,
        output_path: Path
    ):
        """Save features.json"""

        features = {
            "input_url": scraped_data.input_url,
            "final_url": scraped_data.final_url,
            "signals": {
                "status_code": scraped_data.status_code,
                "text_length": scraped_data.dom_signals.text_length,
                "form_count": scraped_data.dom_signals.form_count,
                "password_fields": scraped_data.dom_signals.password_field_count,
                "email_mentions": scraped_data.dom_signals.email_mentions,
                "outlink_count": scraped_data.dom_signals.outlink_count,
            },
            "dns": scraped_data.dns_info.model_dump(),
            "rdap": scraped_data.rdap_info.model_dump()
            if scraped_data.rdap_info
            else {},
            "metadata": {
                "job_id": scraped_data.job_id,
                "registered_domain": scraped_data.registered_domain,
                "scraped_at": scraped_data.scraped_at.isoformat(),
                "duration_ms": scraped_data.duration_ms,
                "is_partial": scraped_data.is_partial
            }
        }

        with open(output_path, "w") as f:
            json.dump(
                nan_to_null(features),
                f,
                indent=2
            )

        logger.info(
            "features_saved",
            path=str(output_path)
        )

