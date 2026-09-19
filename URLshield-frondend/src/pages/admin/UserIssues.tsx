import React, { useState, useEffect } from 'react';
import { MessageSquare, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getIssues, updateIssueStatus, deleteIssue, type UserIssue } from '../../lib/issuesStorage';

export const UserIssues: React.FC = () => {
  const [issues, setIssues] = useState<UserIssue[]>([]);

  useEffect(() => {
    setIssues(getIssues());
  }, []);

  const handleStatusChange = (id: string, status: UserIssue['status']) => {
    updateIssueStatus(id, status);
    setIssues(getIssues());
  };

  const handleDelete = (id: string) => {
    deleteIssue(id);
    setIssues(getIssues());
  };

  const getStatusIcon = (status: UserIssue['status']) => {
    switch (status) {
      case 'open':
        return <AlertCircle size={16} className="text-amber-500" />;
      case 'in-progress':
        return <Clock size={16} className="text-blue-500" />;
      case 'resolved':
        return <CheckCircle size={16} className="text-green-500" />;
    }
  };

  const getStatusLabel = (status: UserIssue['status']) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in-progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
    }
  };

  const getStatusStyle = (status: UserIssue['status']) => {
    switch (status) {
      case 'open':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'resolved':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">User Issues</h1>
          <p className="text-sm text-text-secondary mt-1">
            Issues reported by users through the footer "Report an Issue" feature.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-text-secondary">
          <MessageSquare size={16} />
          {issues.length} total
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
          <MessageSquare size={48} className="mb-4 opacity-30" />
          <p className="text-lg font-medium text-text">No issues reported yet</p>
          <p className="text-sm mt-1">User-submitted issues will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map(issue => (
            <div
              key={issue.id}
              className="bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-text text-sm leading-relaxed whitespace-pre-wrap">
                    {issue.description}
                  </p>
                  <p className="text-xs text-text-secondary mt-3">
                    Submitted on {new Date(issue.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={issue.status}
                    onChange={(e) => handleStatusChange(issue.id, e.target.value as UserIssue['status'])}
                    className={`text-xs font-medium rounded-lg border px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer ${getStatusStyle(issue.status)}`}
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    onClick={() => handleDelete(issue.id)}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Delete issue"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
