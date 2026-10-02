import React, { useState, useEffect } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const searchResults = [
  { category: 'Pages', items: ['Overview', 'Alerts', 'Domains', 'Evidence', 'Watchlist', 'Settings'] },
  { category: 'Quick Actions', items: ['Export Report', 'Add to Watchlist', 'Mark as Clean', 'Create Alert'] },
  { category: 'Recent', items: ['suspicious-domain.com', 'alert-2024-001', 'evidence-screenshot-45'] }
];

export const CommandSearch: React.FC<CommandSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl animate-slide-down">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={20} className="text-text-secondary" />
          <input
            type="text"
            placeholder="Search pages, actions, domains..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-text placeholder:text-text-secondary focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors duration-150">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {searchResults.map((section, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              <div className="px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {section.category}
              </div>
              {section.items.map((item, itemIdx) => (
                <button
                  key={itemIdx}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-text hover:bg-bg transition-all duration-120 group"
                  onClick={onClose}
                >
                  <span>{item}</span>
                  <ArrowRight size={16} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-120" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
