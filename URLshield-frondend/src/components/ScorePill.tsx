import React from 'react';

interface ScorePillProps {
  score: 'phishing' | 'suspected' | 'clean';
  className?: string;
}

export const ScorePill: React.FC<ScorePillProps> = ({ score, className = '' }) => {
  const config = {
    phishing: {
      label: 'Phishing',
      styles: 'bg-danger/15 text-danger border-danger/30'
    },
    suspected: {
      label: 'Suspected',
      styles: 'bg-warning/15 text-warning border-warning/30'
    },
    clean: {
      label: 'Clean',
      styles: 'bg-success/15 text-success border-success/30'
    }
  };

  const { label, styles } = config[score];

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${styles} ${className}`}>
      {label}
    </span>
  );
};
