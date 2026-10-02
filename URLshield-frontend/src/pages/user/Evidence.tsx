import React, { useState, useEffect } from 'react';
import { Image, ExternalLink, Calendar, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { apiClient } from '../../lib/api';

interface EvidenceItem {
  id: string;
  type: 'screenshot';
  domain: string;
  capturedAt: string;
  thumbnail: string;
  size: string;
  timestamp: string;
  hasScreenshot?: boolean;
  isPartial?: boolean;
  url?: string;
  finalUrl?: string;
}

export const Evidence: React.FC = () => {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [filterTimestamp, setFilterTimestamp] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const domain = sessionStorage.getItem('evidence_filter_domain');
    const timestamp = sessionStorage.getItem('evidence_filter_timestamp');

    if (domain && timestamp) {
      setFilterDomain(domain);
      setFilterTimestamp(timestamp);
    }

    loadEvidence();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadEvidence = async () => {
    try {
      setLoading(true);
      setError(null);

      const scanHistory = await apiClient.getScanHistory({ limit: 50 });
      const evidenceItems: EvidenceItem[] = [];

      for (const scan of scanHistory.items) {
        if (filterDomain && filterTimestamp) {
          if (
            scan.domain !== filterDomain ||
            scan.scan_time !== filterTimestamp
          ) {
            continue;
          }
        }

        // Only add screenshot if it actually exists
        if (scan.has_screenshot) {
          evidenceItems.push({
            id: `EVD-${scan.domain}-${scan.timestamp}-screenshot`,
            type: 'screenshot',
            domain: scan.domain,
            capturedAt: new Date(scan.scan_time).toLocaleString(),
            thumbnail: 'screenshot',
            size: formatFileSize(scan.file_sizes?.screenshot || 0),
            timestamp: scan.timestamp,
            hasScreenshot: true,
            isPartial: scan.is_partial,
            url: scan.url,
            finalUrl: scan.final_url,
          });
        }
      }

      setEvidence(evidenceItems);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load evidence'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (evidence: EvidenceItem) => {
    const artifact = 'screenshot.png';

    try {
      const url = apiClient.getEvidenceUrl(
        evidence.domain,
        evidence.timestamp,
        artifact
      );

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.statusText}`
        );
      }

      const blob = await response.blob();

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = downloadUrl;

      link.download = `${evidence.domain}-${evidence.timestamp}-${artifact}`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);

      alert(
        'Download failed. Please check your API configuration.'
      );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'screenshot':
        return 'primary';

      default:
        return 'default';
    }
  };

  const handleImageError = (evidenceId: string) => {
    setImageErrors(prev => new Set(prev).add(evidenceId));
  };

  const handleRemove = async (item: EvidenceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistically remove from UI
    setEvidence(prev => prev.filter(ev => ev.id !== item.id));
    try {
      await apiClient.deleteScanHistoryItem(item.domain, item.timestamp);
    } catch (err) {
      console.error('Failed to delete from server:', err);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all evidence?')) {
      setEvidence([]);
      try {
        await apiClient.clearScanHistory();
      } catch (err) {
        console.error('Failed to clear evidence from server:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={24} />

          <span className="text-text-secondary">
            Loading evidence...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text mb-2">
              Evidence
            </h1>

            <p className="text-text-secondary">
              View and download collected evidence
            </p>
          </div>

          <Button
            onClick={loadEvidence}
            variant="primary"
          >
            Retry
          </Button>
        </div>

        <div className="bg-error/10 border border-error/20 rounded-lg p-6 text-center">
          <p className="text-error mb-2">{error}</p>

          <p className="text-text-secondary text-sm">
            Please check your connection and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">
            {filterDomain
              ? `Evidence: ${filterDomain}`
              : 'Evidence'}
          </h1>

          <p className="text-text-secondary">
            {filterDomain
              ? `Showing evidence for selected alert (${evidence.length} items)`
              : `View and download collected evidence (${evidence.length} items)`}
          </p>
        </div>

        <div className="flex gap-2">
          {filterDomain && (
            <Button
              variant="secondary"
              onClick={() => {
                sessionStorage.removeItem(
                  'evidence_filter_domain'
                );

                sessionStorage.removeItem(
                  'evidence_filter_timestamp'
                );

                setFilterDomain(null);

                setFilterTimestamp(null);

                loadEvidence();
              }}
            >
              Clear Filter
            </Button>
          )}

          <Button
            variant="ghost"
            className="text-text-secondary hover:text-error"
            onClick={handleClearAll}
            disabled={evidence.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {evidence.length === 0 ? (
        <div className="bg-bg border border-border rounded-lg p-12 text-center">
          <Image
            size={48}
            className="text-text-secondary/30 mx-auto mb-4"
          />

          <h3 className="text-lg font-medium text-text mb-2">
            {filterDomain
              ? 'No evidence available'
              : 'No evidence found'}
          </h3>

          <p className="text-text-secondary">
            {filterDomain
              ? 'No evidence available for this site.'
              : 'No scans have been completed yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidence.map((evidence, idx) => (
            <Card
              key={evidence.id}
              hover
              className="group animate-slide-up cursor-pointer relative"
              style={{
                animationDelay: `${idx * 50}ms`,
              }}
            >
              <CardContent className="p-0 relative">
                <button
                  onClick={(e) => handleRemove(evidence, e)}
                  className="absolute top-2 right-2 z-10 p-1.5 bg-black/40 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors"
                  title="Remove"
                >
                  <X size={14} />
                </button>
                <div className="aspect-video bg-bg relative overflow-hidden border-b border-border">
                  <div className="relative h-56 overflow-hidden rounded-xl bg-slate-900">
                    {imageErrors.has(evidence.id) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-center p-4">
                        <Image
                          size={32}
                          className="text-text-secondary/40 mb-3"
                        />
                        <p className="text-sm text-text-secondary">
                          screenshot not available for this site
                        </p>
                      </div>
                    ) : (
                      <img
                        src={apiClient.getEvidenceUrl(
                          evidence.domain,
                          evidence.timestamp,
                          "screenshot.png"
                        )}
                        alt="Screenshot"
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(evidence.id)}
                      />
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-text text-sm truncate"
                        title={evidence.url}
                      >
                        {evidence.domain}
                      </p>

                      <p className="text-xs text-text-secondary truncate">
                        {evidence.id}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={getTypeColor(
                          evidence.type
                        )}
                      >
                        {evidence.type}
                      </Badge>
                      {evidence.isPartial && (
                        <Badge variant="warning" className="text-[9px] h-4">
                          PARTIAL
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Calendar size={12} />

                    <span>{evidence.capturedAt}</span>

                    <span className="mx-1">•</span>

                    <span>{evidence.size}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();

                      let url = evidence.finalUrl || evidence.url || evidence.domain;
                      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                      }
                      if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <ExternalLink
                      size={14}
                      className="mr-2"
                    />

                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};