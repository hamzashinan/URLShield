import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  FileText,
  Image,
  Search,
  Filter,
  Download,
  Eye,
  AlertCircle,
  ChevronRight,
  Calendar,
  Globe,
  FileCode,
  Lock,
  Mail,
  Link as LinkIcon,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { ScanHistoryItem } from '../../types/api';
import { MLFeaturesDisplay } from '../../components/MLFeaturesDisplay';

export const ScanHistory: React.FC = () => {
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState<ScanHistoryItem | null>(null);
  const [selectedScanImage, setSelectedScanImage] = useState<string | null>(null);
  const [interactionScreenshots, setInteractionScreenshots] = useState<Array<{filename: string, url: string, blobUrl?: string}>>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Deletion States
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [scanToDelete, setScanToDelete] = useState<ScanHistoryItem | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    loadScanHistory();
  }, [offset, searchQuery]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    // Cleanup blob URLs when component unmounts
    return () => {
      if (selectedScanImage) {
        URL.revokeObjectURL(selectedScanImage);
      }
    };
  }, [selectedScanImage]);

  const loadScanHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch more items to account for client-side filtering
      const fetchLimit = limit * 2;
      
      const response = await apiClient.getScanHistory({
        domain: searchQuery || undefined,
        limit: fetchLimit,
        offset,
      });
      
      // Filter out locally hidden/deleted items
      const clearedAtStr = localStorage.getItem('yodha_history_cleared_at');
      const clearedAt = clearedAtStr ? new Date(clearedAtStr).getTime() : 0;
      
      let deletedItems: string[] = [];
      try {
        deletedItems = JSON.parse(localStorage.getItem('yodha_history_deleted_items') || '[]');
      } catch (e) {}
      
      const visibleItems = response.items.filter(scan => {
        const scanTime = new Date(scan.scan_time).getTime();
        const isBeforeClear = scanTime <= clearedAt;
        const isDeleted = deletedItems.includes(`${scan.domain}|${scan.timestamp}`);
        return !isBeforeClear && !isDeleted;
      });
      
      // We slice to the original limit to maintain correct page sizes
      setScans(visibleItems.slice(0, limit));
      
      // Calculate a rough adjusted total 
      const hiddenCount = response.items.length - visibleItems.length;
      const adjustedTotal = Math.max(0, response.total - hiddenCount);
      setTotal(adjustedTotal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (scan: ScanHistoryItem) => {
    try {
      setIsDeleting(true);
      console.log('Hiding scan from history:', { 
        domain: scan.domain, 
        timestamp: scan.timestamp
      });
      
      // Store deleted item in localStorage instead of calling API
      // This ensures it's removed from History but remains in Alerts
      let deletedItems: string[] = [];
      try {
        deletedItems = JSON.parse(localStorage.getItem('yodha_history_deleted_items') || '[]');
      } catch (e) {}
      
      const itemKey = `${scan.domain}|${scan.timestamp}`;
      if (!deletedItems.includes(itemKey)) {
        deletedItems.push(itemKey);
        localStorage.setItem('yodha_history_deleted_items', JSON.stringify(deletedItems));
      }
      
      // Update local state instantly
      setScans(prev => prev.filter(s => !(s.domain === scan.domain && s.timestamp === scan.timestamp)));
      setTotal(prev => prev > 0 ? prev - 1 : 0);
      
      setNotification({ type: 'success', message: `Scan for ${scan.domain} removed from history.` });
      setScanToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove scan' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      setIsDeleting(true);
      console.log('Clearing scan history locally...');
      
      // Store the most recent scan_time as cleared_at instead of client's current time
      // This prevents clock skew issues where a newly analyzed URL might be hidden
      // because the client's clock is ahead of the server's clock.
      if (scans.length > 0) {
        localStorage.setItem('yodha_history_cleared_at', scans[0].scan_time);
      } else {
        localStorage.setItem('yodha_history_cleared_at', new Date().toISOString());
      }
      
      // Update local state instantly
      setScans([]);
      setTotal(0);
      
      setNotification({ type: 'success', message: 'All scan history cleared from this view.' });
      setShowConfirmClear(false);
    } catch (err) {
      console.error('Clear history error:', err);
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Failed to clear history' });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatRelativeTime = (dateString: string) => {
    // Ensure the date string is treated as UTC if it doesn't have timezone info
    const dateStr = dateString.includes('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const handleViewEvidence = async (scan: ScanHistoryItem) => {
    setSelectedScan(scan);
    
    // Load screenshot as blob if it exists
    if (scan.has_screenshot) {
      try {
        const screenshotUrl = apiClient.getEvidenceUrl(scan.domain, scan.timestamp, 'screenshot.png');
        
        const response = await fetch(screenshotUrl);
        
        if (response.ok) {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setSelectedScanImage(imageUrl);
        }
        
        // Load interaction screenshots
        try {
          const config = apiClient.getConfig();
          const screenshotsListUrl = `${config.baseURL}/evidence/${scan.domain}/${scan.timestamp}/screenshots?api_key=${config.apiKey}`;
          const listResponse = await fetch(screenshotsListUrl);
          
          if (listResponse.ok) {
            const data = await listResponse.json();
            const screenshots = data.screenshots || [];
            
            // Fetch each screenshot as blob
            const screenshotsWithBlobs = await Promise.all(
              screenshots.map(async (screenshot: {filename: string, url: string}) => {
                try {
                  const imgUrl = `${config.baseURL}${screenshot.url}?api_key=${config.apiKey}`;
                  const imgResponse = await fetch(imgUrl);
                  if (imgResponse.ok) {
                    const blob = await imgResponse.blob();
                    return {
                      ...screenshot,
                      blobUrl: URL.createObjectURL(blob)
                    };
                  }
                } catch (e) {
                  console.error('Failed to load interaction screenshot:', e);
                }
                return screenshot;
              })
            );
            
            setInteractionScreenshots(screenshotsWithBlobs);
          }
        } catch (err) {
          console.error('Failed to load interaction screenshots:', err);
        }
      } catch (err) {
        console.error('Failed to load screenshot:', err);
      }
    }
  };

  const getScreenshotUrl = (scan: ScanHistoryItem) => {
    return apiClient.getEvidenceUrl(scan.domain, scan.timestamp, 'screenshot.png');
  };

  
  const getFeaturesUrl = (scan: ScanHistoryItem) => {
    return apiClient.getEvidenceUrl(scan.domain, scan.timestamp, 'features.json');
  };

  const getRiskIndicators = (scan: ScanHistoryItem) => {
    const indicators = [];
    if (scan.password_field_count > 0) {
      indicators.push({ icon: Lock, label: `${scan.password_field_count} password fields`, color: 'text-red-500' });
    }
    if (scan.form_count > 0) {
      indicators.push({ icon: FileCode, label: `${scan.form_count} forms`, color: 'text-yellow-500' });
    }
    if (scan.email_count > 0) {
      indicators.push({ icon: Mail, label: `${scan.email_count} emails`, color: 'text-blue-500' });
    }
    if (scan.outlink_count > 0) {
      indicators.push({ icon: LinkIcon, label: `${scan.outlink_count} outlinks`, color: 'text-gray-500' });
    }
    return indicators;
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[60] p-4 rounded-lg shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-red-500/10 border-red-500/50 text-red-500'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="font-medium">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text">Scan History</h1>
          <p className="text-text-secondary mt-1">
            View all historical scans and their evidence artifacts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">
            {total} total scans
          </span>
          {scans.length > 0 && (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
            >
              <Trash2 size={18} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              placeholder="Search by domain..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={loadScanHistory}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Filter size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && scans.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Scan List */}
      {!loading && scans.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <FileText className="mx-auto text-text-secondary mb-4" size={48} />
          <h3 className="text-lg font-semibold text-text mb-2">No scan history available</h3>
          <p className="text-text-secondary">
            {searchQuery ? 'Try adjusting your search query' : 'Start scanning URLs to see history here'}
          </p>
        </div>
      )}

      {scans.length > 0 && (
        <div className="space-y-3">
          {scans.map((scan) => {
            const indicators = getRiskIndicators(scan);
            
            return (
              <div
                key={`${scan.domain}-${scan.timestamp}`}
                className="bg-surface border border-border rounded-lg p-5 hover:border-primary/50 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                onClick={() => handleViewEvidence(scan)}
              >
                <div className="flex items-start justify-between gap-4 relative z-10">
                  {/* Left: Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Globe className="text-primary flex-shrink-0" size={20} />
                      <h3 className="text-lg font-semibold text-text truncate">
                        {scan.domain}
                      </h3>
                      <span className="text-xs text-text-secondary bg-bg px-2 py-1 rounded">
                        {formatRelativeTime(scan.scan_time)}
                      </span>
                    </div>

                    {scan.title && (
                      <p className="text-sm text-text-secondary mb-2 truncate">
                        {scan.title}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
                      <ExternalLink size={14} />
                      <a
                        href={scan.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary truncate max-w-md"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {scan.url}
                      </a>
                    </div>

                    {/* Risk Indicators */}
                    {indicators.length > 0 && (
                      <div className="flex items-center gap-3 flex-wrap">
                        {indicators.map((indicator, idx) => {
                          const Icon = indicator.icon;
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 text-xs bg-bg px-2 py-1 rounded"
                            >
                              <Icon size={14} className={indicator.color} />
                              <span className="text-text-secondary">{indicator.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions & Metadata */}
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2">
                      {scan.has_screenshot && (
                        <a
                          href={getScreenshotUrl(scan)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-bg hover:bg-primary/10 rounded-lg transition-colors"
                          title="View Screenshot"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Image size={18} className="text-text-secondary group-hover:text-primary" />
                        </a>
                      )}
                      <a
                        href={getFeaturesUrl(scan)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-bg hover:bg-primary/10 rounded-lg transition-colors"
                        title="Download Features JSON"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={18} className="text-text-secondary group-hover:text-primary" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setScanToDelete(scan);
                        }}
                        className="p-2 bg-bg hover:bg-red-500/10 rounded-lg transition-colors text-text-secondary hover:text-red-500"
                        title="Delete Entry"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Calendar size={14} />
                      {formatDate(scan.scan_time)}
                    </div>

                    <ChevronRight
                      size={20}
                      className="text-text-secondary group-hover:text-primary group-hover:translate-x-1 transition-all"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex items-center justify-between bg-surface border border-border rounded-lg p-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 bg-bg border border-border rounded-lg text-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/10 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-text-secondary">
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-4 py-2 bg-bg border border-border rounded-lg text-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/10 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Confirmation Modal: Clear History */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-text mb-2">Clear Scan History?</h3>
              <p className="text-text-secondary mb-6">
                This will clear all scan history from this view. Phishing and suspicious alerts will remain visible on the Alerts page.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-bg border border-border rounded-lg text-text hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearHistory}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Item */}
      {scanToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-text">Delete Scan Record?</h3>
              </div>
              <p className="text-text-secondary mb-6">
                Are you sure you want to remove the scan history for <span className="text-text font-semibold">{scanToDelete.domain}</span> from this view?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setScanToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-bg border border-border rounded-lg text-text hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSingle(scanToDelete)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedScan && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (selectedScanImage) {
              URL.revokeObjectURL(selectedScanImage);
            }
            setSelectedScan(null);
            setSelectedScanImage(null);
          }}
        >
          <div
            className="bg-surface border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-text">{selectedScan.domain}</h2>
                <p className="text-sm text-text-secondary mt-1">{formatDate(selectedScan.scan_time)}</p>
              </div>
              <button
                onClick={() => {
                  if (selectedScanImage) {
                    URL.revokeObjectURL(selectedScanImage);
                  }
                  setSelectedScan(null);
                  setSelectedScanImage(null);
                }}
                className="p-2 hover:bg-bg rounded-lg transition-colors"
              >
                <span className="text-2xl text-text-secondary">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* ML Prediction Result */}
              {selectedScan.ml_prediction && (
                <div className={`p-4 rounded-lg border-2 ${
                  selectedScan.ml_prediction.prediction.toLowerCase() === 'phishing' 
                    ? 'bg-red-500/10 border-red-500' 
                    : 'bg-green-500/10 border-green-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-text mb-1">
                        {selectedScan.ml_prediction.prediction.toLowerCase() === 'phishing' ? '🚨 Phishing Detected' : '✅ Legitimate Site'}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Confidence: {(selectedScan.ml_prediction.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-secondary mb-1">Probabilities:</div>
                      <div className="text-sm">
                        {Object.entries(selectedScan.ml_prediction.probabilities).map(([key, value], index, array) => (
                          <span key={key}>
                            <span className={key.toLowerCase().includes('phish') ? 'text-red-500' : 'text-green-500'}>
                              {key}: {((value as number) * 100).toFixed(1)}%
                            </span>
                            {index < array.length - 1 && <span className="mx-2 text-text-secondary">|</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* URLs */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">URLs</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-text-secondary min-w-24">Input URL:</span>
                    <a
                      href={selectedScan.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {selectedScan.url}
                    </a>
                  </div>
                  {selectedScan.final_url !== selectedScan.url && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-text-secondary min-w-24">Final URL:</span>
                      <a
                        href={selectedScan.final_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {selectedScan.final_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Evidence Preview */}
              {selectedScan.has_screenshot && selectedScanImage && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-3">Main Screenshot</h3>
                  <img
                    src={selectedScanImage}
                    alt={`Screenshot of ${selectedScan.domain}`}
                    className="w-full border border-border rounded-lg"
                  />
                </div>
              )}
              
              {/* Interaction Screenshots */}
              {interactionScreenshots.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-3">Page Interaction Screenshots ({interactionScreenshots.length})</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {interactionScreenshots.map((screenshot) => (
                      screenshot.blobUrl && (
                        <div key={screenshot.filename} className="space-y-2">
                          <p className="text-xs text-text-secondary">{screenshot.filename.replace(/^\d+_/, '').replace(/\.png$/, '').replace(/_/g, ' ')}</p>
                          <img
                            src={screenshot.blobUrl}
                            alt={screenshot.filename}
                            className="w-full border border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                            onClick={() => window.open(screenshot.blobUrl, '_blank')}
                          />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
              {selectedScan.has_screenshot && !selectedScanImage && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {/* Signals Summary */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Scan Signals</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-bg p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode size={16} className="text-yellow-500" />
                      <span className="text-sm text-text-secondary">Forms</span>
                    </div>
                    <p className="text-2xl font-bold text-text">{selectedScan.form_count}</p>
                  </div>
                  <div className="bg-bg p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={16} className="text-red-500" />
                      <span className="text-sm text-text-secondary">Password Fields</span>
                    </div>
                    <p className="text-2xl font-bold text-text">{selectedScan.password_field_count}</p>
                  </div>
                  <div className="bg-bg p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail size={16} className="text-blue-500" />
                      <span className="text-sm text-text-secondary">Email Mentions</span>
                    </div>
                    <p className="text-2xl font-bold text-text">{selectedScan.email_count}</p>
                  </div>
                  <div className="bg-bg p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <LinkIcon size={16} className="text-gray-500" />
                      <span className="text-sm text-text-secondary">Outlinks</span>
                    </div>
                    <p className="text-2xl font-bold text-text">{selectedScan.outlink_count}</p>
                  </div>
                </div>
              </div>

              {/* ML Features - All 22 features passed to the model */}
              {selectedScan.ml_features && (
                <MLFeaturesDisplay 
                  mlFeatures={selectedScan.ml_features} 
                  mlPrediction={selectedScan.ml_prediction}
                />
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                {selectedScan.has_screenshot && (
                  <a
                    href={getScreenshotUrl(selectedScan)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    View Screenshot
                  </a>
                )}
                <a
                  href={getFeaturesUrl(selectedScan)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-bg border border-border text-text rounded-lg hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download JSON
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
