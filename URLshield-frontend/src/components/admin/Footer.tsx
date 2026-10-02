import React from 'react';
import {
  Shield,
  GitBranch,
  Activity,
  Database,
  BarChart3,
  Settings,
  FileText,
  HelpCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  const adminLinks = [
    { label: 'Dashboard', href: '/admin', icon: Activity },
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
    { label: 'Maintenance Schedule', href: '/maintenance', icon: Clock },
  ];

  const legalLinks = [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security Policy', href: '/security' },
    { label: 'Compliance', href: '/compliance' },
  ];

  return (
    <footer
      className={`bg-surface border-t border-border ${className}`}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main Footer */}
        <div className="py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 sm:gap-8">

            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">

                {/* URLShield Logo */}
                <div className="relative flex items-center justify-center">
                  <Shield
                    size={30}
                    className="text-blue-500"
                    strokeWidth={2.5}
                    fill="currentColor"
                    fillOpacity={0.1}
                  />

                  <span className="absolute font-bold text-blue-500 text-[9px]">
                    U
                  </span>
                </div>

                <div className="flex items-center">
                  <span className="text-lg font-bold text-text sm:text-xl">
                    URLShield
                  </span>

                  <span className="ml-2 px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full hidden sm:inline">
                    Admin
                  </span>
                </div>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed max-w-md mb-6">
                URLShield is a phishing intelligence platform designed to
                analyze suspicious URLs, detect phishing threats, inspect
                evidence, and provide security intelligence through
                machine-learning powered analysis.
              </p>

              {/* Platform Information */}
              <div className="bg-bg/50 border border-border/20 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-text mb-3 uppercase tracking-wider">
                  Platform
                </h5>

                <div className="space-y-3 text-xs">

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">
                      Environment
                    </span>

                    <span className="text-primary font-medium">
                      Development
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">
                      API
                    </span>

                    <span className="text-text font-medium">
                      FastAPI
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">
                      ML Engine
                    </span>

                    <span className="text-text font-medium">
                      XGBoost
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">
                      Status
                    </span>

                    <span className="flex items-center gap-1.5 text-success font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Operational
                    </span>
                  </div>

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
                        <Icon
                          size={14}
                          className="text-text-tertiary group-hover:text-primary/70 flex-shrink-0"
                        />

                        <span className="truncate">
                          {label}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Admin Resources */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Resources
              </h4>

              <nav aria-label="Admin resources">
                <ul className="space-y-2.5">
                  {adminResources.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                      >
                        <Icon
                          size={14}
                          className="text-text-tertiary group-hover:text-primary/70 flex-shrink-0"
                        />

                        <span className="truncate">
                          {label}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Support
              </h4>

              <nav aria-label="Admin support">
                <ul className="space-y-2.5">
                  {supportLinks.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                      >
                        <Icon
                          size={14}
                          className="text-text-tertiary group-hover:text-primary/70 flex-shrink-0"
                        />

                        <span className="truncate">
                          {label}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* GitHub */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-text mb-3 uppercase tracking-wider">
                  Project
                </h4>

                <a
                  href="https://github.com/hamzashinan/URLShield"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-border hover:bg-surface hover:border-primary/50 hover:text-primary transition-all duration-200"
                >
                  <GitBranch
                    size={16}
                    className="text-text-secondary"
                  />

                  <span className="text-sm text-text-secondary">
                    GitHub Repository
                  </span>
                </a>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Legal
              </h4>

              <nav aria-label="Legal links">
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

              <div className="mt-6">
                <div className="flex items-start gap-2 text-xs text-text-tertiary">
                  <Shield
                    size={14}
                    className="flex-shrink-0 mt-0.5 text-primary"
                  />

                  <span>
                    URLShield security controls are designed to support
                    phishing analysis and threat intelligence workflows.
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">

            {/* Copyright */}
            <div className="text-xs text-text-secondary text-center lg:text-left">
              © {currentYear} URLShield — Phishing Intelligence Platform.
              All rights reserved.
            </div>

            {/* System Information */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 lg:gap-6 text-center lg:text-right">

              {/* System Status */}
              <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                <div
                  className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
                  aria-hidden="true"
                />

                <span>
                  URLShield Systems Operational
                </span>
              </div>

              {/* API */}
              <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                <CheckCircle
                  size={12}
                  className="text-success"
                  aria-hidden="true"
                />

                <span>
                  API Connected
                </span>
              </div>

              {/* Version */}
              <div className="text-xs text-text-tertiary">
                URLShield Admin
              </div>

            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;

