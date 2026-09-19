import React, { useState } from 'react';
import {
  Bell, Plus, Edit2, Trash2, Play, Pause, CheckCircle2, AlertTriangle,
  XCircle, Clock, Mail, MessageSquare, Webhook, Phone, ChevronRight,
  Zap, Filter, Settings, Activity, Globe, Cpu, Database, Shield,
  X, ArrowRight
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  conditionType: 'threshold' | 'pattern' | 'anomaly';
  channels: string[];
  status: 'active' | 'paused' | 'triggered';
  triggerCount: number;
  lastTriggered: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cooldown: string;
}

interface AlertHistoryEntry {
  id: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockRules: AlertRule[] = [
  { id: 'rule-1', name: 'Critical Threat Detected', description: 'Alert when a high-confidence phishing domain is detected', condition: 'threat.confidence > 95%', conditionType: 'threshold', channels: ['email', 'slack', 'pagerduty'], status: 'active', triggerCount: 23, lastTriggered: '2 hours ago', severity: 'critical', cooldown: '5 min' },
  { id: 'rule-2', name: 'Queue Depth Alert', description: 'Alert when job queue exceeds capacity threshold', condition: 'queue.depth > 100', conditionType: 'threshold', channels: ['slack'], status: 'active', triggerCount: 5, lastTriggered: '1 day ago', severity: 'high', cooldown: '15 min' },
  { id: 'rule-3', name: 'Model Accuracy Drop', description: 'Alert when ML model accuracy drops below threshold', condition: 'model.accuracy < 95%', conditionType: 'threshold', channels: ['email', 'slack'], status: 'active', triggerCount: 1, lastTriggered: '5 days ago', severity: 'high', cooldown: '1 hour' },
  { id: 'rule-4', name: 'Zero-Day Pattern', description: 'Alert on anomalous scan patterns that may indicate zero-day attacks', condition: 'anomaly.score > 3σ', conditionType: 'anomaly', channels: ['email', 'slack', 'pagerduty', 'sms'], status: 'active', triggerCount: 2, lastTriggered: '3 days ago', severity: 'critical', cooldown: '30 min' },
  { id: 'rule-5', name: 'High FP Rate', description: 'Alert when false positive rate exceeds acceptable threshold', condition: 'metrics.fp_rate > 5%', conditionType: 'threshold', channels: ['email'], status: 'paused', triggerCount: 8, lastTriggered: '2 weeks ago', severity: 'medium', cooldown: '6 hours' },
  { id: 'rule-6', name: 'Service Health Check', description: 'Alert when any backend service is unresponsive', condition: 'service.response_time > 5s OR service.status = down', conditionType: 'threshold', channels: ['slack', 'pagerduty'], status: 'triggered', triggerCount: 3, lastTriggered: 'Now', severity: 'critical', cooldown: '5 min' },
];

const mockAlertHistory: AlertHistoryEntry[] = [
  { id: 'alert-1', ruleName: 'Service Health Check', severity: 'critical', timestamp: '2026-05-09T14:35:00Z', message: 'WHOIS Lookup service is down — connection timeout', acknowledged: false },
  { id: 'alert-2', ruleName: 'Critical Threat Detected', severity: 'critical', timestamp: '2026-05-09T12:20:00Z', message: 'High-confidence phishing: fake-amazon-login.com (confidence: 97.3%)', acknowledged: true, acknowledgedBy: 'Deepika KM' },
  { id: 'alert-3', ruleName: 'Queue Depth Alert', severity: 'high', timestamp: '2026-05-08T16:45:00Z', message: 'Queue depth reached 142 items — processing backlog detected', acknowledged: true, acknowledgedBy: 'Muhammad Shahal' },
  { id: 'alert-4', ruleName: 'Zero-Day Pattern', severity: 'critical', timestamp: '2026-05-06T08:30:00Z', message: 'Anomalous scan pattern detected — 3.2σ deviation from baseline', acknowledged: true, acknowledgedBy: 'Emily Xavier' },
  { id: 'alert-5', ruleName: 'Model Accuracy Drop', severity: 'high', timestamp: '2026-05-04T11:15:00Z', message: 'Model accuracy dropped to 94.8% — retraining recommended', acknowledged: true, acknowledgedBy: 'Deepika KM' },
];

// ─── Helper Components ──────────────────────────────────────────────────────

const SeverityBadge = ({ severity }: { severity: AlertRule['severity'] }) => {
  const styles: Record<string, string> = {
    critical: 'bg-danger/15 text-danger border-danger/30',
    high: 'bg-warning/15 text-warning border-warning/30',
    medium: 'bg-primary/15 text-primary border-primary/30',
    low: 'bg-text-secondary/15 text-text-secondary border-text-secondary/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${styles[severity]}`}>
      {severity}
    </span>
  );
};

const ChannelIcon = ({ channel }: { channel: string }) => {
  const icons: Record<string, { icon: React.ElementType; color: string }> = {
    email: { icon: Mail, color: 'text-primary' },
    slack: { icon: MessageSquare, color: 'text-success' },
    pagerduty: { icon: Phone, color: 'text-danger' },
    sms: { icon: Phone, color: 'text-warning' },
    webhook: { icon: Webhook, color: 'text-text-secondary' },
  };
  const { icon: Icon, color } = icons[channel] || icons.webhook;
  return (
    <div className={`w-6 h-6 rounded-md bg-bg/50 border border-border/20 flex items-center justify-center ${color}`} title={channel}>
      <Icon size={12} />
    </div>
  );
};

// ─── Create Rule Modal ──────────────────────────────────────────────────────

const CreateRuleModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in">
      <div className="bg-surface border border-border/40 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/20 sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Zap size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text">Create Alert Rule</h3>
              <p className="text-xs text-text-secondary">Define conditions and actions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors p-1 rounded-lg hover:bg-border/20">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Rule Name</label>
            <input placeholder="e.g., High Threat Alert" className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-secondary/50 outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Description</label>
            <textarea rows={2} placeholder="What does this rule monitor?" className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-secondary/50 outline-none focus:border-primary/50 resize-none" />
          </div>

