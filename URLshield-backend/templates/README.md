# Brand Templates for SSIM Comparison

This folder contains screenshots of legitimate brand websites used for Structural Similarity Index (SSIM) comparison in phishing detection.

## Structure

```
templates/
├── airtel_in/
│   ├── screenshot.png      # 800x600 screenshot
│   └── metadata.json       # Capture metadata
├── hdfcbank_com/
│   ├── screenshot.png
│   └── metadata.json
└── ...
```

## How to Capture Templates

Run the capture script:

```bash
cd /Users/jay/Documents/MY\ WORK/YodhaC.ai-Backend
python scripts/capture_brand_templates.py
```

This will:
1. Visit each brand website
2. Capture full-page screenshot
3. Resize to 800x600 (standard size)
4. Save with metadata

## Brands Included

- **Banking:** SBI, HDFC, ICICI, Bank of Baroda, PNB
- **Telecom:** Airtel
- **Government:** NCRB, NIC, Email.gov.in, IRCTC
- **Insurance:** HDFC Ergo, HDFC Life, SBI Life, ICICI Lombard
- **Others:** IOCL

## Usage in SSIM Comparison

The `_calculate_ssim()` function in `scraper.py` will:

1. Detect brand from URL (e.g., "hdfc" → `hdfcbank_com`)
2. Load template screenshot from this folder
3. Compare with captured screenshot
4. Return similarity score (0.0-1.0)

## Updating Templates

Templates should be updated periodically as websites change:

```bash
# Update all templates
python scripts/capture_brand_templates.py

# Or manually update specific brand
# Just delete the folder and re-run the script
```

## File Sizes

Each screenshot is approximately 50-200 KB (PNG, optimized).

Total folder size: ~5-10 MB for all brands.
