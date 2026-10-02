import React, { useState, useEffect, useRef } from 'react';
import { Loader, CheckCircle2, XCircle, Clock, AlertTriangle, X, Download } from 'lucide-react';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { apiClient } from '../lib/api';
import { classifySecurityRisk, shouldAlert } from '../lib/classification';
import type { BatchJobStatus, JobDetail } from '../types/api';

interface BatchMonitorProps {
  batchId: string;
  urls?: string[];
  onClose?: () => void;
  /** Optional override for batch API base URL (used for mini backend). */
  apiBaseUrl?: string;
}

export const BatchMonitor: React.FC<BatchMonitorProps> = ({ batchId, urls = [], onClose, apiBaseUrl }) => {
  const [status, setStatus] = useState<BatchJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jobResults, setJobResults] = useState<JobDetail[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // ─── Frontend-driven sequential scraping ─────────────────────────────────
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [scrapedResults, setScrapedResults] = useState<JobDetail[]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const fetchStatus = async () => {
      try {
        let batchStatus: BatchJobStatus;

        if (!apiBaseUrl) {
          batchStatus = await apiClient.getBatchStatus(batchId);
        } else {
          const { apiKey } = apiClient.getConfig();
          const res = await fetch(`${apiBaseUrl}/batch/${batchId}`, {
            headers: { 'X-API-Key': apiKey },
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(errText || 'Failed to fetch mini batch status');
          }
          batchStatus = (await res.json()) as BatchJobStatus;
        }
        setStatus(batchStatus);
        setError(null);

        // Stop polling when completed or failed
        if (['completed', 'failed', 'cancelled'].includes(batchStatus.state)) {
          if (intervalId) {
            clearInterval(intervalId);
          }
          // Fetch job results when batch completes
          if (batchStatus.state === 'completed' && batchStatus.job_ids.length > 0) {
            void fetchJobResults(batchStatus.job_ids);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch batch status');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 3 seconds
    intervalId = setInterval(fetchStatus, 3000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [batchId]);

  // ─── Frontend-driven sequential scraping (fallback / primary) ──────────────
  useEffect(() => {
    if (urls.length === 0) return;
    // If backend already produced results, skip frontend scraping
    if (status?.state === 'completed' && (status.processed_urls ?? 0) > 0) return;

    abortRef.current = false;
    setIsScraping(true);

    const run = async () => {
      const results: JobDetail[] = [];

      for (let i = 0; i < urls.length; i++) {
        if (abortRef.current) break;
        const url = urls[i];

        try {
          // 1. Start scrape + prediction job
          const { job_ids } = await apiClient.scrape({
            url,
            analysis_mode: 'full_analysis',
          });
          const jobId = job_ids[0];
          if (!jobId) throw new Error('No job id returned');

          // 2. Poll until done (max ~2 min)
          let job: JobDetail | null = null;
          let attempts = 0;
          const maxAttempts = 60;

          while (attempts < maxAttempts && !abortRef.current) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              job = await apiClient.getJob(jobId);
              if (job.state === 'done' || job.state === 'error') break;
            } catch { /* retry */ }
            attempts++;
          }

          if (job) {
            results.push(job);

            // Classify and save alert if dangerous
            const classification = classifySecurityRisk(job);
            if (shouldAlert(classification)) {
              const alert = {
                id: `batch-${batchId}-${Date.now()}-${i}`,
                url: job.url || url,
                domain: job.root || url,
                classification: classification.label,
                riskLevel: classification.riskLevel,
                confidence: classification.confidence,
                timestamp: new Date().toISOString(),
                source: 'batch',
                explanation: classification.explanation,
                details: {
                  brand: job.domain_details?.registrar_name || 'Unknown',
                  registrar: job.domain_details?.registrar_name || 'Unknown',
                  createdDate: job.domain_details?.domain_registration_date || 'Unknown',
                  country: job.domain_details?.hosting_country || 'Unknown',
                }
              };
              const existing = JSON.parse(localStorage.getItem('urlshield_alerts') || '[]');
              localStorage.setItem('urlshield_alerts', JSON.stringify([alert, ...existing]));
            }
          }
        } catch {
          /* silent per-URL failure */
        }

        setScrapedResults([...results]);
        setScrapedCount(i + 1);
      }

      setIsScraping(false);
    };

    run();

    return () => {
      abortRef.current = true;
    };
  }, [urls, batchId]); // intentional: status omitted so re-scrape only when urls change

  const handleCancel = async () => {
    if (!status || !['pending', 'processing'].includes(status.state)) return;

    try {
      if (!apiBaseUrl) {
        await apiClient.cancelBatch(batchId);
      } else {
        const { apiKey } = apiClient.getConfig();
        const res = await fetch(`${apiBaseUrl}/batch/${batchId}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': apiKey },
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(errText || 'Failed to cancel mini batch');
        }
      }
      // Refresh status
      const updatedStatus = await (async () => {
        if (!apiBaseUrl) {
          return apiClient.getBatchStatus(batchId);
        }
        const { apiKey } = apiClient.getConfig();
        const res = await fetch(`${apiBaseUrl}/batch/${batchId}`, {
          headers: { 'X-API-Key': apiKey },
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(errText || 'Failed to fetch mini batch status');
        }
        return (await res.json()) as BatchJobStatus;
      })();
      setStatus(updatedStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel batch');
    }
  };

  const allResults = scrapedResults.length > 0 ? scrapedResults : jobResults;

  const handleDownloadPDF = () => {
    if (allResults.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Compute summary stats
    const classifications = allResults.map(job => classifySecurityRisk(job));
    const phishingCount = classifications.filter(c => c.category === 'phishing').length;
    const suspectedCount = classifications.filter(c => c.category === 'suspected').length;
    const safeCount = classifications.filter(c => c.category === 'safe').length;
    const unknownCount = classifications.filter(c => c.category === 'unknown').length;
    const criticalCount = classifications.filter(c => c.riskLevel === 'critical').length;
    const highCount = classifications.filter(c => c.riskLevel === 'high').length;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Batch Analysis Report - ${batchId.substring(0, 8)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          h1 { color: #1a1a2e; border-bottom: 3px solid #0066cc; padding-bottom: 12px; margin-bottom: 8px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
          .summary-grid { display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap; }
          .summary-card { flex: 1; min-width: 140px; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb; }
          .summary-card.total { background: #f0f9ff; border-color: #bae6fd; }
          .summary-card.phishing { background: #fef2f2; border-color: #fecaca; }
          .summary-card.suspected { background: #fffbeb; border-color: #fde68a; }
          .summary-card.safe { background: #f0fdf4; border-color: #bbf7d0; }
          .summary-card.unknown { background: #f9fafb; border-color: #e5e7eb; }
          .summary-number { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
          .summary-card.total .summary-number { color: #0369a1; }
          .summary-card.phishing .summary-number { color: #dc2626; }
          .summary-card.suspected .summary-number { color: #d97706; }
          .summary-card.safe .summary-number { color: #16a34a; }
          .summary-card.unknown .summary-number { color: #6b7280; }
          .summary-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .risk-section { margin-bottom: 24px; }
          .risk-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #374151; }
          .risk-bar { display: flex; height: 24px; border-radius: 4px; overflow: hidden; margin-bottom: 16px; }
          .risk-bar > div { display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 600; }
          .risk-critical { background: #dc2626; }
          .risk-high { background: #ea580c; }
          .risk-medium { background: #d97706; }
          .risk-low { background: #16a34a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #1e40af; color: white; padding: 12px; text-align: left; font-size: 13px; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .phishing { color: #dc2626; font-weight: bold; }
          .suspected { color: #d97706; font-weight: bold; }
          .safe { color: #16a34a; font-weight: bold; }
          .unknown { color: #6b7280; font-weight: bold; }
          .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-between; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
          .badge-danger { background: #fef2f2; color: #dc2626; }
          .badge-warning { background: #fffbeb; color: #d97706; }
          .badge-success { background: #f0fdf4; color: #16a34a; }
          .badge-default { background: #f3f4f6; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>URL Analysis Report</h1>
          <div class="subtitle">
            Batch ID: <strong>${batchId}</strong> &nbsp;|&nbsp;
            Generated: <strong>${new Date().toLocaleString()}</strong>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card total">
            <div class="summary-number">${allResults.length}</div>
            <div class="summary-label">Total URLs</div>
          </div>
          <div class="summary-card phishing">
            <div class="summary-number">${phishingCount}</div>
            <div class="summary-label">Phishing</div>
          </div>
          <div class="summary-card suspected">
            <div class="summary-number">${suspectedCount}</div>
            <div class="summary-label">Suspected</div>
          </div>
          <div class="summary-card safe">
            <div class="summary-number">${safeCount}</div>
            <div class="summary-label">Safe</div>
          </div>
          <div class="summary-card unknown">
            <div class="summary-number">${unknownCount}</div>
            <div class="summary-label">Unknown</div>
          </div>
        </div>

        <div class="risk-section">
          <div class="risk-title">Risk Distribution</div>
          <div class="risk-bar">
            ${criticalCount > 0 ? `<div class="risk-critical" style="width:${(criticalCount / allResults.length * 100).toFixed(1)}%">${criticalCount > 1 ? criticalCount : ''}</div>` : ''}
            ${highCount > 0 ? `<div class="risk-high" style="width:${(highCount / allResults.length * 100).toFixed(1)}%">${highCount > 1 ? highCount : ''}</div>` : ''}
            ${suspectedCount > 0 ? `<div class="risk-medium" style="width:${(suspectedCount / allResults.length * 100).toFixed(1)}%">${suspectedCount > 1 ? suspectedCount : ''}</div>` : ''}
            ${safeCount > 0 ? `<div class="risk-low" style="width:${(safeCount / allResults.length * 100).toFixed(1)}%">${safeCount > 1 ? safeCount : ''}</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:40px">#</th>
              <th>URL</th>
              <th style="width:140px">Classification</th>
              <th style="width:100px">Risk</th>
              <th style="width:80px">Confidence</th>
            </tr>
          </thead>
          <tbody>
            ${allResults.map((job, index) => {
              const c = classifySecurityRisk(job);
              const badgeClass = c.badgeVariant === 'danger' ? 'badge-danger' : c.badgeVariant === 'warning' ? 'badge-warning' : c.badgeVariant === 'success' ? 'badge-success' : 'badge-default';
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td style="word-break:break-all">${job.url || job.root || 'N/A'}</td>
                  <td><span class="badge ${badgeClass}">${c.label}</span></td>
                  <td class="${c.category}">${c.riskLevel}</td>
                  <td>${(c.confidence * 100).toFixed(1)}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>URLShield Security Report</span>
          <span>${new Date().toISOString().split('T')[0]}</span>
        </div>

        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const fetchJobResults = async (jobIds: string[]) => {
    setIsLoadingResults(true);
    try {
      let jobs: JobDetail[];

      if (!apiBaseUrl) {
        // Use the new batch jobs endpoint if available, otherwise fetch individually
        try {
          jobs = await apiClient.getBatchJobs(batchId);
        } catch {
          // Fallback: fetch each job individually
          const jobPromises = jobIds.map(id => apiClient.getJob(id));
          jobs = await Promise.all(jobPromises);
        }
      } else {
        // Mini backend: fetch each job individually
        const { apiKey } = apiClient.getConfig();
        const jobPromises = jobIds.map(async (id) => {
          const res = await fetch(`${apiBaseUrl}/job/${id}`, {
            headers: { 'X-API-Key': apiKey },
          });
          if (!res.ok) throw new Error(`Failed to fetch job ${id}`);
          return res.json() as Promise<JobDetail>;
        });
        jobs = await Promise.all(jobPromises);
      }

      // Filter only completed jobs with results
      const completedJobs = jobs.filter(job => job.state === 'done' && job.ml_prediction);
      setJobResults(completedJobs);

      // Create alerts for phishing/suspicious URLs using classification logic
      const classifiedJobs = completedJobs.map(job => ({
        job,
        classification: classifySecurityRisk(job),
      }));
      const suspiciousJobs = classifiedJobs.filter(({ classification }) => shouldAlert(classification));

      if (suspiciousJobs.length > 0) {
        // Store alerts in localStorage for the Alerts page
        const existingAlerts = JSON.parse(localStorage.getItem('urlshield_alerts') || '[]');
        const newAlerts = suspiciousJobs.map(({ job, classification }) => ({
          id: `batch-${batchId}-${job.id}`,
          domain: job.url || job.root || 'Unknown',
          url: job.url || '',
          prediction: classification.label,
          riskLevel: classification.riskLevel,
          confidence: classification.confidence,
          explanation: classification.explanation,
          timestamp: new Date().toISOString(),
          batchId: batchId,
          status: 'new'
        }));
        localStorage.setItem('urlshield_alerts', JSON.stringify([...existingAlerts, ...newAlerts]));
      }
    } catch (err: any) {
      console.error('Failed to fetch job results:', err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'pending':
        return <Clock size={20} className="text-warning" />;
      case 'processing':
        return <Loader size={20} className="text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 size={20} className="text-success" />;
      case 'failed':
        return <XCircle size={20} className="text-danger" />;
      case 'cancelled':
        return <AlertTriangle size={20} className="text-text-secondary" />;
      default:
        return null;
    }
  };

  const getStateColor = (state: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (state) {
      case 'completed':
        return 'success';
      case 'processing':
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'default';
    }
  };

  if (isLoading && !status) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader size={32} className="mx-auto mb-3 text-primary animate-spin" />
          <p className="text-text-secondary">Loading batch status...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !status) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Card>
      <CardContent className="py-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getStateIcon(status.state)}
              <div>
                <h3 className="text-lg font-semibold text-text">Batch Processing</h3>
                <p className="text-xs text-text-secondary font-mono mt-0.5">
                  ID: {batchId.substring(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStateColor(status.state)}>
                {status.state.toUpperCase()}
              </Badge>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-surface-secondary rounded transition-colors"
                >
                  <X size={20} className="text-text-secondary" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Progress</span>
              <span className="text-text font-medium">
                {isScraping
                  ? `${((scrapedCount / urls.length) * 100).toFixed(1)}%`
                  : `${status.progress_percentage.toFixed(1)}%`}
              </span>
            </div>
            <div className="w-full bg-surface-tertiary rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  status?.state === 'completed' || (!isScraping && scrapedResults.length > 0)
                    ? 'bg-success'
                    : status?.state === 'failed'
                    ? 'bg-danger'
                    : status?.state === 'cancelled'
                    ? 'bg-text-secondary'
                    : 'bg-primary'
                }`}
                style={{
                  width: isScraping
                    ? `${urls.length > 0 ? (scrapedCount / urls.length) * 100 : 0}%`
                    : `${status.progress_percentage}%`,
                }}
              />
            </div>
            {isScraping && (
              <p className="text-xs text-text-secondary">
                Analyzing URL {scrapedCount} of {urls.length}...
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">Total</p>
              <p className="text-xl font-bold text-text">
                {urls.length > 0 ? urls.length : status?.total_urls ?? 0}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-xs text-primary mb-1">Scanned</p>
              <p className="text-xl font-bold text-primary">
                {scrapedCount > 0 ? scrapedCount : status?.processed_urls ?? 0}
              </p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">Unscanned</p>
              <p className="text-xl font-bold text-text">
                {urls.length > 0
                  ? Math.max(0, urls.length - scrapedCount)
                  : Math.max(0, (status?.total_urls ?? 0) - (status?.processed_urls ?? 0))}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-text-secondary space-y-1">
            <p>Created: {new Date(status.created_at).toLocaleString()}</p>
            {status.completed_at && (
              <p>Completed: {new Date(status.completed_at).toLocaleString()}</p>
            )}
          </div>

          {/* Failed Items */}
          {status.failed_items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-text">Failed URLs</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {status.failed_items.map((item, index) => (
                  <div
                    key={index}
                    className="p-2 bg-danger/5 border border-danger/20 rounded text-xs"
                  >
                    <p className="text-text font-medium truncate">{item.url}</p>
                    <p className="text-danger mt-1">{item.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Table */}
          {(status.state === 'completed' || scrapedResults.length > 0) && (
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-semibold text-text flex items-center justify-between">
                <span>Analysis Results</span>
                {isLoadingResults && <Loader size={14} className="animate-spin text-primary" />}
              </h4>
              <div className="max-h-64 overflow-y-auto border border-border rounded-lg bg-surface-secondary">
                <table className="w-full text-sm">
                  <thead className="bg-surface-tertiary sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">URL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allResults.length > 0 ? (
                      allResults.map((job, index) => {
                        const classification = classifySecurityRisk(job);
                        return (
                          <tr key={index} className="hover:bg-surface-tertiary/50 transition-colors">
                            <td className="px-3 py-2">
                              <p className="text-text truncate max-w-xs" title={job.url || job.root || ''}>
                                {job.url || job.root || 'Unknown'}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={classification.badgeVariant}
                                className="text-xs"
                              >
                                {classification.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs ${classification.riskLevel === 'critical' ? 'text-danger font-medium' : classification.riskLevel === 'high' ? 'text-danger' : classification.riskLevel === 'medium' ? 'text-warning' : 'text-success'}`}>
                                {(classification.confidence * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-xs text-text-secondary">
                          {isLoadingResults ? 'Loading results...' : 'No results found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-xs text-text-secondary">
              {status.state === 'processing' && (
                <p>Processing URLs without artificial delay...</p>
              )}
              {status.state === 'completed' && (
                <p>All URLs have been processed successfully</p>
              )}
            </div>
            <div className="flex gap-2">
              {['pending', 'processing'].includes(status.state) && (
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  size="sm"
                >
                  Cancel Batch
                </Button>
              )}
              {(status?.state === 'completed' || scrapedResults.length > 0) && allResults.length > 0 && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (onClose) {
                        onClose();
                      }
                    }}
                    size="sm"
                  >
                    <X size={14} className="mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDownloadPDF}
                    size="sm"
                  >
                    <Download size={14} className="mr-1" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};
