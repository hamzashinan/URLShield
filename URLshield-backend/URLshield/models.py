"""Data models for URLShield"""

from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl, field_serializer, ConfigDict, model_serializer


class JobState(str, Enum):
    """Job execution states"""
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


class ScrapeRequest(BaseModel):
    """Request to scrape URLs"""
    url: Optional[str] = None
    urls: Optional[List[str]] = None
    brand: Optional[str] = None
    legitimate_domain: Optional[str] = None
    analysis_type: Optional[str] = "full"  # Options: "url_only", "full"
    analysis_mode: Optional[str] = "full_analysis"  # Options: "url_only", "full_analysis"
    
    def get_urls(self) -> List[str]:
        """Get all URLs from request"""
        if self.urls:
            return self.urls
        elif self.url:
            return [self.url]
        return []


class ScrapeResponse(BaseModel):
    """Response from scrape request"""
    job_ids: List[str]


class HealthResponse(BaseModel):
    """Health check response"""
    ok: bool
    version: str
    time: datetime


class DomainDetails(BaseModel):
    """Domain registration and hosting details"""
    domain_registration_date: Optional[str] = None
    registrar_name: Optional[str] = None
    registrant_name: Optional[str] = None
    registrant_country: Optional[str] = None
    name_servers: List[str] = Field(default_factory=list)
    hosting_ips: List[str] = Field(default_factory=list)
    hosting_isp: Optional[str] = None
    hosting_country: Optional[str] = None


class JobStatus(BaseModel):
    """Job status information"""
    id: str
    state: JobState
    url: Optional[str] = None
    brand_hint: Optional[str] = None
    legitimate_domain: Optional[str] = None
    root: Optional[Path] = None
    feature_path: Optional[Path] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    ml_features: Optional[Dict[str, Any]] = None  # ML features if job is done
    ml_prediction: Optional[Dict[str, Any]] = None  # ML prediction if job is done
    analysis_type: Optional[str] = None  # 'full' or 'url_only'
    is_partial: bool = False  # True if fallback to URL-only occurred
    domain_details: Optional[DomainDetails] = None


class JobSummary(BaseModel):
    """Summary information for job listing"""
    id: str
    state: JobState
    url: str
    domain: str
    created_at: datetime
    updated_at: datetime


class JobsResponse(BaseModel):
    """Response for jobs listing"""
    items: List[JobSummary]
    next_cursor: Optional[str] = None


class MetricsResponse(BaseModel):
    """System metrics response"""
    active_alerts: int
    new_suspected: int
    evidence_packs: int
    fp_rate: float
    queue_len: int
    total_scans: int
    total_phishing: int
    last_24h_counts: List[Dict[str, Any]]
    attack_types: Dict[str, int] = Field(default_factory=dict)
    geo_distribution: List[Dict[str, Any]] = Field(default_factory=list)
    accuracy_history: List[float] = Field(default_factory=list)
    accuracy_labels: List[str] = Field(default_factory=list)
    ml_performance: Dict[str, float] = Field(default_factory=dict)
    forecast_data: List[int] = Field(default_factory=list)


class ServiceStatus(BaseModel):
    id: str
    name: str
    status: str
    uptime: str
    response_time: str
    last_check: str
    details: str


class ResourceTrend(BaseModel):
    value: float
    history: List[float]
    trend: float


class ResourceUsage(BaseModel):
    cpu: ResourceTrend
    memory: ResourceTrend
    disk: ResourceTrend


class QueueMetrics(BaseModel):
    queue_depth: int
    active_workers: int
    jobs_per_minute: float
    error_rate: float
    total_queued: int
    total_running: int
    total_done: int
    total_error: int


class LogEntry(BaseModel):
    time: str
    level: str
    message: str


class SystemMonitoringResponse(BaseModel):
    service_statuses: List[ServiceStatus]
    resource_usage: ResourceUsage
    queue_metrics: QueueMetrics
    logs: List[LogEntry]
    last_checked: datetime
    metrics: MetricsResponse


class DomainRow(BaseModel):
    """Domain information row"""
    domain: str
    favicon_hash: Optional[str] = None
    risk_score: float
    first_seen: datetime
    last_seen: datetime
    evidence_count: int


class DomainsResponse(BaseModel):
    """Response for domains listing"""
    items: List[DomainRow]
    total: int


class DNSInfo(BaseModel):
    """DNS information"""
    a_records: List[str] = []
    aaaa_records: List[str] = []
    mx_records: List[str] = []
    ns_records: List[str] = []
    txt_records: List[str] = []
    cname_records: List[str] = []
    ttl_avg: Optional[float] = None  # Average TTL across all records


class RDAPInfo(BaseModel):
    """RDAP/WHOIS information"""
    registrar: Optional[str] = None
    creation_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None
    name_servers: List[str] = []
    status: List[str] = []


class DOMSignals(BaseModel):
    """DOM-based signals"""
    text_length: int
    form_count: int
    password_field_count: int
    email_mentions: int
    outlink_count: int
    outlinks: List[str] = Field(default_factory=list, max_length=200)


class ScrapedData(BaseModel):
    """Complete scraped data"""
    job_id: str
    input_url: str
    final_url: str
    status_code: int
    headers: Dict[str, str]
    html_path: Path
    screenshot_path: Optional[Path] = None
    screenshot_hash: Optional[str] = None
    dns_info: DNSInfo
    rdap_info: Optional[RDAPInfo] = None
    dom_signals: DOMSignals
    ct_log_count: int = 0  # Stub for future
    registered_domain: str
    scraped_at: datetime
    duration_ms: float
    is_partial: bool = False


