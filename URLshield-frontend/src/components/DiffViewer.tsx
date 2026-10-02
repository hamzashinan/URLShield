import React from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface DiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  leftImage: string;
  rightImage: string;
  leftLabel: string;
  rightLabel: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  isOpen,
  onClose,
  leftLabel,
  rightLabel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-7xl bg-surface border border-border rounded-xl shadow-2xl animate-slide-down">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">Screenshot Comparison</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg transition-all duration-150"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-text">{leftLabel}</h3>
                <span className="text-xs text-text-secondary">Original</span>
              </div>
              <div className="aspect-video bg-bg border border-border rounded-lg overflow-hidden">
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <ImageIcon size={64} className="text-primary/30" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-text">{rightLabel}</h3>
                <span className="text-xs text-text-secondary">Current</span>
              </div>
              <div className="aspect-video bg-bg border border-border rounded-lg overflow-hidden">
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-danger/20 to-danger/5">
                  <ImageIcon size={64} className="text-danger/30" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                Previous
              </Button>
              <Button variant="secondary" size="sm">
                Next
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                Download Both
              </Button>
              <Button variant="primary" size="sm">
                Mark as Reviewed
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
