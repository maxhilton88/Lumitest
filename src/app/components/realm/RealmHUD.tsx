/**
 * RealmHUD.tsx — AAA Mobile RPG Heads-Up Display
 *
 * BOLD & CHAOTIC game HUD — nothing aligned, nothing safe:
 * - Ornate avatar frame with animated gold ring + level shield badge
 * - XP bar with shaped level end-cap breaking out of the bar
 * - HP bar — totally different style, heart icon, shorter
 * - Currencies in thick beveled dark pills — gold + diamond
 * - Settings & Music as glowing floating orbs
 * - White rank/age text
 * - Cherry Bomb One font — chunky & playful
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getStageEmoji, getStageName, type EvolutionStage } from '../../utils/evolution';

export interface FoxyStats {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  gold: number;
  diamond: number;
  hunger: number;
  thirst: number;
  isSick: boolean;
  evolutionStage: 'egg' | 'baby' | 'young' | 'warrior';
  rank?: number;
  age?: number;
}

interface RealmHUDProps {
  stats: FoxyStats;
  coinIconUrl?: string;
  diamondIconUrl?: string;
  onSettings?: () => void;
  onMusicToggle?: () => void;
  onRecruit?: () => void;
  onAvatarTap?: () => void;
  onDailyQuestsTap?: () => void;
  onGoldTap?: () => void;
  onDiamondTap?: () => void;
  dailyLog?: Record<string, { count?: number }>;
  musicOn?: boolean;
  isLandscape?: boolean;
  /** 'realm' = full HUD (default), 'training' = compact top row only + reward strip */
  variant?: 'realm' | 'training';
  /** XP & Gold reward for the current training session (only shown when variant='training') */
  trainingRewards?: { xp: number; gold: number };
}

const F = "'Cherry Bomb One', cursive";

/* ── Ornate avatar frame with rotating outer ring ── */
function AvatarFrame({ level, foxyUrl, onClick }: { level: number; foxyUrl?: string; onClick?: () => void }) {
  return (
    <div className="relative cursor-pointer" style={{ width: 62, height: 62 }} onClick={onClick}>
      {/* Outer rotating ring */}
      <div
        className="absolute inset-[-4px] rounded-full"
        style={{
          border: '2.5px dashed rgba(255,215,0,0.35)',
          animation: 'hudRingSpin 12s linear infinite',
        }}
      />
      {/* Gold border ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #ffd700, #b8860b, #ffd700, #daa520, #ffd700)',
          padding: 3,
          boxShadow: '0 0 16px rgba(255,215,0,0.4), inset 0 0 8px rgba(255,215,0,0.2)',
        }}
      >
        {/* Inner dark circle */}
        <div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1a1408, #0d0a05)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          {foxyUrl ? (
            <img src={foxyUrl} alt="Fox" className="w-full h-full object-cover scale-150" draggable={false} />
          ) : (
            <span style={{ fontSize: 28 }}>🦊</span>
          )}
        </div>
      </div>
      {/* Level shield badge — overlapping bottom-right */}
      <div
        className="absolute -bottom-1 -right-1 z-10 flex items-center justify-center"
        style={{ width: 28, height: 28 }}
      >
        <svg viewBox="0 0 28 28" width={28} height={28}>
          <defs>
            <linearGradient id="shieldG" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="100%" stopColor="#b8860b" />
            </linearGradient>
          </defs>
          <path
            d="M14 2 L24 8 L24 16 Q24 24 14 27 Q4 24 4 16 L4 8 Z"
            fill="url(#shieldG)"
            stroke="#8b6914"
            strokeWidth="1.2"
          />
          <path
            d="M14 4 L22 9 L22 16 Q22 22.5 14 25 Q6 22.5 6 16 L6 9 Z"
            fill="linear-gradient(135deg, #2a1f0e, #1a1408)"
            style={{ fill: '#1a1408' }}
          />
        </svg>
        <span
          className="absolute"
          style={{
            fontFamily: F,
            fontSize: 12,
            color: '#ffd700',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          {level}
        </span>
      </div>
    </div>
  );
}

