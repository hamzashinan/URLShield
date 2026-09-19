"""
Test script for batch upload functionality
"""

import asyncio
import time
from pathlib import Path

import pandas as pd
import requests

# Configuration
API_URL = "http://localhost:8000"
API_KEY = "dev-key-12345"  # Replace with your actual API key

# Test URLs
TEST_URLS = [
    "https://google.com",
    "https://github.com",
    "https://stackoverflow.com",
    "https://python.org",
    "https://fastapi.tiangolo.com",
]


def create_test_excel():
    """Create a test Excel file with URLs"""
    df = pd.DataFrame({"URL": TEST_URLS})
    
    test_file = Path(__file__).parent / "test_urls.xlsx"
    df.to_excel(test_file, index=False, engine='openpyxl')
    
    print(f"✅ Created test file: {test_file}")
    return test_file


def upload_batch(file_path: Path):
    """Upload Excel file for batch processing"""
    print(f"\n📤 Uploading batch file: {file_path.name}")
    
    with open(file_path, "rb") as f:
        response = requests.post(
            f"{API_URL}/batch/upload",
            headers={"X-API-Key": API_KEY},
            files={"file": ("test_urls.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
    
    if response.status_code != 200:
        print(f"❌ Upload failed: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    print(f"✅ Batch created successfully!")
    print(f"   Batch ID: {data['batch_id']}")
    print(f"   Total URLs: {data['total_urls']}")
    print(f"   Message: {data['message']}")
    
    return data["batch_id"]


def get_batch_status(batch_id: str):
    """Get current batch status"""
    response = requests.get(
        f"{API_URL}/batch/{batch_id}",
        headers={"X-API-Key": API_KEY}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get status: {response.status_code}")
        return None
    
    return response.json()


def monitor_batch(batch_id: str, poll_interval: int = 5):
    """Monitor batch progress until completion"""
    print(f"\n📊 Monitoring batch: {batch_id}")
    print("=" * 60)
    
    start_time = time.time()
    
    while True:
        status = get_batch_status(batch_id)
        
        if not status:
            break
        
        elapsed = time.time() - start_time
        
        # Display progress
        print(f"\r⏱️  Elapsed: {elapsed:.0f}s | "
              f"State: {status['state']} | "
              f"Progress: {status['progress_percentage']:.1f}% | "
              f"Processed: {status['processed_urls']}/{status['total_urls']} | "
              f"Success: {status['successful_urls']} | "
              f"Failed: {status['failed_urls']}", end="")
        
        # Check if completed
        if status["state"] in ["completed", "failed", "cancelled"]:
            print()  # New line
            break
        
        time.sleep(poll_interval)
    
    print("=" * 60)
    return status


def display_results(status: dict):
    """Display final batch results"""
    print(f"\n📋 Final Results:")
    print(f"   State: {status['state'].upper()}")
    print(f"   Total URLs: {status['total_urls']}")
    print(f"   Successful: {status['successful_urls']}")
    print(f"   Failed: {status['failed_urls']}")
    
    if status.get("completed_at"):
        created = status["created_at"]
        completed = status["completed_at"]
        print(f"   Duration: {completed} - {created}")
    
    if status["failed_items"]:
        print(f"\n❌ Failed URLs:")
        for item in status["failed_items"]:
            print(f"   • {item['url']}: {item['error']}")
    
    print(f"\n✅ Job IDs created: {len(status['job_ids'])}")
    if status['job_ids']:
        print(f"   First 5 jobs: {status['job_ids'][:5]}")


def list_all_batches():
    """List all batch jobs"""
    print(f"\n📋 Listing all batch jobs...")
    
    response = requests.get(
        f"{API_URL}/batch?limit=10",
        headers={"X-API-Key": API_KEY}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to list batches: {response.status_code}")
        return
    
    batches = response.json()
    
    if not batches:
        print("   No batch jobs found")
        return
    
    print(f"   Found {len(batches)} batch jobs:")
    for batch in batches:
        print(f"\n   Batch ID: {batch['batch_id']}")
        print(f"   State: {batch['state']}")
        print(f"   URLs: {batch['total_urls']} (Success: {batch['successful_urls']}, Failed: {batch['failed_urls']})")
        print(f"   Created: {batch['created_at']}")


def test_cancel_batch(batch_id: str):
    """Test cancelling a batch"""
    print(f"\n🛑 Attempting to cancel batch: {batch_id}")
    
    response = requests.delete(
        f"{API_URL}/batch/{batch_id}",
        headers={"X-API-Key": API_KEY}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {data['message']}")
    else:
        print(f"❌ Cancel failed: {response.status_code}")
        print(response.text)


def main():
    """Main test function"""
    print("=" * 60)
    print("🧪 Batch Upload Test Script")
    print("=" * 60)
    
    # Step 1: Create test Excel file
    test_file = create_test_excel()
    
    # Step 2: Upload batch
    batch_id = upload_batch(test_file)
    
    if not batch_id:
        print("❌ Test failed: Could not create batch")
        return
    
    # Step 3: Monitor progress
    final_status = monitor_batch(batch_id, poll_interval=3)
    
    # Step 4: Display results
    if final_status:
        display_results(final_status)
    
    # Step 5: List all batches
    list_all_batches()
    
    # Cleanup: Remove test file
    if test_file.exists():
        test_file.unlink()
        print(f"\n🧹 Cleaned up test file: {test_file.name}")
    
    print("\n✅ Test completed!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