class Features(BaseModel):
    """Engineered features for analysis"""
    input_url: str
    final_url: str
    signals: Dict[str, Any]
    extraction: Dict[str, Any]
    engineered_features: Dict[str, Any]
    artifact_paths: Dict[str, str]
    metadata: Dict[str, Any]


class EventType(str, Enum):
    """Server-Sent Event types"""
    JOB_UPDATE = "job_update"
    KPI_UPDATE = "kpi_update"


class JobUpdateEvent(BaseModel):
    """Job status update event"""
    type: EventType = EventType.JOB_UPDATE
    id: str
    state: JobState
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KPIUpdateEvent(BaseModel):
    """KPI metrics update event"""
    type: EventType = EventType.KPI_UPDATE
    metrics: MetricsResponse
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScanHistoryItem(BaseModel):
    """Scan history item from data directory"""
    model_config = ConfigDict(ser_json_timedelta='iso8601')
    
    domain: str
    timestamp: str
    scan_time: str  # Changed from datetime to str to have full control
    url: str
    final_url: str
    has_screenshot: bool
    has_html: bool
    form_count: int
    password_field_count: int
    email_count: int
    outlink_count: int
    title: Optional[str] = None
    
    # ML Features (all 22 features passed to the model)
    ml_features: Optional[Dict[str, Any]] = None
    
    # ML Prediction Result
    ml_prediction: Optional[Dict[str, Any]] = None
    
    # File metadata
    file_sizes: Dict[str, int] = Field(default_factory=dict)
    is_partial: bool = False


class ScanHistoryResponse(BaseModel):
    """Response for scan history listing"""
    items: List[ScanHistoryItem]
    total: int


class BatchJobState(str, Enum):
    """Batch job execution states"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BatchJobStatus(BaseModel):
    """Status of a batch job"""
    batch_id: str
    state: BatchJobState
    total_urls: int
    processed_urls: int
    successful_urls: int
    failed_urls: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    job_ids: List[str] = Field(default_factory=list)
    failed_items: List[Dict[str, str]] = Field(default_factory=list)  # {url, error}
    progress_percentage: float = 0.0


class BatchUploadResponse(BaseModel):
    """Response from batch upload"""
    batch_id: str
    total_urls: int
    message: str
    status: str


class WatchlistMetricsResponse(BaseModel):
    """Metrics for the watchlist dashboard"""
    activeItems: int
    escalated: int
    resolved: int


class ModelPerformanceMetrics(BaseModel):
    """ML model performance metrics"""
    precision: float
    recall: float
    f1_score: float
    auc_roc: float
    accuracy: float
    is_estimated: bool = True


class FPFNStats(BaseModel):
    """False positive/negative statistics"""
    false_positives: int
    false_negatives: int
    fp_trend_pct: float
    fn_trend_pct: float
    fp_tip: Optional[str] = None
    is_estimated: bool = True


class ScanForecastPoint(BaseModel):
    """Scan volume forecast data point"""
    label: str
    value: int
    is_forecast: bool


class AccuracyPoint(BaseModel):
    """Accuracy history data point"""
    month: str
    accuracy: float


class AdminOverviewStats(BaseModel):
    """Comprehensive stats for the Admin Overview dashboard"""
    attack_types: List[Dict[str, Any]]
    geo_distribution: List[Dict[str, Any]]
    accuracy_history: List[AccuracyPoint]
    model_performance: ModelPerformanceMetrics
    fp_fn_stats: FPFNStats
    scan_forecast: List[ScanForecastPoint]
    phishing_count: int
    spam_count: int
    legitimate_count: int


# ============================================================================
# User Management Models
# ============================================================================

class UserRole(str, Enum):
    """User roles"""
    SUPER_ADMIN = "Super Admin"
    SECURITY_ADMIN = "Security Admin"
    ANALYST = "Analyst"
    VIEWER = "Viewer"
    API_USER = "API User"


class UserStatus(str, Enum):
    """User account status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class User(BaseModel):
    """User account information"""
    id: str
    name: str
    email: str
    role: UserRole
    status: UserStatus
    last_active: str  # e.g., "2 min ago", "1 hour ago", "Never"
    created_at: str  # ISO format or "YYYY-MM-DD"
    scans_run: int
    mfa_enabled: bool
    avatar: Optional[str] = None


class UsersResponse(BaseModel):
    """Response for users listing"""
    items: List[User]
    total: int


class UsersStatsResponse(BaseModel):
    """Stats response for user dashboard"""
    total_users: int
    active_users: int
    inactive_users: int
    pending_invites: int


class CreateUserRequest(BaseModel):
    """Request to create/invite a user"""
    email: str
    role: UserRole
    name: Optional[str] = None


class UpdateUserRequest(BaseModel):
    """Request to update a user"""
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    name: Optional[str] = None
    mfa_enabled: Optional[bool] = None


class BulkUserActionRequest(BaseModel):
    """Request for bulk user operations"""
    user_ids: List[str]
    action: str  # "activate", "deactivate", "delete"


class BulkUserActionResponse(BaseModel):
    """Response from bulk user operations"""
    success: bool
    affected_count: int
    failed_ids: List[str] = Field(default_factory=list)
    message: str


