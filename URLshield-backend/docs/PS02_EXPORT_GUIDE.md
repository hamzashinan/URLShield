# PS-02 Export Feature Guide

## Overview

The batch export feature generates PS-02 format Excel files from batch job results, containing all required columns for submission.

## PS-02 Format Columns (20 columns)

1. **Application_ID** - Application ID for PS-02
2. **Source of detection** - How the phishing site was detected
3. **Identified Phishing/Suspected Domain Name** - The suspicious domain
4. **Corresponding CSE Domain Name** - Related CSE domain (if any)
5. **Critical Sector Entity Name** - CSE name (if applicable)
6. **Phishing/Suspected Domains (i.e. Class Label)** - Classification result
7. **Domain Registration Date** - When domain was registered
8. **Registrar Name** - Domain registrar
9. **Registrant Name or Registrant Organisation** - Domain owner
10. **Registrant Country** - Country of registrant
11. **Name Servers** - DNS name servers
12. **Hosting IP** - IP address of hosting
13. **Hosting ISP** - Internet Service Provider
14. **Hosting Country** - Country of hosting
15. **DNS Records (if any)** - DNS record summary
16. **Evidence file name** - Associated evidence files
17. **Date of detection (DD-MM-YYYY)** - Detection date
18. **Time of detection (HH-MM-SS)** - Detection time
19. **Date of Post (If detection is from Source: social media)** - Social media post date
20. **Remarks (If any)** - Additional notes and findings

## API Endpoint

### Export Batch Results

**Endpoint:** `POST /batch/{batch_id}/export`

**Headers:**
```
X-API-Key: your-api-key
```

**Query Parameters:**
- `application_id` (required) - Application ID for PS-02 format
- `source_of_detection` (optional) - Default: "Automated System"
- `cse_domain_name` (optional) - Corresponding CSE Domain Name
- `cse_name` (optional) - Critical Sector Entity Name

**Response:**
- Excel file download (`.xlsx`)
- Filename format: `PS-02_{application_id}_Submission_Set_{date}.xlsx`

## Usage Examples

### Using cURL

```bash
curl -X POST "http://localhost:8080/batch/{batch_id}/export?application_id=APP001" \
  -H "X-API-Key: your-api-key" \
  --output PS-02_APP001.xlsx
```

### Using Python

```python
import requests

API_URL = "http://localhost:8080"
API_KEY = "your-api-key"
BATCH_ID = "your-batch-id"

# Export batch results
response = requests.post(
    f"{API_URL}/batch/{BATCH_ID}/export",
    headers={"X-API-Key": API_KEY},
    params={
        "application_id": "APP001",
        "source_of_detection": "Automated System",
        "cse_domain_name": "example.com",
        "cse_name": "Example CSE"
    }
)

# Save to file
if response.status_code == 200:
    with open("PS-02_APP001.xlsx", "wb") as f:
        f.write(response.content)
    print("Export successful!")
else:
    print(f"Export failed: {response.text}")
```

### Using JavaScript/Frontend

```javascript
const API_URL = "http://localhost:8080";
const API_KEY = "your-api-key";
const BATCH_ID = "your-batch-id";

async function exportBatch() {
  const params = new URLSearchParams({
    application_id: "APP001",
    source_of_detection: "Automated System"
  });

  const response = await fetch(
    `${API_URL}/batch/${BATCH_ID}/export?${params}`,
    {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY
      }
    }
  );

  if (response.ok) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PS-02_APP001_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
```

## Data Mapping

### ML Prediction to Class Label

| Prediction | Confidence | Class Label |
|------------|------------|-------------|
| Phishing | 0.85 | "Phishing (Confidence: 85.00%)" |
| Legitimate | 0.92 | "Legitimate (Confidence: 92.00%)" |
| Unknown | - | "Suspected" |

### WHOIS Data Extraction

- **Domain Registration Date**: From `whois.creation_date`
- **Registrar Name**: From `whois.registrar`
- **Registrant Name**: From `whois.registrant_name` or `whois.registrant_org`
- **Registrant Country**: From `whois.registrant_country`

### DNS Data Extraction

- **Name Servers**: From `dns.ns_records`
- **Hosting IP**: From `dns.a_records`
- **DNS Records**: Summary of A, AAAA, MX, TXT records

### Network Data Extraction

