// YodhaC.Ai API Client
// Handles all backend communication with authentication and error handling

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
  APIError,
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

class YodhaCAPIClient {
  private baseURL: string;
  private apiKey: string;
  private timeout: number = 30000; // 30 seconds

  constructor() {
    const defaultBaseURL = 'http://localhost:8080';
    const defaultApiKey = 'dev-secret-key';

    // Match the backend defaults used by URLShield so the app works immediately
    // without requiring the user to manually configure settings first.
    const storedBaseURL = localStorage.getItem('yodhac_api_url');
    const storedApiKey = localStorage.getItem('yodhac_api_key');

    this.baseURL = storedBaseURL && storedBaseURL !== 'null' && storedBaseURL !== 'undefined'
      ? storedBaseURL
      : import.meta.env.VITE_API_BASE_URL || defaultBaseURL;

    this.apiKey = storedApiKey && storedApiKey.trim() && storedApiKey !== 'null' && storedApiKey !== 'undefined'
      ? storedApiKey
      : import.meta.env.VITE_API_KEY || defaultApiKey;

    // Reset stale cache for the default local backend so the app does not keep
    // using an invalid key from earlier runs while the backend is still on dev-secret-key.
    if (this.baseURL === defaultBaseURL && this.apiKey !== defaultApiKey) {
      this.apiKey = defaultApiKey;
      localStorage.setItem('yodhac_api_key', defaultApiKey);
    }

    if (!this.baseURL || this.baseURL === 'null' || this.baseURL === 'undefined') {
      this.baseURL = defaultBaseURL;
      localStorage.setItem('yodhac_api_url', defaultBaseURL);
    }
  }

  // Update configuration (called from Settings page)
  configure(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    localStorage.setItem('yodhac_api_url', baseURL);
    localStorage.setItem('yodhac_api_key', apiKey);
  }

