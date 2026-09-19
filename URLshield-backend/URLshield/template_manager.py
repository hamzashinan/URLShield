"""
Template Manager - Capture brand screenshots on-demand

This module provides functionality to capture brand screenshots
when new brands are added via the Keyword Management dashboard.
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image
import json
from datetime import datetime, timezone
import structlog
from typing import Optional, List, Dict, Any

logger = structlog.get_logger()

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


async def capture_brand_screenshot(domain: str) -> dict:
    """
    Capture screenshot of a brand website
    
    Args:
        domain: Domain name (e.g., 'airtel.in')
        
    Returns:
        dict: Result with status and path
    """
    # Create brand folder
    brand_name = domain.replace('.', '_')
    brand_dir = TEMPLATES_DIR / brand_name
    brand_dir.mkdir(parents=True, exist_ok=True)
    
    screenshot_path = brand_dir / "screenshot.png"
    metadata_path = brand_dir / "metadata.json"
    
    # Check if already exists
    if screenshot_path.exists():
        logger.info(f"Template already exists for {domain}")
        return {
            "status": "exists",
            "domain": domain,
            "path": str(screenshot_path),
            "message": f"Template for {domain} already exists"
        }
    
    try:
        async with async_playwright() as p:
            logger.info(f"Capturing screenshot for {domain}")
            
            # Launch browser
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            page = await context.new_page()
            
            # Navigate to website
            url = f"https://{domain}"
            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)
            except:
                # Try http if https fails
                url = f"http://{domain}"
                await page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Wait a bit for dynamic content
            await asyncio.sleep(2)
            
            # Take screenshot
            await page.screenshot(
                path=str(screenshot_path),
                full_page=True,
                timeout=30000
            )
            
            # Process screenshot to standard size
            img = Image.open(screenshot_path)
            img = img.convert('RGB')
            img = img.resize((800, 600), Image.Resampling.LANCZOS)
            img.save(screenshot_path, 'PNG', optimize=True)
            
            # Try to capture favicon
            favicon_path = brand_dir / "favicon.png"
            try:
                favicon_url = f"{url}/favicon.ico"
                import httpx
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    response = await client.get(favicon_url)
                    if response.status_code == 200:
                        from io import BytesIO
                        favicon_img = Image.open(BytesIO(response.content))
                        favicon_img = favicon_img.convert('RGB')
                        favicon_img = favicon_img.resize((32, 32), Image.Resampling.LANCZOS)
                        favicon_img.save(favicon_path, 'PNG')
                        logger.info(f"✅ Favicon captured for {domain}")
            except Exception as e:
                logger.warning(f"⚠️ Favicon capture failed for {domain}: {e}")
            
            # Save metadata
            metadata = {
                "domain": domain,
                "url": url,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "screenshot_size": [800, 600],
                "brand_name": brand_name,
                "has_favicon": favicon_path.exists()
            }
            
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            await browser.close()
            
            logger.info(f"Screenshot captured successfully for {domain}")
            
            return {
                "status": "success",
                "domain": domain,
                "path": str(screenshot_path),
                "message": f"Screenshot captured for {domain}"
            }
            
    except Exception as e:
        logger.error(f"Failed to capture screenshot for {domain}: {e}")
        return {
            "status": "error",
            "domain": domain,
            "error": str(e),
            "message": f"Failed to capture screenshot: {str(e)}"
        }


async def capture_multiple_brands(domains: list[str]) -> list[dict]:
    """
    Capture screenshots for multiple brands
    
    Args:
        domains: List of domain names
        
    Returns:
        list: Results for each domain
    """
    results = []
    
    for domain in domains:
        result = await capture_brand_screenshot(domain)
        results.append(result)
        await asyncio.sleep(1)  # Small delay between captures
    
    return results


def get_brand_template_path(brand_keyword: str) -> Optional[Path]:
    """
    Get the template path for a brand keyword
    
    Args:
        brand_keyword: Brand keyword (e.g., 'hdfc', 'sbi')
        
    Returns:
        Path to screenshot or None if not found
    """
    # Try to find matching template
    # This is a simple implementation - can be enhanced with fuzzy matching
    
    for template_dir in TEMPLATES_DIR.iterdir():
        if template_dir.is_dir():
            if brand_keyword.lower() in template_dir.name.lower():
                screenshot_path = template_dir / "screenshot.png"
                if screenshot_path.exists():
                    return screenshot_path
    
    return None


def list_available_templates() -> list[dict]:
    """
    List all available brand templates
    
    Returns:
        list: Template information
    """
    templates = []
    
    if not TEMPLATES_DIR.exists():
        return templates
    
    for template_dir in TEMPLATES_DIR.iterdir():
        if template_dir.is_dir():
            screenshot_path = template_dir / "screenshot.png"
            metadata_path = template_dir / "metadata.json"
            
            if screenshot_path.exists():
                # Load metadata if available
                metadata = {}
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                
                templates.append({
                    "brand_name": template_dir.name,
                    "domain": metadata.get("domain", "unknown"),
                    "screenshot_path": str(screenshot_path),
                    "captured_at": metadata.get("captured_at", "unknown"),
                    "size_kb": screenshot_path.stat().st_size / 1024
                })
    
    return templates


async def refresh_brand_template(domain: str) -> dict:
    """
    Refresh (re-capture) a brand template
    
    Args:
        domain: Domain name
        
    Returns:
        dict: Result
    """
    brand_name = domain.replace('.', '_')
    brand_dir = TEMPLATES_DIR / brand_name
    
    # Delete existing template
    if brand_dir.exists():
        screenshot_path = brand_dir / "screenshot.png"
        metadata_path = brand_dir / "metadata.json"
        
        if screenshot_path.exists():
            screenshot_path.unlink()
        if metadata_path.exists():
            metadata_path.unlink()
    
    # Capture new screenshot
    return await capture_brand_screenshot(domain)

