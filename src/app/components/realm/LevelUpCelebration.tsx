/**
 * LevelUpCelebration.tsx — Full-screen level-up splash
 *
 * Brief, impactful celebration when the player levels up.
 * Auto-dismisses after 2.5 seconds or on tap.
 * Features: golden burst, level number, particle shower.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onLevelUp, type LevelUpEvent } from '../../utils/reward-events';
import { useLanguage } from '../LanguageContext';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#ffd700';
const GOLD_DARK = '#b8860b';

export function LevelUpCelebration() {
  const { language } = useLanguage();
  const [event, setEvent] = useState<LevelUpEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setEvent(null), 400);
  }, []);

  useEffect(() => {
    const unsub = onLevelUp((ev) => {
      setEvent(ev);
      setVisible(true);
      // Auto-dismiss after 3s
      const timer = setTimeout(dismiss, 3000);
      return () => clearTimeout(timer);
    });
    return unsub;
  }, [dismiss]);

  const title = language === 'zh' ? '\u5347\u7EA7\uFF01' : language === 'ms' ? 'Naik Tahap!' : 'Level Up!';
  const subtitle = event
    ? language === 'zh'
      ? `\u8FBE\u5230\u7B49\u7EA7 ${event.newLevel}\uFF01`
      : language === 'ms'
        ? `Tahap ${event.newLevel} dicapai!`
        : `Reached Level ${event.newLevel}!`
    : '';

  // Generate random particles for the burst
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const dist = 80 + Math.random() * 120;
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      size: 3 + Math.random() * 5,
      delay: Math.random() * 0.3,
      color: i % 4 === 0 ? '#fff' : i % 4 === 1 ? GOLD : i % 4 === 2 ? '#ff9800' : '#ffeaa7',
    };
  });

  // Confetti flakes
  const confetti = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    delay: 0.2 + Math.random() * 0.5,
    color: ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24'][i % 6],
    rotation: Math.random() * 360,
  }));

  return (
    <AnimatePresence>
      {visible && event && (
        <motion.div
          className="fixed inset-0 z-[450] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={dismiss}
          style={{ cursor: 'pointer' }}
        >
          {/* Backdrop flash */}
          <motion.div
            className="absolute inset-0"
            initial={{ background: 'rgba(255,215,0,0.3)' }}
            animate={{ background: 'rgba(5,4,2,0.85)' }}
            transition={{ duration: 0.6 }}
            style={{ backdropFilter: 'blur(4px)' }}
          />

          {/* Radial golden glow */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 45%, rgba(255,215,0,0.12) 0%, transparent 60%)',
            }}
          />

          {/* Particle burst */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                left: '50%',
                top: '42%',
                boxShadow: `0 0 6px ${p.color}80`,
              }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
              transition={{ duration: 1.2 + Math.random() * 0.5, delay: p.delay, ease: 'easeOut' }}
            />
          ))}

          {/* Confetti rain */}
          {confetti.map(c => (
            <motion.div
              key={`c-${c.id}`}
              className="absolute"
              style={{
                width: 8,
                height: 12,
                borderRadius: 2,
                background: c.color,
                left: '50%',
                top: '-5%',
              }}
              initial={{ x: c.x, y: 0, rotate: 0, opacity: 1 }}
              animate={{
                y: typeof window !== 'undefined' ? window.innerHeight + 50 : 800,
                rotate: c.rotation + 720,
                opacity: 0,
              }}
              transition={{ duration: 2.5 + Math.random(), delay: c.delay, ease: [0.2, 0.8, 0.3, 1] }}
            />
          ))}

          {/* Main content */}
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0.3, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
          >
            {/* Expanding ring */}
            <motion.div
              className="absolute rounded-full"
              style={{
                border: `3px solid ${GOLD}40`,
                width: 200,
                height: 200,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.15 }}
            />

            {/* Level number — huge */}
            <motion.div
              className="flex items-center justify-center"
              style={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(255,215,0,0.15) 0%, rgba(0,0,0,0.4) 70%)`,
                border: `3px solid ${GOLD}60`,
                boxShadow: `0 0 40px rgba(255,215,0,0.25), 0 0 80px rgba(255,215,0,0.1)`,
              }}
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.2 }}
            >
              <motion.span
                style={{
                  fontFamily: F,
                  fontSize: 52,
                  color: GOLD,
                  textShadow: `0 3px 12px rgba(0,0,0,0.8), 0 0 30px rgba(255,215,0,0.4)`,
                  lineHeight: 1,
                }}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {event.newLevel}
              </motion.span>
            </motion.div>

            {/* "LEVEL UP!" text */}
            <motion.h1
              className="mt-4"
              style={{
                fontFamily: CINZEL,
                fontSize: 28,
                color: GOLD,
                textShadow: `0 2px 12px rgba(255,215,0,0.4), 0 4px 20px rgba(0,0,0,0.8)`,
                letterSpacing: '0.1em',
                textAlign: 'center',
              }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              style={{
                fontFamily: F,
                fontSize: 14,
                color: '#ffeaa7',
                textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                textAlign: 'center',
                marginTop: 6,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {subtitle}
            </motion.p>

            {/* Multi-level indicator */}
            {event.levelsGained > 1 && (
              <motion.div
                className="mt-2 px-3 py-1 rounded-full"
                style={{
                  background: 'rgba(255,215,0,0.1)',
                  border: '1px solid rgba(255,215,0,0.25)',
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
              >
                <span style={{ fontFamily: F, fontSize: 11, color: `${GOLD}cc` }}>
                  +{event.levelsGained} {language === 'en' ? 'Levels' : language === 'ms' ? 'Tahap' : '\u7EA7'}!
                </span>
              </motion.div>
            )}

            {/* Tap to continue hint */}
            <motion.p
              style={{
                fontFamily: F,
                fontSize: 10,
                color: 'rgba(200,184,138,0.4)',
                marginTop: 20,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              {language === 'en' ? 'Tap to continue' : language === 'ms' ? 'Ketik untuk teruskan' : '\u70B9\u51FB\u7EE7\u7EED'}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
