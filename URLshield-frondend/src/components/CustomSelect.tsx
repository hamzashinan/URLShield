import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, disabled, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className={`w-full flex items-center justify-between bg-surface/40 backdrop-blur-md border border-white/5 rounded-xl px-4 py-3 text-sm text-text transition-all duration-300 shadow-sm ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface/60 hover:border-white/10 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]'
        } ${isOpen && !disabled ? 'ring-2 ring-primary/40 border-primary bg-surface/80 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="truncate pr-4">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={`text-text-secondary transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-surface/95 backdrop-blur-2xl border border-border/40 rounded-xl shadow-[0_10px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in-up" style={{ animationDuration: '200ms' }}>
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <div
                key={option.value}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                  value === option.value 
                    ? 'bg-primary/20 text-primary font-medium border-l-2 border-primary' 
                    : 'text-text hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
