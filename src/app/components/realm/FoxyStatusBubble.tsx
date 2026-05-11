/**
 * FoxyStatusBubble.tsx — Kid-friendly animated status notifications
 * 
 * Shows cute animated popups near foxy to communicate needs:
 * - Sleeping: floating "Zzzzz" with moon
 * - Hungry: bouncing speech bubble "I'm hungry!"
 * - Thirsty: wobbling speech bubble "I'm thirsty!"
 * - Sick: swaying speech bubble "I feel sick..."
 * - Happy: sparkle burst with hearts
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';

interface FoxyStatusBubbleProps {
  hunger: number;    // 0-100
  thirst: number;    // 0-100
  isSick: boolean;
  isSleeping: boolean;
  foxyState: 'sleeping' | 'idle' | 'happy' | 'sad' | 'eating';
}

// Cycle through active status messages so they don't overlap
export function FoxyStatusBubble({ hunger, thirst, isSick, isSleeping, foxyState }: FoxyStatusBubbleProps) {
  const { t } = useLanguage();
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [cycleIndex, setCycleIndex] = useState(0);

  const isHungry = hunger < 30;
  const isThirsty = thirst < 30;

  // Build list of active alerts
  const alerts: { key: string; emoji: string; text: string; color: string; bgColor: string }[] = [];
  
  if (isHungry) {
    alerts.push({
      key: 'hungry',
      emoji: '🍖',
      text: hunger < 15 ? t('foxy.soHungry') : t('foxy.hungry'),
      color: '#fbbf24',
      bgColor: 'rgba(120,60,10,0.9)',
    });
  }
  if (isThirsty) {
    alerts.push({
      key: 'thirsty',
      emoji: '💧',
      text: thirst < 15 ? t('foxy.soThirsty') : t('foxy.thirsty'),
      color: '#60a5fa',
      bgColor: 'rgba(20,50,100,0.9)',
    });
  }
  if (isSick) {
    alerts.push({
      key: 'sick',
      emoji: '🤒',
      text: t('foxy.sick'),
      color: '#4ade80',
      bgColor: 'rgba(20,80,40,0.9)',
    });
  }

  // Cycle through alerts every 3 seconds
  useEffect(() => {
    if (alerts.length === 0 || isSleeping || foxyState === 'eating') {
      setActiveAlert(null);
      return;
    }
    const idx = cycleIndex % alerts.length;
    setActiveAlert(alerts[idx].key);
  }, [cycleIndex, alerts.length, isSleeping, foxyState]);

  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setInterval(() => {
      setCycleIndex(prev => prev + 1);
    }, 3500);
    return () => clearInterval(timer);
  }, [alerts.length]);

  const currentAlert = alerts.find(a => a.key === activeAlert);

  return (
    <div className="absolute inset-0 pointer-events-none z-15">
      {/* Sleeping ZZZ — large floating letters */}
      <AnimatePresence>
        {isSleeping && (
          <motion.div
            className="absolute"
            style={{ top: '25%', right: '15%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {['Z', 'z', 'z'].map((letter, i) => (
              <motion.span
                key={i}
                className="absolute font-black"
                style={{
                  color: 'rgba(160,180,255,0.7)',
                  fontSize: 32 - i * 8,
                  textShadow: '0 0 20px rgba(100,140,255,0.4)',
                  top: i * -22,
                  left: i * 16,
                }}
                animate={{
                  y: [0, -12, 0],
                  opacity: [0.4, 0.9, 0.4],
                  scale: [0.9, 1.1, 0.9],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.4,
                }}
              >
                {letter}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status speech bubble */}
      <AnimatePresence mode="wait">
        {currentAlert && !isSleeping && (
          <motion.div
            key={currentAlert.key}
            className="absolute flex flex-col items-center"
            style={{ top: '22%', left: '50%', transform: 'translateX(-50%)' }}
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {/* Bubble */}
            <motion.div
              className="relative px-4 py-2.5 rounded-2xl flex items-center gap-2"
              style={{
                background: currentAlert.bgColor,
                border: `2px solid ${currentAlert.color}40`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 15px ${currentAlert.color}20`,
              }}
              animate={{
                y: [0, -4, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {/* Emoji */}
              <motion.span
                className="text-xl"
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {currentAlert.emoji}
              </motion.span>
              
              {/* Text */}
              <span
                className="text-sm font-bold tracking-wide"
                style={{ color: currentAlert.color }}
              >
                {currentAlert.text}
              </span>

              {/* Speech bubble tail */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: `8px solid ${currentAlert.bgColor}`,
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Happy state — floating hearts */}
      <AnimatePresence>
        {foxyState === 'happy' && !isSleeping && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(4)].map((_, i) => (
              <motion.span
                key={`heart-${i}`}
                className="absolute text-lg"
                style={{
                  left: `${30 + i * 12}%`,
                  bottom: '40%',
                }}
                animate={{
                  y: [0, -60, -100],
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.2, 0.8],
                  x: [0, (i % 2 === 0 ? 15 : -15), (i % 2 === 0 ? 25 : -25)],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                  delay: i * 0.5,
                }}
              >
                {i % 2 === 0 ? '💛' : '✨'}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eating state — yum! */}
      <AnimatePresence>
        {foxyState === 'eating' && (
          <motion.div
            className="absolute flex items-center justify-center"
            style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <motion.div
              className="px-4 py-2 rounded-2xl"
              style={{
                background: 'rgba(80,50,10,0.9)',
                border: '2px solid rgba(251,191,36,0.4)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              }}
              animate={{ rotate: [-2, 2, -2] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <span className="text-yellow-300 font-bold text-sm">{t('foxy.yummy')} 😋</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}