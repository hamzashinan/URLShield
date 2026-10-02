import React, { useState, useEffect } from 'react';
import { Shield, X, Send, CheckCircle, Eye, AlertCircle, Clock } from 'lucide-react';
import { Button } from '../Button';
import { addIssue, getIssues, type UserIssue } from '../../lib/issuesStorage';

interface FooterProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const PLATFORM_LINKS: { label: string; page: string }[] = [
  { label: 'URL Analysis', page: 'home' },
  { label: 'Scan History', page: 'scan-history' },
  { label: 'Evidence Review', page: 'evidence' },
  { label: 'Alerts', page: 'alerts' },
];

export const Footer: React.FC<FooterProps> = ({ currentPage, onPageChange }) => {
  const currentYear = new Date().getFullYear();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [issues, setIssues] = useState<UserIssue[]>([]);

  const refreshIssues = () => setIssues(getIssues());

  useEffect(() => {
    if (isViewModalOpen) refreshIssues();
  }, [isViewModalOpen]);

  const handleNavigate = (page: string) => {
    if (page === 'home') {
      if (currentPage === 'home') {
        document.getElementById('url-analysis')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        onPageChange('home');
        setTimeout(() => {
          document.getElementById('url-analysis')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      onPageChange(page);
    }
  };

  const handleSubmit = () => {
    if (!description.trim()) return;
    addIssue(description.trim());
    setIsSubmitted(true);
    setTimeout(() => {
      setIsReportModalOpen(false);
      setDescription('');
      setIsSubmitted(false);
    }, 2000);
  };

  const closeModal = () => {
    setIsReportModalOpen(false);
    setDescription('');
    setIsSubmitted(false);
  };

  return (
    <>
      <footer className="bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer */}
          <div className="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="relative">
                  <Shield
                    size={24}
                    className="text-blue-500"
                    strokeWidth={2.5}
                    fill="currentColor"
                    fillOpacity={0.1}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-bold text-blue-500 text-[8px]">C</span>
                  </div>
                </div>
                <span className="text-lg font-bold text-text">
                  URLShield
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
                AI-powered phishing intelligence platform. Analyze suspicious URLs,
                detect threats in real-time, and protect your organization from
                phishing attacks.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Platform
              </h4>
              <ul className="space-y-2.5">
                {PLATFORM_LINKS.map(({ label, page }) => (
                  <li key={label}>
                    <button
                      onClick={() => handleNavigate(page)}
                      className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-sm font-semibold text-text mb-4 uppercase tracking-wider">
                Support
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    Report an Issue
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setIsViewModalOpen(true)}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    <Eye size={14} />
                    View Your Reports
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-text-secondary">
              © {currentYear} URLShield — Phishing Intelligence Platform. All rights
              reserved.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Powered by XGBoost AI
            </div>
          </div>
        </div>
      </footer>

      {/* Report Issue Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-surface border border-border rounded-2xl shadow-premium-lg w-full max-w-md p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text">Report an Issue</h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {isSubmitted ? (
              <div className="py-8 text-center animate-fade-in">
                <CheckCircle size={48} className="mx-auto mb-3 text-success" />
                <p className="text-lg font-medium text-text mb-1">Thank you!</p>
                <p className="text-sm text-text-secondary">Your issue has been submitted.</p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-text mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue you're experiencing..."
                  rows={4}
                  className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-text text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-150 resize-none mb-4"
                />
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" size="sm" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!description.trim()}
                  >
                    <Send size={14} className="mr-1.5" />
                    Submit
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View Your Reports Modal */}
      {isViewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsViewModalOpen(false)}
          />
          <div className="relative bg-surface border border-border rounded-2xl shadow-premium-lg w-full max-w-lg p-6 animate-fade-in-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text">Your Reports</h3>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 -mr-1">
              {issues.length === 0 ? (
                <div className="py-12 text-center text-text-secondary">
                  <Eye size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No reports submitted yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {issues.map(issue => {
                    const statusConfig = {
                      open: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Open' },
                      'in-progress': { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'In Progress' },
                      resolved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Resolved' },
                    };
                    const cfg = statusConfig[issue.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div key={issue.id} className="bg-bg border border-border rounded-xl p-4">
                        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap mb-3">
                          {issue.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary">
                            {new Date(issue.timestamp).toLocaleString()}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border px-2 py-1 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            <StatusIcon size={13} />
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
