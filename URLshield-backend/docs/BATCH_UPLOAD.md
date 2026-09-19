# Batch URL Upload Feature

## Overview

The batch upload feature allows you to analyze multiple URLs simultaneously by uploading an Excel file. URLs are processed sequentially with rate limiting to prevent overwhelming the system.

## Features

- ✅ **Excel File Support**: Upload `.xlsx` or `.xls` files
- ✅ **Sequential Processing**: URLs are processed one at a time with configurable delays
- ✅ **Progress Tracking**: Real-time progress updates for batch jobs
- ✅ **Error Handling**: Failed URLs don't stop the entire batch
- ✅ **Rate Limiting**: 2-second delay between URL processing (configurable)
- ✅ **Background Processing**: Non-blocking batch execution

## API Endpoints

### 1. Upload Batch Excel File

**Endpoint**: `POST /batch/upload`

**Headers**:
```
X-API-Key: your-api-key
Content-Type: multipart/form-data
```

**Request Body**:
- `file`: Excel file (.xlsx or .xls)

**Excel File Format**:
- First column should contain URLs
- Or use a column named: `url`, `urls`, `link`, `links`, `website`, or `domain`
- Header row is automatically detected and skipped

**Example Excel Structure**:
```
| URL                          |
|------------------------------|
| https://example.com          |
| https://phishing-site.com    |
| https://legitimate-bank.com  |
```

**Response**:
```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_urls": 50,
  "message": "Batch job created successfully. Processing 50 URLs.",
  "status": "success"
}
```

**cURL Example**:
```bash
curl -X POST "http://localhost:8000/batch/upload" \
  -H "X-API-Key: your-api-key" \
  -F "file=@urls.xlsx"
```

---

### 2. Get Batch Status

**Endpoint**: `GET /batch/{batch_id}`

**Headers**:
```
X-API-Key: your-api-key
```

**Response**:
```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "processing",
  "total_urls": 50,
  "processed_urls": 25,
  "successful_urls": 24,
  "failed_urls": 1,
  "created_at": "2025-10-30T17:30:00Z",
  "updated_at": "2025-10-30T17:35:00Z",
  "completed_at": null,
  "job_ids": ["job1", "job2", "job3", ...],
  "failed_items": [
    {
      "url": "https://invalid-url.com",
      "error": "Connection timeout"
    }
  ],
  "progress_percentage": 50.0
}
```

**Batch States**:
- `pending`: Batch created, not yet started
- `processing`: Currently processing URLs
- `completed`: All URLs processed
- `failed`: Batch processing failed
- `cancelled`: Batch was cancelled

**cURL Example**:
```bash
curl -X GET "http://localhost:8000/batch/550e8400-e29b-41d4-a716-446655440000" \
  -H "X-API-Key: your-api-key"
```

---

### 3. List All Batch Jobs

**Endpoint**: `GET /batch`

**Query Parameters**:
- `limit` (optional): Maximum number of batches to return (default: 50, max: 200)

**Headers**:
```
X-API-Key: your-api-key
```

**Response**:
```json
[
  {
    "batch_id": "550e8400-e29b-41d4-a716-446655440000",
    "state": "completed",
    "total_urls": 50,
    "processed_urls": 50,
    "successful_urls": 48,
    "failed_urls": 2,
    "created_at": "2025-10-30T17:30:00Z",
    "updated_at": "2025-10-30T17:45:00Z",
    "completed_at": "2025-10-30T17:45:00Z",
    "progress_percentage": 100.0
  },
  ...
]
```

**cURL Example**:
```bash
curl -X GET "http://localhost:8000/batch?limit=20" \
  -H "X-API-Key: your-api-key"
```

---

### 4. Cancel Batch Job

**Endpoint**: `DELETE /batch/{batch_id}`

**Headers**:
```
X-API-Key: your-api-key
```

**Response**:
```json
{
  "message": "Batch job 550e8400-e29b-41d4-a716-446655440000 cancelled",
  "status": "success"
}
```

**Note**: Only `pending` or `processing` batches can be cancelled. Already queued individual jobs will still be processed.

**cURL Example**:
```bash
curl -X DELETE "http://localhost:8000/batch/550e8400-e29b-41d4-a716-446655440000" \
  -H "X-API-Key: your-api-key"
```

---

## Usage Examples

### Python Example

