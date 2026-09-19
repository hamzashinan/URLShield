import React, { useState } from 'react';
import {
  Database, HardDrive, Download, Upload, Trash2, Archive,
  Shield, Clock, CheckCircle2, AlertTriangle, RefreshCw,
  FileText, Settings, Calendar, BarChart3, Filter, Search,
  FolderOpen, Eye, X, CircleX
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StorageMetric {
  category: string;
  size: string;
  items: number;
  icon: React.ElementType;
  color: string;
  percentage: number;
}

interface RetentionPolicy {
  id: string;
  name: string;
  retention: string;
  autoDelete: boolean;
  lastCleanup: string;
  itemsAffected: number;
}

interface BackupEntry {
  id: string;
  name: string;
  size: string;
  createdAt: string;
  type: 'auto' | 'manual';
  status: 'complete' | 'in-progress' | 'failed';
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const storageMetrics: StorageMetric[] = [
  { category: 'Scan Evidence', size: '1.2 GB', items: 4832, icon: FolderOpen, color: 'primary', percentage: 52 },
  { category: 'Screenshots', size: '680 MB', items: 2341, icon: Eye, color: 'success', percentage: 29 },
  { category: 'ML Models', size: '245 MB', items: 8, icon: Database, color: 'warning', percentage: 11 },
  { category: 'Templates', size: '89 MB', items: 45, icon: FileText, color: 'danger', percentage: 4 },
  { category: 'Logs & Reports', size: '96 MB', items: 1200, icon: BarChart3, color: 'text-secondary', percentage: 4 },
];

const retentionPolicies: RetentionPolicy[] = [
  { id: 'pol-1', name: 'Scan Evidence', retention: '90 days', autoDelete: true, lastCleanup: '2026-05-08', itemsAffected: 342 },
  { id: 'pol-2', name: 'Screenshots', retention: '60 days', autoDelete: true, lastCleanup: '2026-05-08', itemsAffected: 567 },
  { id: 'pol-3', name: 'Audit Logs', retention: '1 year', autoDelete: false, lastCleanup: 'Never', itemsAffected: 0 },
  { id: 'pol-4', name: 'ML Training Data', retention: 'Indefinite', autoDelete: false, lastCleanup: 'N/A', itemsAffected: 0 },
  { id: 'pol-5', name: 'Batch Job Results', retention: '30 days', autoDelete: true, lastCleanup: '2026-05-07', itemsAffected: 89 },
];

const backups: BackupEntry[] = [
  { id: 'bk-1', name: 'Daily Auto-Backup', size: '2.3 GB', createdAt: '2026-05-09 02:00', type: 'auto', status: 'complete' },
  { id: 'bk-2', name: 'Daily Auto-Backup', size: '2.2 GB', createdAt: '2026-05-08 02:00', type: 'auto', status: 'complete' },
  { id: 'bk-3', name: 'Pre-Migration Backup', size: '2.1 GB', createdAt: '2026-05-07 14:30', type: 'manual', status: 'complete' },
  { id: 'bk-4', name: 'Daily Auto-Backup', size: '2.1 GB', createdAt: '2026-05-07 02:00', type: 'auto', status: 'complete' },
  { id: 'bk-5', name: 'Manual Snapshot', size: '—', createdAt: '2026-05-06 16:00', type: 'manual', status: 'failed' },
];

// ─── Donut Chart ────────────────────────────────────────────────────────────

const StorageDonut = ({ metrics }: { metrics: StorageMetric[] }) => {
  let cumulative = 0;
  const total = metrics.reduce((acc, m) => acc + m.percentage, 0);
  const colorMap: Record<string, string> = {
    primary: 'hsl(215, 84%, 56%)',
    success: 'hsl(173, 80%, 40%)',
    warning: 'hsl(38, 92%, 50%)',
    danger: 'hsl(0, 72%, 60%)',
    'text-secondary': 'hsl(210, 15%, 65%)',
  };

  return (
    <div className="flex items-center justify-center relative">
      <svg viewBox="0 0 36 36" className="w-[140px] h-[140px] transform -rotate-90">
        {metrics.map((m, i) => {
          const dasharray = `${m.percentage} 100`;
          const offset = -cumulative;
          cumulative += m.percentage;
          return (
            <circle
              key={i}
              cx="18" cy="18" r="15.9"
              fill="transparent"
              stroke={colorMap[m.color] || 'hsl(215, 84%, 56%)'}
              strokeWidth="2.5"
              strokeDasharray={dasharray}
              strokeDashoffset={offset}
              className="transition-all duration-500 hover:stroke-[4px] cursor-pointer"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-text">2.3 GB</span>
        <span className="text-[9px] text-text-secondary">Total Used</span>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const DataManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'storage' | 'retention' | 'backup' | 'export'>('storage');

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen text-text p-2 sm:p-4 md:p-8 space-y-6">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/20">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-text">Data Management</h1>
          <p className="text-xs text-text-secondary mt-1">Manage data lifecycle, retention policies, backups, and exports.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary bg-surface border border-border/40 rounded-lg hover:text-text transition-colors">
            <Upload size={14} /> Restore Backup
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors">
            <Download size={14} /> Create Backup
          </button>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-surface border border-border/40 rounded-lg p-1 w-fit">
        {[
          { id: 'storage' as const, label: 'Storage', icon: HardDrive },
          { id: 'retention' as const, label: 'Retention', icon: Clock },
          { id: 'backup' as const, label: 'Backups', icon: Archive },
          { id: 'export' as const, label: 'Export', icon: Download },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.id ? 'bg-bg text-text shadow-sm border border-border/50' : 'text-text-secondary hover:text-text'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Storage Tab ─── */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Donut Chart */}
            <div className="lg:col-span-4 bg-surface border border-border/40 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">Storage Breakdown</h3>
              <StorageDonut metrics={storageMetrics} />
              <div className="flex flex-col gap-2 mt-4">
                {storageMetrics.map(m => (
                  <div key={m.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full bg-${m.color}`} />
                      <span className="text-text-secondary">{m.category}</span>
                    </div>
                    <span className="text-text font-medium">{m.size}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Metrics */}
            <div className="lg:col-span-8 space-y-4">
              {storageMetrics.map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.category} className="bg-surface border border-border/40 rounded-xl p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-${m.color}/15 flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} className={`text-${m.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-text">{m.category}</span>
                        <span className="text-xs text-text-secondary">{m.size} • {m.items.toLocaleString()} items</span>
                      </div>
                      <div className="w-full bg-border/20 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-${m.color} transition-all duration-700`} style={{ width: `${m.percentage}%` }} />
                      </div>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-border/20 text-text-secondary transition-colors flex-shrink-0">
                      <Settings size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Quality */}
          <div className="bg-surface border border-border/40 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={14} className="text-primary" /> Data Quality Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Complete Records', value: '97.8%', icon: CheckCircle2, color: 'success' },
                { label: 'Missing Fields', value: '2.2%', icon: AlertTriangle, color: 'warning' },
                { label: 'Stale Records', value: '156', icon: Clock, color: 'text-secondary' },
                { label: 'Duplicate Entries', value: '23', icon: Database, color: 'danger' },
              ].map(metric => (
                <div key={metric.label} className="bg-bg/50 border border-border/20 rounded-lg p-4 text-center">
                  <metric.icon size={20} className={`text-${metric.color} mx-auto mb-2`} />
                  <p className="text-xl font-semibold text-text">{metric.value}</p>
                  <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-wider">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Retention Tab ─── */}
      {activeTab === 'retention' && (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
            <Shield size={18} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text">GDPR & Compliance</p>
              <p className="text-xs text-text-secondary mt-0.5">Retention policies are applied automatically. Audit logs are exempt from auto-deletion per SOC2 requirements.</p>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="text-[10px] text-text-secondary uppercase tracking-widest bg-bg/50 border-b border-border/20">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Data Category</th>
                  <th className="px-5 py-3.5 font-medium">Retention Period</th>
                  <th className="px-5 py-3.5 font-medium">Auto-Delete</th>
                  <th className="px-5 py-3.5 font-medium">Last Cleanup</th>
                  <th className="px-5 py-3.5 font-medium">Items Affected</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {retentionPolicies.map(policy => (
                  <tr key={policy.id} className="hover:bg-border/5 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-text">{policy.name}</td>
                    <td className="px-5 py-4 text-xs text-text-secondary">{policy.retention}</td>
                    <td className="px-5 py-4">
                      {policy.autoDelete ? (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-success/15 text-success rounded-md border border-success/30">Enabled</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-border/15 text-text-secondary rounded-md border border-border/30">Disabled</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-text-secondary">{policy.lastCleanup}</td>
                    <td className="px-5 py-4 text-xs text-text font-mono">{policy.itemsAffected}</td>
                    <td className="px-5 py-4 text-right">
                      <button className="px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Backup Tab ─── */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Last Backup', value: 'Today 02:00', icon: CheckCircle2, color: 'success' },
              { label: 'Backup Size', value: '2.3 GB', icon: HardDrive, color: 'primary' },
              { label: 'Backup Schedule', value: 'Daily at 2 AM', icon: Calendar, color: 'warning' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface border border-border/40 rounded-xl p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-${stat.color}/15 flex items-center justify-center`}>
                  <stat.icon size={20} className={`text-${stat.color}`} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-text">{stat.value}</p>
                  <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/20 bg-bg/30">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                <Archive size={14} className="text-primary" /> Backup History
              </h3>
            </div>
            <div className="divide-y divide-border/10">
              {backups.map(backup => (
                <div key={backup.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-border/5 transition-colors">
                  <div className="flex items-center gap-3">
                    {backup.status === 'complete' ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : backup.status === 'failed' ? (
                      <CircleX size={16} className="text-danger" />
                    ) : (
                      <RefreshCw size={16} className="text-warning animate-spin" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-text">{backup.name}</p>
                      <p className="text-[10px] text-text-secondary">{backup.createdAt} • {backup.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border ${
                      backup.type === 'auto' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-warning/15 text-warning border-warning/30'
                    }`}>{backup.type}</span>
                    {backup.status === 'complete' && (
                      <button className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary transition-colors">
                        <Download size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Export Tab ─── */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border/40 rounded-xl p-6">
            <h3 className="text-sm font-medium text-text mb-1">Bulk Data Export</h3>
            <p className="text-xs text-text-secondary mb-6">Export your data in various formats with custom filters.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Data Type</label>
                <select className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
                  <option>All Scan Data</option>
                  <option>Domains Only</option>
                  <option>ML Model Data</option>
                  <option>Audit Logs</option>
                  <option>Evidence Files</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Format</label>
                <select className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
                  <option>CSV</option>
                  <option>JSON</option>
                  <option>Excel (.xlsx)</option>
                  <option>PDF Report</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Date Range</label>
                <select className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                  <option>All Time</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Anonymize PII</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                    <input type="checkbox" className="accent-primary rounded" />
                    Enable GDPR-compliant anonymization
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors">
                <Download size={16} />
                Generate Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
