/**
 * SpellMenu.tsx — Magical Radial Navigation Menu
 *
 * Closed: R2 magic_button image on right edge, slowly pulsing with glow.
 * Open:   blooms to full-screen overlay with rotating rune rings,
 *         5 realm icons burst outward in a circle — all white/ethereal.
 *
 * The 5 Realms:
 *   📖 Flashcards (Study)   → /flashcards
 *   ⚔️ Practice (Battle)    → /practice
 *   🎵 Music (Listen)       → /audio
 *   🎬 Video (Watch)        → /library
 *   📝 Test (Quest)         → /test
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { BookOpen, Swords, Music, Play, ScrollText, CheckCircle2, Coins } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import type { DailyLog } from './DailyQuestsPanel';

const F = "'Cherry Bomb One', cursive";

interface RealmDef {
  labelKey: string;
  icon: React.ReactNode;
  route: string;
  delay: number;
  activityKey: string; // maps to daily log activity type
}

const REALMS: RealmDef[] = [
  { labelKey: 'realm.flashcards', icon: <BookOpen size={28} strokeWidth={2.2} />, route: '/realm/flashcards', delay: 0, activityKey: 'flashcard' },
  { labelKey: 'realm.practice', icon: <Swords size={28} strokeWidth={2.2} />, route: '/realm/practice', delay: 0.05, activityKey: 'practice' },
  { labelKey: 'realm.music', icon: <Music size={28} strokeWidth={2.2} />, route: '/realm/audio', delay: 0.1, activityKey: 'music' },
  { labelKey: 'realm.video', icon: <Play size={28} strokeWidth={2.2} />, route: '/realm/library', delay: 0.15, activityKey: 'video' },
  { labelKey: 'realm.test', icon: <ScrollText size={28} strokeWidth={2.2} />, route: '/realm/test', delay: 0.2, activityKey: 'test' },
];

// Place items evenly around a circle
function getCirclePos(index: number, total: number, radius: number) {
  const angle = ((360 / total) * index - 90) * (Math.PI / 180);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/* ── Outer Rune Ring SVG — slowly rotating decorative circle ── */
function RuneRing({ size, duration, reverse, opacity }: { size: number; duration: number; reverse?: boolean; opacity: number }) {
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const marks = 24;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
        animation: `spellSpin ${duration}s linear infinite ${reverse ? 'reverse' : 'normal'}`,
        opacity,
      }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
        strokeDasharray={`${circumference / marks * 0.6} ${circumference / marks * 0.4}`}
      />
      {Array.from({ length: marks }).map((_, i) => {
        const a = (360 / marks) * i * (Math.PI / 180);
        const inner = r - 4;
        const outer = r + 2;
        const cx = size / 2;
        const cy = size / 2;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * inner}
            y1={cy + Math.sin(a) * inner}
            x2={cx + Math.cos(a) * outer}
            y2={cy + Math.sin(a) * outer}
            stroke={i % 3 === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}
            strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
          />
        );
      })}
    </svg>
  );
}

