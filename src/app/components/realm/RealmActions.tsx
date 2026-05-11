/**
 * RealmActions.tsx — Bottom Action Bar for Foxy Realm
 *
 * AAA Mobile RPG style — dramatic curved layout:
 * - Center button (Battle) is BIGGER and elevated
 * - Side buttons (Bag, Quest) flanking and lower
 * - Each is a circular/rounded medallion with animated glow ring
 * - Bold icons, Cherry Bomb One labels floating below
 * - Pulsing aura animation on idle
 */
import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { Lock, Crown } from 'lucide-react';

const F = "'Cherry Bomb One', cursive";

interface GateInfo {
  remaining: number; // -1 = unlimited
  maxPerDay: number; // -1 = unlimited
  isPaid: boolean;
}

interface RealmActionsProps {
  onBag: () => void;
  onBattle: () => void;
  onQuest: () => void;
  bagIconUrl?: string;
  battleIconUrl?: string;
  questIconUrl?: string;
  isLandscape?: boolean;
  /** Number of daily activities remaining (0-6). When > 0, buttons glow gold. */
  dailyRemaining?: number;
  /** Gate info for the battle button */
  battleGate?: GateInfo;
  /** Navigate to plan page for upgrade */
  onUpgrade?: () => void;
}

interface ActionDef {
  label: string;
  onClick: () => void;
  iconUrl?: string;
  fallbackEmoji: string;
  size: 'normal' | 'big';
  glowColor: string;
  borderColor: string;
}

function ActionMedallion({ btn, index, hasGoldToCollect, gate, onUpgrade }: { btn: ActionDef; index: number; hasGoldToCollect: boolean; gate?: GateInfo; onUpgrade?: () => void }) {
  const sz = btn.size === 'big' ? 82 : 66;
  const iconSz = btn.size === 'big' ? 48 : 36;
  const yOffset = btn.size === 'big' ? -14 : 0;
  const isLocked = gate && gate.remaining === 0 && gate.maxPerDay !== -1;
  const showCounter = gate && gate.maxPerDay > 0 && gate.remaining >= 0;

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ marginTop: yOffset }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: yOffset }}
      transition={{
        delay: index * 0.08,
        type: 'spring',
        stiffness: 280,
        damping: 20,
      }}
    >
      {/* Glow aura behind */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: sz + 20,
          height: sz + 20,
          top: yOffset - 10,
          background: `radial-gradient(circle, ${btn.glowColor}18 0%, transparent 70%)`,
          animation: 'actionPulse 2.5s ease-in-out infinite',
        }}
      />

      {/* Button */}
      <motion.button
        onClick={btn.onClick}
        className="relative flex items-center justify-center"
        style={{
          width: sz,
          height: sz,
          borderRadius: 18,
          background: 'linear-gradient(145deg, rgba(28,22,12,0.92) 0%, rgba(15,12,6,0.96) 100%)',
          border: `2.5px solid ${btn.borderColor}`,
          boxShadow: `
            0 6px 24px rgba(0,0,0,0.6),
            0 0 16px ${btn.glowColor}20,
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 0 -2px 4px rgba(0,0,0,0.3)
          `,
          padding: 0,
        }}
        whileTap={{ scale: 0.88, rotate: -2 }}
        whileHover={{ scale: 1.05 }}
      >
        {/* Corner decorations */}
        {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, i) => (
          <div
            key={i}
            className={`absolute ${pos} w-2 h-2 pointer-events-none`}
            style={{
              borderTop: pos.includes('top') ? `1px solid ${btn.borderColor}60` : 'none',
              borderBottom: pos.includes('bottom') ? `1px solid ${btn.borderColor}60` : 'none',
              borderLeft: pos.includes('left') ? `1px solid ${btn.borderColor}60` : 'none',
              borderRight: pos.includes('right') ? `1px solid ${btn.borderColor}60` : 'none',
              borderRadius: 2,
            }}
          />
        ))}

        {/* Inner glow on hover */}
        <div
          className="absolute inset-0 rounded-[16px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${btn.glowColor}10 0%, transparent 70%)`,
          }}
        />

        {/* Icon */}
        {btn.iconUrl ? (
          <img
            src={btn.iconUrl}
            alt={btn.label}
            style={{ width: iconSz, height: iconSz, objectFit: 'contain', opacity: isLocked ? 0.35 : 1 }}
            draggable={false}
            className="relative z-10"
          />
        ) : (
          <span className="relative z-10" style={{ fontSize: btn.size === 'big' ? 36 : 28, lineHeight: 1, opacity: isLocked ? 0.35 : 1 }}>
            {btn.fallbackEmoji}
          </span>
        )}

        {/* Lock overlay for gated buttons at limit */}
        {isLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[16px]"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            <Lock size={btn.size === 'big' ? 28 : 22} style={{ color: '#d4a44a' }} />
          </div>
        )}

        {/* Remaining counter badge */}
        {showCounter && !isLocked && (
          <div className="absolute -top-1 -right-1 z-20 flex items-center justify-center"
            style={{
              minWidth: 22, height: 22, borderRadius: 11,
              background: gate.remaining <= 1 ? '#e74c3c' : 'rgba(212,164,74,0.9)',
              border: '2px solid rgba(8,6,3,0.8)',
              fontFamily: F, fontSize: 11, fontWeight: 900,
              color: '#fff', padding: '0 4px',
              boxShadow: gate.remaining <= 1 ? '0 0 8px rgba(231,76,60,0.5)' : '0 0 8px rgba(212,164,74,0.4)',
            }}>
            {gate.remaining}
          </div>
        )}

        {/* Animated shimmer sweep */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ borderRadius: 16 }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '60%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              animation: `actionShimmer ${3 + index * 0.5}s ease-in-out infinite ${index * 0.8}s`,
            }}
          />
        </div>
      </motion.button>

      {/* Label below */}
      <motion.span
        style={{
          fontFamily: F,
          fontSize: btn.size === 'big' ? 14 : 12,
          color: isLocked ? 'rgba(212,164,74,0.6)' : hasGoldToCollect ? '#ffeaa7' : 'rgba(220,220,220,0.7)',
          textShadow: hasGoldToCollect
            ? '0 2px 6px rgba(0,0,0,0.8), 0 0 10px rgba(255,234,167,0.15)'
            : '0 2px 6px rgba(0,0,0,0.8)',
          marginTop: 6,
          letterSpacing: '0.02em',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 + index * 0.08 }}
      >
        {btn.label}
      </motion.span>

      {/* Upgrade nudge for locked buttons */}
      {isLocked && !gate.isPaid && onUpgrade && (
        <motion.button
          onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
          className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(212,164,74,0.15)',
            border: '1px solid rgba(212,164,74,0.3)',
            fontFamily: F, fontSize: 9,
            color: '#d4a44a',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.9 }}
        >
          <Crown size={9} /> Upgrade
        </motion.button>
      )}
    </motion.div>
  );
}

