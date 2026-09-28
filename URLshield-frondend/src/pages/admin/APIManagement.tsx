import React, { useState } from 'react';
import {
  Key, Plus, Copy, Eye, EyeOff, Trash2, RefreshCw, Clock,
  BarChart3, Globe, Shield, AlertTriangle, CheckCircle2,
  ExternalLink, Webhook, Settings, Activity, ChevronRight, X
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface APIKey {
  id: string;
  name: string;
  keyPreview: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsed: string;
  requestsToday: number;
  requestsTotal: number;
  rateLimit: number;
  status: 'active' | 'expired' | 'revoked';
}

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'failing' | 'disabled';
  lastDelivery: string;
  successRate: number;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockApiKeys: APIKey[] = [
  { id: 'key-1', name: 'Production API Key', keyPreview: 'yc_prod_••••••••a3f8', scopes: ['scrape', 'domains', 'metrics', 'jobs'], createdAt: '2026-03-01', expiresAt: '2027-03-01', lastUsed: '1 min ago', requestsToday: 1247, requestsTotal: 89432, rateLimit: 1000, status: 'active' },
  { id: 'key-2', name: 'Development Key', keyPreview: 'yc_dev_••••••••b7e2', scopes: ['scrape', 'domains'], createdAt: '2026-04-15', expiresAt: '2026-10-15', lastUsed: '2 hours ago', requestsToday: 56, requestsTotal: 3421, rateLimit: 100, status: 'active' },
  { id: 'key-3', name: 'CI/CD Pipeline', keyPreview: 'yc_ci_••••••••c1d9', scopes: ['metrics', 'health'], createdAt: '2026-02-10', expiresAt: '2026-08-10', lastUsed: '15 min ago', requestsToday: 342, requestsTotal: 15678, rateLimit: 500, status: 'active' },
  { id: 'key-4', name: 'Deprecated Key', keyPreview: 'yc_old_••••••••d4a1', scopes: ['scrape'], createdAt: '2025-12-01', expiresAt: '2026-06-01', lastUsed: '30 days ago', requestsToday: 0, requestsTotal: 45210, rateLimit: 100, status: 'expired' },
];

const mockWebhooks: WebhookConfig[] = [
  { id: 'wh-1', url: 'https://slack.com/api/webhooks/urlshield-alerts', events: ['threat.detected', 'scan.complete'], status: 'active', lastDelivery: '5 min ago', successRate: 99.8 },
  { id: 'wh-2', url: 'https://api.pagerduty.com/incidents', events: ['threat.critical'], status: 'active', lastDelivery: '1 hour ago', successRate: 100 },
  { id: 'wh-3', url: 'https://hooks.internal.corp/siem', events: ['audit.log', 'threat.detected', 'user.login'], status: 'failing', lastDelivery: '3 days ago', successRate: 45.2 },
];

// ─── API Key Card ───────────────────────────────────────────────────────────

const APIKeyCard = ({ apiKey }: { apiKey: APIKey }) => {
  const [showKey, setShowKey] = useState(false);

  const statusColors: Record<string, string> = {
    active: 'bg-success/15 text-success border-success/30',
    expired: 'bg-danger/15 text-danger border-danger/30',
    revoked: 'bg-text-secondary/15 text-text-secondary border-text-secondary/30',
  };

  return (
    <div className={`bg-surface border rounded-xl p-5 transition-all duration-200 hover:border-border ${
      apiKey.status === 'active' ? 'border-border/40' : 'border-border/20 opacity-70'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            apiKey.status === 'active' ? 'bg-primary/15' : 'bg-border/20'
          }`}>
            <Key size={18} className={apiKey.status === 'active' ? 'text-primary' : 'text-text-secondary'} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-text">{apiKey.name}</h3>
            <p className="text-[10px] text-text-secondary">Created {apiKey.createdAt}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border ${statusColors[apiKey.status]}`}>
          {apiKey.status}
        </span>
      </div>

      {/* Key Display */}
      <div className="bg-bg/50 border border-border/20 rounded-lg px-3 py-2 flex items-center justify-between mb-4">
        <code className="text-xs text-text font-mono">{showKey ? 'yc_prod_sk_live_a3f8x9b2c1d7e4f6' : apiKey.keyPreview}</code>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowKey(!showKey)} className="p-1 rounded hover:bg-border/20 text-text-secondary transition-colors">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button className="p-1 rounded hover:bg-border/20 text-text-secondary transition-colors">
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Scopes */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {apiKey.scopes.map(scope => (
          <span key={scope} className="px-2 py-0.5 text-[9px] font-medium bg-bg border border-border/30 rounded text-text-secondary">
            {scope}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-text">{apiKey.requestsToday.toLocaleString()}</p>
          <p className="text-[9px] text-text-secondary uppercase">Today</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-text">{(apiKey.requestsTotal / 1000).toFixed(1)}k</p>
          <p className="text-[9px] text-text-secondary uppercase">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-text">{apiKey.rateLimit}</p>
          <p className="text-[9px] text-text-secondary uppercase">Rate/min</p>
        </div>
      </div>

      {/* Rate Limit Usage */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-text-secondary mb-1">
          <span>Rate limit usage</span>
          <span>{Math.round((apiKey.requestsToday / (apiKey.rateLimit * 60 * 24)) * 100)}%</span>
        </div>
        <div className="w-full bg-border/20 h-1.5 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (apiKey.requestsToday / (apiKey.rateLimit * 60 * 24)) * 100)}%` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/20">
        <div className="flex items-center gap-1 text-[10px] text-text-secondary">
          <Clock size={10} />
          <span>Last used: {apiKey.lastUsed}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary transition-colors" title="Rotate Key">
            <RefreshCw size={14} />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors" title="Revoke Key">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Key Modal ───────────────────────────────────────────────────────

const CreateKeyModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in">
      <div className="bg-surface border border-border/40 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Key size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text">Create API Key</h3>
              <p className="text-xs text-text-secondary">Generate a new API key with scopes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors p-1 rounded-lg hover:bg-border/20">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Key Name</label>
            <input placeholder="e.g., Production API Key" className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-secondary/50 outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {['scrape', 'domains', 'metrics', 'jobs', 'health', 'keywords', 'training'].map(scope => (
                <label key={scope} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/40 bg-bg text-xs text-text cursor-pointer hover:border-primary/30 transition-colors">
                  <input type="checkbox" className="accent-primary rounded" />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Rate Limit (requests/min)</label>
            <input type="number" defaultValue={100} className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Expiration</label>
            <select className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
              <option>30 days</option>
              <option>90 days</option>
              <option>6 months</option>
              <option>1 year</option>
              <option>Never</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors rounded-lg border border-border/40 hover:bg-bg">Cancel</button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors">Generate Key</button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const APIManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen text-text p-2 sm:p-4 md:p-8 space-y-6">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/20">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-text">API Management</h1>
          <p className="text-xs text-text-secondary mt-1">Manage API keys, webhooks, and developer integrations.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
        >
          <Plus size={14} />
          Create API Key
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-surface border border-border/40 rounded-lg p-1 w-fit">
        {[
          { id: 'keys' as const, label: 'API Keys', icon: Key },
          { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
          { id: 'docs' as const, label: 'Documentation', icon: ExternalLink },
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

      {/* ─── API Keys Tab ─── */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Active Keys', value: mockApiKeys.filter(k => k.status === 'active').length, icon: Key, color: 'success' },
              { label: 'Requests Today', value: '1,645', icon: Activity, color: 'primary' },
              { label: 'Total Requests', value: '153k', icon: BarChart3, color: 'warning' },
              { label: 'Expired Keys', value: mockApiKeys.filter(k => k.status === 'expired').length, icon: AlertTriangle, color: 'danger' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface border border-border/40 rounded-xl p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-${stat.color}/15 flex items-center justify-center`}>
                  <stat.icon size={20} className={`text-${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-text">{stat.value}</p>
                  <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Key Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mockApiKeys.map(key => (
              <APIKeyCard key={key.id} apiKey={key} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Webhooks Tab ─── */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">Configure webhook endpoints for real-time event delivery.</p>
            <button className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
              <Plus size={14} /> Add Webhook
            </button>
          </div>

          {mockWebhooks.map(wh => (
            <div key={wh.id} className="bg-surface border border-border/40 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    wh.status === 'active' ? 'bg-success/15' : wh.status === 'failing' ? 'bg-danger/15' : 'bg-border/20'
                  }`}>
                    <Webhook size={16} className={wh.status === 'active' ? 'text-success' : wh.status === 'failing' ? 'text-danger' : 'text-text-secondary'} />
                  </div>
                  <div>
                    <p className="text-sm font-mono text-text">{wh.url}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {wh.events.map(ev => (
                        <span key={ev} className="px-1.5 py-0.5 text-[8px] font-medium bg-bg border border-border/30 rounded text-text-secondary">{ev}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border ${
                  wh.status === 'active' ? 'bg-success/15 text-success border-success/30' :
                  wh.status === 'failing' ? 'bg-danger/15 text-danger border-danger/30' :
                  'bg-border/15 text-text-secondary border-border/30'
                }`}>{wh.status}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary pt-3 border-t border-border/20">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Clock size={10} /> Last delivery: {wh.lastDelivery}</span>
                  <span className="flex items-center gap-1">
                    {wh.successRate > 90 ? <CheckCircle2 size={10} className="text-success" /> : <AlertTriangle size={10} className="text-danger" />}
                    Success rate: {wh.successRate}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-border/20 transition-colors"><Settings size={14} /></button>
                  <button className="p-1.5 rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Documentation Tab ─── */}
      {activeTab === 'docs' && (
        <div className="bg-surface border border-border/40 rounded-xl p-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <ExternalLink size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">API Documentation</h2>
            <p className="text-sm text-text-secondary mb-6">Explore the complete URLShield REST API reference with interactive examples.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {[
                { title: 'Getting Started', desc: 'Authentication, rate limits, and quickstart guide', icon: Key },
                { title: 'Endpoints', desc: 'Complete reference for all API endpoints', icon: Globe },
                { title: 'SDKs & Libraries', desc: 'Python, JavaScript, and Go client libraries', icon: Settings },
              ].map(doc => (
                <div key={doc.title} className="bg-bg/50 border border-border/20 rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer group">
                  <doc.icon size={20} className="text-primary mb-2" />
                  <h3 className="text-sm font-medium text-text mb-1 group-hover:text-primary transition-colors">{doc.title}</h3>
                  <p className="text-[10px] text-text-secondary">{doc.desc}</p>
                  <ChevronRight size={14} className="text-text-secondary mt-2 group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <CreateKeyModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