/* ── Currency pill — thick beveled dark container ── */
function CurrencyPill({
  value,
  icon,
  color,
  glowColor,
  delay = 0,
  onClick,
}: {
  value: number | string;
  icon: React.ReactNode;
  color: string;
  glowColor: string;
  delay?: number;
  onClick?: () => void;
}) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (typeof value === 'number' && typeof prevRef.current === 'number' && value > prevRef.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 800);
      prevRef.current = value;
      return () => clearTimeout(timer);
    }
    prevRef.current = value;
  }, [value]);

  return (
    <motion.div
      className="flex items-center gap-1.5 relative cursor-pointer"
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(15,12,8,0.9), rgba(25,20,12,0.95))',
        border: `2px solid ${flash ? color : `${glowColor}40`}`,
        borderRadius: 20,
        padding: '4px 12px 4px 6px',
        boxShadow: flash
          ? `0 3px 12px rgba(0,0,0,0.5), 0 0 16px ${glowColor}60, inset 0 1px 0 rgba(255,255,255,0.05)`
          : `0 3px 12px rgba(0,0,0,0.5), 0 0 8px ${glowColor}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: flash ? [1, 1.15, 1] : 1,
      }}
      transition={flash ? { scale: { duration: 0.5, ease: 'easeOut' } } : { delay, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-center" style={{ width: 26, height: 26 }}>
        {icon}
      </div>
      <span
        style={{
          fontFamily: F,
          fontSize: 15,
          color,
          textShadow: `0 1px 3px rgba(0,0,0,0.8), 0 0 8px ${glowColor}30`,
          lineHeight: 1,
        }}
      >
        {typeof value === 'number' ? (value >= 10000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()) : value}
      </span>
    </motion.div>
  );
}

/* ── Gold coin icon ── */
function GoldCoinIcon({ url }: { url?: string }) {
  if (url) return <img src={url} alt="G" className="w-6 h-6 object-contain" draggable={false} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />;
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #ffd700, #ff9800)',
        border: '2px solid #b8860b',
        boxShadow: '0 1px 4px rgba(255,215,0,0.4), inset 0 -1px 2px rgba(0,0,0,0.2)',
      }}
    >
      <span style={{ fontFamily: F, fontSize: 11, color: '#5c3d00', lineHeight: 1 }}>G</span>
    </div>
  );
}

/* ── Diamond icon SVG ── */
function DiamondIcon({ url }: { url?: string }) {
  if (url) return <img src={url} alt="D" className="w-6 h-6 object-contain" draggable={false} style={{ filter: 'drop-shadow(0 1px 4px rgba(139,92,246,0.5))' }} />;
  return (
    <svg viewBox="0 0 26 26" width={24} height={24} style={{ filter: 'drop-shadow(0 1px 4px rgba(139,92,246,0.5))' }}>
      <defs>
        <linearGradient id="dgr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="40%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <polygon points="13,1 24,9 13,25 2,9" fill="url(#dgr)" stroke="#6d28d9" strokeWidth="1.2" />
      <polygon points="13,1 18,9 13,7.5 8,9" fill="rgba(255,255,255,0.35)" />
      <line x1="2" y1="9" x2="24" y2="9" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />
    </svg>
  );
}

/* ── Daily progress pill — shows X/6 remaining activities to collect ── */
function DailyPill({ completed, onClick, delay = 0 }: { completed: number; onClick?: () => void; delay?: number }) {
  const { t } = useLanguage();
  const remaining = 6 - completed;
  const hasUncollected = remaining > 0;
  const glowColor = hasUncollected ? 'rgba(255,215,0,0.45)' : 'rgba(124,198,67,0.25)';
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-1.5 relative"
      style={{
        background: 'linear-gradient(135deg, rgba(15,12,8,0.9), rgba(25,20,12,0.95))',
        border: `2px solid ${glowColor}`,
        borderRadius: 20,
        padding: '4px 12px 4px 6px',
        boxShadow: `0 3px 12px rgba(0,0,0,0.5), 0 0 ${hasUncollected ? '12px' : '4px'} ${hasUncollected ? 'rgba(255,215,0,0.25)' : 'rgba(124,198,67,0.08)'}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileTap={{ scale: 0.92 }}
    >
      {/* Pulsing glow ring when gold is available to collect */}
      {hasUncollected && (
        <motion.div
          className="absolute inset-[-3px] rounded-full pointer-events-none"
          style={{
            border: '1.5px solid rgba(255,215,0,0.3)',
            borderRadius: 20,
          }}
          animate={{
            boxShadow: [
              '0 0 4px rgba(255,215,0,0.15)',
              '0 0 12px rgba(255,215,0,0.35)',
              '0 0 4px rgba(255,215,0,0.15)',
            ],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="flex items-center justify-center" style={{ width: 26, height: 26 }}>
        <span
          style={{
            fontFamily: F,
            fontSize: 15,
            color: hasUncollected ? '#ffd700' : '#7cc643',
            textShadow: hasUncollected
              ? '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(255,215,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.8)',
            lineHeight: 1,
          }}
        >
          {remaining}/6
        </span>
      </div>
      <span
        style={{
          fontFamily: F,
          fontSize: 15,
          color: hasUncollected ? '#ffd700' : 'rgba(200,184,138,0.7)',
          textShadow: hasUncollected
            ? '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(255,215,0,0.2)'
            : '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(212,164,74,0.15)',
          lineHeight: 1,
        }}
      >
        {t('realm.daily')}
      </span>
      {/* Glowing coin indicator when there's gold to collect */}
      {hasUncollected ? (
        <motion.div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: '#ffd700', boxShadow: '0 0 6px rgba(255,215,0,0.7)' }}
          animate={{
            scale: [1, 1.3, 1],
            boxShadow: [
              '0 0 4px rgba(255,215,0,0.5)',
              '0 0 10px rgba(255,215,0,0.8)',
              '0 0 4px rgba(255,215,0,0.5)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#7cc643', boxShadow: '0 0 4px rgba(124,198,67,0.6)' }} />
      )}
    </motion.button>
  );
}

/* ── Level Badge — fused to the left of the XP bar ── */
function LevelBadge({ level }: { level: number }) {
  const size = 34;
  return (
    <div className="relative flex-shrink-0 z-10" style={{ width: size, height: size, marginRight: -5 }}>
      {/* Pulsing glow ring */}
      <div
        className="absolute inset-[-3px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,215,0,0.25) 0%, transparent 70%)',
          animation: 'levelPulse 2.5s ease-in-out infinite',
        }}
      />
      {/* Outer gold ring */}
      <svg viewBox="0 0 40 40" width={size} height={size} className="absolute inset-0">
        <defs>
          <linearGradient id="lvlRingG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd700" />
            <stop offset="50%" stopColor="#b8860b" />
            <stop offset="100%" stopColor="#ffd700" />
          </linearGradient>
          <linearGradient id="lvlInnerG" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a1408" />
            <stop offset="100%" stopColor="#0d0a05" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill="url(#lvlRingG)" />
        <circle cx="20" cy="20" r="15" fill="url(#lvlInnerG)" stroke="#8b6914" strokeWidth="0.8" />
        <circle cx="20" cy="3.5" r="1.5" fill="#ffd700" opacity="0.6" />
        <circle cx="20" cy="36.5" r="1.5" fill="#ffd700" opacity="0.6" />
      </svg>
      {/* Level number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          style={{
            fontFamily: F,
            fontSize: level >= 100 ? 10 : level >= 10 ? 12 : 15,
            color: '#ffd700',
            textShadow: '0 1px 4px rgba(0,0,0,1), 0 0 10px rgba(255,215,0,0.4)',
            lineHeight: 1,
          }}
        >
          {level}
        </span>
      </div>
      {/* Tiny "LV" label at top */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: -2,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #b8860b, #8b6914)',
          borderRadius: 4,
          padding: '0px 4px',
          border: '1px solid rgba(255,215,0,0.4)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
        }}
      >
        <span style={{ fontFamily: F, fontSize: 7, color: '#ffd700', lineHeight: 1.3, letterSpacing: 1 }}>LV</span>
      </div>
    </div>
  );
}

