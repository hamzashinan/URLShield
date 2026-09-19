import React, { useState, useEffect } from 'react';
import { Eye, Clock, AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { apiClient } from '../../lib/api';
import type { WatchlistMetrics, ScanHistoryItem } from '../../types/api';


const getActionIcon = (action: string) => {
  switch (action) {
    case 'added':
      return <Eye size={16} className="text-primary" />;
    case 'updated':
      return <Clock size={16} className="text-warning" />;
    case 'resolved':
      return <CheckCircle size={16} className="text-success" />;
    case 'escalated':
      return <AlertTriangle size={16} className="text-danger" />;
    default:
      return <XCircle size={16} className="text-text-secondary" />;
  }
};

const getActionColor = (action: string): 'primary' | 'warning' | 'success' | 'danger' | 'default' => {
  switch (action) {
    case 'added':
      return 'primary';
    case 'updated':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'escalated':
      return 'danger';
    default:
      return 'default';
  }
};

export const Watchlist: React.FC = () => {
  const [metrics, setMetrics] = useState<WatchlistMetrics | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [apiCallMade, setApiCallMade] = useState(false);
  const [lastMetricsUpdate, setLastMetricsUpdate] = useState<Date | null>(null);
  const [isUpdatingMetrics, setIsUpdatingMetrics] = useState(false);

  // Ensure API client is configured with correct key
  useEffect(() => {
    const currentConfig = apiClient.getConfig();
    if (!currentConfig.apiKey) {
      apiClient.configure('http://localhost:8080', 'lAm3493F0AW0p-ARuvNYENhcYSY-RxNio5Q-o8p15oc');
      console.log('API client configured with key');
    }
  }, []);

  const handleRefresh = React.useCallback(async () => {
    try {
      setLoading(true);
      console.log('Refreshing watchlist data...');
      
      // Fetch both metrics and scan history
      const [metricsData, historyData] = await Promise.all([
        apiClient.getWatchlistMetrics(),
        apiClient.getScanHistory({ limit: 10 })
      ]);
      
      console.log('Refreshed metrics data:', metricsData);
      console.log('Refreshed history data:', historyData.items?.length || 0, 'items');
      
      setMetrics(metricsData);
      setHistory(historyData.items || []);
      setApiCallMade(true);
      
      // Force re-render by updating refresh key
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to refresh watchlist data:', error);
      setMetrics(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add frequent metrics refresh for real-time counts
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!loading) {
        try {
          setIsUpdatingMetrics(true);
          const metricsData = await apiClient.getWatchlistMetrics();
          
          // If active items count changed, especially if it dropped to 0, 
          // trigger a full refresh to show the new history item immediately
          if (metrics && metricsData.activeItems !== metrics.activeItems) {
            console.log(`Watchlist: activeItems changed from ${metrics.activeItems} to ${metricsData.activeItems}. Refreshing...`);
            handleRefresh();
          } else {
            setMetrics(metricsData);
          }
          
          setLastMetricsUpdate(new Date());
        } catch (error) {
          console.error('Failed to update metrics:', error);
        } finally {
          setIsUpdatingMetrics(false);
        }
      }
    }, 1000); // Update metrics every 1 second for better real-time feel

    return () => clearInterval(interval);
  }, [loading, metrics, handleRefresh]);

  // Add periodic refresh for full data (less frequent)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        handleRefresh();
      }
    }, 10000); // Refresh full data every 10 seconds

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch both metrics and scan history
        const [metricsData, historyData] = await Promise.all([
          apiClient.getWatchlistMetrics(),
          apiClient.getScanHistory({ limit: 10 })
        ]);
        
        console.log('Raw metrics data:', JSON.stringify(metricsData, null, 2));
        console.log('Raw history data:', JSON.stringify(historyData, null, 2));
        
        // Always set metrics data even if no history
        setMetrics(metricsData);
        setApiCallMade(true);
        console.log('Set metrics:', metricsData);
        
        // Handle history data
        if (!historyData.items || historyData.items.length === 0) {
          console.log('No scan history found in backend');
          setHistory([]);
        } else {
          setHistory(historyData.items);
          console.log('Set history to:', historyData.items.length, 'items');
        }
        console.log('API call completed successfully');
      } catch (error) {
        console.error('Failed to fetch watchlist data:', error);
        console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
        setError('Failed to load scan history');
        // Set empty data on error to prevent showing static data
        setMetrics(null);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getAction = (item: ScanHistoryItem): 'escalated' | 'resolved' => {
    const pred = item.ml_prediction;
    if (!pred) return 'resolved';
    
    // Check for phishing prediction (multiple formats for robustness)
    const prediction = pred.prediction?.toString().toLowerCase();
    if (prediction === '1' || prediction === 'phishing') return 'escalated';
    
    // Check risk score threshold
    if (pred.risk_score > 0.5) return 'escalated';
    
    return 'resolved';
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Watchlist</h1>
          <div className="flex items-center gap-2">
            <p className="text-text-secondary">Track domain monitoring activity over time</p>
            {lastMetricsUpdate && (
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <div className={`w-2 h-2 rounded-full ${isUpdatingMetrics ? 'bg-green-500 animate-pulse' : 'bg-green-400'}`} />
                <span>Live</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="text-center py-6">
            <Eye size={32} className="mx-auto mb-2 text-primary" />
            {loading || !apiCallMade ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-1" />
            ) : (
              <div className="relative">
                <p className={`text-3xl font-bold text-primary mb-1 transition-all duration-300 ${isUpdatingMetrics ? 'opacity-50' : 'opacity-100'}`}>
                  {metrics?.activeItems || 0}
                </p>
                {isUpdatingMetrics && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
            <p className="text-sm text-text-secondary">Active Items</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="text-center py-6">
            <AlertTriangle size={32} className="mx-auto mb-2 text-warning" />
            {loading || !apiCallMade ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-warning mb-1" />
            ) : (
              <div className="relative">
                <p className={`text-3xl font-bold text-warning mb-1 transition-all duration-300 ${isUpdatingMetrics ? 'opacity-50' : 'opacity-100'}`}>
                  {metrics?.escalated || 0}
                </p>
                {isUpdatingMetrics && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
            <p className="text-sm text-text-secondary">Escalated</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="text-center py-6">
            <CheckCircle size={32} className="mx-auto mb-2 text-success" />
            {loading || !apiCallMade ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-success mb-1" />
            ) : (
              <div className="relative">
                <p className={`text-3xl font-bold text-success mb-1 transition-all duration-300 ${isUpdatingMetrics ? 'opacity-50' : 'opacity-100'}`}>
                  {metrics?.resolved || 0}
                </p>
                {isUpdatingMetrics && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
            <p className="text-sm text-text-secondary">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6">
          <h2 className="text-lg font-semibold text-text mb-6">Activity Timeline</h2>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {apiCallMade && history.map((item, idx) => {
                const action = getAction(item);
                const description = action === 'escalated'
                  ? `Domain flagged as phishing risk${item.ml_prediction?.risk_score ? ` (Risk Score: ${(item.ml_prediction.risk_score * 100).toFixed(1)}%)` : ''}`
                  : 'Domain scan completed without high risk findings.';

                return (
                  <div
                    key={`${item.domain}-${item.timestamp}-${refreshKey}`}
                    className="relative flex gap-4 animate-slide-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-surface border-2 border-border flex items-center justify-center">
                      {getActionIcon(action)}
                    </div>

                    <div className="flex-1 pb-6">
                      <div className="bg-bg border border-border rounded-lg p-4 hover:border-primary/50 transition-all duration-150">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-text font-mono">{item.domain}</h3>
                            <Badge variant={getActionColor(action)}>
                              {action.toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-xs text-text-secondary">
                            {new Date(item.scan_time).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-sm text-text-secondary mb-2">{description}</p>

                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <span className="font-medium">By:</span>
                          <span>{item.url ? 'Automated Scan' : 'System'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {error && !loading && (
                <div className="text-center py-8">
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-6">
                    <p className="text-warning font-medium mb-2">Data Loading Issue</p>
                    <p className="text-text-secondary text-sm">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors duration-150"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              )}
              {apiCallMade && history.length === 0 && !loading && !error && (
                <div className="text-center py-8 text-text-secondary">
                  No scan history available in backend.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