/* ── Small dormant spell button (right edge) ── */
function DormantSpell({ onClick, imageUrl, isLandscape }: { onClick: () => void; imageUrl?: string; isLandscape?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      className="absolute z-40 flex flex-col items-center justify-center"
      style={{
        right: 4,
        top: '50%',
        marginTop: -48,
        width: 80,
        height: 96,
      }}
      whileTap={{ scale: 0.85 }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.6, type: 'spring' }}
    >
      {/* Large pulsing glow aura */}
      <div
        className="absolute rounded-full"
        style={{
          width: 110,
          height: 110,
          top: -8,
          background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, rgba(168,85,247,0.08) 40%, transparent 70%)',
          animation: 'dormantAura 2s ease-in-out infinite',
        }}
      />

      {/* Orbiting dot */}
      <div
        className="absolute"
        style={{
          width: 80, height: 80, top: -2,
          animation: 'spellSpin 4s linear infinite',
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 5, height: 5, top: 0, left: '50%', marginLeft: -2.5,
            background: '#ffd700',
            boxShadow: '0 0 6px rgba(255,215,0,0.6)',
          }}
        />
      </div>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Spell Menu"
          className="relative z-10"
          style={{
            width: 68,
            height: 68,
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.25)) drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
            animation: 'dormantBob 2.5s ease-in-out infinite',
          }}
        />
      ) : (
        <div className="relative z-10" style={{ width: 68, height: 68 }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px dashed rgba(255,255,255,0.35)',
              animation: 'spellSpin 6s linear infinite',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: 8,
              background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              animation: 'dormantBob 2.5s ease-in-out infinite',
            }}
          />
          <svg viewBox="0 0 24 24" width={26} height={26} className="absolute z-10" style={{ top: '50%', left: '50%', marginTop: -13, marginLeft: -13, opacity: 0.8 }}>
            <circle cx="12" cy="12" r="8" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            <circle cx="12" cy="12" r="3" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
            <line x1="12" y1="2" x2="12" y2="22" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            <line x1="2" y1="12" x2="22" y2="12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          </svg>
        </div>
      )}

      {/* Label */}
      <span
        className="relative z-10"
        style={{
          fontFamily: F,
          fontSize: 9,
          color: 'rgba(255,215,0,0.7)',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          marginTop: 2,
          letterSpacing: '0.06em',
          animation: 'dormantLabelPulse 2.5s ease-in-out infinite',
        }}
      >
        STROLL
      </span>

      {/* Floating particles */}
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2.5,
            height: 2.5,
            background: i % 2 === 0 ? 'rgba(255,215,0,0.6)' : 'rgba(168,85,247,0.5)',
            animation: `spellParticle ${1.8 + i * 0.5}s ease-in-out infinite ${i * 0.4}s`,
            top: '40%',
            left: '50%',
          }}
        />
      ))}
    </motion.button>
  );
}

/* ── Realm Icon Orb — individual icon in the expanded circle ── */
function RealmOrb({
  realm,
  index,
  total,
  radius,
  onSelect,
  dailyLog,
}: {
  realm: RealmDef;
  index: number;
  total: number;
  radius: number;
  onSelect: (route: string) => void;
  dailyLog?: DailyLog;
}) {
  const { t } = useLanguage();
  const pos = getCirclePos(index, total, radius);

  const entry = dailyLog?.[realm.activityKey];
  const isDone = (entry?.count || 0) > 0;
  const goldClaimed = entry?.goldAwarded || false;

  return (
    <motion.button
      className="absolute flex flex-col items-center gap-1.5"
      style={{
        left: '50%',
        top: '50%',
        marginLeft: -32,
        marginTop: -32,
      }}
      initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
      animate={{
        opacity: 1,
        x: pos.x,
        y: pos.y,
        scale: 1,
      }}
      exit={{ opacity: 0, x: 0, y: 0, scale: 0 }}
      transition={{
        delay: realm.delay,
        type: 'spring',
        stiffness: 300,
        damping: 18,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(realm.route);
      }}
      whileTap={{ scale: 0.85 }}
    >
      {/* Glow behind orb */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 72,
          height: 72,
          top: -4,
          left: -4,
          background: isDone
            ? 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(212,164,74,0.2) 0%, transparent 70%)',
          animation: isDone ? undefined : 'spellPulse 2.5s ease-in-out infinite',
        }}
      />
      {/* Orb */}
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: isDone
            ? 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)'
            : 'radial-gradient(circle at 35% 35%, rgba(212,164,74,0.25) 0%, rgba(212,164,74,0.08) 100%)',
          border: isDone
            ? '1.5px solid rgba(255,255,255,0.2)'
            : '1.5px solid rgba(212,164,74,0.5)',
          boxShadow: isDone
            ? '0 0 20px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 0 20px rgba(212,164,74,0.2), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(212,164,74,0.2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: isDone ? 'rgba(255,255,255,0.7)' : 'rgba(212,164,74,0.95)',
        }}
      >
        {realm.icon}

        {/* Done badge — shown when attempted */}
        {isDone && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: goldClaimed ? '#d4a44a' : 'rgba(255,255,255,0.85)',
              boxShadow: goldClaimed ? '0 0 6px rgba(212,164,74,0.6)' : '0 0 6px rgba(255,255,255,0.4)',
            }}
          >
            {goldClaimed
              ? <Coins size={10} style={{ color: '#1a0a2e' }} />
              : <CheckCircle2 size={12} style={{ color: '#1a0a2e' }} />
            }
          </div>
        )}
      </div>
      {/* Label */}
      <span
        style={{
          fontFamily: F,
          fontSize: 11,
          color: isDone ? 'rgba(255,255,255,0.7)' : 'rgba(212,164,74,0.95)',
          textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 12px rgba(255,255,255,0.1)',
          whiteSpace: 'nowrap',
        }}
      >
        {t(realm.labelKey)}
      </span>
    </motion.button>
  );
}