- **Hosting ISP**: From `network.isp`
- **Hosting Country**: From `network.country`

### Evidence Files

Automatically includes:
- `screenshot.png` - Page screenshot
- `page.html` - HTML source
- `features.json` - Extracted features

### Remarks Generation

Automatically includes:
- Top 3 ML prediction reasons
- Typosquatting detection
- Misleading keywords
- HTTPS status
- Other risk indicators

## Example Output

| Application_ID | Source of detection | Identified Phishing/Suspected Domain Name | ... |
|----------------|---------------------|-------------------------------------------|-----|
| APP001 | Automated System | phishing-site.com | ... |
| APP001 | Automated System | suspicious-bank.com | ... |

## Complete Workflow

### 1. Upload Batch

```bash
curl -X POST "http://localhost:8080/batch/upload" \
  -H "X-API-Key: your-api-key" \
  -F "file=@urls.xlsx"
```

Response:
```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_urls": 50,
  "message": "Batch job created successfully",
  "status": "success"
}
```

### 2. Monitor Progress

```bash
curl "http://localhost:8080/batch/550e8400-e29b-41d4-a716-446655440000" \
  -H "X-API-Key: your-api-key"
```

Wait until `state` is `"completed"`.

### 3. Export Results

```bash
curl -X POST "http://localhost:8080/batch/550e8400-e29b-41d4-a716-446655440000/export?application_id=APP001" \
  -H "X-API-Key: your-api-key" \
  --output PS-02_APP001.xlsx
```

### 4. Submit Excel File

Open the generated Excel file and verify all columns are populated correctly before submission.

## Customization

### Custom Application ID

```bash
?application_id=MY_APP_2025
```

### Custom Source

```bash
?source_of_detection=Manual%20Review
```

### With CSE Information

```bash
?application_id=APP001&cse_domain_name=bank.com&cse_name=National%20Bank
```

## Data Quality

### Required Data

✅ **Always Available:**
- Application ID (from parameter)
- Source of detection (from parameter)
- Domain name (from URL)
- Class label (from ML prediction)
- Detection date/time (from job creation)
- Evidence files (from job artifacts)

⚠️ **May Be Missing:**
- Domain registration date (if WHOIS fails)
- Registrar/Registrant info (if WHOIS unavailable)
- Hosting ISP/Country (if network lookup fails)
- DNS records (if DNS query fails)

### Missing Data Handling

- Missing values shown as "N/A"
- Partial data included when available
- Remarks include data quality notes

## Troubleshooting

### Export Fails

**Error:** "Batch job not found"
- Verify batch_id is correct
- Check batch exists: `GET /batch/{batch_id}`

**Error:** "Export failed"
- Check batch is completed
- Verify job data exists in `data/` directory
- Check logs for details

### Empty Columns

**WHOIS data missing:**
- Domain may be newly registered
- WHOIS service may be unavailable
- Some TLDs don't provide WHOIS

**Network data missing:**
- DNS lookup may have failed
- Domain may not resolve
- Network service unavailable

### Incorrect Dates

**Format:** DD-MM-YYYY and HH-MM-SS
- Dates automatically formatted
- Timezone: UTC
- Invalid dates shown as "N/A"

## Best Practices

1. **Wait for Completion:** Only export after batch state is "completed"
2. **Unique Application IDs:** Use unique IDs for each submission
3. **Verify Data:** Review Excel file before submission
4. **Keep Records:** Save both Excel file and batch_id
5. **Backup Evidence:** Evidence files stored in `data/batch_jobs/{batch_id}/`

## Integration with Frontend

Add export button to BatchMonitor component:

```typescript
const handleExport = async () => {
  const blob = await apiClient.exportBatch(
    batchId,
    applicationId,
    "Automated System"
  );
  
  // Download file
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PS-02_${applicationId}_${Date.now()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
```

## Summary

✅ **PS-02 format** with all 20 required columns
✅ **Automatic data extraction** from batch results
✅ **ML predictions** included with confidence
✅ **WHOIS, DNS, Network** data when available
✅ **Evidence file** references
✅ **Formatted dates** (DD-MM-YYYY, HH-MM-SS)
✅ **Remarks** with ML reasoning and risk indicators
✅ **Excel download** ready for submission

The export feature is now fully implemented and ready to use!

