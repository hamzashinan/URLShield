"""
Create a sample Excel template for batch URL uploads
"""

import pandas as pd
from pathlib import Path

# Sample URLs for testing
sample_urls = [
    "https://google.com",
    "https://facebook.com",
    "https://amazon.com",
    "https://apple.com",
    "https://microsoft.com",
    "https://netflix.com",
    "https://twitter.com",
    "https://linkedin.com",
    "https://github.com",
    "https://stackoverflow.com",
]

# Create DataFrame
df = pd.DataFrame({
    "URL": sample_urls,
    "Description": [
        "Search Engine",
        "Social Media",
        "E-commerce",
        "Technology",
        "Software",
        "Streaming",
        "Social Media",
        "Professional Network",
        "Code Repository",
        "Developer Community"
    ]
})

# Create examples directory if it doesn't exist
examples_dir = Path(__file__).parent
examples_dir.mkdir(exist_ok=True)

# Save as Excel file
output_file = examples_dir / "batch_upload_template.xlsx"
df.to_excel(output_file, index=False, engine='openpyxl')

print(f"✅ Template created: {output_file}")
print(f"📊 Contains {len(sample_urls)} sample URLs")
print("\nYou can now upload this file to test the batch upload feature!")
