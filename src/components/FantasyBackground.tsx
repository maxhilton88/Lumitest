import React, { memo } from 'react';
import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';

/**
 * FantasyBackground — Shared dark-fantasy background used across all child-facing screens.
 * Provides: background image, dark warm overlay, vignette, floating sparkles.
 *
 * PERF: Wrapped in React.memo — the background never changes during a question,
 * so it should NOT re-render on parent state changes (progress bar, etc.).
 */

interface FantasyBackgroundProps {
  bgImage?: string;
  overlayOpacity?: number;
  children?: React.ReactNode;
}

// Inject sparkle CSS once globally
let sparkleStylesInjected = false;
function injectSparkleStyles() {
  if (sparkleStylesInjected) return;
  sparkleStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'sparkle-float-css';
  style.textContent = `
@keyframes sparkle-float{0%{transform:translateY(0) scale(0);opacity:0}10%{transform:translateY(-10vh) scale(1);opacity:1}90%{opacity:.6}100%{transform:translateY(-100vh) scale(.3);opacity:0}}
.sparkle-float{animation:sparkle-float linear infinite}
`;
  document.head.appendChild(style);
}

// Pre-compute sparkle data once (module-level, never recreated)
const SPARKLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: ((i * 8.3 + 2.1) % 100),
  delay: ((i * 0.7 + 0.3) % 8),
  duration: 4 + (i % 6),
  size: 2 + (i % 3),
  opacity: 0.3 + (i % 5) * 0.1,
}));

const FloatingSparkles = memo(function FloatingSparkles() {
  // Inject CSS once on mount
  React.useEffect(() => { injectSparkleStyles(); }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {SPARKLES.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full sparkle-float"
          style={{
            left: `${s.left}%`,
            bottom: '-10px',
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: `radial-gradient(circle, rgba(255,215,0,${s.opacity}) 0%, transparent 70%)`,
            boxShadow: `0 0 ${s.size * 2}px rgba(255,200,0,${s.opacity * 0.6})`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
});

export const FantasyBackground = memo<FantasyBackgroundProps>(function FantasyBackground({
  bgImage,
  overlayOpacity = 0.6,
  children,
}) {
  const src = bgImage || questMapBg;

  return (
    <>
      {/* Google font for fantasy titles */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />

      {/* Background image */}
      <div className="absolute inset-0">
        <img src={src} alt="" className="w-full h-full object-cover" />
        {/* Dark warm overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(10,10,18,${overlayOpacity + 0.1}) 0%, rgba(13,17,23,${overlayOpacity - 0.1}) 50%, rgba(10,10,18,${overlayOpacity + 0.2}) 100%)`,
          }}
        />
        {/* Warm vignette edges */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,10,18,0.7) 100%)',
          }}
        />
      </div>

      {/* Floating sparkle particles */}
      <FloatingSparkles />

      {children}
    </>
  );
});

/** Gold ornament divider – reusable across screens */
export function GoldOrnament({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <div className="h-px w-12 md:w-20 bg-gradient-to-r from-transparent to-[#d4a44a]/60" />
      <div className="w-2 h-2 rotate-45 bg-[#d4a44a]/80" />
      <div className="h-px w-12 md:w-20 bg-gradient-to-l from-transparent to-[#d4a44a]/60" />
    </div>
  );
}

/** Fantasy-styled card panel (dark glass with gold border) */
export function FantasyPanel({
  children,
  className = '',
  gold = false,
}: {
  children: React.ReactNode;
  className?: string;
  gold?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(30,22,12,0.92) 0%, rgba(20,16,10,0.95) 100%)',
        border: gold
          ? '2px solid #d4a44a'
          : '2px solid rgba(212,164,74,0.25)',
        boxShadow: gold
          ? '0 0 20px rgba(212,164,74,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Subtle corner accents */}
      {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, idx) => (
        <div
          key={idx}
          className={`absolute ${pos} w-3 h-3 z-[1] pointer-events-none`}
          style={{
            borderTop: pos.includes('top') ? '1.5px solid rgba(212,164,74,0.35)' : 'none',
            borderBottom: pos.includes('bottom') ? '1.5px solid rgba(212,164,74,0.35)' : 'none',
            borderLeft: pos.includes('left') ? '1.5px solid rgba(212,164,74,0.35)' : 'none',
            borderRight: pos.includes('right') ? '1.5px solid rgba(212,164,74,0.35)' : 'none',
            borderRadius: '3px',
          }}
        />
      ))}
      {children}
    </div>
  );
}

/** Fantasy title style – gold gradient with Cinzel font */
export function FantasyTitle({
  children,
  className = '',
  size = 'lg',
}: {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeClasses = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl lg:text-3xl',
    lg: 'text-2xl md:text-4xl lg:text-5xl',
    xl: 'text-3xl md:text-5xl lg:text-7xl',
  };

  return (
    <h1
      className={`font-bold tracking-wide ${sizeClasses[size]} ${className}`}
      style={{
        fontFamily: "'Cinzel Decorative', serif",
        background: 'linear-gradient(180deg, #ffeaa7 0%, #d4a44a 40%, #c6872e 70%, #ffeaa7 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 0 12px rgba(212,164,74,0.4)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
      }}
    >
      {children}
    </h1>
  );
}

/** Gold-styled footer */
export function FantasyFooter({ hideLinks = false }: { hideLinks?: boolean }) {
  const linkStyle = { color: '#c8b88a88' };
  const separatorStyle = { color: '#c8b88a44' };

  return (
    <div className="relative z-10 pb-4 text-center space-y-1.5">
      {/* Nav links — hidden on child-facing screens */}
      {!hideLinks && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <a href="/store" className="text-[10px] md:text-xs hover:underline transition-colors" style={linkStyle}>
            Pricing
          </a>
          <span className="text-[10px]" style={separatorStyle}>&middot;</span>
          <a href="/privacy" className="text-[10px] md:text-xs hover:underline transition-colors" style={linkStyle}>
            Privacy Policy
          </a>
          <span className="text-[10px]" style={separatorStyle}>&middot;</span>
          <a href="/terms" className="text-[10px] md:text-xs hover:underline transition-colors" style={linkStyle}>
            Terms of Service
          </a>
        </div>
      )}
      {/* Copyright */}
      <p className="text-[10px] md:text-xs" style={{ color: '#c8b88a55' }}>
        <a
          href="https://projectlumi.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline transition-colors"
          style={{ color: '#c8b88a77' }}
        >
          &copy; 2026 Project Lumi
        </a>
        {' . All Rights Reserved.'}
      </p>
    </div>
  );
}