```python
import requests
import time

API_URL = "http://localhost:8000"
API_KEY = "your-api-key"

# Upload Excel file
with open("urls.xlsx", "rb") as f:
    response = requests.post(
        f"{API_URL}/batch/upload",
        headers={"X-API-Key": API_KEY},
        files={"file": f}
    )

batch_data = response.json()
batch_id = batch_data["batch_id"]
print(f"Batch created: {batch_id}")
print(f"Total URLs: {batch_data['total_urls']}")

# Poll for status
while True:
    status = requests.get(
        f"{API_URL}/batch/{batch_id}",
        headers={"X-API-Key": API_KEY}
    ).json()
    
    print(f"Progress: {status['progress_percentage']:.1f}% "
          f"({status['processed_urls']}/{status['total_urls']})")
    
    if status["state"] in ["completed", "failed", "cancelled"]:
        break
    
    time.sleep(5)  # Check every 5 seconds

print(f"Batch {status['state']}")
print(f"Successful: {status['successful_urls']}")
print(f"Failed: {status['failed_urls']}")

# Get individual job results
for job_id in status["job_ids"]:
    job = requests.get(
        f"{API_URL}/job/{job_id}",
        headers={"X-API-Key": API_KEY}
    ).json()
    print(f"Job {job_id}: {job['state']} - {job['url']}")
```

### JavaScript Example

```javascript
const API_URL = "http://localhost:8000";
const API_KEY = "your-api-key";

// Upload Excel file
async function uploadBatch(file) {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_URL}/batch/upload`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY
    },
    body: formData
  });
  
  return await response.json();
}

// Monitor batch progress
async function monitorBatch(batchId) {
  while (true) {
    const response = await fetch(`${API_URL}/batch/${batchId}`, {
      headers: {
        "X-API-Key": API_KEY
      }
    });
    
    const status = await response.json();
    console.log(`Progress: ${status.progress_percentage}%`);
    
    if (["completed", "failed", "cancelled"].includes(status.state)) {
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Usage
const fileInput = document.getElementById("file-input");
const file = fileInput.files[0];

const batchData = await uploadBatch(file);
console.log(`Batch created: ${batchData.batch_id}`);

const finalStatus = await monitorBatch(batchData.batch_id);
console.log(`Batch ${finalStatus.state}`);
console.log(`Successful: ${finalStatus.successful_urls}`);
console.log(`Failed: ${finalStatus.failed_urls}`);
```

---

## Data Storage

Batch job data is stored in:
```
data/batch_jobs/{batch_id}/
├── status.json      # Current batch status
└── urls.json        # Original URLs and metadata
```

Individual job results are stored in the standard location:
```
data/{domain}/{timestamp}/
├── features.json
├── screenshot.png
├── page.html
└── prediction.json
```

---

## Configuration

### Rate Limiting

Default: 2 seconds between URL processing

To modify, edit the `delay_seconds` parameter in `api.py`:

```python
background_tasks.add_task(
    batch_processor.process_batch,
    batch_id,
    queue,
    delay_seconds=5.0  # 5 second delay
)
```

### Maximum File Size

Configure in your FastAPI settings or reverse proxy (nginx/Apache).

Example nginx configuration:
```nginx
client_max_body_size 50M;
```

---

## Error Handling

### Common Errors

1. **Invalid File Format**
   - Error: `Invalid file format. Please upload an Excel file (.xlsx or .xls)`
   - Solution: Ensure file has `.xlsx` or `.xls` extension

2. **No URLs Found**
   - Error: `No valid URLs found in Excel file`
   - Solution: Ensure URLs are in first column or a column named 'url'

3. **Batch Not Found**
   - Error: `Batch job not found`
   - Solution: Verify batch_id is correct

4. **Cannot Cancel**
   - Error: `Cannot cancel batch job in state: completed`
   - Solution: Only pending/processing batches can be cancelled

### Failed URL Handling

- Failed URLs are recorded in `failed_items` array
- Processing continues for remaining URLs
- Final status shows count of successful vs failed URLs

---

## Best Practices

1. **File Size**: Keep batches under 1000 URLs for optimal performance
2. **Monitoring**: Poll batch status every 5-10 seconds
3. **Error Recovery**: Check `failed_items` for URLs that need retry
4. **Rate Limiting**: Default 2s delay prevents overwhelming target sites
5. **Cleanup**: Old batch data can be manually deleted from `data/batch_jobs/`

---

## Troubleshooting

### Batch Stuck in Processing

Check worker logs:
```bash
tail -f logs/worker.log
```

Verify worker is running:
```bash
ps aux | grep worker
```

### High Memory Usage

Large batches may consume memory. Consider:
- Splitting into smaller batches (< 500 URLs)
- Increasing worker memory limits
- Monitoring with `htop` or similar tools

### Slow Processing

- Check network connectivity
- Verify target sites are responsive
- Consider increasing `delay_seconds` if rate-limited

---

## Future Enhancements

- [ ] CSV file support
- [ ] Batch result export (Excel/CSV)
- [ ] Configurable rate limiting per batch
- [ ] Batch scheduling (cron-like)
- [ ] Email notifications on completion
- [ ] Webhook callbacks for batch events
- [ ] Batch templates (save/reuse URL lists)