interface SpellMenuProps {
  magicButtonUrl?: string;
  isLandscape?: boolean;
  dailyLog?: DailyLog;
}

export function SpellMenu({ magicButtonUrl, isLandscape = false, dailyLog }: SpellMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleSelect = useCallback((route: string) => {
    setIsOpen(false);
    setTimeout(() => navigate(route), 250);
  }, [navigate]);

  return (
    <>
      {/* Dormant spell — right edge */}
      {!isOpen && <DormantSpell onClick={handleOpen} imageUrl={magicButtonUrl} isLandscape={isLandscape} />}

      {/* Expanded spell circle overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            /* Clicking anywhere on this overlay (backdrop) closes the menu */
            onClick={handleClose}
            style={{ cursor: 'default' }}
          >
            {/* Dark backdrop */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'rgba(5,4,2,0.75)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Central spell circle container — stop propagation so clicking inside doesn't close */}
            <motion.div
              className="relative"
              style={{ width: 320, height: 320 }}
              initial={{ scale: 0, rotate: -60 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Outer rune ring — slow rotation */}
              <RuneRing size={310} duration={20} opacity={0.6} />

              {/* Middle rune ring — counter-rotation */}
              <RuneRing size={240} duration={15} reverse opacity={0.4} />

              {/* Inner glow circle */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 160,
                  height: 160,
                  top: '50%',
                  left: '50%',
                  marginTop: -80,
                  marginLeft: -80,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />

              {/* Center magic symbol */}
              <div
                className="absolute flex items-center justify-center pointer-events-none"
                style={{
                  width: 60,
                  height: 60,
                  top: '50%',
                  left: '50%',
                  marginTop: -30,
                  marginLeft: -30,
                }}
              >
                <svg viewBox="0 0 40 40" width={40} height={40} style={{ opacity: 0.3 }}>
                  <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                  <circle cx="20" cy="20" r="6" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
                  <line x1="20" y1="2" x2="20" y2="38" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
                  <line x1="2" y1="20" x2="38" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
                  {/* Pentagram star */}
                  {[0, 1, 2, 3, 4].map(i => {
                    const a1 = ((72 * i) - 90) * Math.PI / 180;
                    const a2 = ((72 * (i + 2)) - 90) * Math.PI / 180;
                    return (
                      <line
                        key={i}
                        x1={20 + Math.cos(a1) * 14}
                        y1={20 + Math.sin(a1) * 14}
                        x2={20 + Math.cos(a2) * 14}
                        y2={20 + Math.sin(a2) * 14}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="0.5"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Floating particles inside the circle */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={`sp-${i}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 2 + Math.random() * 2,
                    height: 2 + Math.random() * 2,
                    background: 'rgba(255,255,255,0.5)',
                    top: '50%',
                    left: '50%',
                  }}
                  initial={{ opacity: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 0.7, 0],
                    x: [0, (Math.random() - 0.5) * 200],
                    y: [0, (Math.random() - 0.5) * 200],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                    ease: 'easeInOut',
                  }}
                />
              ))}

              {/* 5 Realm orbs arranged in a circle */}
              {REALMS.map((realm, i) => (
                <RealmOrb
                  key={realm.labelKey}
                  realm={realm}
                  index={i}
                  total={REALMS.length}
                  radius={120}
                  onSelect={handleSelect}
                  dailyLog={dailyLog}
                />
              ))}
            </motion.div>

            {/* Close hint at bottom */}
            <motion.p
              className="absolute bottom-8 pointer-events-none"
              style={{
                fontFamily: F,
                fontSize: 12,
                color: 'rgba(255,255,255,0.35)',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Tap outside to close
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spell menu keyframes */}
      <style>{`
        @keyframes spellSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes spellPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes spellParticle {
          0% { transform: translate(0, 0) scale(1); opacity: 0; }
          25% { opacity: 0.8; }
          50% { transform: translate(14px, -22px) scale(0.5); opacity: 0.5; }
          75% { opacity: 0.2; }
          100% { transform: translate(-10px, -30px) scale(0); opacity: 0; }
        }
        @keyframes dormantBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes dormantAura {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes dormantLabelPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}