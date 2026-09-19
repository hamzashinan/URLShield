// React hooks for API data fetching

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import type {
  AdminOverviewStats,
  HealthResponse,
  JobsResponse,
  MetricsResponse,
  SystemMonitoringResponse,
  DomainsResponse,
  JobDetail,
  UsersResponse,
  UsersStatsResponse,
} from '../types/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Generic API hook
function useApi<T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}

// Health check hook
export function useHealth() {
  return useApi<HealthResponse>(() => apiClient.health());
}

// Metrics hook with auto-refresh
export function useMetrics(refreshInterval?: number) {
  const result = useApi<MetricsResponse>(() => apiClient.getMetrics());

  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      result.refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, result.refetch]);

  return result;
}

// System monitoring hook with auto-refresh
export function useSystemMonitoring(refreshInterval?: number) {
  const result = useApi<SystemMonitoringResponse>(() => apiClient.getSystemMonitoring());

  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      result.refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, result.refetch]);

  return result;
}

// Admin Overview Stats hook with auto-refresh
export function useAdminOverviewStats(refreshInterval?: number) {
  const result = useApi<AdminOverviewStats>(() => apiClient.getAdminOverviewStats());

  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      result.refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, result.refetch]);

  return result;
}

// Jobs list hook
export function useJobs(params?: {
  state?: string;
  limit?: number;
  cursor?: string;
  autoRefresh?: number;
}) {
  const { state, limit, cursor, autoRefresh } = params || {};

  const result = useApi<JobsResponse>(
    () => apiClient.listJobs({ state, limit, cursor }),
    [state, limit, cursor]
  );

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      result.refetch();
    }, autoRefresh);

    return () => clearInterval(interval);
  }, [autoRefresh, result.refetch]);

  return result;
}

// Single job detail hook
export function useJob(jobId: string | null, pollInterval?: number) {
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getJob(jobId);
      setData(result);

      // Stop polling if job is done or errored
      if (result.state === 'done' || result.state === 'error') {
        return true; // Signal to stop polling
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return true; // Stop polling on error
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();

    if (!pollInterval) return;

    const interval = setInterval(async () => {
      const shouldStop = await fetchJob();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [jobId, pollInterval, fetchJob]);

  return { data, loading, error, refetch: fetchJob };
}

// Users hook with auto-refresh
export function useUsers(options?: {
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  refreshInterval?: number;
}) {
  const result = useApi<UsersResponse>(
    () => apiClient.getUsers({
      role: options?.role,
      status: options?.status,
      search: options?.search,
      limit: options?.limit,
      offset: options?.offset,
    })
  );

  useEffect(() => {
    if (!options?.refreshInterval) return;

    const interval = setInterval(() => {
      result.refetch();
    }, options.refreshInterval);

    return () => clearInterval(interval);
  }, [options?.refreshInterval, result.refetch]);

  return result;
}

// Users stats hook with auto-refresh
export function useUsersStats(refreshInterval?: number) {
  const result = useApi<UsersStatsResponse>(() => apiClient.getUsersStats());

  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      result.refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, result.refetch]);

  return result;
}

// Domains list hook
export function useDomains(params?: {
  query?: string;
  page?: number;
}) {
  const { query, page } = params || {};

  return useApi<DomainsResponse>(
    () => apiClient.listDomains({ query, page }),
    [query, page]
  );
}

// Submit URLs hook
export function useSubmitUrls() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);

  const submit = async (urls: string | string[]) => {
    try {
      setLoading(true);
      setError(null);

      const request = Array.isArray(urls)
        ? { urls }
        : { url: urls };

      const response = await apiClient.scrape(request);
      setJobIds(response.job_ids);

      return response.job_ids;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit URLs';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error, jobIds };
}
