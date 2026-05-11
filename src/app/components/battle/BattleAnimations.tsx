/**
 * BattleAnimations.tsx — Hit, Miss & Counter-Attack visual effects for battle
 *
 * HIT (correct answer): Screen shake + element-colored flash + particles flying at opponent
 * MISS (wrong answer): Grey fizzle puff + slight opacity dip on your Foxy
 * COUNTER-ATTACK: Red flash + reverse particles (opponent → player) + player hit reaction
 *
 * Uses Motion for all animations. Style A (particles/glow) + C (flash/shake).
 */
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ── Element color palettes ── */
const ELEMENT_PALETTES: Record<string, { primary: string; secondary: string; particles: string[] }> = {
  fire:    { primary: '#ef4444', secondary: '#f97316', particles: ['#ef4444', '#f97316', '#fbbf24', '#dc2626'] },
  thunder: { primary: '#eab308', secondary: '#fbbf24', particles: ['#eab308', '#fbbf24', '#fef08a', '#ca8a04'] },
  earth:   { primary: '#92400e', secondary: '#a16207', particles: ['#92400e', '#a16207', '#d97706', '#78350f'] },
  water:   { primary: '#3b82f6', secondary: '#60a5fa', particles: ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb'] },
  nature:  { primary: '#22c55e', secondary: '#4ade80', particles: ['#22c55e', '#4ade80', '#86efac', '#16a34a'] },
};

const DEFAULT_PALETTE = { primary: '#a855f7', secondary: '#c084fc', particles: ['#a855f7', '#c084fc', '#d8b4fe', '#7c3aed'] };

/* ═════════════════════════════════
   HIT FLASH — full-screen color flash
   ═════════════════════════════════ */
export function HitFlash({ element, visible }: { element: string; visible: boolean }) {
  const palette = ELEMENT_PALETTES[element] || DEFAULT_PALETTE;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-30 pointer-events-none"
          style={{ background: palette.primary }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.2, 0.4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════
   HIT PARTICLES — fly from player → opponent
   ═════════════════════════════════ */
export function HitParticles({ element, visible }: { element: string; visible: boolean }) {
  const palette = ELEMENT_PALETTES[element] || DEFAULT_PALETTE;

  // Generate random particles
  const particles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      color: palette.particles[i % palette.particles.length],
      size: 4 + Math.random() * 8,
      startX: 15 + Math.random() * 25, // % from left (player side)
      startY: 55 + Math.random() * 20, // % from top (player area)
      endX: 55 + Math.random() * 30,   // % from left (opponent side)
      endY: 15 + Math.random() * 35,   // % from top (opponent area)
      delay: Math.random() * 0.15,
      duration: 0.4 + Math.random() * 0.25,
      rotation: Math.random() * 360,
    }))
  , [element]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <div className="absolute inset-0 z-25 pointer-events-none overflow-hidden">
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle, ${p.color}, ${p.color}80)`,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}80`,
                left: `${p.startX}%`,
                top: `${p.startY}%`,
              }}
              initial={{ opacity: 1, scale: 0.5, rotate: 0 }}
              animate={{
                left: `${p.endX}%`,
                top: `${p.endY}%`,
                opacity: [1, 1, 0.8, 0],
                scale: [0.5, 1.5, 1, 0.3],
                rotate: p.rotation,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Impact burst at opponent position */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 80, height: 80,
              left: '65%', top: '30%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${palette.primary}60, ${palette.secondary}30, transparent)`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0.6, 0], scale: [0, 1.5, 2, 2.5] }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════
   MISS FIZZLE — grey puff on player side
   ═════════════════════════════════ */
export function MissFizzle({ visible }: { visible: boolean }) {
  const puffs = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: 6 + Math.random() * 10,
      x: 10 + Math.random() * 30,
      y: 50 + Math.random() * 25,
      dx: (Math.random() - 0.5) * 30,
      dy: -10 - Math.random() * 20,
      delay: Math.random() * 0.1,
    }))
  , []);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Dim flash */}
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ background: 'rgba(100,100,100,0.3)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 0.5 }}
          />

          {/* Grey puff particles */}
          <div className="absolute inset-0 z-25 pointer-events-none overflow-hidden">
            {puffs.map(p => (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size, height: p.size,
                  background: 'radial-gradient(circle, rgba(150,150,150,0.6), rgba(100,100,100,0.3))',
                  left: `${p.x}%`, top: `${p.y}%`,
                }}
                initial={{ opacity: 0.8, scale: 0.5 }}
                animate={{
                  left: `${p.x + p.dx}%`,
                  top: `${p.y + p.dy}%`,
                  opacity: [0.8, 0.5, 0],
                  scale: [0.5, 1.2, 0.3],
                }}
                transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
              />
            ))}
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════
   COUNTER FLASH — red-tinted full-screen flash for incoming attack
   ═════════════════════════════════ */
