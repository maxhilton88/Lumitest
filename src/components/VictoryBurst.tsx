import React, { useRef, useEffect, memo } from 'react';

/**
 * VictoryBurst — dark-fantasy-themed success animation.
 * Uses CSS-only animations on a fixed set of lightweight DOM nodes.
 *
 * PERF: Wrapped in React.memo to prevent re-renders from parent's
 * progress-bar state updates (10x/sec). The component only re-renders
 * when `isActive` actually changes.
 */

interface VictoryBurstProps {
  isActive: boolean;
}

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';

// Pre-generate stable particle data (never changes)
const EMBERS = Array.from({ length: 15 }, (_, i) => {
  const colors = [GOLD, GOLD_LIGHT, '#c6872e', '#ffb347', '#fff5d4'];
  return {
    id: i,
    left: 15 + ((i * 17 + 7) % 70),
    size: 3 + (i % 4),
    delay: (i * 0.03) % 0.5,
    duration: 1.6 + (i % 3) * 0.4,
    drift: Math.round(((i * 13 + 3) % 70) - 35),
    color: colors[i % colors.length],
    opacity: 0.6 + (i % 4) * 0.1,
  };
});

const GEMS = Array.from({ length: 5 }, (_, i) => {
  const colors = [GOLD, GOLD_LIGHT, '#e8c44a', '#ffb347'];
  return {
    id: i,
    left: 12 + ((i * 19 + 5) % 76),
    size: 6 + (i % 5),
    delay: 0.1 + (i * 0.08),
    duration: 1.8 + (i % 3) * 0.3,
    drift: Math.round(((i * 11 + 7) % 50) - 25),
    color: colors[i % colors.length],
  };
});

const RAYS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  angle: (360 / 6) * i,
  delay: i * 0.04,
}));

// ── Inject keyframe CSS ONCE globally (not per render) ──
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'vb-keyframes';
  style.textContent = `
@keyframes vb-pulse{0%{transform:translate(-50%,-50%) scale(0);opacity:.8}60%{transform:translate(-50%,-50%) scale(1);opacity:.3}100%{transform:translate(-50%,-50%) scale(1.25);opacity:0}}
@keyframes vb-ray{0%{transform:scaleY(0);opacity:0}30%{transform:scaleY(1);opacity:.7}100%{transform:scaleY(1.4);opacity:0}}
@keyframes vb-sigil{0%{transform:scale(.3) rotate(0);opacity:0}15%{transform:scale(1.1) rotate(30deg);opacity:.9}40%{transform:scale(1) rotate(60deg);opacity:.7}100%{transform:scale(1.3) rotate(120deg);opacity:0}}
@keyframes vb-flash{0%{transform:scale(0);opacity:1}30%{transform:scale(3);opacity:.8}100%{transform:scale(6);opacity:0}}
@keyframes vb-ember{0%{transform:translateY(0) translateX(0) scale(0);opacity:0}15%{transform:translateY(-5vh) translateX(calc(var(--d)*.2)) scale(1.2);opacity:1}80%{opacity:.6}100%{transform:translateY(-70vh) translateX(var(--d)) scale(.3);opacity:0}}
@keyframes vb-gem{0%{transform:rotate(45deg) translateY(0) translateX(0) scale(0);opacity:0}20%{transform:rotate(45deg) translateY(-10vh) translateX(calc(var(--d)*.3)) scale(1);opacity:.9}100%{transform:rotate(405deg) translateY(-70vh) translateX(var(--d)) scale(.2);opacity:0}}
`;
  document.head.appendChild(style);
}

export const VictoryBurst: React.FC<VictoryBurstProps> = memo(({ isActive }) => {
  // Inject keyframes once globally (not in render tree)
  useEffect(() => { injectStyles(); }, []);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Radial pulse — small fixed-size element, scaled via transform */}
      <div
        style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,234,167,0.33) 0%, rgba(212,164,74,0.13) 40%, transparent 70%)',
          animation: 'vb-pulse 1.2s ease-out forwards',
          willChange: 'transform, opacity',
        }}
      />

      {/* Light rays */}
      {RAYS.map((ray) => (
        <div
          key={ray.id}
          style={{
            position: 'absolute', left: '50%', top: '50%', marginLeft: -1,
            width: 2, height: 100,
            background: 'linear-gradient(to top, rgba(212,164,74,0), rgba(255,234,167,0.5), rgba(212,164,74,0))',
            transformOrigin: 'center bottom',
            transform: `rotate(${ray.angle}deg) scaleY(0)`,
            animation: `vb-ray 0.8s ease-out ${ray.delay}s forwards`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Magic sigil — lightweight SVG */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ animation: 'vb-sigil 2.5s ease-out forwards', willChange: 'transform, opacity' }}>
          <svg viewBox="0 0 200 200" width="140" height="140">
            <circle cx="100" cy="100" r="90" fill="none" stroke={GOLD} strokeWidth="1.5" strokeDasharray="8 6" opacity="0.6" />
            <circle cx="100" cy="100" r="70" fill="none" stroke={GOLD_LIGHT} strokeWidth="1" strokeDasharray="4 8" opacity="0.4" />
            <polygon points="100,70 115,100 100,130 85,100" fill={GOLD} opacity="0.3" />
          </svg>
        </div>
      </div>

      {/* Ember particles */}
      {EMBERS.map((e) => (
        <div
          key={e.id}
          style={{
            position: 'absolute', left: `${e.left}%`, bottom: '10%',
            width: e.size, height: e.size, borderRadius: '50%',
            background: e.color, opacity: e.opacity,
            boxShadow: `0 0 ${e.size * 2}px ${e.color}`,
            animation: `vb-ember ${e.duration}s ease-out ${e.delay}s forwards`,
            ['--d' as string]: `${e.drift}px`,
          }}
        />
      ))}

      {/* Floating gems */}
      {GEMS.map((g) => (
        <div
          key={g.id}
          style={{
            position: 'absolute', left: `${g.left}%`, bottom: '5%',
            width: g.size, height: g.size,
            transform: 'rotate(45deg)', background: g.color,
            boxShadow: `0 0 ${g.size * 2}px ${g.color}`,
            animation: `vb-gem ${g.duration}s ease-out ${g.delay}s forwards`,
            ['--d' as string]: `${g.drift}px`,
          }}
        />
      ))}

      {/* Central flash */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: `radial-gradient(circle, ${GOLD_LIGHT} 0%, ${GOLD}88 30%, transparent 60%)`,
            animation: 'vb-flash 0.6s ease-out forwards',
            willChange: 'transform, opacity',
          }}
        />
      </div>
    </div>
  );
});

VictoryBurst.displayName = 'VictoryBurst';
