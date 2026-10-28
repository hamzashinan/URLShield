
import type {
  AdminOverviewStats,
  HealthResponse,
  ScrapeRequest,
  ScrapeResponse,
  JobDetail,
  JobsResponse,
  MetricsResponse,
  SystemMonitoringResponse,
  DomainsResponse,
  ScanHistoryResponse,
  BatchUploadResponse,
  TrainingResponse,
  WatchlistMetrics,
  BatchJobStatus,
  User,
  UsersResponse,
  UsersStatsResponse,
  CreateUserRequest,
  UpdateUserRequest,
  BulkUserActionRequest,
  BulkUserActionResponse,
} from '../types/api';

// ------------------------------------------------------
// API ERROR
// ------------------------------------------------------

class APIRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'APIRequestError';
    this.status = status;
  }
}

// ------------------------------------------------------
// API CLIENT
// ------------------------------------------------------

class URLShieldAPIClient {
  private baseURL: string;
  private apiKey: string;
  private timeout = 30000;

  constructor() {
    const defaultBaseURL = 'http://localhost:8080';

    const storedBaseURL = this.getStoredValue('urlshield_api_url');
    const configuredBaseURL =
      import.meta.env.VITE_API_BASE_URL || defaultBaseURL;

    this.baseURL = (
      storedBaseURL || configuredBaseURL
    ).replace(/\/+$/, '');

    const storedApiKey = this.getStoredValue('urlshield_api_key');

    this.apiKey =
      storedApiKey || import.meta.env.VITE_API_KEY || '';
  }

  private getStoredValue(key: string): string {
    try {
      const value = localStorage.getItem(key);

      if (
        !value ||
        value === 'null' ||
        value === 'undefined' ||
        !value.trim()
      ) {
        return '';
      }

      return value.trim();
    } catch {
      return '';
    }
  }

  getConfig() {
    return {
      baseURL: this.baseURL,
      apiKey: this.apiKey,
    };
  }

  
configure(
  configOrBaseURL: {
    baseURL?: string;
    apiKey?: string;
  } | string,
  apiKey?: string
): void {
  const config =
    typeof configOrBaseURL === 'string'
      ? {
          baseURL: configOrBaseURL,
          apiKey,
        }
      : configOrBaseURL;

  if (config.baseURL !== undefined) {
    this.baseURL = config.baseURL.trim().replace(/\/+$/, '');

    try {
      localStorage.setItem('urlshield_api_url', this.baseURL);
    } catch {
      // Configuration remains available in memory.
    }
  }

  if (config.apiKey !== undefined) {
    this.apiKey = config.apiKey.trim();

    try {
      localStorage.setItem('urlshield_api_key', this.apiKey);
    } catch {
      // Configuration remains available in memory.
    }
  }
}


  // ------------------------------------------------------
  // AUTHENTICATION HEADERS
  // ------------------------------------------------------

  private getHeaders(
    options: RequestInit = {},
    isFormData = false
  ): Headers {
    const headers = new Headers(options.headers);

    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.apiKey) {
      headers.set('X-API-Key', this.apiKey);
    }

    const token = this.getStoredValue('urlshield_access_token');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  // ------------------------------------------------------
  // ERROR HANDLING
  // ------------------------------------------------------

  private async getErrorMessage(
    response: Response
  ): Promise<string> {
    const body = await response.json().catch(() => null);

    if (typeof body?.detail === 'string') {
      return body.detail;
    }

    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((item: { msg?: string }) => item.msg || 'Validation error')
        .join(', ');
    }

    if (typeof body?.error === 'string') {
      return body.error;
    }

    if (typeof body?.message === 'string') {
      return body.message;
    }