export function RealmActions({
  onBag,
  onBattle,
  onQuest,
  bagIconUrl,
  battleIconUrl,
  questIconUrl,
  isLandscape = false,
  dailyRemaining = 6,
  battleGate,
  onUpgrade,
}: RealmActionsProps) {
  const { t } = useLanguage();
  const hasGoldToCollect = dailyRemaining > 0;
  const buttons: ActionDef[] = [
    {
      label: t('realm.bag'),
      onClick: onBag,
      iconUrl: bagIconUrl,
      fallbackEmoji: '🎒',
      size: 'normal',
      glowColor: hasGoldToCollect ? '#ffd700' : '#888888',
      borderColor: hasGoldToCollect ? 'rgba(255,215,0,0.4)' : 'rgba(180,180,180,0.25)',
    },
    {
      label: t('realm.battle'),
      onClick: onBattle,
      iconUrl: battleIconUrl,
      fallbackEmoji: '⚔️',
      size: 'big',
      glowColor: hasGoldToCollect ? '#ff6b3d' : '#888888',
      borderColor: hasGoldToCollect ? 'rgba(255,107,61,0.45)' : 'rgba(180,180,180,0.3)',
    },
    {
      label: t('realm.quest'),
      onClick: onQuest,
      iconUrl: questIconUrl,
      fallbackEmoji: '📜',
      size: 'normal',
      glowColor: hasGoldToCollect ? '#3b82f6' : '#888888',
      borderColor: hasGoldToCollect ? 'rgba(59,130,246,0.35)' : 'rgba(180,180,180,0.25)',
    },
  ];

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
      {/* Gradient fade */}
      <div
        className="pointer-events-auto"
        style={{
          padding: isLandscape ? '12px 0 10px' : '20px 16px 20px',
          background:
            'linear-gradient(to top, rgba(8,6,3,0.85) 0%, rgba(8,6,3,0.5) 40%, transparent 100%)',
          ...(isLandscape ? { paddingTop: 40 } : {}),
        }}
      >
        {/* Curved layout: sides lower, center elevated */}
        <div
          className="flex items-end justify-center"
          style={{ gap: isLandscape ? 32 : 20, maxWidth: isLandscape ? 480 : undefined, margin: '0 auto' }}
        >
          {buttons.map((btn, i) => (
            <ActionMedallion
              key={btn.label}
              btn={btn}
              index={i}
              hasGoldToCollect={hasGoldToCollect}
              gate={i === 1 ? battleGate : undefined}
              onUpgrade={onUpgrade}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes actionPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes actionShimmer {
          0%, 100% { left: -100%; }
          50% { left: 120%; }
        }
      `}</style>
    </div>
  );
}