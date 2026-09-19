"""Batch URL processing service for Excel uploads"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from URLshield.config import Settings
from URLshield.logger import get_logger
from URLshield.models import BatchJobState, BatchJobStatus, JobState
from URLshield.queue import JobQueue
from URLshield.utils import mkdir_with_permissions

logger = get_logger(__name__)


class BatchProcessor:
    """Process batch URL uploads from Excel files"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.batch_storage_dir = settings.data_root / "batch_jobs"
        mkdir_with_permissions(self.batch_storage_dir)
        self.active_batches: Dict[str, BatchJobStatus] = {}
        
    def parse_excel_file(self, file_path: Path) -> List[str]:
        """
        Parse Excel file and extract URLs
        
        Supports:
        - .xlsx, .xls files
        - First column should contain URLs
        - Skips header row if detected
        
        Parameters:
        - file_path: Path to Excel file
        
        Returns:
        - List of URLs
        """
        try:
            # Read Excel file - use appropriate engine based on extension
            engine = 'openpyxl' if file_path.suffix == '.xlsx' else 'xlrd'
            df = pd.read_excel(file_path, engine=engine)
            
            # Try to find URL column
            url_column = None
            
            # Look for common URL column names
            url_column_names = ['url', 'urls', 'link', 'links', 'website', 'domain']
            for col in df.columns:
                if str(col).lower() in url_column_names:
                    url_column = col
                    break
            
            # If no named column found, use first column
            if url_column is None:
                url_column = df.columns[0]
            
            # Extract URLs and clean
            urls = df[url_column].dropna().astype(str).tolist()
            
            # Filter out empty strings and non-URL values
            urls = [url.strip() for url in urls if url.strip() and ('http://' in url or 'https://' in url or '.' in url)]
            
            # Add http:// prefix if missing
            cleaned_urls = []
            for url in urls:
                if not url.startswith(('http://', 'https://')):
                    url = 'https://' + url
                cleaned_urls.append(url)
            
            logger.info("excel_parsed", file=str(file_path), url_count=len(cleaned_urls))
            return cleaned_urls
            
        except Exception as e:
            logger.error("excel_parse_error", file=str(file_path), error=str(e))
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
    
    def create_batch_job(self, urls: List[str], filename: str = "batch_upload") -> str:
        """
        Create a new batch job
        
        Parameters:
        - urls: List of URLs to process
        - filename: Original filename for reference
        
        Returns:
        - batch_id: Unique batch job identifier
        """
        batch_id = str(uuid.uuid4())
        
        batch_status = BatchJobStatus(
            batch_id=batch_id,
            state=BatchJobState.PENDING,
            total_urls=len(urls),
            processed_urls=0,
            successful_urls=0,
            failed_urls=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            job_ids=[],
            failed_items=[],
            progress_percentage=0.0
        )
        
        # Store batch status
        self.active_batches[batch_id] = batch_status
        self._save_batch_status(batch_id, batch_status)
        
        # Save URLs to file
        batch_dir = self.batch_storage_dir / batch_id
        mkdir_with_permissions(batch_dir)
        
        urls_file = batch_dir / "urls.json"
        with open(urls_file, 'w') as f:
            json.dump({
                "batch_id": batch_id,
                "filename": filename,
                "urls": urls,
                "created_at": datetime.now(timezone.utc).isoformat()
            }, f, indent=2)
        
        logger.info("batch_created", batch_id=batch_id, url_count=len(urls), filename=filename)
        return batch_id
    
    async def process_batch(self, batch_id: str, queue: JobQueue, delay_seconds: float = 0.0):
        """
        Process batch job sequentially
        
        Parameters:
        - batch_id: Batch job identifier
        - queue: JobQueue instance for creating individual jobs
        - delay_seconds: Delay between processing each URL (rate limiting)
        """
        try:
            # Load batch status
            batch_status = self.get_batch_status(batch_id)
            if not batch_status:
                logger.error("batch_not_found", batch_id=batch_id)
                return
            
            # Load URLs
            batch_dir = self.batch_storage_dir / batch_id
            urls_file = batch_dir / "urls.json"
            
            with open(urls_file, 'r') as f:
                data = json.load(f)
                urls = data['urls']
            
            # Update state to processing
            batch_status.state = BatchJobState.PROCESSING
            batch_status.updated_at = datetime.now(timezone.utc)
            self._save_batch_status(batch_id, batch_status)
            
            logger.info("batch_processing_started", batch_id=batch_id, total_urls=len(urls))
            
            pending_jobs: Dict[str, str] = {}
            
            # OPTIMIZED: Create ALL jobs at once for maximum parallelism
            logger.info("batch_creating_all_jobs", batch_id=batch_id, count=len(urls))
            
            for url in urls:
                try:
                    # Create job for this URL (all at once, no delays)
                    job_id = queue.create_job(url)
                    batch_status.job_ids.append(job_id)
                    pending_jobs[job_id] = url
                    
                except Exception as e:
                    # Record failure but continue processing
                    batch_status.failed_urls += 1
                    batch_status.processed_urls += 1
                    batch_status.failed_items.append({
                        "url": url,
                        "error": str(e)
                    })
                    
                    logger.error("batch_job_creation_failed", 
                                batch_id=batch_id, 
                                url=url, 
                                error=str(e))
            
            # Save batch status after all jobs created
            batch_status.updated_at = datetime.now(timezone.utc)
            self._save_batch_status(batch_id, batch_status)
            
            logger.info("batch_all_jobs_created", 
                       batch_id=batch_id, 
                       total_jobs=len(pending_jobs),
                       failed_to_create=batch_status.failed_urls)
            
            # Wait for all queued jobs to finish processing
            check_interval = max(self.settings.queue_check_interval_ms, 200) / 1000.0
            
            while pending_jobs:
                await asyncio.sleep(check_interval)
                
                for job_id, url in list(pending_jobs.items()):
                    job_status = queue.get_job(job_id)
                    
                    if not job_status:
                        continue
                    
                    if job_status.state == JobState.DONE:
                        batch_status.successful_urls += 1
                        batch_status.processed_urls += 1
                        pending_jobs.pop(job_id)
                        
                        logger.info(
                            "batch_job_completed",
                            batch_id=batch_id,
                            job_id=job_id,
                            url=url,
                            processed=batch_status.processed_urls,
                            total=batch_status.total_urls,
                        )
                        
                    elif job_status.state == JobState.ERROR:
                        batch_status.failed_urls += 1
                        batch_status.processed_urls += 1
                        pending_jobs.pop(job_id)
                        
                        error_message = job_status.error or "Unknown error"
                        batch_status.failed_items.append({
                            "url": url,
                            "error": error_message,
                        })
                        
                        logger.error(
                            "batch_job_failed",
                            batch_id=batch_id,
                            job_id=job_id,
                            url=url,
                            error=error_message,
                        )
                        
                    else:
                        continue
                    
                    batch_status.progress_percentage = (
                        batch_status.processed_urls / batch_status.total_urls * 100
                        if batch_status.total_urls else 0.0
                    )
                    batch_status.updated_at = datetime.now(timezone.utc)
                    self._save_batch_status(batch_id, batch_status)
            
            # Mark batch as completed
            batch_status.state = BatchJobState.COMPLETED
            batch_status.completed_at = datetime.now(timezone.utc)
            batch_status.updated_at = datetime.now(timezone.utc)
            batch_status.progress_percentage = 100.0
            
            self._save_batch_status(batch_id, batch_status)
            
            logger.info("batch_processing_completed", 
                       batch_id=batch_id,
                       total=batch_status.total_urls,
                       successful=batch_status.successful_urls,
                       failed=batch_status.failed_urls)
            
        except Exception as e:
            # Mark batch as failed
            if batch_id in self.active_batches:
                batch_status = self.active_batches[batch_id]
                batch_status.state = BatchJobState.FAILED
                batch_status.updated_at = datetime.now(timezone.utc)
                self._save_batch_status(batch_id, batch_status)
            
            logger.error("batch_processing_failed", batch_id=batch_id, error=str(e))
    
    def get_batch_status(self, batch_id: str) -> Optional[BatchJobStatus]:
        """
        Get batch job status
        
        Parameters:
        - batch_id: Batch job identifier
        
        Returns:
        - BatchJobStatus or None if not found
        """
        # Check in-memory cache first
        if batch_id in self.active_batches:
            return self.active_batches[batch_id]
        
        # Try to load from disk
        status_file = self.batch_storage_dir / batch_id / "status.json"
        if status_file.exists():
            try:
                with open(status_file, 'r') as f:
                    data = json.load(f)
                    batch_status = BatchJobStatus(**data)
                    self.active_batches[batch_id] = batch_status
                    return batch_status
            except Exception as e:
                logger.error("batch_status_load_error", batch_id=batch_id, error=str(e))
        
        return None
    
    def list_batch_jobs(self, limit: int = 50) -> List[BatchJobStatus]:
        """
        List all batch jobs (most recent first)
        
        Parameters:
        - limit: Maximum number of batches to return
        
        Returns:
        - List of BatchJobStatus
        """
        batches = []
        
        # Get all batch directories
        if not self.batch_storage_dir.exists():
            return batches
        
        for batch_dir in sorted(self.batch_storage_dir.iterdir(), reverse=True):
            if not batch_dir.is_dir():
                continue
            
            batch_id = batch_dir.name
            status = self.get_batch_status(batch_id)
            
            if status:
                batches.append(status)
            
            if len(batches) >= limit:
                break
        
        return batches
    
    def _save_batch_status(self, batch_id: str, status: BatchJobStatus):
        """Save batch status to disk"""
        batch_dir = self.batch_storage_dir / batch_id
        mkdir_with_permissions(batch_dir)
        
        status_file = batch_dir / "status.json"
        with open(status_file, 'w') as f:
            json.dump(status.model_dump(mode='json'), f, indent=2, default=str)
        
        # Update in-memory cache
        self.active_batches[batch_id] = status


# Global batch processor instance
_batch_processor: Optional[BatchProcessor] = None


def get_batch_processor(settings: Settings) -> BatchProcessor:
    """Get or create global batch processor instance"""
    global _batch_processor
    if _batch_processor is None:
        _batch_processor = BatchProcessor(settings)
    return _batch_processor