          {/* Condition Builder */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">When this happens...</label>
            <div className="bg-bg/50 border border-border/20 rounded-lg p-4 space-y-3">
              <div className="flex gap-2">
                <select className="bg-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-primary/50 flex-1">
                  <option>Queue Depth</option>
                  <option>Threat Confidence</option>
                  <option>Model Accuracy</option>
                  <option>FP Rate</option>
                  <option>Service Status</option>
                  <option>Error Rate</option>
                </select>
                <select className="bg-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-primary/50 w-24">
                  <option>&gt;</option>
                  <option>&lt;</option>
                  <option>=</option>
                  <option>≠</option>
                  <option>≥</option>
                  <option>≤</option>
                </select>
                <input type="number" defaultValue={100} className="bg-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-primary/50 w-24" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Do this...</label>
            <div className="flex flex-wrap gap-2">
              {['Email', 'Slack', 'PagerDuty', 'SMS', 'Webhook'].map(channel => (
                <label key={channel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 bg-bg text-xs text-text cursor-pointer hover:border-primary/30 transition-colors">
                  <input type="checkbox" className="accent-primary rounded" />
                  {channel}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Severity</label>
              <select className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Cooldown</label>
              <select className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
                <option>5 minutes</option>
                <option>15 minutes</option>
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>6 hours</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors rounded-lg border border-border/40 hover:bg-bg">Cancel</button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors">
            <Zap size={14} className="inline mr-2" />
            Create Rule
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const AlertRules: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const stats = {
    active: mockRules.filter(r => r.status === 'active').length,
    triggered: mockRules.filter(r => r.status === 'triggered').length,
    paused: mockRules.filter(r => r.status === 'paused').length,
    unacked: mockAlertHistory.filter(a => !a.acknowledged).length,
  };

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen text-text p-2 sm:p-4 md:p-8 space-y-6">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/20">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-text">Alert Rules Engine</h1>
          <p className="text-xs text-text-secondary mt-1">Configure automated alert rules with conditions and notification channels.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
        >
          <Plus size={14} />
          Create Rule
        </button>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Rules', value: stats.active, icon: Play, color: 'success' },
          { label: 'Currently Triggered', value: stats.triggered, icon: AlertTriangle, color: 'danger' },
          { label: 'Paused Rules', value: stats.paused, icon: Pause, color: 'text-secondary' },
          { label: 'Unacknowledged', value: stats.unacked, icon: Bell, color: 'warning' },
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

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-surface border border-border/40 rounded-lg p-1 w-fit">
        {[
          { id: 'rules' as const, label: 'Alert Rules', icon: Zap },
          { id: 'history' as const, label: 'Alert History', icon: Clock },
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

      {/* ─── Rules Tab ─── */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {mockRules.map(rule => (
            <div key={rule.id} className={`bg-surface border rounded-xl p-5 transition-all duration-200 hover:border-border ${
              rule.status === 'triggered' ? 'border-danger/40 bg-danger/[0.02]' :
              rule.status === 'paused' ? 'border-border/20 opacity-70' : 'border-border/40'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      rule.status === 'triggered' ? 'bg-danger/15' : rule.status === 'active' ? 'bg-success/15' : 'bg-border/20'
                    }`}>
                      {rule.status === 'triggered' ? (
                        <Bell size={16} className="text-danger animate-pulse" />
                      ) : rule.status === 'active' ? (
                        <Zap size={16} className="text-success" />
                      ) : (
                        <Pause size={16} className="text-text-secondary" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-text">{rule.name}</h3>
                      <p className="text-[10px] text-text-secondary">{rule.description}</p>
                    </div>
                  </div>

                  {/* Condition + Action Flow */}
                  <div className="flex items-center gap-2 ml-11 mt-3 mb-3">
                    <div className="px-3 py-1.5 bg-bg/50 border border-border/20 rounded-lg text-xs text-text">
                      <span className="text-text-secondary">When </span>
                      <code className="text-primary font-mono">{rule.condition}</code>
                    </div>
                    <ArrowRight size={14} className="text-text-secondary/40" />
                    <div className="flex items-center gap-1">
                      {rule.channels.map(ch => <ChannelIcon key={ch} channel={ch} />)}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 ml-11 text-[10px] text-text-secondary">
                    <span className="flex items-center gap-1"><Activity size={10} /> Triggered {rule.triggerCount} times</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> Last: {rule.lastTriggered}</span>
                    <span className="flex items-center gap-1"><Settings size={10} /> Cooldown: {rule.cooldown}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SeverityBadge severity={rule.severity} />
                  <button className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary transition-colors" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary transition-colors" title={rule.status === 'paused' ? 'Resume' : 'Pause'}>
                    {rule.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── History Tab ─── */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/20 bg-bg/30">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Recent Alerts
            </h3>
          </div>
          <div className="divide-y divide-border/10">
            {mockAlertHistory.map(alert => (
              <div key={alert.id} className={`px-5 py-4 flex items-center justify-between hover:bg-border/5 transition-colors ${
                !alert.acknowledged ? 'bg-danger/[0.02]' : ''
              }`}>
                <div className="flex items-center gap-3">
                  {!alert.acknowledged ? (
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                  ) : (
                    <CheckCircle2 size={14} className="text-success" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-text">{alert.ruleName}</span>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <p className="text-xs text-text-secondary">{alert.message}</p>
                    {alert.acknowledgedBy && (
                      <p className="text-[10px] text-text-secondary/60 mt-0.5">Acknowledged by {alert.acknowledgedBy}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary flex-shrink-0">
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  {!alert.acknowledged && (
                    <button className="px-2.5 py-1 text-[10px] font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateRuleModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