  // Get current configuration
  getConfig() {
    return {
      baseURL: this.baseURL,
      apiKey: this.apiKey,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your settings.');
        }

        const error: APIError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));

        throw new Error(error.detail);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout. Please try again.');
        }
        throw error;
      }

      throw new Error('Network error. Please check your connection.');
    }
  }

  // Retry logic for 5xx errors
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) or auth errors
        if (lastError.message.includes('401') ||
          lastError.message.includes('400') ||
          lastError.message.includes('404')) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError;
  }

  // API Endpoints

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async scrape(request: ScrapeRequest): Promise<ScrapeResponse> {
    return this.requestWithRetry<ScrapeResponse>('/scrape', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getJob(jobId: string): Promise<JobDetail> {
    return this.request<JobDetail>(`/job/${jobId}`);
  }

  async listJobs(params?: {
    state?: string;
    limit?: number;
    cursor?: string;
  }): Promise<JobsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.state) searchParams.set('state', params.state);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.cursor) searchParams.set('cursor', params.cursor);

    const query = searchParams.toString();
    const endpoint = query ? `/jobs?${query}` : '/jobs';

    return this.request<JobsResponse>(endpoint);
  }

  async getMetrics(): Promise<MetricsResponse> {
    return this.request<MetricsResponse>('/metrics');
  }

  async getSystemMonitoring(): Promise<SystemMonitoringResponse> {
    return this.request<SystemMonitoringResponse>('/system/monitoring');
  }

  async getAdminOverviewStats(): Promise<AdminOverviewStats> {
    return this.request<AdminOverviewStats>('/admin/overview-stats');
  }

  async getWatchlistMetrics(userId?: string): Promise<WatchlistMetrics> {
    const endpoint = userId ? `/watchlist/metrics?user_id=${encodeURIComponent(userId)}` : '/watchlist/metrics';
    return this.request<WatchlistMetrics>(endpoint);
  }

  async listDomains(params?: {
    query?: string;
    page?: number;
  }): Promise<DomainsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set('query', params.query);
    if (params?.page) searchParams.set('page', params.page.toString());

    const query = searchParams.toString();
    const endpoint = query ? `/domains?${query}` : '/domains';

    return this.request<DomainsResponse>(endpoint);
  }

  async getScanHistory(params?: {
    domain?: string;
    limit?: number;
    offset?: number;
  }): Promise<ScanHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params?.domain) searchParams.set('domain', params.domain);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `/scan-history?${query}` : '/scan-history';

    return this.request<ScanHistoryResponse>(endpoint);
  }

  async deleteScanHistoryItem(domain: string, timestamp: string, userId?: string): Promise<{ message: string; success: boolean }> {
    const endpoint = userId
      ? `/scan-history/${encodeURIComponent(domain)}/${encodeURIComponent(timestamp)}?user_id=${encodeURIComponent(userId)}`
      : `/scan-history/${encodeURIComponent(domain)}/${encodeURIComponent(timestamp)}`;

    return this.request<{ message: string; success: boolean }>(endpoint, {
      method: 'DELETE',
    });
  }

  async clearScanHistory(userId?: string): Promise<{ message: string; success: boolean }> {
    const endpoint = userId ? `/scan-history?user_id=${encodeURIComponent(userId)}` : '/scan-history';

    return this.request<{ message: string; success: boolean }>(endpoint, {
      method: 'DELETE',
    });
  }

  // Get evidence artifact URL (for images, HTML, JSON)
  getEvidenceUrl(domain: string, timestamp: string, artifact: string): string {
    return `${this.baseURL}/evidence/${encodeURIComponent(domain)}/${encodeURIComponent(timestamp)}/${encodeURIComponent(artifact)}`;
  }

  async captureEvidenceScreenshot(
    domain: string,
    timestamp: string
  ): Promise<{ success: boolean; has_screenshot: boolean; size: number }> {
    return this.request(
      `/evidence/${encodeURIComponent(domain)}/${encodeURIComponent(timestamp)}/screenshot/capture`,
      { method: 'POST' }
    );
  }

  // SSE connection for real-time updates
  createEventSource(): EventSource {
    const url = `${this.baseURL}/events`;
    const eventSource = new EventSource(url);

    // Note: EventSource doesn't support custom headers
    // The API key needs to be passed via query param or cookie for SSE
    // For now, we'll use polling fallback if SSE fails

    return eventSource;
  }

  // Batch Upload Methods

  async uploadBatch(file: File): Promise<BatchUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/batch/upload`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds for file upload

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your settings.');
        }

        const error: APIError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));

        throw new Error(error.detail);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Upload timeout. Please try again with a smaller file.');
        }
        throw error;
      }

      throw new Error('Network error. Please check your connection.');
    }
  }

  async getBatchStatus(batchId: string): Promise<BatchJobStatus> {
    return this.request<BatchJobStatus>(`/batch/${batchId}`);
  }

  async getBatchJobs(batchId: string): Promise<JobDetail[]> {
    return this.request<JobDetail[]>(`/batch/${batchId}/jobs`);
  }

  async listBatches(limit: number = 50): Promise<BatchJobStatus[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', limit.toString());

    return this.request<BatchJobStatus[]>(`/batch?${searchParams.toString()}`);
  }

  async cancelBatch(batchId: string): Promise<{ message: string; status: string }> {
    return this.request<{ message: string; status: string }>(`/batch/${batchId}`, {
      method: 'DELETE',
    });
  }

  async exportBatch(
    batchId: string,
    applicationId: string,
    sourceOfDetection: string = 'Automated System',
    cseDomainName: string = '',
    cseName: string = ''
  ): Promise<Blob> {
    const searchParams = new URLSearchParams();
    searchParams.set('application_id', applicationId);
    searchParams.set('source_of_detection', sourceOfDetection);
    if (cseDomainName) searchParams.set('cse_domain_name', cseDomainName);
    if (cseName) searchParams.set('cse_name', cseName);

    const url = `${this.baseURL}/batch/${batchId}/export?${searchParams.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your settings.');
        }

        const error: APIError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));

        throw new Error(error.detail);
      }

      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Export timeout. Please try again.');
        }
        throw error;
      }

      throw new Error('Network error. Please check your connection.');
    }
  }

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

    const url = `${this.baseURL}/feature-extraction/extract`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout for feature extraction

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your settings.');
        }

        const errorJson = await response.json().catch(() => null);
        const detail = errorJson?.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(detail);
      }

      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Feature extraction timeout. Please try with fewer URLs.');
        }
        throw error;
      }

      throw new Error('Network error. Please check your connection.');
    }
  }

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
    if (options?.dropColumns && Array.isArray(options.dropColumns)) {
      for (const col of options.dropColumns) {
        formData.append('drop_columns', col);
      }
    }

    const url = `${this.baseURL}/training/train-from-excel`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = (await response.json().catch(() => null)) as TrainingResponse | null;

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your settings.');
        }

        const detail =
          (json && typeof json.error === 'string' && json.error) ||
          (json && (json as unknown as { detail?: string }).detail) ||
          `HTTP ${response.status}: ${response.statusText}`;

        throw new Error(detail);
      }

      if (!json) {
        throw new Error('Empty response from training endpoint.');
      }

      return json;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Training request timeout. Please try again.');
        }
        throw error;
      }

      throw new Error('Network error. Please check your connection.');
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // User Management Methods
  // ──────────────────────────────────────────────────────────────────────

  async getUsersStats(): Promise<UsersStatsResponse> {
    return this.request<UsersStatsResponse>('/admin/users/stats');
  }

  async getUsers(options?: {
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<UsersResponse> {
    const params = new URLSearchParams();
    if (options?.role) params.append('role', options.role);
    if (options?.status) params.append('status', options.status);
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString();
    const url = queryString ? `/admin/users?${queryString}` : '/admin/users';
    return this.request<UsersResponse>(url);
  }

  async createUser(request: CreateUserRequest): Promise<User> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async updateUser(userId: string, request: UpdateUserRequest): Promise<User> {
    return this.request<User>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(request)
    });
  }

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  async bulkUserAction(request: BulkUserActionRequest): Promise<BulkUserActionResponse> {
    return this.request<BulkUserActionResponse>('/admin/users/bulk-action', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }
}

// Export singleton instance
export const apiClient = new YodhaCAPIClient();

// Export class for testing
export { YodhaCAPIClient };
