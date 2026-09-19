import React from 'react';
import { X } from 'lucide-react';

interface ChipProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({ label, onRemove, className = '' }) => {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border rounded-md text-xs font-medium text-text transition-all duration-150 hover:border-primary/50 ${className}`}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:text-danger transition-colors duration-150"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};
