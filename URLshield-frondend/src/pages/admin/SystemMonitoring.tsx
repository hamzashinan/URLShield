import React, { useState } from 'react';
import {
  Server, Cpu, HardDrive, MemoryStick, Activity, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, Terminal, Database, Globe, Shield, Zap,
  ArrowUpRight, ArrowDownRight, Pause
} from 'lucide-react';
import { useSystemMonitoring } from '../../hooks/useApi';
import type { ServiceStatus as ServiceStatusType, ResourceUsage, QueueMetrics, LogEntry } from '../../types/api';

// ─── Sparkline Component ────────────────────────────────────────────────────

const Sparkline = ({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 120;

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = (height - 2) - ((d - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#spark-${color.replace(/[^a-zA-Z0-9]/g, '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const StatusBadge = ({ status }: { status: ServiceStatusType['status'] }) => {
  const config: Record<string, { icon: React.ElementType; className: string; label: string }> = {
    healthy: { icon: CheckCircle2, className: 'bg-success/15 text-success border border-success/30', label: 'Healthy' },
    degraded: { icon: AlertTriangle, className: 'bg-warning/15 text-warning border border-warning/30', label: 'Degraded' },
    down: { icon: XCircle, className: 'bg-danger/15 text-danger border border-danger/30', label: 'Down' },
  };
  const { icon: Icon, className, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${className}`}>
      <Icon size={10} />
      {label}
    </span>
  );
};

const serviceIconMap: Record<string, React.ElementType> = {
  api: Server,
  worker: Zap,
  ml: Cpu,
  scraper: Globe,
  sse: Activity,
  dns: Globe,
  whois: Shield,
  storage: Database,
};

export const SystemMonitoring: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, loading, error } = useSystemMonitoring(autoRefresh ? 5000 : undefined);

  const services = data?.service_statuses ?? [];
  const resourceUsage = data?.resource_usage;
  const queueMetrics = data?.queue_metrics;
  const logs = data?.logs ?? [];

  const healthyCount = services.filter((service) => service.status === 'healthy').length;
  const degradedCount = services.filter((service) => service.status === 'degraded').length;
  const downCount = services.filter((service) => service.status === 'down').length;
  const lastChecked = data?.last_checked ? new Date(data.last_checked).toLocaleTimeString() : '...';

  const resources = resourceUsage ? [
    { label: 'CPU Usage', value: resourceUsage.cpu.value, data: resourceUsage.cpu.history, color: 'hsl(215, 84%, 56%)', icon: Cpu, trend: resourceUsage.cpu.trend },
    { label: 'Memory Usage', value: resourceUsage.memory.value, data: resourceUsage.memory.history, color: 'hsl(173, 80%, 40%)', icon: MemoryStick, trend: resourceUsage.memory.trend },
    { label: 'Disk Usage', value: resourceUsage.disk.value, data: resourceUsage.disk.history, color: 'hsl(38, 92%, 50%)', icon: HardDrive, trend: resourceUsage.disk.trend },
  ] : [];

  const queueStats = [
    { label: 'Queue Depth', value: queueMetrics?.queue_depth ?? 0, max: Math.max(1, queueMetrics?.queue_depth ?? 1), barClass: 'bg-primary' },
    { label: 'Active Workers', value: queueMetrics?.active_workers ?? 0, max: Math.max(4, queueMetrics?.active_workers ?? 1), barClass: 'bg-success' },
    { label: 'Jobs/Minute', value: queueMetrics?.jobs_per_minute ?? 0, max: Math.max(30, queueMetrics?.jobs_per_minute ?? 1), barClass: 'bg-warning' },
    { label: 'Error Rate', value: queueMetrics?.error_rate ?? 0, max: 100, barClass: 'bg-danger', suffix: '%' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen text-text p-2 sm:p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/20">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-text">System Monitoring</h1>
          <p className="text-xs text-text-secondary mt-1">Infrastructure health, resource usage, and application logs.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              autoRefresh ? 'text-success bg-success/5 border-success/30' : 'text-text-secondary bg-surface border-border/40'
            }`}
          >
            {autoRefresh ? <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '3s' }} /> : <Pause size={14} />}
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm bg-danger/10 border border-danger/30 text-danger">
          Unable to load monitoring data: {error}
        </div>
      )}

      <div className={`rounded-xl p-4 flex items-center justify-between border ${
        downCount > 0 ? 'bg-danger/5 border-danger/30' : degradedCount > 0 ? 'bg-warning/5 border-warning/30' : 'bg-success/5 border-success/30'
      }`}>
        <div className="flex items-center gap-3">
          {downCount > 0 ? (
            <XCircle size={24} className="text-danger" />
          ) : degradedCount > 0 ? (
            <AlertTriangle size={24} className="text-warning" />
          ) : (
            <CheckCircle2 size={24} className="text-success" />
          )}
          <div>
            <p className="text-sm font-medium text-text">
              {downCount > 0 ? 'System Alert — Service Outage Detected' : degradedCount > 0 ? 'Partial Degradation Detected' : 'All Systems Operational'}
            </p>
            <p className="text-[10px] text-text-secondary">
              {healthyCount} healthy • {degradedCount} degraded • {downCount} down — Last checked: {lastChecked}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-text-secondary flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${downCount > 0 ? 'bg-danger' : degradedCount > 0 ? 'bg-warning' : 'bg-success'} animate-pulse`} />
          Live
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resources.length > 0 ? resources.map((resource) => (
          <div key={resource.label} className="bg-surface border border-border/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <resource.icon size={16} className="text-text-secondary" />
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">{resource.label}</span>
              </div>
              <span className={`text-[10px] font-medium flex items-center gap-0.5 ${resource.trend < 0 ? 'text-success' : 'text-warning'}`}>
                {resource.trend < 0 ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                {Math.abs(resource.trend)}%
              </span>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-3xl font-semibold text-text">{resource.value}%</p>
              </div>
              <div className="flex-1 h-[40px]">
                <Sparkline data={resource.data} color={resource.color} />
              </div>
            </div>
            <div className="w-full bg-border/20 h-2 rounded-full overflow-hidden mt-3">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${resource.value}%`, backgroundColor: resource.color }} />
            </div>
          </div>
        )) : (
          <div className="md:col-span-3 bg-surface border border-border/40 rounded-xl p-5 text-center text-text-secondary">
            {loading ? 'Loading resource usage...' : 'Resource usage unavailable.'}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/20 bg-bg/30">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
            <Server size={14} className="text-primary" /> Service Status Dashboard
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border/10">
          {services.length > 0 ? services.map((service) => {
            const Icon = serviceIconMap[service.id] ?? Server;
            return (
              <div key={service.id} className="bg-surface p-4 hover:bg-border/5 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-text-secondary" />
                    <span className="text-sm font-medium text-text">{service.name}</span>
                  </div>
                  <StatusBadge status={service.status} />
                </div>
                <p className="text-[10px] text-text-secondary mb-3">{service.details}</p>
                <div className="flex items-center justify-between text-[10px] text-text-secondary">
                  <span>Uptime: <span className="text-text font-medium">{service.uptime}</span></span>
                  <span>Response: <span className="text-text font-medium">{service.response_time}</span></span>
                </div>
              </div>
            );
          }) : (
            <div className="md:col-span-4 bg-surface p-6 text-text-secondary text-center">{loading ? 'Loading service statuses...' : 'No service statuses available.'}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border/40 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-primary" /> Queue & Processing
          </h3>
          <div className="space-y-4">
            {queueStats.map((metric) => (
              <div key={metric.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">{metric.label}</span>
                  <span className="text-text font-medium">{metric.value}{metric.suffix || ''} / {metric.max}{metric.suffix || ''}</span>
                </div>
                <div className="w-full bg-border/20 h-2 rounded-full overflow-hidden">
                  <div className={`${metric.barClass} h-full rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, (metric.value / metric.max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/20 bg-bg/30 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
              <Terminal size={14} className="text-primary" /> Live Logs
            </h3>
            <span className="text-[10px] text-success font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Streaming
            </span>
          </div>
          <div className="h-[280px] overflow-y-auto bg-bg/30 p-3 font-mono text-[11px] custom-scrollbar">
            {logs.length > 0 ? logs.map((log, idx) => {
              const levelColor: Record<string, string> = {
                INFO: 'text-primary', WARN: 'text-warning', ERROR: 'text-danger', DEBUG: 'text-text-secondary',
              };
              return (
                <div key={idx} className="py-1 hover:bg-border/5 px-2 rounded transition-colors flex gap-3">
                  <span className="text-text-secondary/50">{log.time}</span>
                  <span className={`font-bold w-12 ${levelColor[log.level] || 'text-text-secondary'}`}>{log.level}</span>
                  <span className="text-text/80">{log.message}</span>
                </div>
              );
            }) : (
              <div className="text-text-secondary">{loading ? 'Loading live logs...' : 'No log entries available.'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
