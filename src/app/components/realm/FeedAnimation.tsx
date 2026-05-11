/**
 * FeedAnimation.tsx — Floating food/water animation when feeding foxy
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedAnimationProps {
  type: 'food' | 'water' | null;
}

export function FeedAnimation({ type }: FeedAnimationProps) {
  return (
    <AnimatePresence>
      {type && (
        <motion.div
          className="absolute inset-0 z-25 pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Floating emoji toward foxy */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`feed-${i}`}
              className="absolute text-3xl"
              initial={{
                opacity: 0,
                y: 100,
                x: -60 + i * 30,
                scale: 0.5,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [100, 20, -20, -60],
                scale: [0.5, 1.2, 1, 0.8],
              }}
              transition={{
                duration: 1.2,
                delay: i * 0.15,
                ease: 'easeOut',
              }}
            >
              {type === 'food' ? '🍌' : '💧'}
            </motion.div>
          ))}

          {/* +HP / +Energy text */}
          <motion.div
            className="absolute text-lg font-bold"
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: [0, -40, -60, -80], scale: [0.5, 1.2, 1, 0.8] }}
            transition={{ duration: 1.5, delay: 0.5 }}
            style={{
              color: type === 'food' ? '#fbbf24' : '#60a5fa',
              textShadow: `0 0 10px ${type === 'food' ? 'rgba(251,191,36,0.5)' : 'rgba(96,165,250,0.5)'}`,
            }}
          >
            {type === 'food' ? '+15 Hunger' : '+15 Thirst'}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
