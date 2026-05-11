/**
 * RewardToastOverlay.tsx — Floating reward popups
 *
 * Shows animated "+X Gold", "+X XP", "+X Diamond" notifications
 * that rise and fade out. Stacks up to 5 at a time, newest on top.
 * Rendered globally in RealmShell above all other content.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onReward, type RewardEvent } from '../../utils/reward-events';
import { useRealmContext } from '../../contexts/RealmContext';

const F = "'Cherry Bomb One', cursive";

const REWARD_CONFIG: Record<string, {
  icon: string;
  color: string;
  glow: string;
  label: string;
  bg: string;
  border: string;
}> = {
  gold: {
    icon: '\u{1FA99}',
    color: '#ffd700',
    glow: 'rgba(255,215,0,0.5)',
    label: 'Gold',
    bg: 'linear-gradient(135deg, rgba(40,30,10,0.95), rgba(25,18,5,0.98))',
    border: 'rgba(255,215,0,0.5)',
  },
  diamond: {
    icon: '\u{1F48E}',
    color: '#c084fc',
    glow: 'rgba(168,85,247,0.5)',
    label: 'Diamond',
    bg: 'linear-gradient(135deg, rgba(30,15,50,0.95), rgba(20,10,35,0.98))',
    border: 'rgba(168,85,247,0.5)',
  },
  xp: {
    icon: '\u2728',
    color: '#4ade80',
    glow: 'rgba(74,222,128,0.5)',
    label: 'XP',
    bg: 'linear-gradient(135deg, rgba(10,30,15,0.95), rgba(5,20,10,0.98))',
    border: 'rgba(74,222,128,0.5)',
  },
};

const MAX_VISIBLE = 5;
const TOAST_DURATION = 2200;

interface ToastItem extends RewardEvent {
  createdAt: number;
}

export function RewardToastOverlay() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Get diamond icon URL from realm assets
  let diamondIconUrl: string | undefined;
  let goldIconUrl: string | undefined;
  try {
    const { assets } = useRealmContext();
    diamondIconUrl = assets.iconDiamond;
    goldIconUrl = assets.iconCoin;
  } catch {}

  const addToast = useCallback((event: RewardEvent) => {
    const item: ToastItem = { ...event, createdAt: Date.now() };
    setToasts(prev => {
      const next = [item, ...prev].slice(0, MAX_VISIBLE + 2); // keep a small buffer
      return next;
    });

    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== event.id));
    }, TOAST_DURATION);
  }, []);

  useEffect(() => {
    const unsub = onReward(addToast);
    return unsub;
  }, [addToast]);

  return (
    <div
      className="fixed z-[400] pointer-events-none"
      style={{
        top: 90, // below HUD
        left: '50%',
        transform: 'translateX(-50%)',
        width: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.slice(0, MAX_VISIBLE).map((toast, idx) => {
          const cfg = REWARD_CONFIG[toast.type];
          // Use game asset image for gold & diamond if available
          const useAssetImg = (toast.type === 'diamond' && diamondIconUrl) || (toast.type === 'gold' && goldIconUrl);
          const assetUrl = toast.type === 'diamond' ? diamondIconUrl : toast.type === 'gold' ? goldIconUrl : undefined;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -30, scale: 0.6 }}
              animate={{
                opacity: idx === 0 ? 1 : Math.max(0.3, 1 - idx * 0.2),
                y: 0,
                scale: idx === 0 ? 1 : Math.max(0.85, 1 - idx * 0.05),
              }}
              exit={{ opacity: 0, y: -20, scale: 0.5 }}
              transition={{
                type: 'spring',
                damping: 18,
                stiffness: 300,
              }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-full"
              style={{
                background: cfg.bg,
                border: `2px solid ${cfg.border}`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 20px ${cfg.glow}`,
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* Icon with bounce — use game asset image if available */}
              <motion.span
                style={{ fontSize: 22, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                initial={{ scale: 0.3, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 8, stiffness: 350, delay: 0.05 }}
              >
                {useAssetImg && assetUrl ? (
                  <img src={assetUrl} alt="" className="w-6 h-6 object-contain" draggable={false} style={{ filter: `drop-shadow(0 1px 4px ${cfg.glow})` }} />
                ) : (
                  cfg.icon
                )}
              </motion.span>

              {/* Amount text */}
              <motion.span
                style={{
                  fontFamily: F,
                  fontSize: 18,
                  color: cfg.color,
                  textShadow: `0 2px 8px rgba(0,0,0,0.8), 0 0 12px ${cfg.glow}`,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.08 }}
              >
                +{toast.amount.toLocaleString()}
              </motion.span>

              {/* Label */}
              <span
                style={{
                  fontFamily: F,
                  fontSize: 11,
                  color: `${cfg.color}99`,
                  textShadow: `0 1px 3px rgba(0,0,0,0.6)`,
                  lineHeight: 1,
                }}
              >
                {cfg.label}
              </span>

              {/* Sparkle particles */}
              {idx === 0 && (
                <>
                  {[0, 1, 2].map(p => (
                    <motion.div
                      key={p}
                      className="absolute rounded-full"
                      style={{
                        width: 4,
                        height: 4,
                        background: cfg.color,
                        right: 10 + p * 12,
                        top: '50%',
                      }}
                      initial={{ opacity: 0.8, scale: 1, y: 0, x: 0 }}
                      animate={{
                        opacity: 0,
                        scale: 0,
                        y: -20 - p * 8,
                        x: (p - 1) * 15,
                      }}
                      transition={{ duration: 0.8, delay: 0.15 + p * 0.1 }}
                    />
                  ))}
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}