export function CounterFlash({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-30 pointer-events-none"
          style={{ background: '#ef4444' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0.1, 0.25, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════
   COUNTER PARTICLES — fly from opponent → player (reverse direction)
   ═════════════════════════════════ */
export function CounterParticles({ visible }: { visible: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      color: ['#ef4444', '#dc2626', '#f87171', '#b91c1c'][i % 4],
      size: 4 + Math.random() * 7,
      startX: 55 + Math.random() * 30,   // opponent side (right)
      startY: 20 + Math.random() * 30,   // opponent area (top)
      endX: 5 + Math.random() * 30,      // player side (left)
      endY: 50 + Math.random() * 30,     // player area (bottom)
      delay: Math.random() * 0.12,
      duration: 0.35 + Math.random() * 0.2,
      rotation: Math.random() * 360,
    }))
  , []);

  return (
    <AnimatePresence>
      {visible && (
        <div className="absolute inset-0 z-25 pointer-events-none overflow-hidden">
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle, ${p.color}, ${p.color}80)`,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}80`,
                left: `${p.startX}%`,
                top: `${p.startY}%`,
              }}
              initial={{ opacity: 1, scale: 0.5, rotate: 0 }}
              animate={{
                left: `${p.endX}%`,
                top: `${p.endY}%`,
                opacity: [1, 1, 0.8, 0],
                scale: [0.5, 1.3, 1, 0.2],
                rotate: p.rotation,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Impact burst at player position */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 70, height: 70,
              left: '20%', top: '65%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(239,68,68,0.5), rgba(220,38,38,0.25), transparent)',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0.5, 0], scale: [0, 1.3, 1.8, 2.2] }}
            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════
   PLAYER HIT REACTION — flash + shake when taking counter damage
   Applied to the player sprite wrapper
   ═════════════════════════════════ */
export function PlayerHitReaction({ hit, children }: { hit: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={hit ? {
        filter: [
          'brightness(1)',
          'brightness(2.5)',
          'brightness(1)',
          'brightness(2)',
          'brightness(1)',
        ],
        x: [0, 4, -5, 3, -2, 0],
      } : {
        filter: 'brightness(1)',
        x: 0,
      }}
      transition={hit ? { duration: 0.5, ease: 'easeOut' } : { duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/* ═════════════════════════════════
   SCREEN SHAKE wrapper — wraps the arena div
   Usage: <ScreenShake active={shaking}><ArenaContent /></ScreenShake>
   ═════════════════════════════════ */
export function ScreenShake({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      className="w-full h-full"
      animate={active ? {
        x: [0, -6, 8, -10, 6, -4, 3, 0],
        y: [0, 3, -5, 2, -3, 4, -1, 0],
      } : { x: 0, y: 0 }}
      transition={active ? { duration: 0.5, ease: 'easeInOut' } : { duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/* ═════════════════════════════════
   OPPONENT HIT REACTION — flash white + bounce
   Applied to the opponent sprite wrapper
   ═════════════════════════════════ */
export function OpponentHitReaction({ hit, children }: { hit: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={hit ? {
        filter: [
          'brightness(1)',
          'brightness(3)',
          'brightness(1)',
          'brightness(2.5)',
          'brightness(1)',
        ],
        x: [0, -3, 5, -4, 2, 0],
      } : {
        filter: 'brightness(1)',
        x: 0,
      }}
      transition={hit ? { duration: 0.5, ease: 'easeOut' } : { duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/* ═════════════════════════════════
   PLAYER MISS REACTION — slight dip
   ═════════════════════════════════ */
export function PlayerMissReaction({ miss, children }: { miss: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={miss ? {
        opacity: [1, 0.4, 0.7, 0.4, 1],
        scale: [1, 0.96, 1],
      } : {
        opacity: 1,
        scale: 1,
      }}
      transition={miss ? { duration: 0.6, ease: 'easeInOut' } : { duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/* ═════════════════════════════════
   FLOATING DAMAGE NUMBER — "-42" that floats up from the damaged sprite
   ═════════════════════════════════ */
export function FloatingDamageNumber({
  amount, visible, position = 'opponent',
}: {
  amount: number;
  visible: boolean;
  /** 'opponent' = top-right, 'player' = bottom-left */
  position?: 'opponent' | 'player';
}) {
  // Color by severity
  const color = amount >= 40 ? '#ef4444' : amount >= 20 ? '#fbbf24' : '#f0e6d0';
  const glow  = amount >= 40 ? 'rgba(239,68,68,0.7)' : amount >= 20 ? 'rgba(251,191,36,0.6)' : 'rgba(240,230,208,0.4)';
  const size  = amount >= 40 ? 32 : amount >= 20 ? 26 : 22;

  const posStyle: React.CSSProperties = position === 'opponent'
    ? { right: '18%', top: '22%' }
    : { left: '22%', bottom: '28%' };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute z-40 pointer-events-none"
          style={{ ...posStyle }}
          initial={{ opacity: 0, scale: 0.3, y: 0 }}
          animate={{
            opacity: [0, 1, 1, 0.8, 0],
            scale: [0.3, 1.4, 1.1, 1, 0.9],
            y: [0, -10, -25, -45, -60],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          <span
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              fontWeight: 900,
              fontSize: size,
              color,
              textShadow: `0 0 12px ${glow}, 0 2px 4px rgba(0,0,0,0.8), 0 0 24px ${glow}`,
              letterSpacing: '-0.02em',
              WebkitTextStroke: '1px rgba(0,0,0,0.4)',
            }}
          >
            -{amount}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════
   LOW HP PULSE — pulsing red glow overlay on sprite when HP is critically low
   Wraps the sprite. Pulses when ratio < 0.25, intensifies < 0.10.
   ═════════════════════════════════ */
export function LowHPPulse({
  ratio, children,
}: {
  ratio: number;
  children: React.ReactNode;
}) {
  const critical = ratio <= 0.10 && ratio > 0;
  const warning  = ratio <= 0.25 && ratio > 0.10;

  if (!warning && !critical) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {children}

      {/* Red vignette pulse over the sprite */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-lg"
        style={{
          background: critical
            ? 'radial-gradient(ellipse at center, transparent 40%, rgba(239,68,68,0.25) 100%)'
            : 'radial-gradient(ellipse at center, transparent 55%, rgba(239,68,68,0.12) 100%)',
          mixBlendMode: 'screen',
        }}
        animate={{
          opacity: critical ? [0.5, 1, 0.5] : [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: critical ? 0.8 : 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Heartbeat icon for critical */}
      {critical && (
        <motion.div
          className="absolute z-10 pointer-events-none"
          style={{ top: 4, right: 4 }}
          animate={{ scale: [1, 1.3, 1, 1.3, 1], opacity: [0.7, 1, 0.7, 1, 0.7] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span style={{ fontSize: 14 }}>💔</span>
        </motion.div>
      )}
    </div>
  );
}

/* ═════════════════════════════════
   HP BAR GLOW PULSE — pulsing border glow on the HP bar container when low
   Wraps the HP bar section.
   ═════════════════════════════════ */
export function HPBarPulse({
  ratio, children,
}: {
  ratio: number;
  children: React.ReactNode;
}) {
  const critical = ratio <= 0.10 && ratio > 0;
  const warning  = ratio <= 0.25 && ratio > 0.10;

  if (!warning && !critical) {
    return <>{children}</>;
  }

  return (
    <motion.div
      animate={{
        boxShadow: critical
          ? ['0 0 0px rgba(239,68,68,0)', '0 0 10px rgba(239,68,68,0.6)', '0 0 0px rgba(239,68,68,0)']
          : ['0 0 0px rgba(239,68,68,0)', '0 0 6px rgba(239,68,68,0.3)', '0 0 0px rgba(239,68,68,0)'],
      }}
      transition={{
        duration: critical ? 0.8 : 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className="rounded-xl"
    >
      {children}
    </motion.div>
  );
}