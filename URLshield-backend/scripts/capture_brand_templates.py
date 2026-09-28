#!/usr/bin/env python3
"""
Brand Template Screenshot Capture Tool

This script captures screenshots of legitimate brand websites
and saves them in a structured templates folder for SSIM comparison.

Usage:
    python scripts/capture_brand_templates.py
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image
import json
from datetime import datetime

# Brand domains to capture
BRAND_DOMAINS = [
    "airtel.in",
    "bankofbaroda.in",
    "dc.crsorgi.gov.in",
    "hdfcbank.com",
    "hdfcergo.com",
    "hdfclife.com",
    "icicibank.com",
    "icicidirect.com",
    "icicilombard.com",
    "iciciprulife.com",
    "iocl.com",
    "irctc.co.in",
    "ncrb.gov.in",
    "email.gov.in",
    "kavach.mail.gov.in",
    "accounts.mgovcloud.in",
    "nic.gov.in",
    "pnbindia.in",
    "sbicard.com",
    "sbilife.co.in",
    "sbi.co.in",
]

# Output directory
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


async def capture_brand_screenshot(domain: str, output_dir: Path):
    """
    Capture screenshot of a brand website
    
    Args:
        domain: Domain name (e.g., 'airtel.in')
        output_dir: Directory to save screenshots
    """
    # Create brand folder
    brand_name = domain.replace('.', '_')
    brand_dir = output_dir / brand_name
    brand_dir.mkdir(parents=True, exist_ok=True)
    
    screenshot_path = brand_dir / "screenshot.png"
    metadata_path = brand_dir / "metadata.json"
    
    # Skip if already exists
    if screenshot_path.exists():
        print(f"✅ {domain} - Already exists, skipping")
        return
    
    try:
        async with async_playwright() as p:
            print(f"🔍 Capturing {domain}...")
            
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
            
            # Save metadata
            metadata = {
                "domain": domain,
                "url": url,
                "captured_at": datetime.utcnow().isoformat(),
                "screenshot_size": [800, 600],
                "brand_name": brand_name
            }
            
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            await browser.close()
            
            print(f"✅ {domain} - Screenshot saved to {screenshot_path}")
            
    except Exception as e:
        print(f"❌ {domain} - Failed: {e}")


async def capture_all_brands():
    """Capture screenshots for all brand domains"""
    
    print(f"📸 Starting brand template capture...")
    print(f"📁 Output directory: {TEMPLATES_DIR}")
    print(f"🎯 Total brands: {len(BRAND_DOMAINS)}")
    print("-" * 60)
    
    # Create templates directory
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Capture screenshots sequentially (to avoid overwhelming the system)
    for domain in BRAND_DOMAINS:
        await capture_brand_screenshot(domain, TEMPLATES_DIR)
        await asyncio.sleep(1)  # Small delay between captures
    
    print("-" * 60)
    print(f"✅ Brand template capture complete!")
    print(f"📁 Templates saved to: {TEMPLATES_DIR}")


async def verify_templates():
    """Verify captured templates"""
    
    print("\n" + "=" * 60)
    print("📊 Template Verification")
    print("=" * 60)
    
    total = 0
    successful = 0
    
    for domain in BRAND_DOMAINS:
        brand_name = domain.replace('.', '_')
        brand_dir = TEMPLATES_DIR / brand_name
        screenshot_path = brand_dir / "screenshot.png"
        metadata_path = brand_dir / "metadata.json"
        
        total += 1
        
        if screenshot_path.exists() and metadata_path.exists():
            successful += 1
            # Get file size
            size_kb = screenshot_path.stat().st_size / 1024
            print(f"✅ {domain:30s} - {size_kb:6.1f} KB")
        else:
            print(f"❌ {domain:30s} - Missing")
    
    print("=" * 60)
    print(f"📊 Success Rate: {successful}/{total} ({successful/total*100:.1f}%)")
    print("=" * 60)


def main():
    """Main entry point"""
    print("""
╔══════════════════════════════════════════════════════════╗
║     Brand Template Screenshot Capture Tool              ║
║     URLShield Phishing Detection System                 ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # Run capture
    asyncio.run(capture_all_brands())
    
    # Verify results
    asyncio.run(verify_templates())
    
    print("""
📝 Next Steps:
1. Review captured screenshots in templates/ folder
2. Manually verify they look correct
3. Restart backend to use templates for SSIM comparison
4. Test with phishing URLs to see improved detection!
    """)


if __name__ == "__main__":
    main()
