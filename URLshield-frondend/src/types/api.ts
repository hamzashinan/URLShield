// YodhaC.Ai API TypeScript Types
// Matches backend Pydantic models

export interface HealthResponse {
  ok: boolean;
  version: string;
  time: string;
}

export interface ScrapeRequest {
  url?: string;
  urls?: string[];
  brand?: string;
  legitimate_domain?: string;
  analysis_mode?: string;  // Options: "url_only", "full_analysis"
}

export interface ScrapeResponse {
  job_ids: string[];
}

export type JobState = 'queued' | 'running' | 'done' | 'error';

export interface JobDetail {
  id: string;
  state: JobState;
  url: string;
  root: string | null;
  feature_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  brand_hint?: string | null;
  legitimate_domain?: string | null;
  analysis_type?: string | null;
  ml_features?: MLFeatures | null;
  ml_prediction?: MLPrediction | null;
  is_partial?: boolean;
  domain_details?: DomainDetails | null;
}

export interface DomainDetails {
  domain_registration_date?: string | null;
  registrar_name?: string | null;
  registrant_name?: string | null;
  registrant_country?: string | null;
  name_servers: string[];
  hosting_ips: string[];
  hosting_isp?: string | null;
  hosting_country?: string | null;
}

export interface MLFeatures {
  url_length: number;
  domain_length: number;
  path_length: number;
  num_subdomains: number;
  num_dots: number;
  domain_num_hyphens: number;
  num_special_chars: number;
  url_entropy: number;
  is_idn: number;
  brand_word_present: number;
  misleading_keyword_present: number;
  typosquatting_score: number | string;
  brand_position: number | string;
  domain_age_days: number;
  HTTPS: string;
  Is_Tunneling: string | number;
  ttl_avg: number;
  asn_number: number;
  reverse_dns_entropy: number;
  ssim_score: number;
  favicon_similarity_score: number;
  domain?: string;
  url?: string;
}

export interface MLPrediction {
  prediction: string;
  confidence: number;
  risk_score: number;
  probabilities: Record<string, number>;
  reasoning?: string[];
  top_features?: Array<{ feature: string; value: string; importance: number }>;
}

export interface JobSummary {
  id: string;
  state: JobState;
  url: string;
  domain: string;
  created_at: string;
}

export interface JobsResponse {
  items: JobSummary[];
  next_cursor: string | null;
}

export interface MetricsResponse {
  active_alerts: number;
  new_suspected: number;
  evidence_packs: number;
  fp_rate: number;
  queue_len: number;
  total_scans: number;
  total_phishing: number;
  last_24h_counts: Array<{ ts: string; count: number }>;
  attack_types: Record<string, number>;
  geo_distribution: Array<{ country: string; pct: number }>;
  accuracy_history: number[];
  accuracy_labels: string[];
  ml_performance: Record<string, number>;
  forecast_data: number[];
}

export interface ServiceStatus {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  response_time: string;
  last_check: string;
  details: string;
}

export interface ResourceTrend {
  value: number;
  history: number[];
  trend: number;
}

export interface ResourceUsage {
  cpu: ResourceTrend;
  memory: ResourceTrend;
  disk: ResourceTrend;
}

export interface QueueMetrics {
  queue_depth: number;
  active_workers: number;
  jobs_per_minute: number;
  error_rate: number;
  total_queued: number;
  total_running: number;
  total_done: number;
  total_error: number;
}

