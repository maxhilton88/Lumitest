/**
 * EggHatchBubble.tsx — Animated speech bubble above the egg
 *
 * Shows a live 48-hour countdown until the egg hatches.
 * Uses shared hatch timing from utils/hatch.ts.
 * Once hatched, the bubble is not rendered (Foxy replaces the egg).
 *
 * Cherry Bomb One font, dark-fantasy gold style matching the realm.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { hatchRemainingFromStats } from '../../utils/hatch';
import { useRealmContext } from '../../contexts/RealmContext';

const F = "'Cherry Bomb One', cursive";

function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'ms' ? ms : lang === 'zh' ? zh : en;
}

function formatCountdown(ms: number): { h: string; m: string; s: string } {
  if (ms <= 0) return { h: '00', m: '00', s: '00' };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  };
}

export function EggHatchBubble() {
  const { t, language } = useLanguage();
  const { stats } = useRealmContext();
  const [remaining, setRemaining] = useState<number>(() => hatchRemainingFromStats(stats.hatchStartMs, undefined, stats.evolutionStage));
  const [visible, setVisible] = useState(true);

  // Tick every second
  useEffect(() => {
    const tick = () => setRemaining(hatchRemainingFromStats(stats.hatchStartMs, undefined, stats.evolutionStage));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [stats.hatchStartMs, stats.evolutionStage]);

  const hatched = remaining <= 0;
  const needsLevel = hatched && stats.level < 5; // Bible v5: egg→baby requires Level 5 too
  const { h, m, s } = formatCountdown(remaining);

  // Dismiss on tap — stop propagation so click doesn't reach avatar/mastery behind
  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
  }, []);

  // Auto-reappear after 8 seconds if dismissed
  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(timer);
  }, [visible]);

  // Once hatched AND level met, don't render the bubble — Foxy is shown instead of the egg
  if (hatched && !needsLevel) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute z-30 flex flex-col items-center pointer-events-auto cursor-pointer"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            top: '22%',
          }}
          initial={{ opacity: 0, y: 12, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          onClick={handleDismiss}
        >
          {/* Bubble */}
          <motion.div
            className="relative px-4 py-2.5 rounded-2xl flex items-center gap-2.5"
            style={{
              background: 'linear-gradient(135deg, rgba(20,16,10,0.92), rgba(35,28,16,0.95))',
              border: '2px solid rgba(255,215,0,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 12px rgba(255,215,0,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Egg / hatch emoji */}
            <motion.span
              className="text-xl"
              animate={{ rotate: [-3, 3, -3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              🥚
            </motion.span>

            {/* Text content */}
            <div className="flex flex-col">
                <div className="flex flex-col">
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 11,
                      color: 'rgba(200,184,138,0.85)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                      lineHeight: 1.2,
                    }}
                  >
                    {needsLevel
                      ? t3('Reach Level 5 to hatch!', 'Capai Tahap 5 untuk menetas!', '达到5级即可孵化！', language)
                      : t('realm.hatchingIn')}
                  </span>
                  {/* Countdown digits — only show when timer still running */}
                  {!needsLevel && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {[
                      { val: h, label: 'h' },
                      { val: m, label: 'm' },
                      { val: s, label: 's' },
                    ].map((unit, i) => (
                      <span key={unit.label} className="inline-flex items-center">
                        {i > 0 && (
                          <span
                            style={{
                              fontFamily: F,
                              fontSize: 13,
                              color: 'rgba(255,215,0,0.4)',
                            }}
                          >
                            :
                          </span>
                        )}
                        <span
                          style={{
                            fontFamily: F,
                            fontSize: 16,
                            color: '#ffd700',
                            textShadow: '0 0 8px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.5)',
                            letterSpacing: '0.04em',
                            minWidth: 22,
                            textAlign: 'center',
                            display: 'inline-block',
                          }}
                        >
                          {unit.val}
                        </span>
                        <span
                          style={{
                            fontFamily: F,
                            fontSize: 9,
                            color: 'rgba(200,184,138,0.5)',
                            marginLeft: 1,
                          }}
                        >
                          {unit.label}
                        </span>
                      </span>
                    ))}
                  </div>
                  )}
                  {/* Level progress when timer done but level too low */}
                  {needsLevel && (
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: 14,
                        color: '#ffd700',
                        textShadow: '0 0 8px rgba(255,215,0,0.3)',
                        marginTop: 2,
                      }}
                    >
                      Lv {stats.level} / 5
                    </span>
                  )}
                </div>
            </div>

            {/* Sparkle particles when close to hatching (< 1 hour) */}
            {remaining > 0 && remaining < 3600000 &&
              [...Array(3)].map((_, i) => (
                <motion.span
                  key={`sp-${i}`}
                  className="absolute text-xs pointer-events-none"
                  style={{
                    top: -4 - i * 3,
                    right: 8 + i * 14,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                >
                  ✨
                </motion.span>
              ))
            }

            {/* Speech bubble tail pointing down to egg */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid rgba(28,22,13,0.94)',
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}