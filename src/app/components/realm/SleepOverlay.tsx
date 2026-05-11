/**
 * SleepOverlay.tsx — Dark overlay when foxy is sleeping
 * 
 * Tap anywhere to wake foxy up.
 * Shows moon, stars, and "Tap to wake" prompt
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SleepOverlayProps {
  isSleeping: boolean;
  onWake: () => void;
}

export function SleepOverlay({ isSleeping, onWake }: SleepOverlayProps) {
  return (
    <AnimatePresence>
      {isSleeping && (
        <motion.div
          className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-32 cursor-pointer"
          onClick={onWake}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          style={{
            background: 'linear-gradient(180deg, rgba(10,5,30,0.7) 0%, rgba(20,10,50,0.5) 50%, rgba(10,5,30,0.6) 100%)',
          }}
        >
          {/* Floating stars */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute text-white/30"
              style={{
                top: `${5 + Math.random() * 50}%`,
                left: `${5 + Math.random() * 90}%`,
                fontSize: 6 + Math.random() * 10,
                animation: `starTwinkle ${2 + Math.random() * 3}s ease-in-out infinite ${Math.random() * 2}s`,
              }}
            >
              ✦
            </div>
          ))}

          {/* Moon */}
          <div
            className="absolute top-12 right-8"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #e8e0c8 0%, #c8b88a 50%, #a89868 100%)',
              boxShadow: '0 0 30px rgba(200,184,138,0.3), 0 0 60px rgba(200,184,138,0.15)',
            }}
          />

          {/* Tap prompt */}
          <motion.div
            className="flex flex-col items-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center mb-3"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/50">
                <path d="M12 2C10.34 2 9 3.34 9 5V11.17L7.41 9.59L6 11L12 17L18 11L16.59 9.59L15 11.17V5C15 3.34 13.66 2 12 2Z" fill="currentColor" opacity="0.5"/>
                <circle cx="12" cy="21" r="1.5" fill="currentColor" opacity="0.3"/>
              </svg>
            </div>
            <p className="text-white/40 text-sm font-medium tracking-widest uppercase">
              Tap to wake Foxy
            </p>
          </motion.div>

          <style>{`
            @keyframes starTwinkle {
              0%, 100% { opacity: 0.2; transform: scale(0.8); }
              50% { opacity: 0.8; transform: scale(1.2); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