    return `HTTP ${response.status}: ${response.statusText}`;
  }

  private handleUnauthorized(endpoint: string): never {
    if (endpoint.startsWith('/auth/')) {
      throw new APIRequestError(
        'Invalid email or password.',
        401
      );
    }

    throw new APIRequestError(
      'Authentication failed. Please sign in again.',
      401
    );
  }

  // ------------------------------------------------------
  // GENERIC REQUEST
  // ------------------------------------------------------

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeout
    );

    const isFormData = options.body instanceof FormData;

    try {
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options, isFormData),
        signal: controller.signal,
      });

      if (response.status === 401) {
        this.handleUnauthorized(endpoint);
      }

      if (!response.ok) {
        const message = await this.getErrorMessage(response);

        throw new APIRequestError(
          message,
          response.status
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType =
        response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        return await response.json() as T;
      }

      if (contentType.includes('text/')) {
        return await response.text() as T;
      }

      return await response.blob() as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        'Network error. Please check your connection.'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ------------------------------------------------------
  // RETRY REQUEST
  // ------------------------------------------------------

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error = new Error('Request failed.');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error('Request failed.');

        if (error instanceof APIRequestError) {
          // Never retry client errors.
          if (error.status >= 400 && error.status < 500) {
            throw error;
          }

          // Retry only server errors.
          if (error.status < 500) {
            throw error;
          }
        } else if (
          lastError.message.includes('timeout')
        ) {
          throw lastError;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;

          await new Promise(resolve =>
            setTimeout(resolve, delay)
          );
        }
      }
    }

    throw lastError;
  }

  // ------------------------------------------------------
  // AUTHENTICATION
  // ------------------------------------------------------

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<void> {
    await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });
  }

  async login(
    email: string,
    password: string
  ): Promise<void> {
    const response = await this.request<{
      access_token: string;
      user: { email: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.access_token) {
      throw new Error('Login response did not contain an access token.');
    }

    localStorage.setItem(
      'urlshield_access_token',
      response.access_token
    );

    localStorage.setItem(
      'currentUser',
      response.user.email
    );
  }

  logout(): void {
    localStorage.removeItem('urlshield_access_token');
    localStorage.removeItem('currentUser');
  }

  // ------------------------------------------------------
  // HEALTH
  // ------------------------------------------------------

  async health(): Promise<HealthResponse> {
    return this.request('/health');
  }

  // ------------------------------------------------------
  // URL SCANNING
  // ------------------------------------------------------

  async scrape(
    request: ScrapeRequest
  ): Promise<ScrapeResponse> {
    return this.requestWithRetry('/scrape', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getJob(jobId: string): Promise<JobDetail> {
    return this.request(
      `/job/${encodeURIComponent(jobId)}`
    );
  }

  async listJobs(params?: {
    state?: string;
    limit?: number;
    cursor?: string;
  }): Promise<JobsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.state) {
      searchParams.set('state', params.state);
    }

    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }

    if (params?.cursor) {
      searchParams.set('cursor', params.cursor);
    }

    const query = searchParams.toString();

    return this.request(
      query ? `/jobs?${query}` : '/jobs'
    );
  }

  // ------------------------------------------------------
  // METRICS AND MONITORING
  // ------------------------------------------------------

  async getMetrics(): Promise<MetricsResponse> {
    return this.request('/metrics');
  }

  async getSystemMonitoring(): Promise<SystemMonitoringResponse> {
    return this.request('/system/monitoring');
  }

  async getAdminOverviewStats(): Promise<AdminOverviewStats> {
    return this.request('/admin/overview-stats');
  }

  async getWatchlistMetrics(
    userId?: string
  ): Promise<WatchlistMetrics> {
    const query = userId
      ? `?user_id=${encodeURIComponent(userId)}`
      : '';

    return this.request(`/watchlist/metrics${query}`);
  }

  // ------------------------------------------------------
  // DOMAINS
  // ------------------------------------------------------

  async listDomains(params?: {
    query?: string;
    page?: number;
  }): Promise<DomainsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.query) {
      searchParams.set('query', params.query);
    }

    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }

    const query = searchParams.toString();

    return this.request(
      query ? `/domains?${query}` : '/domains'
    );
  }

  // ------------------------------------------------------
  // SCAN HISTORY
  // ------------------------------------------------------

  async getScanHistory(params?: {
    domain?: string;
    limit?: number;
    offset?: number;
  }): Promise<ScanHistoryResponse> {
    const searchParams = new URLSearchParams();

    if (params?.domain) {
      searchParams.set('domain', params.domain);
    }

    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }

    if (params?.offset !== undefined) {
      searchParams.set('offset', String(params.offset));
    }

    const query = searchParams.toString();

    return this.request(
      query ? `/scan-history?${query}` : '/scan-history'
    );
  }

  async deleteScanHistoryItem(
    domain: string,
    timestamp: string,
    userId?: string
  ): Promise<{ message: string; success: boolean }> {
    const query = userId
      ? `?user_id=${encodeURIComponent(userId)}`
      : '';

    return this.request(
      `/scan-history/${encodeURIComponent(domain)}/${encodeURIComponent(timestamp)}${query}`,
      { method: 'DELETE' }
    );
  }

  async clearScanHistory(
    userId?: string
  ): Promise<{ message: string; success: boolean }> {
    const query = userId
      ? `?user_id=${encodeURIComponent(userId)}`
      : '';

    return this.request(
      `/scan-history${query}`,
      { method: 'DELETE' }
    );
  }

  // ------------------------------------------------------
  // EVIDENCE
  // ------------------------------------------------------

  getEvidenceUrl(
    domain: string,
    timestamp: string,
    artifact: string,
    jobId?: string | null
  ): string {
    const url =
      `${this.baseURL}/evidence/` +
      `${encodeURIComponent(domain)}/` +
      `${encodeURIComponent(timestamp)}/` +
      `${encodeURIComponent(artifact)}`;

    return jobId
      ? `${url}?job_id=${encodeURIComponent(jobId)}`
      : url;
  }

  async captureEvidenceScreenshot(
    domain: string,
    timestamp: string,
    jobId?: string
  ): Promise<{
    success: boolean;
    has_screenshot: boolean;
    size: number;
  }> {
    const query = jobId
      ? `?job_id=${encodeURIComponent(jobId)}`
      : '';

    return this.request(
      `/evidence/${encodeURIComponent(domain)}/${encodeURIComponent(timestamp)}/screenshot/capture${query}`,
      { method: 'POST' }
    );
  }

  // ------------------------------------------------------
  // SERVER-SENT EVENTS
  // ------------------------------------------------------

  createEventSource(): EventSource {
    // Native EventSource does not support custom Authorization
    // or X-API-Key headers. Use only if the backend supports
    // unauthenticated SSE, cookie authentication, or another
    // secure authentication mechanism.
    return new EventSource(`${this.baseURL}/events`);
  }

  // ------------------------------------------------------
  // BATCH UPLOAD
  // ------------------------------------------------------

  async uploadBatch(
    file: File
  ): Promise<BatchUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/batch/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getBatchStatus(
    batchId: string
  ): Promise<BatchJobStatus> {
    return this.request(
      `/batch/${encodeURIComponent(batchId)}`
    );
  }

  async getBatchJobs(
    batchId: string
  ): Promise<JobDetail[]> {
    return this.request(
      `/batch/${encodeURIComponent(batchId)}/jobs`
    );
  }

  async listBatches(
    limit = 50
  ): Promise<BatchJobStatus[]> {
    const params = new URLSearchParams({
      limit: String(limit),
    });

    return this.request(`/batch?${params.toString()}`);
  }

  async cancelBatch(
    batchId: string
  ): Promise<{ message: string; status: string }> {
    return this.request(
      `/batch/${encodeURIComponent(batchId)}`,
      { method: 'DELETE' }
    );
  }

  // ------------------------------------------------------
  // BATCH EXPORT
  // ------------------------------------------------------

  async exportBatch(
    batchId: string,
    applicationId: string,
    sourceOfDetection = 'Automated System',
    cseDomainName = '',
    cseName = ''
  ): Promise<Blob> {
    const params = new URLSearchParams({
      application_id: applicationId,
      source_of_detection: sourceOfDetection,
    });

    if (cseDomainName) {
      params.set('cse_domain_name', cseDomainName);
    }

    if (cseName) {
      params.set('cse_name', cseName);
    }

    const response = await this.fetchBlob(
      `/batch/${encodeURIComponent(batchId)}/export?${params.toString()}`,
      'POST',
      60000
    );

    return response;
  }

  // ------------------------------------------------------
  // FEATURE EXTRACTION
  // ------------------------------------------------------

  async extractFeaturesFromExcel(
    file: File,
    options?: {
      domainColumn?: string;
      legitimateColumn?: string;
    }
  ): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.domainColumn) {
      formData.append('domain_column', options.domainColumn);
    }

    if (options?.legitimateColumn) {
      formData.append('legitimate_column', options.legitimateColumn);
    }

    return this.fetchBlob(
      '/feature-extraction/extract',
      'POST',
      600000,
      formData
    );
  }

  // ------------------------------------------------------
  // MODEL TRAINING
  // ------------------------------------------------------

  async trainModelFromExcel(
    file: File,
    options?: {
      testSize?: string | number;
      randomState?: string | number;
      labelColumn?: string;
      modelFilename?: string;
      dropColumns?: string[];
    }
  ): Promise<TrainingResponse> {
    const formData = new FormData();

    formData.append('train_excel', file);

    if (options?.testSize !== undefined) {
      formData.append('test_size', String(options.testSize));
    }

    if (options?.randomState !== undefined) {
      formData.append('random_state', String(options.randomState));
    }

    if (options?.labelColumn) {
      formData.append('label_column', options.labelColumn);
    }

    if (options?.modelFilename) {
      formData.append('model_filename', options.modelFilename);
    }

    options?.dropColumns?.forEach(column => {
      formData.append('drop_columns', column);
    });

    return this.request(
      '/training/train-from-excel',
      {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(600000),
      }
    );
  }

  // ------------------------------------------------------
  // SHARED BLOB REQUEST
  // ------------------------------------------------------

  private async fetchBlob(
    endpoint: string,
    method: string,
    timeout: number,
    body?: FormData
  ): Promise<Blob> {
    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout
    );

    try {
      const response = await fetch(
        `${this.baseURL}${endpoint}`,
        {
          method,
          headers: this.getHeaders(
            {},
            body instanceof FormData
          ),
          body,
          signal: controller.signal,
        }
      );

      if (response.status === 401) {
        this.handleUnauthorized(endpoint);
      }

      if (!response.ok) {
        throw new APIRequestError(
          await this.getErrorMessage(response),
          response.status
        );
      }

      return await response.blob();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Network error. Please check your connection.');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ------------------------------------------------------
  // ADMIN USER MANAGEMENT
  // ------------------------------------------------------

  async getUsersStats(): Promise<UsersStatsResponse> {
    return this.request('/admin/users/stats');
  }

  async getUsers(options?: {
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<UsersResponse> {
    const params = new URLSearchParams();

    if (options?.role) {
      params.set('role', options.role);
    }

    if (options?.status) {
      params.set('status', options.status);
    }

    if (options?.search) {
      params.set('search', options.search);
    }

    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }

    if (options?.offset !== undefined) {
      params.set('offset', String(options.offset));
    }

    const query = params.toString();

    return this.request(
      query ? `/admin/users?${query}` : '/admin/users'
    );
  }

  async createUser(
    request: CreateUserRequest
  ): Promise<User> {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateUser(
    userId: string,
    request: UpdateUserRequest
  ): Promise<User> {
    return this.request(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(request),
      }
    );
  }

  async deleteUser(
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  }

  async bulkUserAction(
    request: BulkUserActionRequest
  ): Promise<BulkUserActionResponse> {
    return this.request('/admin/users/bulk-action', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

// ------------------------------------------------------
// EXPORT SINGLETON
// ------------------------------------------------------

export const apiClient = new URLShieldAPIClient();

export { URLShieldAPIClient };
