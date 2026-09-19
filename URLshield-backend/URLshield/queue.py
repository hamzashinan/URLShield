"""Job queue management with on-disk persistence"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

from URLshield.config import Settings
from URLshield.logger import get_logger
from URLshield.models import JobState, JobStatus
from URLshield.utils import mkdir_with_permissions

logger = get_logger(__name__)


class JobQueue:
    """Simple on-disk job queue"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.queue_dir = settings.data_root / ".queue"
        mkdir_with_permissions(self.queue_dir)
        
        # State directories
        self.queued_dir = self.queue_dir / "queued"
        self.running_dir = self.queue_dir / "running"
        self.done_dir = self.queue_dir / "done"
        self.error_dir = self.queue_dir / "error"
        
        for dir_path in [self.queued_dir, self.running_dir, self.done_dir, self.error_dir]:
            mkdir_with_permissions(dir_path)
    
    def _get_job_path(self, job_id: str, state: JobState) -> Path:
        """Get file path for job"""
        state_dir = {
            JobState.QUEUED: self.queued_dir,
            JobState.RUNNING: self.running_dir,
            JobState.DONE: self.done_dir,
            JobState.ERROR: self.error_dir,
        }[state]
        return state_dir / f"{job_id}.json"
    
    def _find_job_file(self, job_id: str) -> Optional[Path]:
        """Find job file across all states"""
        for state in JobState:
            job_path = self._get_job_path(job_id, state)
            if job_path.exists():
                return job_path
        return None
    
    def create_job(
        self,
        url: str,
        *,
        brand_hint: Optional[str] = None,
        legitimate_domain: Optional[str] = None,
        analysis_mode: Optional[str] = "url_only",
    ) -> str:
        """Create a new job"""
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        job_status = JobStatus(
            id=job_id,
            state=JobState.QUEUED,
            url=url,
            brand_hint=brand_hint,
            legitimate_domain=legitimate_domain,
            created_at=now,
            updated_at=now,
            analysis_type=analysis_mode
        )
        
        job_path = self._get_job_path(job_id, JobState.QUEUED)
        job_path.write_text(job_status.model_dump_json(indent=2), encoding="utf-8")
        
        logger.info(
            "job_created",
            job_id=job_id,
            url=url,
            brand_hint=brand_hint,
            legitimate_domain=legitimate_domain,
        )
        return job_id
    
    def get_job(self, job_id: str) -> Optional[JobStatus]:
        """Get job status"""
        job_path = self._find_job_file(job_id)
        if not job_path:
            return None
        
        try:
            data = json.loads(job_path.read_text(encoding="utf-8"))
            return JobStatus(**data)
        except Exception as e:
            logger.error("job_read_failed", job_id=job_id, error=str(e))
            return None
    
    def update_job(
        self,
        job_id: str,
        state: Optional[JobState] = None,
        root: Optional[Path] = None,
        feature_path: Optional[Path] = None,
        error: Optional[str] = None,
        brand_hint: Optional[str] = None,
        legitimate_domain: Optional[str] = None,
        is_partial: bool = False,
        ml_features: Optional[Dict[str, Any]] = None,
        ml_prediction: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update job status"""
        job_status = self.get_job(job_id)
        if not job_status:
            return False
        
        old_state = job_status.state
        
        # Update fields
        if state is not None:
            job_status.state = state
        if root is not None:
            job_status.root = root
        if feature_path is not None:
            job_status.feature_path = feature_path
        if error is not None:
            job_status.error = error
        if brand_hint is not None:
            job_status.brand_hint = brand_hint
        if legitimate_domain is not None:
            job_status.legitimate_domain = legitimate_domain
        if ml_features is not None:
            job_status.ml_features = ml_features
        if ml_prediction is not None:
            job_status.ml_prediction = ml_prediction
        
        if is_partial:
            job_status.is_partial = True
        
        job_status.updated_at = datetime.now(timezone.utc)
        
        # Move file if state changed
        old_path = self._get_job_path(job_id, old_state)
        new_path = self._get_job_path(job_id, job_status.state)
        
        # Write to new location
        new_path.write_text(job_status.model_dump_json(indent=2), encoding="utf-8")
        
        # Remove old file if different
        if old_path != new_path and old_path.exists():
            old_path.unlink()
        
        logger.info(
            "job_updated",
            job_id=job_id,
            old_state=old_state.value,
            new_state=job_status.state.value
        )
        
        return True
    
    def get_queued_jobs(self, limit: int = 100) -> List[JobStatus]:
        """Get queued jobs"""
        jobs = []
        for job_path in sorted(self.queued_dir.glob("*.json"))[:limit]:
            try:
                data = json.loads(job_path.read_text(encoding="utf-8"))
                jobs.append(JobStatus(**data))
            except Exception as e:
                logger.error("job_read_failed", path=str(job_path), error=str(e))
        return jobs

    def claim_next_job(self) -> Optional[JobStatus]:
        """Atomically move a queued job to RUNNING state and return it"""
        for job_path in sorted(self.queued_dir.glob("*.json")):
            job_id = job_path.stem
            running_path = self._get_job_path(job_id, JobState.RUNNING)

            try:
                job_path.replace(running_path)
            except FileNotFoundError:
                continue
            except PermissionError as exc:
                logger.warning("job_claim_permission_denied", job_id=job_id, error=str(exc))
                continue
            except OSError as exc:
                # Another worker may have claimed the job
                logger.debug("job_claim_race", job_id=job_id, error=str(exc))
                continue

            try:
                data = json.loads(running_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.error("job_claim_read_failed", job_id=job_id, error=str(exc))
                if running_path.exists():
                    running_path.unlink()
                continue

            try:
                job_status = JobStatus(**data)
            except Exception as exc:
                logger.error("job_claim_invalid", job_id=job_id, error=str(exc))
                if running_path.exists():
                    running_path.unlink()
                continue

            job_status.state = JobState.RUNNING
            job_status.updated_at = datetime.now(timezone.utc)

            running_path.write_text(job_status.model_dump_json(indent=2), encoding="utf-8")
            logger.info("job_claimed", job_id=job_id)
            return job_status

        return None
    
    def clear_all_jobs(self) -> None:
        """Remove all persisted job files across queue states"""
        self.clear_jobs()

    def clear_jobs(self, state: Optional[JobState] = None) -> None:
        """Remove persisted job files, optionally filtered by state"""
        cleared = 0
        if state:
            state_dirs = [self._get_job_path("", state).parent]
        else:
            state_dirs = [self.queued_dir, self.running_dir, self.done_dir, self.error_dir]
            
        for dir_path in state_dirs:
            for job_file in dir_path.glob("*.json"):
                try:
                    job_file.unlink()
                    cleared += 1
                except FileNotFoundError:
                    continue
                except Exception as exc:
                    logger.warning("job_clear_failed", path=str(job_file), error=str(exc))

        if cleared:
            logger.info("queue_cleared", files_removed=cleared, state=state.value if state else "all")

    def get_jobs_by_state(
        self,
        state: Optional[JobState] = None,
        limit: int = 100,
        cursor: Optional[str] = None
    ) -> List[JobStatus]:
        """Get jobs filtered by state"""
        jobs = []
        
        if state:
            state_dirs = [self._get_job_path("", state).parent]
        else:
            state_dirs = [self.queued_dir, self.running_dir, self.done_dir, self.error_dir]
        
        for state_dir in state_dirs:
            for job_path in sorted(state_dir.glob("*.json"), reverse=True):
                # Simple cursor implementation (skip until cursor)
                if cursor and job_path.stem <= cursor:
                    continue
                
                try:
                    data = json.loads(job_path.read_text(encoding="utf-8"))
                    jobs.append(JobStatus(**data))
                    
                    if len(jobs) >= limit:
                        break
                except Exception as e:
                    logger.error("job_read_failed", path=str(job_path), error=str(e))
            
            if len(jobs) >= limit:
                break
        
        return jobs
    
    def get_queue_length(self) -> int:
        """Get number of queued jobs"""
        return len(list(self.queued_dir.glob("*.json")))

    def get_total_job_count(self) -> int:
        """Get total number of jobs ever processed (DONE + ERROR + RUNNING + QUEUED)"""
        total = 0
        for d in [self.done_dir, self.error_dir, self.running_dir, self.queued_dir]:
            total += len(list(d.glob("*.json")))
        return total
    
    def get_running_count(self) -> int:
        """Get number of running jobs"""
        return len(list(self.running_dir.glob("*.json")))
    
    def recover_stale_jobs(self, timeout_seconds: int = 3600) -> int:
        """Recover jobs stuck in running state"""
        recovered = 0
        now = datetime.now(timezone.utc)
        
        for job_path in self.running_dir.glob("*.json"):
            try:
                data = json.loads(job_path.read_text(encoding="utf-8"))
                job_status = JobStatus(**data)
                
                # Check if job is stale
                elapsed = (now - job_status.updated_at).total_seconds()
                if elapsed > timeout_seconds:
                    # Move back to queued
                    self.update_job(
                        job_status.id,
                        state=JobState.QUEUED,
                        error=f"Recovered from stale running state after {elapsed:.0f}s"
                    )
                    recovered += 1
                    logger.warning("job_recovered", job_id=job_status.id, elapsed=elapsed)
            except Exception as e:
                logger.error("job_recovery_failed", path=str(job_path), error=str(e))
        
        return recovered

