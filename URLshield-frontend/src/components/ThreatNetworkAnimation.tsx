import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, Search, ShieldAlert, ShieldCheck } from 'lucide-react';

export const ThreatNetworkAnimation: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const lines = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x1: `${Math.random() * 100}%`,
      y1: `${Math.random() * 100}%`,
      x2: `${Math.random() * 100}%`,
      y2: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${Math.random() * 3 + 2}s`,
    }));
  }, []);

  return (
    <div ref={sectionRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-20 transition-opacity duration-1000">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik02MCAwaC0xdjYwaDFWMHptLTYwIDYwaDYwdi0xSDB2MXoiIGZpbGw9InJnYmEoNTksIDEzMCwgMjQ2LCAwLjA1KSIvPjwvZz48L3N2Zz4=')]"></div>

      {/* Radar Sweep Effect */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl aspect-square rounded-full border border-primary/10 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 rounded-full animate-radar" style={{
          background: 'conic-gradient(from 0deg, transparent 70%, rgba(59, 130, 246, 0.05) 80%, rgba(59, 130, 246, 0.2) 100%)'
        }}></div>
      </div>

      <div className="relative w-full h-full max-w-7xl mx-auto">
        
        {/* Node 1: DNS Check */}
        <div className={`absolute top-[10%] left-[15%] transition-all duration-700 delay-500 animate-float ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-surface/50 border border-primary/20 p-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
            <div className="text-blue-400"><Activity size={14} /></div>
            <span className="text-xs font-medium text-text-secondary">DNS Trace</span>
          </div>
        </div>

        {/* Node 2: Brand Similarity */}
        <div className={`absolute bottom-[20%] left-[10%] transition-all duration-700 delay-700 animate-float-slow ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-surface/50 border border-warning/20 p-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
            <div className="text-warning"><Search size={14} /></div>
            <span className="text-xs font-medium text-text-secondary">Brand Match</span>
          </div>
        </div>

        {/* Node 3: SSL Scan */}
        <div className={`absolute top-[25%] right-[15%] transition-all duration-700 delay-600 animate-float-slow ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-surface/50 border border-success/20 p-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
            <div className="text-success"><ShieldCheck size={14} /></div>
            <span className="text-xs font-medium text-text-secondary">SSL Cert</span>
          </div>
        </div>

        {/* Node 4: Threat Score */}
        <div className={`absolute bottom-[15%] right-[20%] transition-all duration-700 delay-800 animate-float ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-surface/50 border border-danger/20 p-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
            <div className="text-danger"><ShieldAlert size={14} /></div>
            <span className="text-xs font-medium text-text-secondary">Risk Score</span>
          </div>
        </div>

        {/* Abstract Web Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-30">
          {lines.map((line) => (
            <line 
              key={`line-${line.id}`}
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} 
              stroke="rgba(59,130,246,0.3)" 
              strokeWidth="1" 
              className="animate-pulse"
              style={{ animationDelay: line.delay, animationDuration: line.duration }}
            />
          ))}
        </svg>

      </div>
    </div>
  );
};
