"""Background worker for processing scrape jobs"""

import asyncio
import shutil
from datetime import datetime
from typing import Dict

from URLshield.config import Settings
from URLshield.logger import get_logger
from URLshield.models import JobState
from URLshield.queue import JobQueue
from URLshield.scraper import Scraper
from URLshield.utils import mkdir_with_permissions

logger = get_logger(__name__)


class RateLimiter:
    """Per-host rate limiter"""
    
    def __init__(self, requests_per_second: int):
        self.requests_per_second = requests_per_second
        self.enabled = requests_per_second > 0
        self.last_request: Dict[str, datetime] = {}
    
    async def acquire(self, host: str):
        """Wait if necessary to respect rate limit"""
        if not self.enabled:
            return
        
        if host in self.last_request:
            elapsed = (datetime.now(timezone.utc) - self.last_request[host]).total_seconds()
            wait_time = (1.0 / self.requests_per_second) - elapsed
            if wait_time > 0:
                await asyncio.sleep(wait_time)
        
        self.last_request[host] = datetime.now(timezone.utc)


class Worker:
    """Background worker for processing jobs"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.queue = JobQueue(settings)
        self.rate_limiter = RateLimiter(settings.rate_limit_per_host)
        self.running = False
        self._tasks = []

    def _cleanup_persistent_state(self) -> None:
        """Remove persisted queue files and stored job artifacts before startup."""
        try:
            self.queue.clear_all_jobs()
        except Exception as exc:
            logger.warning("queue_cleanup_failed", error=str(exc))

        kept_directories = {".queue"}

        for path in self.settings.data_root.iterdir():
            if path.name in kept_directories:
                continue

            if path.is_dir():
                try:
                    shutil.rmtree(path, ignore_errors=True)
                    logger.debug("storage_directory_removed", path=str(path))
                except Exception as exc:
                    logger.warning("storage_directory_remove_failed", path=str(path), error=str(exc))
            else:
                try:
                    path.unlink()
                    logger.debug("storage_file_removed", path=str(path))
                except FileNotFoundError:
                    continue
                except Exception as exc:
                    logger.warning("storage_file_remove_failed", path=str(path), error=str(exc))

    async def start(self):
        """Start the worker"""
        self.running = True
        if self.settings.cleanup_on_start:
            self._cleanup_persistent_state()
        logger.info("worker_started", concurrency=self.settings.worker_concurrency)
        
        # Recover stale jobs
        recovered = self.queue.recover_stale_jobs()
        if recovered > 0:
            logger.info("stale_jobs_recovered", count=recovered)
        
        # Start worker tasks
        async with Scraper(self.settings) as scraper:
            self._tasks = [
                asyncio.create_task(self._worker_loop(scraper, i))
                for i in range(self.settings.worker_concurrency)
            ]
            
            # Wait for all tasks
            await asyncio.gather(*self._tasks, return_exceptions=True)
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
        logger.info("worker_stopping")
        
        # Cancel all tasks
        for task in self._tasks:
            task.cancel()
        
        # Wait for cancellation
        await asyncio.gather(*self._tasks, return_exceptions=True)
        logger.info("worker_stopped")
    
    async def _worker_loop(self, scraper: Scraper, worker_id: int):
        """Main worker loop"""
        logger.info("worker_loop_started", worker_id=worker_id)
        
        while self.running:
            try:
                # Claim next job atomically
                job_status = self.queue.claim_next_job()

                if not job_status:
                    # No jobs, wait and retry
                    await asyncio.sleep(self.settings.queue_check_interval_ms / 1000.0)
                    continue

                # Extract host for rate limiting
                from urllib.parse import urlparse
                parsed = urlparse(job_status.url)
                host = parsed.netloc
                
                # Wait for rate limit
                await self.rate_limiter.acquire(host)
                
                # Process job with timeout (5 minutes max per job)
                try:
                    scraped_data = await asyncio.wait_for(
                        scraper.scrape_url(
                            job_status.id,
                            job_status.url,
                            brand_hint=job_status.brand_hint,
                            legitimate_domain=job_status.legitimate_domain,
                            analysis_mode=job_status.analysis_type,
                        ),
                        timeout=300.0  # 5 minutes timeout
                    )
                    
                    # Run ML prediction if model is available and analysis type is full
                    logger.info(
                        "checking_ml_prediction",
                        worker_id=worker_id,
                        job_id=job_status.id,
                        analysis_type=job_status.analysis_type
                    )
                    
                    # Initialize ML data variables
                    ml_features_data = None
                    ml_prediction_data = None
                    
                    if job_status.analysis_type == "full":
                        logger.info(
                            "starting_ml_prediction",
                            worker_id=worker_id,
                            job_id=job_status.id
                        )
                        try:
                            from URLshield.predictor import PhishingModelPredictor
                            predictor = PhishingModelPredictor(
                                model_path="models/xgboost_phishing_model.pkl",
                                label_encoder_path="models/label_encoder.pkl",
                                scaler_path="models/scaler.pkl"
                            )
                            logger.info(
                                "ml_predictor_created",
                                worker_id=worker_id,
                                job_id=job_status.id
                            )
                            
                            # Load features and run prediction
                            feature_path = (
                                scraped_data.screenshot_path.parent
                                if scraped_data.screenshot_path
                                else scraped_data.html_path.parent
                            ) / "features.json"
                            if feature_path.exists():
                                import json
                                with open(feature_path, 'r') as f:
                                    features_data = json.load(f)
                                
                                # Extract features for ML model
                                from URLshield import feature_extraction
                                ml_features = feature_extraction.feature_row_from_url(
                                    job_status.url, 
                                    verbose=False, 
                                    legitimate_domain=job_status.legitimate_domain
                                )
                                
                                if ml_features:
                                    # Run prediction
                                    prediction_result = predictor.predict_from_features_dict(ml_features)
                                    
                                    # Add ML prediction to features.json and store in variables
                                    features_data["ml_features"] = ml_features
                                    features_data["ml_prediction"] = prediction_result
                                    ml_features_data = ml_features
                                    ml_prediction_data = prediction_result
                                    
                                    # Save updated features with ML data (handle datetime serialization)
                                    import json
                                    class DateTimeEncoder(json.JSONEncoder):
                                        def default(self, obj):
                                            if hasattr(obj, 'isoformat'):
                                                return obj.isoformat()
                                            return super().default(obj)
                                    
                                    with open(feature_path, 'w') as f:
                                        json.dump(features_data, f, indent=2, cls=DateTimeEncoder)
                                    
                                    logger.info(
                                        "ml_prediction_completed",
                                        worker_id=worker_id,
                                        job_id=job_status.id,
                                        prediction=prediction_result.get("prediction"),
                                        confidence=prediction_result.get("confidence", 0)
                                    )
                        except Exception as ml_error:
                            logger.warning(
                                "ml_prediction_failed",
                                worker_id=worker_id,
                                job_id=job_status.id,
                                error=str(ml_error)
                            )
                    
                    # Mark as done safely
                    root_dir = (
                        scraped_data.screenshot_path.parent
                        if scraped_data.screenshot_path
                        else scraped_data.html_path.parent
                    )

                    self.queue.update_job(
                        job_status.id,
                        state=JobState.DONE,
                        root=root_dir,
                        feature_path=root_dir / "features.json",
                        ml_features=ml_features_data,
                        ml_prediction=ml_prediction_data
                    )
                    
                    logger.info(
                        "job_completed",
                        worker_id=worker_id,
                        job_id=job_status.id,
                        url=job_status.url
                    )
                
                except asyncio.TimeoutError:
                    # Job timed out after 5 minutes
                    error_msg = f"Job timeout after 300 seconds"
                    logger.warning(
                        "job_timeout",
                        worker_id=worker_id,
                        job_id=job_status.id,
                        url=job_status.url,
                        timeout_seconds=300
                    )
                    # Fall through to URL-only analysis
                    raise Exception(error_msg)
                    
                except Exception as e:
                    # Try URL-only analysis when website is unreachable
                    error_msg = f"{type(e).__name__}: {str(e)}"
                    
                    try:
                        logger.info(
                            "attempting_url_only_analysis",
                            worker_id=worker_id,
                            job_id=job_status.id,
                            url=job_status.url,
                            error=error_msg
                        )
                        
                        # Create output directory with explicit permissions
                        from pathlib import Path
                        import tldextract
                        from datetime import datetime, timezone
                        ext = tldextract.extract(job_status.url)
                        registered_domain = ext.registered_domain or "unknown"
                        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
                        output_dir = self.settings.data_root / registered_domain / timestamp
                        mkdir_with_permissions(output_dir)
                        
                        # Run URL-only analysis with timeout (2 minutes)
                        scraped_data = await asyncio.wait_for(
                            scraper.analyze_url_only(
                                job_status.id,
                                job_status.url,
                                output_dir,
                                error_msg,
                                brand_hint=job_status.brand_hint,
                                legitimate_domain=job_status.legitimate_domain,
                            ),
                            timeout=120.0  # 2 minutes timeout for URL-only analysis
                        )
                        
                        # Mark as done with URL-only analysis
                        self.queue.update_job(
                            job_status.id,
                            state=JobState.DONE,
                            root=output_dir,
                            feature_path=output_dir / "features.json",
                            is_partial=True
                        )
                        
                        logger.info(
                            "url_only_analysis_success",
                            worker_id=worker_id,
                            job_id=job_status.id,
                            url=job_status.url
                        )
                    except Exception as url_only_error:
                        # If URL-only analysis also fails, mark as error
                        self.queue.update_job(
                            job_status.id,
                            state=JobState.ERROR,
                            error=error_msg
                        )
                        
                        logger.error(
                            "job_failed",
                            worker_id=worker_id,
                            job_id=job_status.id,
                            url=job_status.url,
                            error=error_msg,
                            url_only_error=str(url_only_error)
                        )
            
            except asyncio.CancelledError:
                logger.info("worker_loop_cancelled", worker_id=worker_id)
                break
            except Exception as e:
                logger.error(
                    "worker_loop_error",
                    worker_id=worker_id,
                    error=str(e)
                )
                await asyncio.sleep(5)  # Back off on error
        
        logger.info("worker_loop_stopped", worker_id=worker_id)


async def run_worker(settings: Settings):
    """Run the worker process"""
    worker = Worker(settings)
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("worker_interrupted")
    finally:
        await worker.stop()


