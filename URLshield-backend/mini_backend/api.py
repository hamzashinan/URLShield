"""Lightweight URL analysis API for fast local inference."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from URLshield import feature_extraction, predictor


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_ROOT / "models"
API_KEY = os.getenv("URLSHIELD_API_KEY", "dev-secret-key")
VERSION = "1.0.0-mini"

app = FastAPI(title="URLShield Mini API", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("URLSHIELD_ALLOW_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_jobs: Dict[str, Dict[str, Any]] = {}
_history: List[Dict[str, Any]] = []


class AnalyzeRequest(BaseModel):
    url: str = Field(min_length=1)
    brand: Optional[str] = None
    legitimate_domain: Optional[str] = None


class ScrapeRequest(AnalyzeRequest):
    urls: Optional[List[str]] = None
    analysis_type: Optional[str] = "url_only"
    analysis_mode: Optional[str] = "url_only"


def verify_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def artifact_status() -> bool:
    return all(
        (MODEL_DIR / name).exists()
        for name in ("xgboost_phishing_model.pkl", "label_encoder.pkl", "scaler.pkl")
    )


def normalize_url(value: str) -> str:
    value = value.strip()
    if not value:
        raise HTTPException(status_code=422, detail="URL is required")
    return value if value.startswith(("http://", "https://")) else f"https://{value}"


def domain_for(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def analyze_url(request: AnalyzeRequest) -> Dict[str, Any]:
    url = normalize_url(request.url)
    if not artifact_status():
        raise RuntimeError("ML model artifacts are unavailable")

    features = feature_extraction.feature_row_from_url(
        url,
        verbose=False,
        legitimate_domain=request.legitimate_domain,
    )
    features = features or {}
    features["input_url"] = url
    prediction = predictor.predict_from_features(features)
    if prediction is None:
        prediction = {"prediction": "unknown", "confidence": 0.0, "risk_score": 0.5}

    now = datetime.now(timezone.utc).isoformat()
    return {
        "url": url,
        "domain": domain_for(url),
        "scan_time": now,
        "ml_features": features,
        "ml_prediction": prediction,
        "domain_details": None,
    }


async def process_job(job_id: str, request: AnalyzeRequest) -> None:
    _jobs[job_id]["state"] = "running"
    try:
        result = await asyncio.to_thread(analyze_url, request)
        _jobs[job_id].update(result, state="done", updated_at=datetime.now(timezone.utc).isoformat())
        _history.insert(0, {"id": job_id, **result})
        del _history[50:]
    except Exception as exc:
        _jobs[job_id].update(
            state="error",
            error=str(exc),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "version": VERSION, "time": datetime.now(timezone.utc).isoformat()}


@app.get("/model/status", dependencies=[Depends(verify_api_key)])
async def model_status() -> Dict[str, bool]:
    return {"model_available": artifact_status()}


@app.post("/analyze", dependencies=[Depends(verify_api_key)])
async def analyze(request: AnalyzeRequest) -> Dict[str, Any]:
    return await asyncio.to_thread(analyze_url, request)


@app.post("/scrape", dependencies=[Depends(verify_api_key)])
async def scrape(request: ScrapeRequest, background_tasks: BackgroundTasks) -> Dict[str, List[str]]:
    urls = request.urls or [request.url]
    job_ids = []
    for value in urls:
        job_id = f"mini-{uuid.uuid4().hex}"
        job_request = AnalyzeRequest(
            url=value,
            brand=request.brand,
            legitimate_domain=request.legitimate_domain,
        )
        now = datetime.now(timezone.utc).isoformat()
        _jobs[job_id] = {
            "id": job_id,
            "state": "queued",
            "url": normalize_url(value),
            "created_at": now,
            "updated_at": now,
        }
        background_tasks.add_task(process_job, job_id, job_request)
        job_ids.append(job_id)
    return {"job_ids": job_ids}


@app.get("/job/{job_id}", dependencies=[Depends(verify_api_key)])
async def get_job(job_id: str) -> Dict[str, Any]:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/scan-history", dependencies=[Depends(verify_api_key)])
async def scan_history(limit: int = Query(default=20, ge=1, le=100)) -> Dict[str, Any]:
    return {"items": _history[:limit], "next_cursor": None}


@app.get("/keywords/brands", dependencies=[Depends(verify_api_key)])
async def brand_keywords() -> Dict[str, List[Dict[str, str]]]:
    return {"brand_mappings": []}
