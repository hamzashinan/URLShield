import React from 'react';
import { Shield } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true }) => {
  const sizeConfig = {
    sm: { icon: 20, text: 'text-lg' },
    md: { icon: 28, text: 'text-2xl' },
    lg: { icon: 36, text: 'text-3xl' }
  };

  const config = sizeConfig[size];

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <Shield
          size={config.icon}
          className="text-primary"
          strokeWidth={2.5}
          fill="currentColor"
          fillOpacity={0.1}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-primary" style={{ fontSize: `${config.icon * 0.35}px` }}>
            C
          </span>
        </div>
      </div>
      {showText && (
        <span className={`font-bold text-text ${config.text}`}>
          URLShield
        </span>
      )}
    </div>
  );
};
