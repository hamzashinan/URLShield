import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Download, AlertTriangle, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Card, CardContent } from '../../components/Card';
import { Input } from '../../components/Input';
import { ScorePill } from '../../components/ScorePill';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import type { ScanHistoryResponse } from '../../types/api';
import { YodhaCAPIClient } from '../../lib/api';

interface Alert {
  id: string;
  domain: string;
  url: string;
  score: 'phishing' | 'suspected' | 'clean';
  timestamp: string;
  scan_time: string;
  severity: 'high' | 'medium' | 'low';
  signals: string[];
  description: string;
  confidence?: number;
  risk_score?: number;
}

const apiClient = new YodhaCAPIClient();

// Helper function to safely format timestamps
const formatTimestamp = (timestamp: string | undefined | null): string => {
  if (!timestamp || timestamp === 'No timestamp') {
    return 'No timestamp';
  }

  try {
    // Handle various timestamp formats
    let date: Date;

    if (timestamp.includes('T')) {
      // ISO 8601 format from backend (e.g., "2024-01-15T10:30:00Z" or "2024-01-15T10:30:00")
      // Backend stores in UTC but may omit Z suffix in older records
      if (!timestamp.includes('Z') && !timestamp.match(/[+-]\d{2}:\d{2}/)) {
        date = new Date(timestamp + 'Z');
      } else {
        date = new Date(timestamp);
      }
    } else if (timestamp.includes(' ')) {
      // Format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM"
      // Replace space with 'T' and append 'Z' to treat as UTC
      date = new Date(timestamp.replace(' ', 'T') + 'Z');
    } else {
      // Try parsing as-is
      date = new Date(timestamp);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Invalid date';
  }
};

interface AlertsProps {
  onNavigateToEvidence?: (domain: string, timestamp: string) => void;
}

export const Alerts: React.FC<AlertsProps> = ({ onNavigateToEvidence }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [selectAllToggled, setSelectAllToggled] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch alerts from API
  const fetchAlerts = async (page: number = 1, query: string = '') => {
    try {
      setLoading(true);
      setError(null);

      const limit = 50;
      const searchParams = new URLSearchParams();
      searchParams.set('limit', limit.toString());
      searchParams.set('offset', ((page - 1) * limit).toString());

      // Alert ID is generated client-side; handle it with client-side filtering
      const trimmedQuery = query.trim();
      const normalizedQuery = trimmedQuery.toUpperCase();
      
      // Always fetch more results if there's any search query to support both domain and Alert ID filtering
      if (trimmedQuery) {
        searchParams.set('limit', '1000'); // Fetch more results for comprehensive filtering
      }

      const data = await apiClient.getScanHistory({
        domain: debouncedQuery,
        limit: 50,
        offset: (currentPage - 1) * 50
      });

      let mappedAlerts: Alert[] = data.items
        .map((item: ScanHistoryResponse['items'][number]) => {
          const prediction = item.ml_prediction;

          let score: 'phishing' | 'suspected' | 'clean' = 'clean';
          let severity: 'high' | 'medium' | 'low' = 'low';

          if (prediction) {
            const predLower = prediction.prediction.toLowerCase();
            if (predLower === 'phishing') {
              score = 'phishing';
              severity = 'high';
            } else if (predLower === 'suspected' || predLower === 'suspicious') {
              score = 'suspected';
              severity = 'medium';
            } else if (prediction.risk_score > 0.5) {
              score = 'suspected';
              severity = 'medium';
            }
          }

          // Generate proper Alert ID: ALT-{hash}
          const hash = btoa(`${item.domain}-${item.timestamp}`).slice(0, 8).toUpperCase();
          const alertId = `ALT-${hash}`;
          
          return {
            id: alertId,
            domain: item.domain,
            url: item.url,
            score,
            timestamp: item.timestamp,
            scan_time: item.scan_time,
            severity,
            signals: prediction?.reasoning || [],
            description: prediction?.reasoning?.join('. ') || 'No reasoning provided',
            confidence: prediction?.confidence,
            risk_score: prediction?.risk_score
          };
        })
        .filter((alert: Alert) => alert.score === 'phishing' || alert.score === 'suspected');

      // Filter out locally deleted alerts
      let deletedAlerts: string[] = [];
      try {
        deletedAlerts = JSON.parse(localStorage.getItem('yodha_alerts_deleted_items') || '[]');
      } catch (e) {}

      if (deletedAlerts.length > 0) {
        mappedAlerts = mappedAlerts.filter(alert => !deletedAlerts.includes(`${alert.domain}|${alert.timestamp}`));
      }

      // Client-side filtering for case-insensitive search (supports both domain and Alert ID)
      if (trimmedQuery) {
        mappedAlerts = mappedAlerts.filter((alert: Alert) => {
          let matchesSearch = false;
          
          // Domain search - case-insensitive partial match
          const domainMatch = alert.domain.toUpperCase().includes(normalizedQuery);
          
          // Alert ID search - partial match, case-insensitive
          const coreSearchId = normalizedQuery.replace('ALT-', '');
          const alertIdUpper = alert.id.toUpperCase();
          const alertCoreId = alertIdUpper.replace('ALT-', '');
          
          const alertIdMatch = alertIdUpper.includes(normalizedQuery) || 
                              alertCoreId.includes(coreSearchId) ||
                              normalizedQuery.includes(alertCoreId);
          
          // Match if either domain or Alert ID matches
          matchesSearch = domainMatch || alertIdMatch;
          
          return matchesSearch;
        });
      }

      setAlerts(mappedAlerts);
      setTotalAlerts(mappedAlerts.length);
      setCurrentPage(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load alerts';
      setError(errorMessage);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and when page/query changes
  useEffect(() => {
    fetchAlerts(1, debouncedQuery);
  }, [debouncedQuery]);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const toggleAlertSelection = (alertId: string, event: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation(); // Prevent row expansion when clicking checkbox
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
    // Reset selectAllToggled when individual row selection changes
    setSelectAllToggled(false);
  };

  const toggleSelectAll = () => {
    if (selectAllToggled) {
      // Deselect all alerts
      setSelectedAlerts(new Set());
      setSelectAllToggled(false);
    } else {
      // Select all alerts
      setSelectedAlerts(new Set(alerts.map(alert => alert.id)));
      setSelectAllToggled(true);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchAlerts(newPage, debouncedQuery);
  };

  const handleDeleteSelected = () => {
    console.log('Delete Selected button clicked, selectedAlerts size:', selectedAlerts.size);
    console.log('Selected alerts IDs:', Array.from(selectedAlerts));
    
    if (selectedAlerts.size === 0) {
      setError('No alerts selected for deletion');
      return;
    }
    
    console.log('Showing delete confirmation modal...');
    setShowDeleteSelectedModal(true);
  };

  const confirmDeleteSelected = async () => {
    console.log('Confirm Delete Selected called');
    
    setShowDeleteSelectedModal(false);
    
    try {
      setLoading(true);
      setError(null);

      // Get the selected alerts to delete
      const selectedAlertsData = alerts.filter(alert => selectedAlerts.has(alert.id));
      
      // Store deleted items in localStorage instead of calling backend API
      let deletedItems: string[] = [];
      try {
        deletedItems = JSON.parse(localStorage.getItem('yodha_alerts_deleted_items') || '[]');
      } catch (e) {}

      selectedAlertsData.forEach((alert) => {
        const itemKey = `${alert.domain}|${alert.timestamp}`;
        if (!deletedItems.includes(itemKey)) {
          deletedItems.push(itemKey);
        }
      });
      
      localStorage.setItem('yodha_alerts_deleted_items', JSON.stringify(deletedItems));

      // Remove deleted alerts from state and clear selection
      console.log('Removing deleted alerts from state locally...');
      const deletedAlertIds = new Set(selectedAlerts);
      const remainingAlerts = alerts.filter(alert => !deletedAlertIds.has(alert.id));
      setAlerts(remainingAlerts);
      setSelectedAlerts(new Set());
      setTotalAlerts(prev => Math.max(0, prev - selectedAlerts.size));
      
      // Optional: re-fetch to ensure pagination stays accurate, though we can skip for performance
      // if we have enough items still visible.
      if (remainingAlerts.length < 10) {
        await fetchAlerts(currentPage, debouncedQuery);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete selected alerts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      console.log('Starting export...');

      // Check if any alerts are selected
      if (selectedAlerts.size === 0) {
        setError('Please select at least one alert to export');
        return;
      }

      // Filter selected alerts from current displayed alerts
      const selectedAlertsData = alerts.filter(alert => selectedAlerts.has(alert.id));

      if (selectedAlertsData.length === 0) {
        setError('No selected alerts found to export');
        return;
      }

      console.log(`Exporting ${selectedAlertsData.length} selected alerts...`);
      generatePDF(selectedAlertsData);
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Failed to export alerts');
    }
  };

  const generatePDF = (alerts: Alert[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 15;
    let yPosition = 15;

    // Add title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('YODHA PHISHING ALERTS REPORT', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Add generation timestamp
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Add summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Alerts: ${alerts.length}`, leftMargin, yPosition);
    yPosition += 15;

    // Add table headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    const headers = ['Alert ID', 'Domain', 'Score', 'Severity', 'Timestamp'];
    // Total available width 180mm (210mm page - 15mm left - 15mm right)
    const columnWidths = [35, 40, 32, 28, 45];
    
    // Draw headers
    let xPos = leftMargin;
    headers.forEach((header, index) => {
      doc.text(header, xPos, yPosition);
      xPos += columnWidths[index];
    });
    yPosition += 15;

    // Helper to truncate text to fit column width
    const truncateText = (text: string, maxWidth: number): string => {
      const textWidth = doc.getTextWidth(text);
      if (textWidth <= maxWidth) return text;
      let truncated = text;
      while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      return truncated + '...';
    };

    // Add alert data in table format (no borders)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    alerts.forEach((alert) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
        
        // Redraw headers on new page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        xPos = leftMargin;
        headers.forEach((header, colIndex) => {
          doc.text(header, xPos, yPosition);
          xPos += columnWidths[colIndex];
        });
        yPosition += 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      }

      xPos = leftMargin;
      
      // Alert ID
      doc.text(truncateText(alert.id, columnWidths[0] - 2), xPos, yPosition);
      xPos += columnWidths[0];
      
      // Domain
      doc.text(truncateText(alert.domain, columnWidths[1] - 2), xPos, yPosition);
      xPos += columnWidths[1];
      
      // Score
      doc.text(alert.score.toUpperCase(), xPos, yPosition);
      xPos += columnWidths[2];
      
      // Severity
      doc.text(alert.severity.toUpperCase(), xPos, yPosition);
      xPos += columnWidths[3];
      
      // Timestamp
      const displayTimestamp = formatTimestamp(alert.scan_time);
      doc.text(truncateText(displayTimestamp, columnWidths[4] - 2), xPos, yPosition);
      
      yPosition += 10;
    });

    // Save the PDF
    doc.save(`yodha-alerts-export-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Alerts</h1>
          <p className="text-text-secondary">Review and manage security alerts ({totalAlerts} total)</p>
          {selectedAlerts.size > 0 && (
            <p className="text-sm text-primary font-medium mt-1">
              {selectedAlerts.size} alert{selectedAlerts.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        <Button variant="primary" onClick={handleExport}>
          <Download size={16} className="mr-2" />
          Export {selectedAlerts.size > 0 && `(${selectedAlerts.size})`}
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Search alerts by domain or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={<Search size={18} />}
            rightIcon={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedQuery('');
                  }}
                  className="hover:text-text transition-colors"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              ) : undefined
            }
          />
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="px-6 flex justify-between items-center">
        <div>
          {alerts.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1 text-xs text-primary hover:text-primary/80 transition-colors"
              title={selectAllToggled ? "Deselect all alerts" : "Select all alerts"}
            >
              {selectAllToggled ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleDeleteSelected()}
            className="px-3 py-1 text-xs text-danger hover:text-danger/80 transition-colors"
            title="Delete selected alerts"
            disabled={selectedAlerts.size === 0}
          >
            Delete {selectedAlerts.size > 0 && `(${selectedAlerts.size})`}
          </button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Select
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Alert ID
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Domain
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Score
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Severity
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-text-secondary">
                    Loading alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-text-secondary">
                    {searchQuery ? 'No alerts found matching your search.' : 'No security alerts found.'}
                  </td>
                </tr>
              ) : (
                alerts.map((alert: Alert, idx: number) => (
                  <React.Fragment key={idx}>
                    <tr
                      className="hover:bg-bg/50 transition-all duration-150 cursor-pointer animate-slide-up"
                      style={{ animationDelay: `${idx * 50}ms` }}
                      onClick={() => toggleRow(alert.id)}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedAlerts.has(alert.id)}
                          onChange={(e) => toggleAlertSelection(alert.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-border bg-bg text-primary focus:ring-primary focus:ring-offset-0"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-text">{alert.id}</td>
                      <td className="px-6 py-4 text-sm text-text font-mono">{alert.domain}</td>
                      <td className="px-6 py-4">
                        <ScorePill
                          score={alert.score}
                          className="min-w-[110px] justify-center"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            alert.severity === 'high'
                              ? 'danger'
                              : alert.severity === 'medium'
                                ? 'warning'
                                : 'success'
                          }
                          className="min-w-[110px] justify-center"
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{formatTimestamp(alert.scan_time)}</td>
                      <td className="px-6 py-4 text-right">
                        {expandedRow === alert.id ? (
                          <ChevronUp size={18} className="inline text-text-secondary" />
                        ) : (
                          <ChevronDown size={18} className="inline text-text-secondary" />
                        )}
                      </td>
                    </tr>
                    {expandedRow === alert.id && (
                      <tr className="bg-bg/30 animate-slide-down">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-sm font-semibold text-text mb-2">Description</h4>
                              <p className="text-sm text-text-secondary">{alert.description}</p>
                              {alert.confidence && (
                                <p className="text-xs text-text-secondary mt-1">
                                  Confidence: {(alert.confidence * 100).toFixed(1)}%
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-text mb-2">Detection Signals</h4>
                              <div className="flex flex-wrap gap-2">
                                {alert.signals.map((signal: string, idx: number) => (
                                  <Badge key={idx} variant="primary">
                                    {signal}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                variant="primary"
                                onClick={() => {
                                  if (onNavigateToEvidence) {
                                    onNavigateToEvidence(alert.domain, alert.timestamp);
                                  }
                                }}
                              >
                                View Evidence
                              </Button>
                              <Button size="sm" variant="secondary">
                                Add to Watchlist
                              </Button>
                              <Button size="sm" variant="ghost">
                                Mark as Resolved
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {!loading && alerts.length > 0 && totalAlerts > 50 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-secondary">
                Showing {((currentPage - 1) * 50) + 1} to {Math.min(currentPage * 50, totalAlerts)} of {totalAlerts} alerts
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage * 50 >= totalAlerts}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Delete Selected Confirmation Modal */}
      {showDeleteSelectedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-text mb-4">Delete Selected Alerts</h3>
            <p className="text-text-secondary mb-6">
              Are you sure you want to remove {selectedAlerts.size} selected alert{selectedAlerts.size !== 1 ? 's' : ''} from this view?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  console.log('Cancel button clicked in Delete Selected modal');
                  setShowDeleteSelectedModal(false);
                }}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Delete button clicked in Delete Selected modal');
                  confirmDeleteSelected();
                }}
                className="px-4 py-2 text-sm text-danger hover:text-danger/80 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
