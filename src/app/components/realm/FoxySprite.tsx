/**
 * FoxySprite.tsx — Animated Foxy / Egg character
 *
 * All animations via Motion (no CSS transform conflicts):
 * - Breathing: gentle scale pulse
 * - Bobbing: float up/down
 * - Glow: aura pulse around foxy
 * - Tap interaction: vigorous egg-shake + sparkle burst
 * - State-based: sleeping overlay, sad state, etc.
 */
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FoxySpriteProps {
  imageUrl: string;
  state: 'sleeping' | 'idle' | 'happy' | 'sad' | 'eating';
  onTap?: () => void;
  isLandscape?: boolean;
}

export function FoxySprite({ imageUrl, state, onTap, isLandscape = false }: FoxySpriteProps) {
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [tapKey, setTapKey] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const shakeTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleTap = useCallback(() => {
    // Trigger shake
    setIsShaking(true);
    setTapKey(k => k + 1);
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => setIsShaking(false), 700);

    // Generate sparkle burst
    const newSparkles = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 180 - 90,
      y: Math.random() * -140 - 20,
    }));
    setSparkles(newSparkles);
    setTimeout(() => setSparkles([]), 900);

    onTap?.();
  }, [onTap]);

  const isSleeping = state === 'sleeping';

  return (
    <div className="relative flex items-center justify-center" style={{ width: isLandscape ? 320 : 460, height: isLandscape ? 320 : 460 }}>
      {/* Glow aura behind foxy */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: isLandscape ? 250 : 360,
          height: isLandscape ? 200 : 300,
          bottom: isLandscape ? 20 : 30,
          background: isSleeping
            ? 'radial-gradient(ellipse, rgba(100,140,255,0.15) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(255,200,100,0.25) 0%, transparent 70%)',
        }}
        animate={{
          opacity: [0.5, 1, 0.5],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Ground shadow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: isLandscape ? 200 : 280,
          height: isLandscape ? 36 : 50,
          bottom: isLandscape ? 8 : 15,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)',
        }}
        animate={{
          scaleX: [1, 0.9, 1],
          opacity: [0.4, 0.3, 0.4],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Foxy/Egg image — all animation via Motion */}
      <motion.div
        className="relative cursor-pointer select-none z-10"
        onClick={handleTap}
        style={{
          filter: state === 'sad' ? 'saturate(0.5) brightness(0.8)' : 'none',
          transformOrigin: 'center bottom',
        }}
        animate={
          isShaking
            ? {
                rotate: [0, -12, 14, -10, 12, -7, 7, -4, 3, 0],
                scale: [1, 1.06, 1.04, 1.06, 1.04, 1.03, 1.02, 1.01, 1.005, 1],
                y: [0, -6, -3, -6, -3, -2, -1, 0, 0, 0],
              }
            : {
                rotate: 0,
                scaleX: isSleeping ? [1, 0.98, 1] : [1, 0.98, 1],
                scaleY: isSleeping ? [1, 1.03, 1] : [1, 1.03, 1],
                y: isSleeping ? 0 : [0, -4, 0],
              }
        }
        transition={
          isShaking
            ? { duration: 0.65, ease: 'easeInOut' }
            : {
                duration: isSleeping ? 4 : 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      >
        <img
          src={imageUrl}
          alt="Foxy"
          className={`${isLandscape ? 'w-64 h-64' : 'w-96 h-96'} object-contain drop-shadow-2xl`}
          draggable={false}
          style={{ imageRendering: 'auto' }}
        />

        {/* Crack lines flash on tap */}
        <AnimatePresence>
          {isShaking && (
            <motion.div
              key={`crack-${tapKey}`}
              className="absolute inset-0 pointer-events-none z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0.6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Radial light burst from center */}
              <div
                className="absolute rounded-full"
                style={{
                  width: 120,
                  height: 120,
                  top: '50%',
                  left: '50%',
                  marginTop: -60,
                  marginLeft: -60,
                  background: 'radial-gradient(circle, rgba(255,230,150,0.35) 0%, transparent 70%)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sleeping ZZZ */}
        {isSleeping && (
          <div className="absolute -top-2 -right-2">
            <span
              className="text-2xl font-bold text-blue-300/80"
              style={{ animation: 'zzzFloat 2s ease-in-out infinite' }}
            >
              Z
            </span>
            <span
              className="text-lg font-bold text-blue-300/60 absolute -top-4 left-3"
              style={{ animation: 'zzzFloat 2s ease-in-out infinite 0.3s' }}
            >
              z
            </span>
            <span
              className="text-sm font-bold text-blue-300/40 absolute -top-7 left-5"
              style={{ animation: 'zzzFloat 2s ease-in-out infinite 0.6s' }}
            >
              z
            </span>
          </div>
        )}

        {/* Happy sparkles */}
        {state === 'happy' && (
          <>
            {[...Array(5)].map((_, i) => (
              <div
                key={`happy-${i}`}
                className="absolute text-yellow-300"
                style={{
                  top: `${10 + i * 15}%`,
                  left: `${10 + i * 18}%`,
                  animation: `happySparkle 1.5s ease-in-out infinite ${i * 0.3}s`,
                  fontSize: 12 + Math.random() * 8,
                }}
              >
                *
              </div>
            ))}
          </>
        )}
      </motion.div>

      {/* Tap sparkle burst */}
      <AnimatePresence>
        {sparkles.map((s) => (
          <motion.div
            key={s.id}
            className="absolute z-20 pointer-events-none"
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: s.x, y: s.y, scale: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ left: '50%', top: '40%' }}
          >
            <div
              className="rounded-full"
              style={{
                width: 6 + Math.random() * 4,
                height: 6 + Math.random() * 4,
                background: Math.random() > 0.5
                  ? 'radial-gradient(circle, #ffd700, #ff9800)'
                  : 'radial-gradient(circle, #c084fc, #7c3aed)',
                boxShadow: Math.random() > 0.5
                  ? '0 0 6px rgba(255,215,0,0.6)'
                  : '0 0 6px rgba(168,85,247,0.6)',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Floating magical particles */}
      {!isSleeping && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={`particle-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 === 0 ? 'rgba(255,200,100,0.6)' : 'rgba(150,200,255,0.5)',
                left: `${15 + i * 13}%`,
                bottom: '10%',
                animation: `particleFloat ${3 + i * 0.5}s ease-in-out infinite ${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* CSS Keyframes — only for non-transform effects */}
      <style>{`
        @keyframes zzzFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.8; }
          50% { transform: translateY(-10px) scale(1.1); opacity: 0.4; }
        }
        @keyframes happySparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes particleFloat {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.6; }
          100% { transform: translateY(-120px) translateX(20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}