/* ── Energy Badge — fused to the left of the HP bar ── */
function EnergyBadge({ hp, maxHp }: { hp: number; maxHp: number }) {
  const size = 34;
  const hpPct = Math.round((hp / maxHp) * 100);
  // Color shifts: green > 60%, yellow > 30%, red <= 30%
  const ringColor = hpPct > 60 ? '#ef4444' : hpPct > 30 ? '#eab308' : '#991b1b';
  const glowColor = hpPct > 60 ? 'rgba(239,68,68,0.25)' : hpPct > 30 ? 'rgba(234,179,8,0.25)' : 'rgba(153,27,27,0.3)';
  return (
    <div className="relative flex-shrink-0 z-10" style={{ width: size, height: size, marginRight: -5 }}>
      {/* Pulsing glow ring */}
      <div
        className="absolute inset-[-3px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          animation: 'levelPulse 2.5s ease-in-out infinite',
          animationDelay: '1.2s',
        }}
      />
      {/* Outer ring */}
      <svg viewBox="0 0 40 40" width={size} height={size} className="absolute inset-0">
        <defs>
          <linearGradient id="hpRingG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ringColor} />
            <stop offset="50%" stopColor="#7f1d1d" />
            <stop offset="100%" stopColor={ringColor} />
          </linearGradient>
          <linearGradient id="hpInnerG" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a0808" />
            <stop offset="100%" stopColor="#0d0505" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill="url(#hpRingG)" />
        <circle cx="20" cy="20" r="15" fill="url(#hpInnerG)" stroke="#7f1d1d" strokeWidth="0.8" />
        {/* Heart shape inside */}
        <path
          d="M20 30 Q12 22 12 17 Q12 13 15.5 13 Q18 13 20 16 Q22 13 24.5 13 Q28 13 28 17 Q28 22 20 30Z"
          fill="none"
          stroke={ringColor}
          strokeWidth="0.6"
          opacity="0.3"
        />
      </svg>
      {/* HP number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          style={{
            fontFamily: F,
            fontSize: hp >= 1000 ? 9 : hp >= 100 ? 10 : 13,
            color: hpPct > 60 ? '#f87171' : hpPct > 30 ? '#facc15' : '#ef4444',
            textShadow: `0 1px 4px rgba(0,0,0,1), 0 0 8px ${glowColor}`,
            lineHeight: 1,
          }}
        >
          {hp}
        </span>
      </div>
      {/* Tiny "HP" label at top */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: -2,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #991b1b, #7f1d1d)',
          borderRadius: 4,
          padding: '0px 4px',
          border: '1px solid rgba(239,68,68,0.35)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
        }}
      >
        <span style={{ fontFamily: F, fontSize: 7, color: '#f87171', lineHeight: 1.3, letterSpacing: 1 }}>HP</span>
      </div>
    </div>
  );
}

