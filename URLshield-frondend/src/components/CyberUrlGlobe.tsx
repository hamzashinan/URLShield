import React, { useMemo } from 'react';

const TLDs = ['.com', '.xyz', '.in', '.net', '.org', 'http://', 'https://', '.io', '.ai'];
const DOMAINS = ['facebook.com', 'secure-login.net', 'verify.xyz', 'paypal.in', 'update.com'];

export const CyberUrlGlobe: React.FC = () => {
  // Generate random particles for the starfield
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => {
      const isDomain = Math.random() > 0.6;
      const text = isDomain 
        ? DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
        : TLDs[Math.floor(Math.random() * TLDs.length)];
      
      const size = Math.random() > 0.8 ? 'text-xs' : 'text-[10px]';
      const color = Math.random() > 0.8 ? 'text-danger' : Math.random() > 0.5 ? 'text-primary' : 'text-success';
      const opacity = Math.random() * 0.5 + 0.1; // 0.1 to 0.6
      const top = `${Math.random() * 100}%`;
      const left = `${Math.random() * 100}%`;
      const animationDuration = `${Math.random() * 10 + 10}s`; // 10s to 20s
      const animationDelay = `-${Math.random() * 10}s`;
      
      return { id: i, text, size, color, opacity, top, left, animationDuration, animationDelay };
    });
  }, []);

  const dots = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => {
      const top = `${Math.random() * 100}%`;
      const left = `${Math.random() * 100}%`;
      const opacity = Math.random() * 0.5 + 0.1;
      const size = Math.random() * 3 + 1;
      const animationDuration = `${Math.random() * 5 + 3}s`;
      const animationDelay = `${Math.random() * 5}s`;
      return { id: i, top, left, opacity, size, animationDuration, animationDelay };
    });
  }, []);

  // Generate shooting stars / comets
  const comets = useMemo(() => {
    return Array.from({ length: 4 }).map((_, i) => {
      // Random rotation between 20deg and 160deg (always travelling downwards)
      const angle = Math.random() * 140 + 20;
      
      // Start position based on angle
      // If angle < 90 (moving right), start on left side (-20% to 50%)
      // If angle > 90 (moving left), start on right side (50% to 120%)
      const isMovingRight = angle < 90;
      const left = isMovingRight ? `${Math.random() * 70 - 20}%` : `${Math.random() * 70 + 50}%`;
      const top = `${Math.random() * -30}%`; // Start slightly higher offscreen

      const animationDuration = `${Math.random() * 5 + 6}s`; // Slower, more majestic (6-11s)
      const animationDelay = `${Math.random() * 20}s`; // Wider random start window
      const length = Math.random() * 100 + 60; // Tail length
      const opacity = Math.random() * 0.4 + 0.2; // Fade out slightly (0.2 to 0.6 opacity)
      
      return { id: i, top, left, angle, animationDuration, animationDelay, length, opacity };
    });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 animate-space-breathe w-full h-full opacity-80">
        {/* Deep Space Background Core */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[80px]"></div>
        
        {/* Constellation / Star dots */}
        {dots.map(dot => (
          <div 
            key={`dot-${dot.id}`}
            className="absolute rounded-full bg-primary/50 animate-twinkle shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            style={{
              top: dot.top,
              left: dot.left,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              opacity: dot.opacity,
              animationDuration: dot.animationDuration,
              animationDelay: dot.animationDelay
            }}
          />
        ))}

        {/* Floating Domains & TLDs */}
      {particles.map((p) => (
        <div
          key={`particle-${p.id}`}
          className={`absolute ${p.size} ${p.color} font-mono animate-float tracking-widest`}
          style={{
            top: p.top,
            left: p.left,
            opacity: p.opacity,
            animationDuration: p.animationDuration,
            animationDelay: p.animationDelay,
            textShadow: '0 0 10px currentColor'
          }}
        >
          {p.text}
        </div>
      ))}
      
      {/* Multi-directional Comets / Shooting Stars */}
      {comets.map((c) => (
        <div
          key={`comet-container-${c.id}`}
          className="absolute z-0"
          style={{
            top: c.top,
            left: c.left,
            transform: `rotate(${c.angle}deg)`,
            opacity: c.opacity,
          }}
        >
          <div
            className="animate-shooting-star bg-gradient-to-r from-transparent via-primary/40 to-primary"
            style={{
              width: `${c.length}px`,
              height: '3px',
              animationDuration: c.animationDuration,
              animationDelay: c.animationDelay,
              borderRadius: '100%',
            }}
          >
            {/* Comet Head */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[5px] h-[5px] bg-primary rounded-full shadow-[0_0_14px_5px_currentColor] text-primary/80"></div>
          </div>
        </div>
      ))}

      {/* Premium Multi-directional Comets */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-px h-[300px] bg-gradient-to-b from-primary/40 to-transparent animate-comet-tl-br opacity-20"></div>
        <div className="absolute top-1/4 right-0 w-[400px] h-px bg-gradient-to-l from-blue-500/40 to-transparent animate-comet-tr-bl opacity-10" style={{ animationDelay: '5s' }}></div>
        <div className="absolute bottom-0 right-1/3 w-px h-[500px] bg-gradient-to-t from-primary/30 to-transparent animate-comet-br-tl opacity-15" style={{ animationDelay: '12s' }}></div>
      </div>

        {/* Subtle Network Lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <path d="M 100 100 Q 300 150 500 100 T 900 150" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="1" strokeDasharray="5,5" className="animate-pulse" />
          <path d="M 200 400 Q 400 350 600 450 T 1000 400" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1" className="animate-pulse" style={{ animationDelay: '1s' }} />
          <path d="M 50 600 Q 250 550 450 650 T 850 600" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="1" strokeDasharray="3,7" className="animate-pulse" style={{ animationDelay: '2s' }} />
        </svg>
      </div>
    </div>
  );
};
