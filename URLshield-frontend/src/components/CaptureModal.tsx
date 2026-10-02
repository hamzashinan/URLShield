import React, { useState } from 'react';
import { X, Plus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { useSubmitUrls } from '../hooks/useApi';
import { useJob } from '../hooks/useApi';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface JobStatus {
  id: string;
  url: string;
  state: 'queued' | 'running' | 'done' | 'error';
  domain?: string;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [singleUrl, setSingleUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [submittedJobs, setSubmittedJobs] = useState<JobStatus[]>([]);
  
  const { submit, loading, error } = useSubmitUrls();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    try {
      const urls = mode === 'single' 
        ? [singleUrl.trim()]
        : batchUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);

      if (urls.length === 0) {
        return;
      }

      const jobIds = await submit(urls);
      
      // Initialize job statuses
      const jobs: JobStatus[] = jobIds.map((id, index) => ({
        id,
        url: urls[index],
        state: 'queued',
      }));
      
      setSubmittedJobs(jobs);
      
      // Clear inputs
      setSingleUrl('');
      setBatchUrls('');
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    setSingleUrl('');
    setBatchUrls('');
    setSubmittedJobs([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text">Capture Suspicious URL</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-bg rounded-lg transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === 'single' ? 'primary' : 'secondary'}
              onClick={() => setMode('single')}
              className="flex-1"
            >
              Single URL
            </Button>
            <Button
              variant={mode === 'batch' ? 'primary' : 'secondary'}
              onClick={() => setMode('batch')}
              className="flex-1"
            >
              Batch URLs
            </Button>
          </div>

          {/* Input */}
          {mode === 'single' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                URL to analyze
              </label>
              <Input
                type="url"
                placeholder="https://suspicious-site.com"
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleSubmit();
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                URLs to analyze (one per line)
              </label>
              <textarea
                className="w-full h-32 px-4 py-3 bg-bg border border-border rounded-xl text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="https://suspicious-site1.com&#10;https://suspicious-site2.com&#10;https://suspicious-site3.com"
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Submitted Jobs */}
          {submittedJobs.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-text">Submitted Jobs</h3>
              {submittedJobs.map((job) => (
                <JobStatusChip key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || (mode === 'single' ? !singleUrl.trim() : !batchUrls.trim())}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Plus size={16} />
                Submit
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Job status chip with live updates
const JobStatusChip: React.FC<{ job: JobStatus }> = ({ job }) => {
  const { data, loading } = useJob(job.id, 2000); // Poll every 2 seconds

  const state = data?.state || job.state;
  const domain = data?.url ? new URL(data.url).hostname : job.domain;

  const getStatusColor = () => {
    switch (state) {
      case 'queued':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'running':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'done':
        return 'bg-success/10 text-success border-success/20';
      case 'error':
        return 'bg-danger/10 text-danger border-danger/20';
      default:
        return 'bg-text-secondary/10 text-text-secondary border-text-secondary/20';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'running':
        return <Loader2 size={14} className="animate-spin" />;
      case 'done':
        return <CheckCircle size={14} />;
      case 'error':
        return <AlertCircle size={14} />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getStatusIcon()}
        <span className="text-sm font-medium truncate">{domain || job.url}</span>
      </div>
      <span className="text-xs font-semibold uppercase">{state}</span>
    </div>
  );
};