export interface LogEntry {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export interface SystemMonitoringResponse {
  service_statuses: ServiceStatus[];
  resource_usage: ResourceUsage;
  queue_metrics: QueueMetrics;
  logs: LogEntry[];
  last_checked: string;
  metrics: MetricsResponse;
}

export interface DomainInfo {
  domain: string;
  risk_score: number;
  evidence_count: number;
  first_seen: string;
  last_seen: string;
  favicon_hash: string | null;
}

export interface DomainsResponse {
  items: DomainInfo[];
  total: number;
}

// SSE Event Types
export interface SSEJobUpdate {
  type: 'job_update';
  job_id: string;
  state: JobState;
  domain: string;
}

export interface SSEKPIUpdate {
  type: 'kpi_update';
  metrics: MetricsResponse;
}

export type SSEEvent = SSEJobUpdate | SSEKPIUpdate;

// Feature extraction data (from features.json)
export interface FeatureData {
  input_url: string;
  final_url: string;
  signals: {
    text_length: number;
    form_count: number;
    password_field_count: number;
    email_count: number;
    outlink_count: number;
  };
  extraction: {
    title: string | null;
    forms: Array<{
      action: string;
      method: string;
      fields: string[];
    }>;
    emails: string[];
    outlinks: string[];
  };
  dns: {
    a_records: string[];
    aaaa_records: string[];
    mx_records: string[];
    ns_records: string[];
    txt_records: string[];
  };
  screenshot_hash: string | null;
}

// API Error Response
export interface APIError {
  detail: string;
}

// Scan History
export interface ScanHistoryItem {
  domain: string;
  timestamp: string;
  scan_time: string;
  url: string;
  final_url: string;
  has_screenshot: boolean;
  has_html: boolean;
  form_count: number;
  password_field_count: number;
  email_count: number;
  outlink_count: number;
  title: string | null;
  ml_features?: MLFeatures;
  ml_prediction?: MLPrediction;
  file_sizes?: Record<string, number>;
  is_partial?: boolean;
}

export interface ScanHistoryResponse {
  items: ScanHistoryItem[];
  total: number;
}

// Batch Upload Types
export type BatchJobState = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchJobStatus {
  batch_id: string;
  state: BatchJobState;
  total_urls: number;
  processed_urls: number;
  successful_urls: number;
  failed_urls: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  job_ids: string[];
  failed_items: Array<{
    url: string;
    error: string;
  }>;
  progress_percentage: number;
}

export interface BatchUploadResponse {
  batch_id: string;
  total_urls: number;
  message: string;
  status: string;
}

export interface TrainingResponse {
  success: boolean;
  model_filename?: string;
  accuracy?: number;
  classification_report?: string;
  confusion_matrix?: number[][];
  label_mapping?: Record<string, string>;
  feature_columns?: string[];
  error?: string;
}

export interface WatchlistMetrics {
  activeItems: number;
  escalated: number;
  resolved: number;
}

// ─── Admin Overview Stats ─────────────────────────────────────────────────

export interface AccuracyPoint {
  month: string;
  accuracy: number;
}

export interface ModelPerformanceMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc: number;
  accuracy: number;
  is_estimated: boolean;
}

export interface FPFNStats {
  false_positives: number;
  false_negatives: number;
  fp_trend_pct: number;
  fn_trend_pct: number;
  fp_tip?: string | null;
  is_estimated: boolean;
}

export interface ScanForecastPoint {
  label: string;
  value: number;
  is_forecast: boolean;
}

export interface AdminOverviewStats {
  attack_types: Array<{ label: string; value: number }>;
  geo_distribution: Array<{ country: string; pct: number }>;
  accuracy_history: AccuracyPoint[];
  model_performance: ModelPerformanceMetrics;
  fp_fn_stats: FPFNStats;
  scan_forecast: ScanForecastPoint[];
  phishing_count: number;
  spam_count: number;
  legitimate_count: number;
}

// ─── User Management ──────────────────────────────────────────────────────

export type UserRole = 'Super Admin' | 'Security Admin' | 'Analyst' | 'Viewer' | 'API User';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  last_active: string;
  created_at: string;
  scans_run: number;
  mfa_enabled: boolean;
  avatar?: string;
}

export interface UsersResponse {
  items: User[];
  total: number;
}

export interface UsersStatsResponse {
  total_users: number;
  active_users: number;
  inactive_users: number;
  pending_invites: number;
}

export interface CreateUserRequest {
  email: string;
  role: UserRole;
  name?: string;
}

export interface UpdateUserRequest {
  role?: UserRole;
  status?: UserStatus;
  name?: string;
  mfa_enabled?: boolean;
}

export interface BulkUserActionRequest {
  user_ids: string[];
  action: 'activate' | 'deactivate' | 'delete';
}

export interface BulkUserActionResponse {
  success: boolean;
  affected_count: number;
  failed_ids: string[];
  message: string;
}
