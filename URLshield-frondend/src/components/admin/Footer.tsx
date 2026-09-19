import React from 'react';
import { Shield, Globe, Mail, Phone, MapPin, Activity, Database, Server, Users, AlertTriangle, CheckCircle, Clock, BarChart3, Settings, FileText, HelpCircle } from 'lucide-react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();
  
  const systemStats = {
    uptime: '99.9%',
    activeUsers: 1247,
    scansToday: 8542,
    threatsBlocked: 127,
    responseTime: '142ms',
    storageUsed: '2.4TB'
  };

  const adminLinks = [
    { label: 'Dashboard', href: '/admin', icon: Activity },
    { label: 'System Monitoring', href: '/admin/monitoring', icon: Server },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Alert Rules', href: '/admin/alert-rules', icon: AlertTriangle },
    { label: 'API Management', href: '/admin/api-management', icon: Database },
    { label: 'Data Management', href: '/admin/data-management', icon: Database },
    { label: 'Model Training', href: '/admin/training', icon: BarChart3 },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const adminResources = [
    { label: 'Admin Documentation', href: '/docs/admin', icon: FileText },
    { label: 'API Reference', href: '/docs/api', icon: Database },
    { label: 'System Logs', href: '/admin/logs', icon: FileText },
    { label: 'Backup & Restore', href: '/admin/backup', icon: Database },
    { label: 'Security Audit', href: '/admin/security', icon: Shield },
  ];

  const supportLinks = [
    { label: 'Admin Support', href: '/support/admin', icon: HelpCircle },
    { label: 'System Status', href: '/status', icon: CheckCircle },
    { label: 'Emergency Contacts', href: '/support/emergency', icon: Phone },
    { label: 'Maintenance Schedule', href: '/maintenance', icon: Clock },
  ];

  const legalLinks = [
    { label: 'Admin Privacy Policy', href: '/privacy/admin' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security Policy', href: '/security' },
    { label: 'Compliance & Audit', href: '/compliance' },
  ];

  const socialLinks = [
    { icon: Globe, href: 'https://github.com/yodhac', label: 'GitHub' },
    { icon: Activity, href: 'https://twitter.com/yodhac', label: 'Twitter' },
    { icon: Shield, href: 'https://linkedin.com/company/yodhac', label: 'LinkedIn' },
    { icon: Mail, href: 'mailto:admin@yodhac.ai', label: 'Admin Support' },
  ];

  return (
    <footer className={`bg-surface border-t border-border ${className}`} role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 sm:gap-8">
            {/* Brand Section - 2 columns on desktop */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="relative">
                  <Shield
                    size={24}
                    className="text-blue-500 sm:size-28"
                    strokeWidth={2.5}
                    fill="currentColor"
                    fillOpacity={0.1}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-bold text-blue-500 text-[8px] sm:text-[10px]">C</span>
                  </div>
                </div>
                <span className="text-lg font-bold text-text sm:text-xl">
                  YodhaC<span className="text-primary">.Ai</span>
                </span>
                <span className="ml-2 px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full hidden sm:inline">
                  Admin
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md mb-4 sm:mb-6">
                Enterprise phishing intelligence platform. Real-time threat detection, 
                comprehensive admin controls, and AI-powered security analytics.
              </p>
              
              {/* System Metrics */}
              <div className="bg-bg/50 border border-border/20 rounded-lg p-3 sm:p-4 mb-4">
                <h5 className="text-xs font-semibold text-text mb-3 uppercase tracking-wider">System Metrics</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Uptime</span>
                    <span className="text-success font-medium">{systemStats.uptime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Active Users</span>
                    <span className="text-primary font-medium">{systemStats.activeUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Scans Today</span>
                    <span className="text-text font-medium">{systemStats.scansToday.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Threats Blocked</span>
                    <span className="text-warning font-medium">{systemStats.threatsBlocked}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Response Time</span>
                    <span className="text-success font-medium">{systemStats.responseTime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Storage Used</span>
                    <span className="text-text font-medium">{systemStats.storageUsed}</span>
                  </div>
                </div>
              </div>
              
              {/* Admin Contact Info */}
              <div className="space-y-2 text-sm text-text-secondary">
                <a 
                  href="mailto:admin@yodhac.ai" 
                  className="flex items-center gap-2 hover:text-primary transition-colors duration-200"
                  aria-label="Admin email address"
                >
                  <Mail size={14} className="text-text-tertiary flex-shrink-0" />
                  <span className="truncate">admin@yodhac.ai</span>
                </a>
                <a 
                  href="tel:+15559876543" 
                  className="flex items-center gap-2 hover:text-primary transition-colors duration-200"
                  aria-label="Admin phone number"
                >
                  <Phone size={14} className="text-text-tertiary flex-shrink-0" />
                  <span>+1 (555) 987-6543</span>
                </a>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-text-tertiary flex-shrink-0" />
                  <span className="truncate">Security Operations Center</span>
                </div>
              </div>
            </div>

            {/* Admin Navigation */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Admin Panel
              </h4>
              <nav aria-label="Admin navigation">
                <ul className="space-y-2.5">
                  {adminLinks.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                      >
                        <Icon size={14} className="text-text-tertiary group-hover:text-primary/70 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Admin Resources */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Admin Resources
              </h4>
              <nav aria-label="Admin resources">
                <ul className="space-y-2.5">
                  {adminResources.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                      >
                        <Icon size={14} className="text-text-tertiary group-hover:text-primary/70 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Admin Support */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Admin Support
              </h4>
              <nav aria-label="Admin support">
                <ul className="space-y-2.5 mb-6">
                  {supportLinks.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                      >
                        <Icon size={14} className="text-text-tertiary group-hover:text-primary/70 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              
              {/* Social Links */}
              <div>
                <h4 className="text-sm font-semibold text-text mb-3 uppercase tracking-wider">
                  Connect
                </h4>
                <nav aria-label="Social media links">
                  <div className="flex gap-2">
                    {socialLinks.map(({ icon: Icon, href, label }) => (
                      <a
                        key={label}
                        href={href}
                        className="p-2 rounded-lg bg-bg border border-border hover:bg-surface hover:border-primary/50 hover:text-primary transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50"
                        aria-label={label}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon size={16} className="text-text-secondary group-hover:text-primary" />
                      </a>
                    ))}
                  </div>
                </nav>
              </div>
            </div>

            {/* Legal & Compliance */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Legal & Compliance
              </h4>
              <nav aria-label="Legal and compliance links">
                <ul className="space-y-2.5">
                  {legalLinks.map(({ label, href }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="text-sm text-text-secondary hover:text-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="text-xs text-text-secondary text-center lg:text-left">
              © {currentYear} YodhaC.Ai — Enterprise Phishing Intelligence Platform. All rights reserved.
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 lg:gap-6 text-center lg:text-right">
              {/* System Status */}
              <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                <span>Security Systems Operational</span>
              </div>
              
              {/* Last Security Scan */}
              <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                <CheckCircle size={12} className="text-success" aria-hidden="true" />
                <span>Last Scan: 2 min ago</span>
              </div>
              
              {/* Version Info */}
              <div className="text-xs text-text-tertiary">
                Admin v2.4.1 | Security Patch Level 3
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
