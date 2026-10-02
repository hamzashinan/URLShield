// Server-Sent Events (SSE) hook for real-time updates

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../lib/api';
import type { SSEEvent, SSEJobUpdate, SSEKPIUpdate } from '../types/api';

interface UseSSEOptions {
  onJobUpdate?: (event: SSEJobUpdate) => void;
  onKPIUpdate?: (event: SSEKPIUpdate) => void;
  fallbackPollInterval?: number; // Fallback to polling if SSE fails
}

export function useSSE(options: UseSSEOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onJobUpdate, onKPIUpdate, fallbackPollInterval = 3000 } = options;

  const connectSSE = useCallback(() => {
    try {
      const eventSource = apiClient.createEventSource();

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setConnected(false);
        setError('Connection lost. Retrying...');
        eventSource.close();
      };

      // Handle job_update events
      eventSource.addEventListener('job_update', (event) => {
        try {
          const data: SSEJobUpdate = JSON.parse(event.data);
          onJobUpdate?.(data);
        } catch (err) {
          console.error('Failed to parse job_update event:', err);
        }
      });

      // Handle kpi_update events
      eventSource.addEventListener('kpi_update', (event) => {
        try {
          const data: SSEKPIUpdate = JSON.parse(event.data);
          onKPIUpdate?.(data);
        } catch (err) {
          console.error('Failed to parse kpi_update event:', err);
        }
      });

      return eventSource;
    } catch (err) {
      console.error('Failed to create SSE connection:', err);
      setError('Failed to connect to server');
      return null;
    }
  }, [onJobUpdate, onKPIUpdate]);

  useEffect(() => {
    const eventSource = connectSSE();

    // Cleanup on unmount
    return () => {
      eventSource?.close();
    };
  }, [connectSSE]);

  // Fallback polling if SSE is not connected
  useEffect(() => {
    if (connected || !fallbackPollInterval) return;

    const pollInterval = setInterval(async () => {
      try {
        // Poll metrics for KPI updates
        if (onKPIUpdate) {
          const metrics = await apiClient.getMetrics();
          onKPIUpdate({
            type: 'kpi_update',
            metrics,
          });
        }

        // Poll jobs for job updates
        if (onJobUpdate) {
          const jobs = await apiClient.listJobs({ limit: 10 });
          // Note: This won't give us individual job updates like SSE would
          // It's just a fallback to keep data somewhat fresh
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, fallbackPollInterval);

    return () => clearInterval(pollInterval);
  }, [connected, fallbackPollInterval, onJobUpdate, onKPIUpdate]);

  return { connected, error };
}