export function RealmHUD({ stats, coinIconUrl, diamondIconUrl, onSettings, onMusicToggle, onRecruit, onAvatarTap, onDailyQuestsTap, onGoldTap, onDiamondTap, dailyLog = {}, musicOn = true, isLandscape = false, variant = 'realm', trainingRewards }: RealmHUDProps) {
  const { language } = useLanguage();
  const xpPct = Math.min(100, Math.round((stats.xp / stats.xpToNext) * 100));
  const hpPct = Math.min(100, Math.round((stats.hp / stats.maxHp) * 100));
  const dailyCompleted = ['test','practice','flashcard','video','music','battle'].filter(k => (dailyLog[k]?.count || 0) > 0).length;

  // Evolution stage badge
  const stageEmoji = getStageEmoji(stats.evolutionStage as EvolutionStage);
  const stageName = getStageName(stats.evolutionStage as EvolutionStage, language);
  const stageColor = stats.evolutionStage === 'warrior' ? '#fbbf24' : stats.evolutionStage === 'young' ? '#60a5fa' : stats.evolutionStage === 'baby' ? '#4ade80' : '#a78bfa';

  // ── LANDSCAPE / DESKTOP LAYOUT ──
  if (isLandscape) {
    return (
      <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
        <div className="pointer-events-auto" style={{ padding: '12px 20px 0' }}>
          <div className="flex items-start gap-4" style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* LEFT CLUSTER: Avatar + Name + Bars */}
            <div className="flex items-start gap-3" style={{ minWidth: 0, flex: '0 1 420px' }}>
              {/* Avatar frame */}
              <AvatarFrame level={stats.level} onClick={onAvatarTap} />

              <div className="flex-1 min-w-0 pt-0.5">
                {/* Name + rank/age */}
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 17,
                      color: '#ffd700',
                      textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.2)',
                      lineHeight: 1.1,
                    }}
                  >
                    {stats.name}
                  </span>
                  {/* Evolution stage badge */}
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${stageColor}15`,
                      border: `1px solid ${stageColor}30`,
                      fontFamily: F,
                      fontSize: 9,
                      color: stageColor,
                      lineHeight: 1,
                      textShadow: `0 0 6px ${stageColor}40`,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>{stageEmoji}</span>
                    {stageName.split(' ').pop()}
                  </span>
                  <span style={{ fontFamily: F, fontSize: 11, color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    Rank #{stats.rank ?? 42}
                  </span>
                  <span style={{ fontFamily: F, fontSize: 11, color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    Age {stats.age ?? 5}
                  </span>
                </div>

                {/* XP + HP bars row */}
                <div className="mt-1.5 flex items-center gap-2">
                  {/* XP */}
                  <div className="flex items-center flex-1 min-w-0">
                    <LevelBadge level={stats.level} />
                    <div className="flex-1 relative">
                      <div
                        className="relative overflow-hidden"
                        style={{
                          height: 20,
                          borderRadius: '3px 10px 10px 3px',
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(10,8,4,0.75) 100%)',
                          border: '2px solid rgba(34,197,94,0.3)',
                          borderLeft: '2px solid rgba(255,215,0,0.25)',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 2px 5px rgba(0,0,0,0.5)',
                        }}
                      >
                        <motion.div
                          className="absolute inset-y-0 left-0"
                          style={{
                            background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 40%, #16a34a 100%)',
                            borderRadius: '1px 8px 8px 1px',
                            boxShadow: '0 0 12px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${xpPct}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                        />
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)', animation: 'hudShineSweep 3s ease-in-out infinite' }} />
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          <span style={{ fontFamily: F, fontSize: 9, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,1)' }}>EXP</span>
                          <span style={{ fontFamily: F, fontSize: 8, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{stats.xp}/{stats.xpToNext}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* HP */}
                  <div className="flex items-center flex-1 min-w-0">
                    <EnergyBadge hp={stats.hp} maxHp={stats.maxHp} />
                    <div className="flex-1 relative">
                      <div
                        className="relative overflow-hidden"
                        style={{
                          height: 20,
                          borderRadius: '3px 10px 10px 3px',
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(15,5,5,0.7) 100%)',
                          border: '2px solid rgba(239,68,68,0.25)',
                          borderLeft: '2px solid rgba(239,68,68,0.2)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.45), inset 0 2px 4px rgba(0,0,0,0.4)',
                        }}
                      >
                        <motion.div
                          className="absolute inset-y-0 left-0"
                          style={{
                            background: hpPct > 55 ? 'linear-gradient(180deg, #f87171 0%, #ef4444 40%, #dc2626 100%)' : hpPct > 25 ? 'linear-gradient(180deg, #facc15 0%, #eab308 40%, #ca8a04 100%)' : 'linear-gradient(180deg, #ef4444 0%, #b91c1c 40%, #7f1d1d 100%)',
                            borderRadius: '1px 8px 8px 1px',
                            boxShadow: hpPct > 55 ? '0 0 10px rgba(239,68,68,0.3)' : hpPct > 25 ? '0 0 10px rgba(234,179,8,0.3)' : '0 0 10px rgba(153,27,27,0.4)',
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${hpPct}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
                        />
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)', animation: 'hudShineSweep 3.5s ease-in-out infinite', animationDelay: '0.5s' }} />
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          <span style={{ fontFamily: F, fontSize: 9, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>HP</span>
                          <span style={{ fontFamily: F, fontSize: 8, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{stats.hp}/{stats.maxHp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SPACER */}
            <div className="flex-1" />

            {/* RIGHT CLUSTER: Daily + Currencies + Settings */}
            <div className="flex items-center gap-3">
              <DailyPill completed={dailyCompleted} onClick={onDailyQuestsTap} delay={0.1} />
              <CurrencyPill value={stats.gold} icon={<GoldCoinIcon url={coinIconUrl} />} color="#ffd700" glowColor="#ffd700" delay={0.15} onClick={onGoldTap} />
              <CurrencyPill value={stats.diamond} icon={<DiamondIcon url={diamondIconUrl} />} color="#c084fc" glowColor="#a855f7" delay={0.25} onClick={onDiamondTap} />
              <div className="flex gap-1.5 ml-1">
                <motion.button
                  onClick={onSettings}
                  className="flex items-center justify-center"
                  style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(20,16,10,0.9), rgba(30,24,14,0.95))', border: '1.5px solid rgba(255,215,0,0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 6px rgba(255,215,0,0.1)' }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Settings size={16} color="#c8b88a" />
                </motion.button>
                <motion.button
                  onClick={onMusicToggle}
                  className="flex items-center justify-center"
                  style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(20,16,10,0.9), rgba(30,24,14,0.95))', border: `1.5px solid ${musicOn ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 6px ${musicOn ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}` }}
                  whileTap={{ scale: 0.85 }}
                >
                  {musicOn ? <Volume2 size={16} color="#4ade80" /> : <VolumeX size={16} color="#f87171" />}
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* HUD Keyframes */}
        <style>{`
          @keyframes hudRingSpin { to { transform: rotate(360deg); } }
          @keyframes hudShineSweep { 0%, 100% { transform: translateX(-120%); } 50% { transform: translateX(120%); } }
          @keyframes levelPulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        `}</style>
      </div>
    );
  }

  // ── PORTRAIT / MOBILE LAYOUT (original) ──
  return (
    <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
      <div className="pointer-events-auto" style={{ padding: '10px 12px 0' }}>

        {/* ═══ TOP ROW: Avatar + Settings/Music + Currencies ═══ */}
        <div className="flex items-start gap-2">

          {/* Avatar frame */}
          <AvatarFrame level={stats.level} onClick={onAvatarTap} />

          {/* Middle: name + rank/age */}
          <div className="flex-1 flex flex-col pt-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  fontFamily: F,
                  fontSize: 16,
                  color: '#ffd700',
                  textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.2)',
                  lineHeight: 1.1,
                }}
              >
                {stats.name}
              </span>
              {/* Evolution stage badge (portrait) */}
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${stageColor}15`,
                  border: `1px solid ${stageColor}30`,
                  fontFamily: F,
                  fontSize: 8,
                  color: stageColor,
                  lineHeight: 1,
                  textShadow: `0 0 6px ${stageColor}40`,
                }}
              >
                <span style={{ fontSize: 9 }}>{stageEmoji}</span>
                {stageName.split(' ').pop()}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span
                style={{
                  fontFamily: F,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.8)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
              >
                🏆 #{stats.rank ?? 42}
              </span>
              <span
                style={{
                  fontFamily: F,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
              >
                ⭐ Age {stats.age ?? 5}
              </span>
            </div>
          </div>

          {/* Settings & Music orbs */}
          <div className="flex gap-1.5 pt-0.5">
            <motion.button
              onClick={onSettings}
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(20,16,10,0.9), rgba(30,24,14,0.95))',
                border: '1.5px solid rgba(255,215,0,0.25)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 6px rgba(255,215,0,0.1)',
              }}
              whileTap={{ scale: 0.85 }}
            >
              <Settings size={16} color="#c8b88a" />
            </motion.button>
            <motion.button
              onClick={onMusicToggle}
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(20,16,10,0.9), rgba(30,24,14,0.95))',
                border: `1.5px solid ${musicOn ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 6px ${musicOn ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}`,
              }}
              whileTap={{ scale: 0.85 }}
            >
              {musicOn ? <Volume2 size={16} color="#4ade80" /> : <VolumeX size={16} color="#f87171" />}
            </motion.button>
          </div>
        </div>

        {/* ═══ XP + HP BARS — side by side in one row ═══ */}
        {variant !== 'training' && (
        <div className="mt-2 flex items-center gap-2">
          {/* ── XP Bar with Level Badge ── */}
          <div className="flex items-center flex-1 min-w-0">
            <LevelBadge level={stats.level} />
            <div className="flex-1 relative">
              <div
                className="relative overflow-hidden"
                style={{
                  height: 22,
                  borderRadius: '3px 11px 11px 3px',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(10,8,4,0.75) 100%)',
                  border: '2px solid rgba(34,197,94,0.3)',
                  borderLeft: '2px solid rgba(255,215,0,0.25)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 2px 5px rgba(0,0,0,0.5)',
                }}
              >
                {/* XP Fill */}
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{
                    background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 40%, #16a34a 100%)',
                    borderRadius: '1px 10px 10px 1px',
                    boxShadow: '0 0 12px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
                {/* Shine sweep */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                    animation: 'hudShineSweep 3s ease-in-out infinite',
                  }}
                />
                {/* Text overlay */}
                <div className="absolute inset-0 flex items-center justify-between px-2.5">
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 10,
                      color: '#fff',
                      textShadow: '0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.6)',
                    }}
                  >
                    EXP
                  </span>
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.9)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    }}
                  >
                    {stats.xp}/{stats.xpToNext}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── HP Bar with Energy Badge ── */}
          <div className="flex items-center flex-1 min-w-0">
            <EnergyBadge hp={stats.hp} maxHp={stats.maxHp} />
            <div className="flex-1 relative">
              <div
                className="relative overflow-hidden"
                style={{
                  height: 22,
                  borderRadius: '3px 11px 11px 3px',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(15,5,5,0.7) 100%)',
                  border: '2px solid rgba(239,68,68,0.25)',
                  borderLeft: '2px solid rgba(239,68,68,0.2)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.45), inset 0 2px 4px rgba(0,0,0,0.4)',
                }}
              >
                {/* HP Fill */}
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{
                    background:
                      hpPct > 55
                        ? 'linear-gradient(180deg, #f87171 0%, #ef4444 40%, #dc2626 100%)'
                        : hpPct > 25
                          ? 'linear-gradient(180deg, #facc15 0%, #eab308 40%, #ca8a04 100%)'
                          : 'linear-gradient(180deg, #ef4444 0%, #b91c1c 40%, #7f1d1d 100%)',
                    borderRadius: '1px 10px 10px 1px',
                    boxShadow:
                      hpPct > 55
                        ? '0 0 10px rgba(239,68,68,0.3)'
                        : hpPct > 25
                          ? '0 0 10px rgba(234,179,8,0.3)'
                          : '0 0 10px rgba(153,27,27,0.4)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${hpPct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
                />
                {/* Shine sweep */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                    animation: 'hudShineSweep 3.5s ease-in-out infinite',
                    animationDelay: '0.5s',
                  }}
                />
                {/* Text overlay */}
                <div className="absolute inset-0 flex items-center justify-between px-2.5">
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 10,
                      color: '#fff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    }}
                  >
                    HP
                  </span>
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.9)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    }}
                  >
                    {stats.hp}/{stats.maxHp}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ═══ TRAINING REWARDS STRIP — shown only in training variant ═══ */}
        {variant === 'training' && trainingRewards && (
          <motion.div
            className="flex items-center justify-end gap-3 mt-2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
          >
            {/* "Rewards:" label removed — pills are self-explanatory */}
            {/* XP reward pill */}
            <div
              className="flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, rgba(15,12,8,0.9), rgba(25,20,12,0.95))',
                border: '2px solid rgba(34,197,94,0.3)',
                borderRadius: 20,
                padding: '3px 10px 3px 6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 6px rgba(34,197,94,0.15)',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>✨</span>
              <span
                style={{
                  fontFamily: F,
                  fontSize: 13,
                  color: '#4ade80',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(34,197,94,0.25)',
                  lineHeight: 1,
                }}
              >
                +{trainingRewards.xp} XP
              </span>
            </div>
            {/* Gold reward pill */}
            <div
              className="flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, rgba(15,12,8,0.9), rgba(25,20,12,0.95))',
                border: '2px solid rgba(255,215,0,0.3)',
                borderRadius: 20,
                padding: '3px 10px 3px 6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 6px rgba(255,215,0,0.15)',
              }}
            >
              <GoldCoinIcon url={coinIconUrl} />
              <span
                style={{
                  fontFamily: F,
                  fontSize: 13,
                  color: '#ffd700',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(255,215,0,0.25)',
                  lineHeight: 1,
                }}
              >
                +{trainingRewards.gold}
              </span>
            </div>
          </motion.div>
        )}

        {/* ═══ DAILY + CURRENCIES — floating right-aligned ═══ */}
        {variant !== 'training' && (
        <div className="flex items-center justify-end gap-2 mt-2">
          <DailyPill completed={dailyCompleted} onClick={onDailyQuestsTap} delay={0.1} />
          <CurrencyPill
            value={stats.gold}
            icon={<GoldCoinIcon url={coinIconUrl} />}
            color="#ffd700"
            glowColor="#ffd700"
            delay={0.15}
            onClick={onGoldTap}
          />
          <CurrencyPill
            value={stats.diamond}
            icon={<DiamondIcon url={diamondIconUrl} />}
            color="#c084fc"
            glowColor="#a855f7"
            delay={0.25}
            onClick={onDiamondTap}
          />
        </div>
        )}
      </div>

      {/* HUD Keyframes */}
      <style>{`
        @keyframes hudRingSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes hudShineSweep {
          0%, 100% { transform: translateX(-120%); }
          50% { transform: translateX(120%); }
        }
        @keyframes levelPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}