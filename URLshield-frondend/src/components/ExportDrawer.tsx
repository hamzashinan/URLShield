import React, { useState } from 'react';
import { X, Download, FileText, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';

interface ExportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportDrawer: React.FC<ExportDrawerProps> = ({ isOpen, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [includeEvidence, setIncludeEvidence] = useState(true);

  if (!isOpen) return null;

  const filename = `yodhac-export-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface border-l border-border shadow-2xl z-50 animate-slide-left overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text">Export Data</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg transition-all duration-150"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Export Format</h3>
            <div className="space-y-2">
              {[
                { format: 'csv' as const, label: 'CSV', description: 'Spreadsheet compatible format' },
                { format: 'json' as const, label: 'JSON', description: 'Machine-readable format' },
                { format: 'pdf' as const, label: 'PDF', description: 'Printable report format' }
              ].map(option => (
                <button
                  key={option.format}
                  onClick={() => setSelectedFormat(option.format)}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-all duration-150 ${
                    selectedFormat === option.format
                      ? 'bg-primary/10 border-primary text-text'
                      : 'bg-bg border-border text-text-secondary hover:border-primary/50'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {selectedFormat === option.format ? (
                      <CheckCircle size={20} className="text-primary" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-current" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-text-secondary">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Options</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
                <div>
                  <p className="font-medium text-text text-sm">Include Evidence</p>
                  <p className="text-xs text-text-secondary">Attach screenshots and files</p>
                </div>
                <button
                  onClick={() => setIncludeEvidence(!includeEvidence)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                    includeEvidence ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                      includeEvidence ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <Card className="bg-bg/50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <FileText size={20} className="text-primary mt-1" />
                <div>
                  <p className="text-sm font-semibold text-text mb-1">Preview Filename</p>
                  <p className="text-sm text-text-secondary font-mono break-all">{filename}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button variant="primary" className="w-full">
              <Download size={16} className="mr-2" />
              Export Now
            </Button>
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
