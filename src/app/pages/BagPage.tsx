/**
 * BagPage.tsx — Foxy Adventure Inventory & Shop (Redesigned)
 *
 * Pokémon-style Bag + Shop with two tabs (Bag first, Shop second).
 * - Header banner area (uploadable via RPG Asset Manager slug "bag_header" / "shop_header")
 * - Large 2-column item cards with prominent Use/Buy actions
 * - Gold/diamond persistence via flushStats after every purchase
 * - All 7 effect types: hp, xp, energy, level, gold, shield, time_extend
 * - Items are admin-configured via ShopManager
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft, ShoppingBag, Store, Sparkles, Package, Swords, Crown, Zap,
  Heart, Star, TrendingUp, X, Shield, Clock, Coins, Check,
  Crosshair, Wind, HeartPulse, ShieldHalf,
  Egg, RefreshCw, MapPin, Lock, Plus,
} from 'lucide-react';
import {
  fetchShopItems, fetchRPGAssets, fetchRealmStoreAvailability,
  type ShopItemDef, type RPGAsset, type EquipSlot,
  saveEquipped, recomputeEquipmentBonuses,
  triggerDailyRefresh,
} from '../utils/api';
import { useRealmContext, xpRequiredForLevel } from '../contexts/RealmContext';
import { useLanguage } from '../components/LanguageContext';
import {
  BAG_DEFAULT_SLOTS, BAG_MAX_SLOTS, STACK_LIMIT,
  getBagSlotsUsed, canAddToBag, getNextSlotCost, type SlotCost,
} from '../utils/bag-helpers';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";

type Tab = 'bag' | 'shop';

// ── Rarity visual config ──
const RARITY: Record<string, { label: string; tKey: string; color: string; border: string; glow: string; bg: string }> = {
  common:    { label: 'Common',    tKey: 'rarity.common',    color: '#9ca3af', border: 'rgba(156,163,175,0.3)',  glow: 'rgba(156,163,175,0.1)',  bg: 'linear-gradient(145deg, #1e1e23 0%, #16161b 100%)' },
  rare:      { label: 'Rare',      tKey: 'rarity.rare',      color: '#60a5fa', border: 'rgba(96,165,250,0.35)',   glow: 'rgba(96,165,250,0.15)',  bg: 'linear-gradient(145deg, #111a30 0%, #0d1425 100%)' },
  epic:      { label: 'Epic',      tKey: 'rarity.epic',      color: '#c084fc', border: 'rgba(192,132,252,0.35)',  glow: 'rgba(192,132,252,0.15)', bg: 'linear-gradient(145deg, #231040 0%, #1a0b30 100%)' },
  legendary: { label: 'Legendary', tKey: 'rarity.legendary', color: '#fbbf24', border: 'rgba(251,191,36,0.4)',    glow: 'rgba(251,191,36,0.2)',   bg: 'linear-gradient(145deg, #302008 0%, #251a06 100%)' },
};

const EFFECT_META: Record<string, { icon: any; color: string; label: string; tKey: string }> = {
  xp:          { icon: Star,        color: '#22c55e', label: 'XP',          tKey: 'stat.xp' },
  energy:      { icon: Zap,         color: '#facc15', label: 'Energy',      tKey: 'stat.energy' },
  hp:          { icon: Heart,       color: '#ef4444', label: 'HP',          tKey: 'stat.hp' },
  level:       { icon: TrendingUp,  color: '#a855f7', label: 'Level',       tKey: 'stat.level' },
  gold:        { icon: Coins,       color: '#ffd700', label: 'Gold',        tKey: 'stat.gold' },
  shield:      { icon: Shield,      color: '#3b82f6', label: 'Shield',      tKey: 'stat.shield' },
  time_extend: { icon: Clock,       color: '#f97316', label: 'Time',        tKey: 'stat.time' },
  attack:      { icon: Crosshair,   color: '#f43f5e', label: 'ATK',         tKey: 'stat.atk' },
  defense:     { icon: ShieldHalf,  color: '#06b6d4', label: 'DEF',         tKey: 'stat.def' },
  speed:       { icon: Wind,        color: '#84cc16', label: 'SPD',         tKey: 'stat.spd' },
  max_hp:      { icon: HeartPulse,  color: '#ec4899', label: 'Max HP',      tKey: 'stat.maxHp' },
  xp_percent:  { icon: Star,        color: '#10b981', label: 'XP%',         tKey: 'stat.xpPercent' },
  hatch_accelerator: { icon: Egg,   color: '#f59e0b', label: '-12hr Hatch', tKey: 'stat.hatchAccel' },
  daily_refresh:     { icon: RefreshCw, color: '#06b6d4', label: 'Daily Reset', tKey: 'stat.dailyReset' },
  treasure_map:      { icon: MapPin, color: '#fbbf24', label: '3× Gold',    tKey: 'stat.treasureMap' },
};

const EQUIP_SLOT_META: Record<string, { label: string; tKey: string; emoji: string; color: string }> = {
  weapon:    { label: 'Weapon',    tKey: 'slot.weapon',    emoji: '⚔️', color: '#f43f5e' },
  armor:     { label: 'Armor',     tKey: 'slot.armor',     emoji: '🛡️', color: '#06b6d4' },
  boots:     { label: 'Boots',     tKey: 'slot.boots',     emoji: '👢', color: '#84cc16' },
  accessory: { label: 'Accessory', tKey: 'slot.accessory', emoji: '💍', color: '#c084fc' },
};

/* ═══════════════════════════════════
   CURRENCY COMPONENTS
   ═════════════════════════��═════════ */

function GoldIcon({ size = 18 }: { size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center shrink-0" style={{
      width: size, height: size,
      background: 'linear-gradient(135deg, #ffd700, #ff9800)',
      border: '1.5px solid #b8860b',
      boxShadow: '0 1px 3px rgba(255,215,0,0.3)',
    }}>
      <span style={{ fontFamily: F, fontSize: size * 0.48, color: '#5c3d00', lineHeight: 1 }}>G</span>
    </div>
  );
}

function DiamondSvg({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} className="shrink-0" style={{ filter: 'drop-shadow(0 1px 3px rgba(139,92,246,0.35))' }}>
      <defs><linearGradient id="bdg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e9d5ff" /><stop offset="40%" stopColor="#a855f7" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient></defs>
      <polygon points="13,1 24,9 13,25 2,9" fill="url(#bdg)" stroke="#6d28d9" strokeWidth="1.2" />
      <polygon points="13,1 18,9 13,7.5 8,9" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

function CurrencyPill({ value, type, size = 'md' }: { value: number; type: 'gold' | 'diamond'; size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <div className="flex items-center gap-1" style={{
      background: 'linear-gradient(135deg, rgba(15,12,8,0.92), rgba(25,20,12,0.96))',
      border: `1.5px solid ${type === 'gold' ? 'rgba(255,215,0,0.2)' : 'rgba(168,85,247,0.2)'}`,
      borderRadius: 14, padding: sm ? '2px 8px 2px 4px' : '4px 10px 4px 5px',
      boxShadow: `0 2px 6px rgba(0,0,0,0.3), 0 0 4px ${type === 'gold' ? 'rgba(255,215,0,0.08)' : 'rgba(168,85,247,0.08)'}`,
    }}>
      {type === 'gold' ? <GoldIcon size={sm ? 14 : 18} /> : <DiamondSvg size={sm ? 12 : 16} />}
      <span style={{ fontFamily: F, fontSize: sm ? 10 : 13, color: type === 'gold' ? '#ffd700' : '#c084fc', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
        {value >= 10000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════
   ITEM IMAGE
   ═══════════════════════════════════ */
function ItemImage({ url, size = 80, rarity = 'common' }: { url?: string | null; size?: number; rarity?: string }) {
  const r = RARITY[rarity] || RARITY.common;
  if (url) {
    return <img src={url} alt="" className="object-contain" style={{ width: size, height: size }} draggable={false} />;
  }
  return (
    <div className="flex items-center justify-center" style={{
      width: size, height: size, borderRadius: 14,
      background: 'rgba(255,255,255,0.03)', border: `1px dashed ${r.border}`,
    }}>
      <Package size={size * 0.35} style={{ color: `${r.color}50` }} />
    </div>
  );
}

/* ═══════════════════════════════════
   ITEM CARD — Large 2-col design
   ═══════════════════════════════════ */
function ItemCard({
  item, imageUrl, quantity, mode, onTap, index, isEquipped,
}: {
  item: ShopItemDef; imageUrl?: string | null; quantity?: number; mode: Tab; onTap: () => void; index: number; isEquipped?: boolean;
}) {
  const { t } = useLanguage();
  const r = RARITY[item.rarity] || RARITY.common;
  const hasEffects = item.effects && item.effects.length > 0;
  const isTreasure = item.category === 'treasure' && !!item.equipSlot;

  return (
    <motion.button
      className="relative flex flex-col items-center overflow-hidden w-full"
      style={{
        background: r.bg,
        border: `2px solid ${r.border}`,
        borderRadius: 20, padding: '16px 10px 14px',
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 16px ${r.glow}`,
      }}
      onClick={onTap}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      {/* Rarity tag */}
      <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-xl" style={{
        background: `${r.color}18`, borderBottom: `1px solid ${r.color}25`, borderLeft: `1px solid ${r.color}25`,
      }}>
        <span style={{ fontFamily: F, fontSize: 8, color: r.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(r.tKey)}</span>
      </div>

      {/* Shimmer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 18 }}>
        <div style={{
          position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          animation: `cardShimmer ${5 + index * 0.4}s ease-in-out infinite ${index * 0.6}s`,
        }} />
      </div>

      {/* Image — large */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
      >
        <ItemImage url={imageUrl} size={80} rarity={item.rarity} />
      </motion.div>

      {/* Name */}
      <span className="text-center leading-tight mt-2.5 px-1" style={{
        fontFamily: F, fontSize: 13, color: '#e8dcc8',
        textShadow: '0 1px 4px rgba(0,0,0,0.7)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        minHeight: 32,
      }}>
        {item.name}
      </span>

      {/* Effect tags (condensed) */}
      {hasEffects && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap justify-center">
          {item.effects.slice(0, 2).map((eff: any, i: number) => {
            const meta = EFFECT_META[eff.type] || EFFECT_META.xp;
            const Icon = meta.icon;
            return (
              <div key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{
                background: `${meta.color}12`, border: `1px solid ${meta.color}18`,
              }}>
                <Icon size={10} color={meta.color} />
                <span style={{ fontFamily: F, fontSize: 8, color: meta.color }}>
                  +{eff.value}{eff.isPercent ? '%' : ''}
                </span>
              </div>
            );
          })}
          {item.effects.length > 2 && (
            <span style={{ fontFamily: F, fontSize: 8, color: 'rgba(200,184,138,0.4)' }}>
              +{item.effects.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Bottom: Price or Quantity + Use */}
      <div className="mt-2.5 w-full px-1">
        {mode === 'shop' ? (
          <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl" style={{
            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)',
          }}>
            {item.currency === 'gold' ? <GoldIcon size={14} /> : <DiamondSvg size={12} />}
            <span style={{ fontFamily: F, fontSize: 14, color: item.currency === 'gold' ? '#ffd700' : '#c084fc', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {item.price}
            </span>
          </div>
        ) : isTreasure ? (
          <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl" style={{
            background: isEquipped
              ? 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.1))'
              : 'linear-gradient(135deg, rgba(192,132,252,0.15), rgba(192,132,252,0.08))',
            border: isEquipped
              ? '1.5px solid rgba(251,191,36,0.4)'
              : '1.5px solid rgba(192,132,252,0.25)',
          }}>
            <Crown size={11} color={isEquipped ? '#fbbf24' : '#c084fc'} />
            <span style={{ fontFamily: F, fontSize: 10, color: isEquipped ? '#fbbf24' : '#c084fc' }}>
              {isEquipped ? t('bag.equipped') : t('bag.equip')}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <div className="px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontFamily: F, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>x{quantity || 0}</span>
            </div>
            {hasEffects && (
              <div className="flex-1 ml-1 py-1.5 rounded-lg text-center" style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))',
                border: '1.5px solid rgba(34,197,94,0.3)',
              }}>
                <span style={{ fontFamily: F, fontSize: 10, color: '#22c55e' }}>{t('bag.use').toUpperCase()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}

/* ═══════════════════════════════════
   DETAIL SHEET — Slide-up panel for buy/use
   ═══════════════════════════════════ */
function DetailSheet({
  item, imageUrl, wallet, mode, quantity, onBuy, onUse, onClose, isEquipped, onEquip, onUnequip,
}: {
  item: ShopItemDef; imageUrl?: string | null; wallet: { gold: number; diamond: number };
  mode: Tab; quantity?: number; onBuy: () => void; onUse: () => void; onClose: () => void;
  isEquipped?: boolean; onEquip?: () => void; onUnequip?: () => void;
}) {
  const { t } = useLanguage();
  const r = RARITY[item.rarity] || RARITY.common;
  const canAfford = item.currency === 'gold' ? wallet.gold >= item.price : wallet.diamond >= item.price;
  const hasEffects = item.effects && item.effects.length > 0;
  const canUse = (quantity || 0) > 0 && hasEffects;
  const isTreasure = item.category === 'treasure' && !!item.equipSlot;
  const slotMeta = isTreasure ? EQUIP_SLOT_META[item.equipSlot!] : null;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: 480,
          background: 'linear-gradient(180deg, #1a1610 0%, #0d0a05 100%)',
          borderTop: `2px solid ${r.border}`,
          borderRadius: '24px 24px 0 0',
          boxShadow: `0 -8px 40px rgba(0,0,0,0.5), 0 0 30px ${r.glow}`,
          padding: '20px 20px 32px',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/10" />
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <X size={16} color="rgba(200,184,138,0.5)" />
        </button>

        <div className="flex gap-4 mt-2">
          {/* Item image — large */}
          <motion.div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 100, height: 100, borderRadius: 20,
              background: r.bg, border: `2px solid ${r.border}`,
              boxShadow: `0 4px 24px ${r.glow}`,
            }}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ItemImage url={imageUrl} size={76} rarity={item.rarity} />
          </motion.div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h3 style={{ fontFamily: F, fontSize: 20, color: r.color, textShadow: `0 2px 8px ${r.glow}`, lineHeight: 1.2 }}>
              {item.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2 py-0.5 rounded-full" style={{
                fontFamily: F, fontSize: 9, color: r.color,
                background: `${r.color}12`, border: `1px solid ${r.color}20`,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {t(r.tKey)}
              </span>
              <span style={{ fontFamily: F, fontSize: 10, color: 'rgba(200,184,138,0.4)', textTransform: 'uppercase' }}>
                {isTreasure ? `${slotMeta?.emoji || ''} ${t(slotMeta?.tKey || '') || item.category}` : item.category}
              </span>
            </div>
            <p className="mt-2" style={{ fontFamily: F, fontSize: 11, color: 'rgba(200,184,138,0.55)', lineHeight: 1.5 }}>
              {item.description || t('bag.mysteryItem')}
            </p>
          </div>
        </div>

        {/* Effects */}
        {hasEffects && (
          <div className="flex flex-wrap gap-2 mt-4">
            {item.effects.map((eff: any, i: number) => {
              const meta = EFFECT_META[eff.type] || EFFECT_META.xp;
              const Icon = meta.icon;
              return (
                <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{
                  background: `${meta.color}10`, border: `1px solid ${meta.color}20`,
                }}>
                  <Icon size={14} color={meta.color} />
                  <span style={{ fontFamily: F, fontSize: 12, color: meta.color }}>
                    +{eff.value}{eff.isPercent ? '%' : ''} {t(meta.tKey)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Price bar + action */}
        <div className="flex items-center gap-3 mt-5">
          {mode === 'shop' ? (
            <>
              {/* Price + balance */}
              <div className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex flex-col">
                  <span style={{ fontFamily: F, fontSize: 8, color: 'rgba(200,184,138,0.35)', textTransform: 'uppercase' }}>{t('bag.price')}</span>
                  <div className="flex items-center gap-1">
                    {item.currency === 'gold' ? <GoldIcon size={16} /> : <DiamondSvg size={14} />}
                    <span style={{ fontFamily: F, fontSize: 18, color: item.currency === 'gold' ? '#ffd700' : '#c084fc' }}>
                      {item.price}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex flex-col">
                  <span style={{ fontFamily: F, fontSize: 8, color: 'rgba(200,184,138,0.35)', textTransform: 'uppercase' }}>{t('bag.balance')}</span>
                  <span style={{ fontFamily: F, fontSize: 16, color: canAfford ? (item.currency === 'gold' ? '#ffd700' : '#c084fc') : '#ef4444' }}>
                    {item.currency === 'gold' ? wallet.gold.toLocaleString() : wallet.diamond}
                  </span>
                </div>
              </div>
              {/* Buy button */}
              <motion.button
                className="px-7 py-3.5 rounded-xl"
                style={{
                  background: canAfford
                    ? (item.currency === 'gold' ? 'linear-gradient(135deg, #b8860b, #ffd700)' : 'linear-gradient(135deg, #7c3aed, #a855f7)')
                    : 'rgba(60,60,60,0.3)',
                  fontFamily: F, fontSize: 15, color: canAfford ? '#fff' : 'rgba(255,255,255,0.25)',
                  textShadow: canAfford ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                  boxShadow: canAfford ? `0 4px 20px ${item.currency === 'gold' ? 'rgba(255,215,0,0.25)' : 'rgba(168,85,247,0.25)'}` : 'none',
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                }}
                whileTap={canAfford ? { scale: 0.94 } : {}}
                onClick={canAfford ? onBuy : undefined}
              >
                {canAfford ? t('bag.buy') : t('bag.notEnough')}
              </motion.button>
            </>
          ) : isTreasure ? (
            <>
              <div className="flex-1 flex items-center gap-2">
                <span className="px-3 py-2 rounded-xl" style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: F, fontSize: 13, color: 'rgba(200,184,138,0.5)',
                }}>
                  {t('bag.owned')}: x{quantity || 0}
                </span>
                {isEquipped && (
                  <span className="px-2.5 py-1.5 rounded-lg" style={{
                    background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                    fontFamily: F, fontSize: 10, color: '#fbbf24',
                  }}>
                    {t('bag.equipped')}
                  </span>
                )}
              </div>
              {isEquipped ? (
                <motion.button
                  className="px-7 py-3.5 rounded-xl flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                    fontFamily: F, fontSize: 15, color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    boxShadow: '0 4px 20px rgba(239,68,68,0.25)',
                  }}
                  whileTap={{ scale: 0.94 }}
                  onClick={onUnequip}
                >
                  <X size={16} />
                  {t('bag.unequip')}
                </motion.button>
              ) : (
                <motion.button
                  className="px-7 py-3.5 rounded-xl flex items-center gap-2"
                  style={{
                    background: (quantity || 0) > 0
                      ? 'linear-gradient(135deg, #b8860b, #fbbf24)'
                      : 'rgba(60,60,60,0.3)',
                    fontFamily: F, fontSize: 15,
                    color: (quantity || 0) > 0 ? '#fff' : 'rgba(255,255,255,0.25)',
                    textShadow: (quantity || 0) > 0 ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                    boxShadow: (quantity || 0) > 0 ? '0 4px 20px rgba(251,191,36,0.25)' : 'none',
                    cursor: (quantity || 0) > 0 ? 'pointer' : 'not-allowed',
                  }}
                  whileTap={(quantity || 0) > 0 ? { scale: 0.94 } : {}}
                  onClick={(quantity || 0) > 0 ? onEquip : undefined}
                >
                  <Crown size={16} />
                  {t('bag.equip')}
                </motion.button>
              )}
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center gap-2">
                <span className="px-3 py-2 rounded-xl" style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: F, fontSize: 13, color: 'rgba(200,184,138,0.5)',
                }}>
                  {t('bag.owned')}: x{quantity || 0}
                </span>
              </div>
              <motion.button
                className="px-8 py-3.5 rounded-xl flex items-center gap-2"
                style={{
                  background: canUse
                    ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                    : 'rgba(60,60,60,0.3)',
                  fontFamily: F, fontSize: 15, color: canUse ? '#fff' : 'rgba(255,255,255,0.25)',
                  textShadow: canUse ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                  boxShadow: canUse ? '0 4px 20px rgba(34,197,94,0.25)' : 'none',
                  cursor: canUse ? 'pointer' : 'not-allowed',
                }}
                whileTap={canUse ? { scale: 0.94 } : {}}
                onClick={canUse ? onUse : undefined}
              >
                <Check size={16} />
                {canUse ? t('bag.use') : (quantity || 0) <= 0 ? t('bag.none') : t('bag.noEffect')}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════
   PURCHASE BURST ANIMATION
   ══════════════════════════════════ */
function PurchaseBurst({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1100); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div className="fixed inset-0 z-[250] flex items-center justify-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: 6, height: 6, background: i % 2 === 0 ? '#ffd700' : '#a855f7' }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ scale: [0, 1.5, 0.5], x: Math.cos(angle) * 60, y: Math.sin(angle) * 60, opacity: [0, 1, 0] }}
            transition={{ duration: 0.7, delay: i * 0.03 }}
          />
        );
      })}
      <motion.div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(168,85,247,0.2))', border: '2px solid rgba(255,215,0,0.3)' }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Sparkles size={24} color="#ffd700" />
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════
   USE-ITEM EFFECT FEEDBACK
   ═══════════════════════════════════ */
interface EffectLine { label: string; color: string; icon: any }

function UseEffectFeedback({ lines, onDone }: { lines: EffectLine[]; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      className="fixed inset-0 z-[260] flex flex-col items-center justify-center pointer-events-none gap-1.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Full-screen green pulse */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(34,197,94,0.15), transparent 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1 }}
      />
      {/* Floating stat lines */}
      {lines.map((line, i) => {
        const Icon = line.icon;
        return (
          <motion.div
            key={i}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
            style={{
              background: `${line.color}18`,
              border: `1.5px solid ${line.color}40`,
              boxShadow: `0 0 20px ${line.color}30`,
            }}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, 0, -10, -40], scale: [0.8, 1.05, 1, 0.9] }}
            transition={{ duration: 1.8, delay: i * 0.15, ease: 'easeOut' }}
          >
            <Icon size={20} color={line.color} />
            <span style={{
              fontFamily: F, fontSize: 18, color: line.color,
              textShadow: `0 0 12px ${line.color}60`,
              fontWeight: 'bold',
            }}>
              {line.label}
            </span>
          </motion.div>
        );
      })}
      {/* Central sparkle */}
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: [0, 1.5, 0], rotate: [-45, 0, 45] }}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        <Sparkles size={32} color="#22c55e" />
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════ */
function EmptyState({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon?: any }) {
  const I = Icon || Package;
  return (
    <motion.div className="flex flex-col items-center justify-center py-16" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <motion.div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(200,184,138,0.15)' }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <I size={36} color="rgba(200,184,138,0.2)" />
      </motion.div>
      <span style={{ fontFamily: F, fontSize: 16, color: 'rgba(200,184,138,0.4)' }}>{title}</span>
      <span style={{ fontFamily: F, fontSize: 11, color: 'rgba(200,184,138,0.2)', marginTop: 6, textAlign: 'center', maxWidth: 240 }}>{subtitle}</span>
    </motion.div>
  );
}

/* ═══════════════════════════════════
   HEADER BANNER
   ═══════════════════════════════════ */
function HeaderBanner({ imageUrl, tab }: { imageUrl?: string | null; tab: Tab }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 120, borderRadius: '0 0 24px 24px' }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.6) saturate(1.2)' }}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0" style={{
          background: tab === 'bag'
            ? 'linear-gradient(135deg, #1a1040 0%, #2d1b4e 50%, #1a1040 100%)'
            : 'linear-gradient(135deg, #2d1f0a 0%, #3d2a0e 50%, #2d1f0a 100%)',
        }} />
      )}
      {/* Gradient fade */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, rgba(10,8,6,0.3) 0%, rgba(10,8,6,0) 40%, rgba(10,8,6,0.8) 100%)',
      }} />
      {/* Centered icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
        >
          {tab === 'bag' ? (
            <ShoppingBag size={40} color="rgba(200,184,138,0.25)" />
          ) : (
            <Store size={40} color="rgba(255,215,0,0.25)" />
          )}
        </motion.div>
      </div>
      {/* Ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3, height: 3,
              background: tab === 'bag' ? 'rgba(168,85,247,0.4)' : 'rgba(255,215,0,0.4)',
              left: `${15 + i * 18}%`, top: `${30 + (i % 3) * 20}%`,
            }}
            animate={{ y: [-10, -30, -10], opacity: [0, 0.8, 0] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */
const BAG_HEADER_SLUG = 'bag_header';
const SHOP_HEADER_SLUG = 'shop_header';

export function BagPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const realm = useRealmContext();
  const { t } = useLanguage();
  // ?shop=1 means accessed from in-map shop (all items available, no restrictions)
  const fromMapShop = searchParams.get('shop') === '1';
  const [tab, setTab] = useState<Tab>(fromMapShop ? 'shop' : 'bag');
  const [shopItems, setShopItems] = useState<ShopItemDef[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, string>>({});
  const [realmAvailability, setRealmAvailability] = useState<Record<string, boolean>>({});
  const [bagHeaderUrl, setBagHeaderUrl] = useState<string | null>(null);
  const [shopHeaderUrl, setShopHeaderUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const wallet = { gold: realm.stats.gold, diamond: realm.stats.diamond };

  // Inventory + equipped are now persisted in FoxyStats (KV-backed).
  // Local state mirrors stats; writes go through realm.setStats so they
  // auto-persist via the existing debounced KV pipeline.
  const inventory = realm.stats.inventory || {};
  const setInventory = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => {
    realm.setStats(prev => ({
      ...prev,
      inventory: updater(prev.inventory || {}),
    }));
  }, [realm]);
  const equipped: Partial<Record<EquipSlot, string>> = (realm.stats.equipped || {}) as Partial<Record<EquipSlot, string>>;
  const setEquippedState = useCallback((val: Partial<Record<EquipSlot, string>>) => {
    realm.setStats(prev => ({
      ...prev,
      equipped: val,
    }));
  }, [realm]);

  const [selectedItem, setSelectedItem] = useState<ShopItemDef | null>(null);
  const [burst, setBurst] = useState(false);
  const [useEffectLines, setUseEffectLines] = useState<EffectLine[] | null>(null);

  // Load shop items + assets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [shopRes, assetRes, availRes] = await Promise.all([
          fetchShopItems(),
          fetchRPGAssets(),
          fetchRealmStoreAvailability(),
        ]);
        if (cancelled) return;
        // Lumicores are now auto-seeded server-side in GET /shop/items
        const items = (shopRes.items || []).filter((i: ShopItemDef) => i.isActive);
        setShopItems(items);
        setRealmAvailability(availRes || {});

        // Build slug->url map
        const map: Record<string, string> = {};
        for (const a of (assetRes.assets || [])) {
          map[a.slug] = a.publicUrl;
        }
        setAssetMap(map);
        if (map[BAG_HEADER_SLUG]) setBagHeaderUrl(map[BAG_HEADER_SLUG]);
        if (map[SHOP_HEADER_SLUG]) setShopHeaderUrl(map[SHOP_HEADER_SLUG]);
      } catch (err) {
        console.error('[BagPage] Load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bag items = shop items that user owns
  const bagItems = useMemo(() => {
    return shopItems.filter(i => (inventory[i.id] || 0) > 0);
  }, [shopItems, inventory]);

  const totalBagCount = useMemo(() => {
    return Object.values(inventory).reduce((a, b) => a + b, 0);
  }, [inventory]);

  // ── Bag slot system ──
  const bagSlots = realm.stats.bagSlots ?? BAG_DEFAULT_SLOTS;
  const slotsUsed = useMemo(() => getBagSlotsUsed(inventory, shopItems), [inventory, shopItems]);
  const nextSlotCost = useMemo(() => getNextSlotCost(bagSlots), [bagSlots]);
  const [bagFullMsg, setBagFullMsg] = useState<string | null>(null);
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);

  /* ── BUY BAG SLOT ── */
  const handleBuySlot = useCallback(() => {
    if (!nextSlotCost) return;
    const { cost, currency } = nextSlotCost;
    if (currency === 'gold') {
      if (wallet.gold < cost) return;
      realm.spendGold(cost);
    } else {
      if (wallet.diamond < cost) return;
      realm.spendDiamond(cost);
    }
    realm.setStats(prev => ({
      ...prev,
      bagSlots: Math.min(BAG_MAX_SLOTS, (prev.bagSlots ?? BAG_DEFAULT_SLOTS) + 1),
    }));
    setBurst(true);
    setTimeout(() => realm.flushStats(), 150);
  }, [nextSlotCost, wallet, realm]);

  /* ── BUY ── */
  const handleBuy = useCallback(() => {
    if (!selectedItem) return;
    const key = selectedItem.currency as 'gold' | 'diamond';
    if (wallet[key] < selectedItem.price) return;

    // Bag capacity check (stack limit + slot limit)
    const check = canAddToBag(inventory, selectedItem.id, 1, bagSlots, shopItems);
    if (!check.canAdd) {
      setBagFullMsg(t('bag.bagFull'));
      setTimeout(() => setBagFullMsg(null), 2500);
      return;
    }

    // Stack limit: cap at 99 per stack
    const currentQty = inventory[selectedItem.id] || 0;
    if (currentQty >= STACK_LIMIT) {
      // Check if a new slot is available (canAddToBag already verified this, but be explicit)
      const slotsNeeded = Math.ceil((currentQty + 1) / STACK_LIMIT) - Math.ceil(currentQty / STACK_LIMIT);
      if (slotsNeeded > 0 && slotsUsed + slotsNeeded > bagSlots) {
        setBagFullMsg(t('bag.bagFull'));
        setTimeout(() => setBagFullMsg(null), 2500);
        return;
      }
    }

    // Deduct from RealmContext wallet
    if (key === 'gold') {
      realm.spendGold(selectedItem.price);
    } else {
      realm.spendDiamond(selectedItem.price);
    }
    setInventory(inv => ({ ...inv, [selectedItem.id]: (inv[selectedItem.id] || 0) + 1 }));
    setSelectedItem(null);
    setBurst(true);
    // Immediately persist gold to KV so it survives page reload
    setTimeout(() => realm.flushStats(), 150);
  }, [selectedItem, wallet, realm, inventory, bagSlots, slotsUsed, shopItems]);

  /* ── USE ITEM ── */
  const handleUse = useCallback(() => {
    if (!selectedItem) return;
    const qty = inventory[selectedItem.id] || 0;
    if (qty <= 0) return;
    setInventory(inv => {
      const next = { ...inv, [selectedItem.id]: inv[selectedItem.id] - 1 };
      if (next[selectedItem.id] <= 0) delete next[selectedItem.id];
      return next;
    });
    setSelectedItem(null);

    // Apply item effects to fox stats via RealmContext
    if (selectedItem.effects && selectedItem.effects.length > 0) {
      const lines: EffectLine[] = [];
      let goldToAdd = 0;

      realm.setStats(prev => {
        let u = { ...prev };
        for (const eff of selectedItem.effects) {
          const raw = eff.value;

          switch (eff.type) {
            case 'hp': {
              const delta = eff.isPercent ? Math.round(u.maxHp * raw / 100) : raw;
              u.hp = Math.min(u.maxHp, u.hp + delta);
              lines.push({ label: `+${delta} HP`, color: '#ef4444', icon: Heart });
              break;
            }
            case 'xp': {
              const delta = eff.isPercent ? Math.round(u.xpToNext * raw / 100) : raw;
              let xp = u.xp + delta;
              let lvl = u.level;
              let xpNext = u.xpToNext;
              while (xp >= xpNext) {
                xp -= xpNext;
                lvl += 1;
                xpNext = xpRequiredForLevel(lvl);
              }
              if (lvl > u.level) {
                lines.push({ label: `${t('bag.effect.levelUp')} Lv.${lvl}`, color: '#a855f7', icon: TrendingUp });
              }
              u.level = lvl;
              u.xp = xp;
              u.xpToNext = xpNext;
              lines.push({ label: `+${delta} ${t('stat.xp')}`, color: '#22c55e', icon: Star });
              break;
            }
            case 'energy': {
              const delta = eff.isPercent ? Math.round(100 * raw / 100) : raw;
              u.hunger = Math.min(100, u.hunger + delta);
              lines.push({ label: `+${delta} ${t('stat.energy')}`, color: '#facc15', icon: Zap });
              break;
            }
            case 'level': {
              const lvlDelta = eff.isPercent ? Math.max(1, Math.round(u.level * raw / 100)) : raw;
              u.level += lvlDelta;
              u.xp = 0;
              u.xpToNext = xpRequiredForLevel(u.level);
              lines.push({ label: `+${lvlDelta} ${t('bag.effect.levelUp')}`, color: '#a855f7', icon: TrendingUp });
              break;
            }
            case 'gold': {
              const delta = eff.isPercent ? Math.round(u.gold * raw / 100) : raw;
              goldToAdd += delta;
              lines.push({ label: `+${delta} ${t('stat.gold')}`, color: '#ffd700', icon: Coins });
              break;
            }
            case 'shield': {
              lines.push({ label: `+${raw}${eff.isPercent ? '%' : ''} ${t('stat.shield')}`, color: '#3b82f6', icon: Shield });
              break;
            }
            case 'time_extend': {
              lines.push({ label: `+${raw}s ${t('stat.time')}`, color: '#f97316', icon: Clock });
              break;
            }
            // ── Special shop item mechanics (Bible v5) ──
            case 'hatch_accelerator': {
              // Subtract 12 hours (in ms) from egg hatch timer
              const MS_12HR = 12 * 60 * 60 * 1000;
              if (u.hatchStartMs) {
                u.hatchStartMs = u.hatchStartMs - MS_12HR;
                lines.push({ label: t('bag.effect.hatchAccel'), color: '#f59e0b', icon: Egg });
              } else {
                lines.push({ label: t('bag.effect.noEgg'), color: '#9ca3af', icon: Egg });
              }
              break;
            }
            case 'daily_refresh': {
              // Reset daily activity counters via server API
              const userId = localStorage.getItem('user_id') || localStorage.getItem('parent_id');
              if (userId) {
                triggerDailyRefresh(userId).then(res => {
                  console.log('[BagPage] Daily refresh result:', res);
                }).catch(err => console.error('[BagPage] Daily refresh error:', err));
              }
              lines.push({ label: t('bag.effect.dailyReset'), color: '#06b6d4', icon: RefreshCw });
              break;
            }
            case 'treasure_map': {
              // Set 3× gold multiplier flag — consumed by next gold-granting activity
              (u as any).treasureMapActive = (u as any).treasureMapActive ? (u as any).treasureMapActive + 1 : 1;
              lines.push({ label: t('bag.effect.treasureMap'), color: '#fbbf24', icon: MapPin });
              break;
            }
            // attack/defense/speed/max_hp are equipment-only stats — applied via Equip, not Use
          }
        }
        return u;
      });

      if (goldToAdd > 0) {
        realm.addGold(goldToAdd);
      }

      setUseEffectLines(lines);
      // Immediately persist after use
      setTimeout(() => realm.flushStats(), 150);
    } else {
      setBurst(true);
    }
  }, [selectedItem, inventory, realm]);

  /* ── EQUIP / UNEQUIP ── */
  const isItemEquipped = useCallback((itemId: string) => {
    return Object.values(equipped).includes(itemId);
  }, [equipped]);

  const handleEquip = useCallback(() => {
    if (!selectedItem || selectedItem.category !== 'treasure' || !selectedItem.equipSlot) return;
    const slot = selectedItem.equipSlot;
    const newEquipped = { ...equipped, [slot]: selectedItem.id };
    setEquippedState(newEquipped);
    saveEquipped(newEquipped);
    recomputeEquipmentBonuses(newEquipped, shopItems);
    setSelectedItem(null);
    // Show equip feedback
    const slotMeta = EQUIP_SLOT_META[slot];
    const lines: EffectLine[] = [
      { label: `${slotMeta?.emoji || ''} ${selectedItem.name} ${t('bag.equipped')}!`, color: slotMeta?.color || '#ffd700', icon: Crown },
    ];
    for (const eff of (selectedItem.effects || [])) {
      const meta = EFFECT_META[eff.type];
      if (meta) lines.push({ label: `+${eff.value}${eff.isPercent ? '%' : ''} ${t(meta.tKey)}`, color: meta.color, icon: meta.icon });
    }
    setUseEffectLines(lines);
  }, [selectedItem, equipped, shopItems, setEquippedState]);

  const handleUnequip = useCallback(() => {
    if (!selectedItem || selectedItem.category !== 'treasure' || !selectedItem.equipSlot) return;
    const slot = selectedItem.equipSlot;
    const newEquipped = { ...equipped };
    delete newEquipped[slot];
    setEquippedState(newEquipped);
    saveEquipped(newEquipped);
    recomputeEquipmentBonuses(newEquipped, shopItems);
    setSelectedItem(null);
    setBurst(true);
  }, [selectedItem, equipped, shopItems, setEquippedState]);

  return (
    <div className="relative w-full h-dvh overflow-hidden select-none flex flex-col" style={{ maxWidth: 480, margin: '0 auto', background: '#0a0806' }}>

      {/* ── Dark background ── */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(165deg, #0a0806 0%, #12100a 30%, #0a0806 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(212,164,74,0.03) 0%, transparent 60%)' }} />

      {/* ── Top Bar ── */}
      <div className="relative z-20 shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <motion.button
              onClick={() => navigate('/realm')}
              className="flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(20,16,10,0.9), rgba(30,24,14,0.95))',
                border: '1.5px solid rgba(255,215,0,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
              whileTap={{ scale: 0.85 }}
            >
              <ArrowLeft size={16} color="#c8b88a" />
            </motion.button>
            <span style={{ fontFamily: F, fontSize: 20, color: '#ffd700', textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 16px rgba(255,215,0,0.12)' }}>
              {tab === 'bag' ? t('bag.myBag') : t('bag.shop')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CurrencyPill value={wallet.gold} type="gold" />
            <CurrencyPill value={wallet.diamond} type="diamond" />
          </div>
        </div>
      </div>

      {/* ── Header Banner ── */}
      <div className="relative z-10 shrink-0">
        <HeaderBanner imageUrl={tab === 'bag' ? bagHeaderUrl : shopHeaderUrl} tab={tab} />
      </div>

      {/* ── Tab toggle ── */}
      <div className="relative z-20 shrink-0 px-4 -mt-5">
        <div className="flex rounded-2xl overflow-hidden" style={{
          background: 'rgba(10,8,6,0.9)', border: '1.5px solid rgba(255,215,0,0.12)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
        }}>
          {([
            { key: 'bag' as Tab, label: t('bag.bagTab'), icon: ShoppingBag, count: totalBagCount },
            { key: 'shop' as Tab, label: t('bag.shopTab'), icon: Store, count: shopItems.length },
          ]).map(tb => (
            <motion.button
              key={tb.key}
              className="flex-1 flex items-center justify-center gap-2 py-3 relative"
              style={{
                background: tab === tb.key
                  ? 'linear-gradient(135deg, rgba(60,42,12,0.7), rgba(45,32,10,0.8))'
                  : 'transparent',
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTab(tb.key)}
            >
              {tab === tb.key && (
                <motion.div
                  className="absolute bottom-0 left-[15%] right-[15%] h-[2.5px] rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent)' }}
                  layoutId="bagTabIndicator"
                />
              )}
              <tb.icon size={16} color={tab === tb.key ? '#ffd700' : 'rgba(200,184,138,0.3)'} />
              <span style={{ fontFamily: F, fontSize: 14, color: tab === tb.key ? '#ffd700' : 'rgba(200,184,138,0.3)' }}>
                {tb.label}
              </span>
              {tb.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full" style={{
                  background: tab === tb.key ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                  fontFamily: F, fontSize: 10, color: tab === tb.key ? 'rgba(255,215,0,0.8)' : 'rgba(200,184,138,0.2)',
                  minWidth: 20, textAlign: 'center',
                }}>
                  {tb.count}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Content Grid ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              className="w-10 h-10 rounded-full"
              style={{ border: '3px solid rgba(212,164,74,0.1)', borderTopColor: '#ffd700' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === 'bag' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'bag' ? 20 : -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── BAG TAB ── */}
              {tab === 'bag' && (
                <>
                  {/* Slot counter bar */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={14} color="rgba(200,184,138,0.5)" />
                      <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(200,184,138,0.6)' }}>
                        {slotsUsed} / {bagSlots} {t('bag.slots')}
                      </span>
                    </div>
                    {nextSlotCost && (
                      <motion.button
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                        style={{
                          background: 'rgba(255,215,0,0.08)',
                          border: '1px solid rgba(255,215,0,0.15)',
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowUpgradePanel(true)}
                      >
                        <Plus size={11} color="#ffd700" />
                        <span style={{ fontFamily: F, fontSize: 10, color: '#ffd700' }}>{t('bag.upgrade')}</span>
                      </motion.button>
                    )}
                  </div>

                  {/* Slot progress bar */}
                  <div className="mb-4 rounded-full overflow-hidden" style={{
                    height: 6,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: slotsUsed >= bagSlots
                          ? 'linear-gradient(90deg, #ef4444, #f97316)'
                          : slotsUsed >= bagSlots * 0.8
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #22c55e, #4ade80)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (slotsUsed / Math.max(1, bagSlots)) * 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>

                  {bagItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {bagItems.map((item, i) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          imageUrl={assetMap[item.imageSlug] || null}
                          quantity={inventory[item.id]}
                          mode="bag"
                          onTap={() => setSelectedItem(item)}
                          index={i}
                          isEquipped={isItemEquipped(item.id)}
                        />
                      ))}
                      {/* Empty slot placeholders (up to 3) */}
                      {Array.from({ length: Math.min(3, Math.max(0, bagSlots - slotsUsed)) }).map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="flex flex-col items-center justify-center"
                          style={{
                            background: 'linear-gradient(145deg, rgba(20,18,14,0.6), rgba(12,10,6,0.8))',
                            border: '2px dashed rgba(200,184,138,0.08)',
                            borderRadius: 20, padding: '24px 10px', minHeight: 160,
                            opacity: 0.5,
                          }}
                        >
                          <Package size={28} color="rgba(200,184,138,0.1)" />
                          <span style={{ fontFamily: F, fontSize: 9, color: 'rgba(200,184,138,0.15)', marginTop: 8 }}>
                            {t('bag.emptySlot')}
                          </span>
                        </div>
                      ))}
                      {/* Locked upgrade slot */}
                      {nextSlotCost && (
                        <motion.button
                          className="flex flex-col items-center justify-center"
                          style={{
                            background: 'linear-gradient(145deg, rgba(30,20,8,0.5), rgba(15,10,4,0.7))',
                            border: '2px dashed rgba(255,215,0,0.12)',
                            borderRadius: 20, padding: '24px 10px', minHeight: 160,
                          }}
                          onClick={() => setShowUpgradePanel(true)}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Lock size={24} color="rgba(255,215,0,0.3)" />
                          <span style={{ fontFamily: F, fontSize: 10, color: 'rgba(255,215,0,0.5)', marginTop: 8 }}>
                            {t('bag.unlockSlot')}
                          </span>
                          <div className="flex items-center gap-1 mt-2">
                            {nextSlotCost.currency === 'gold' ? <GoldIcon size={12} /> : <DiamondSvg size={10} />}
                            <span style={{ fontFamily: F, fontSize: 10, color: nextSlotCost.currency === 'gold' ? '#ffd700' : '#c084fc' }}>
                              {nextSlotCost.cost}
                            </span>
                          </div>
                        </motion.button>
                      )}
                    </div>
                  ) : (
                    <EmptyState
                      title={t('bag.bagEmpty')}
                      subtitle={t('bag.visitShop')}
                      icon={ShoppingBag}
                    />
                  )}
                </>
              )}

              {/* ── SHOP TAB ── */}
              {tab === 'shop' && (
                <>
                  {shopItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {shopItems.map((item, i) => {
                        // If accessed from realm hub (not in-map shop), check availability
                        const isRestricted = !fromMapShop && realmAvailability[item.id] === false;
                        return (
                          <div key={item.id} className="relative">
                            <ItemCard
                              item={item}
                              imageUrl={assetMap[item.imageSlug] || null}
                              quantity={inventory[item.id]}
                              mode="shop"
                              onTap={() => !isRestricted && setSelectedItem(item)}
                              index={i}
                              isEquipped={isItemEquipped(item.id)}
                            />
                            {/* Dimmed overlay for restricted items */}
                            {isRestricted && (
                              <div
                                className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px] cursor-not-allowed"
                                style={{
                                  background: 'rgba(0,0,0,0.65)',
                                  backdropFilter: 'blur(2px)',
                                  border: '2px solid rgba(100,80,50,0.3)',
                                }}
                              >
                                <Lock size={22} color="rgba(200,184,138,0.5)" />
                                <span style={{
                                  fontFamily: F, fontSize: 9, color: 'rgba(200,184,138,0.6)',
                                  textAlign: 'center', marginTop: 6, padding: '0 8px',
                                  lineHeight: 1.3,
                                }}>
                                  {t('bag.questShopOnly')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title={t('bag.shopEmpty')}
                      subtitle={t('bag.noItemsYet')}
                      icon={Store}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Ambient particles ── */}
      <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: 2 + Math.random() * 2, height: 2 + Math.random() * 2,
            background: i % 2 === 0 ? 'rgba(255,215,0,0.35)' : 'rgba(168,85,247,0.25)',
            left: `${10 + Math.random() * 80}%`, bottom: `${10 + Math.random() * 40}%`,
            animation: `bagFloat ${6 + Math.random() * 5}s ease-in-out infinite ${Math.random() * 4}s`,
          }} />
        ))}
      </div>

      {/* ── Bag Full Toast ── */}
      <AnimatePresence>
        {bagFullMsg && (
          <motion.div
            className="fixed top-16 left-1/2 z-[300] flex items-center gap-2 px-5 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95))',
              border: '1.5px solid rgba(239,68,68,0.5)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(239,68,68,0.2)',
              transform: 'translateX(-50%)',
              maxWidth: 340,
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Lock size={16} color="#fff" />
            <span style={{ fontFamily: F, fontSize: 12, color: '#fff' }}>{bagFullMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bag Upgrade Panel ── */}
      <AnimatePresence>
        {showUpgradePanel && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUpgradePanel(false)}
          >
            <motion.div
              className="relative w-full overflow-hidden"
              style={{
                maxWidth: 480,
                background: 'linear-gradient(180deg, #1a1610 0%, #0d0a05 100%)',
                borderTop: '2px solid rgba(255,215,0,0.2)',
                borderRadius: '24px 24px 0 0',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 30px rgba(255,215,0,0.1)',
                padding: '20px 20px 32px',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/10" />
              <button onClick={() => setShowUpgradePanel(false)} className="absolute top-3 right-3 p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X size={16} color="rgba(200,184,138,0.5)" />
              </button>

              <div className="flex items-center gap-3 mt-2 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.06))',
                  border: '1.5px solid rgba(255,215,0,0.2)',
                }}>
                  <ShoppingBag size={22} color="#ffd700" />
                </div>
                <div>
                  <h3 style={{ fontFamily: F, fontSize: 18, color: '#ffd700' }}>{t('bag.upgradeBag')}</h3>
                  <p style={{ fontFamily: F, fontSize: 11, color: 'rgba(200,184,138,0.5)' }}>
                    {bagSlots} / {BAG_MAX_SLOTS} {t('bag.slotsUnlocked')}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-5 rounded-full overflow-hidden" style={{
                height: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div className="h-full rounded-full" style={{
                  background: 'linear-gradient(90deg, #ffd700, #f59e0b)',
                  width: `${(bagSlots / BAG_MAX_SLOTS) * 100}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              {nextSlotCost ? (
                <>
                  <div className="flex items-center justify-between px-3 py-3 rounded-xl mb-4" style={{
                    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div>
                      <span style={{ fontFamily: F, fontSize: 9, color: 'rgba(200,184,138,0.35)', textTransform: 'uppercase' as const }}>{t('bag.nextSlot')}</span>
                      <p style={{ fontFamily: F, fontSize: 16, color: '#e8dcc8' }}>{t('bag.unlockSlot')} #{bagSlots + 1}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {nextSlotCost.currency === 'gold' ? <GoldIcon size={18} /> : <DiamondSvg size={16} />}
                      <span style={{ fontFamily: F, fontSize: 20, color: nextSlotCost.currency === 'gold' ? '#ffd700' : '#c084fc' }}>
                        {nextSlotCost.cost}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
                    style={{
                      background: (nextSlotCost.currency === 'gold' ? wallet.gold >= nextSlotCost.cost : wallet.diamond >= nextSlotCost.cost)
                        ? (nextSlotCost.currency === 'gold' ? 'linear-gradient(135deg, #b8860b, #ffd700)' : 'linear-gradient(135deg, #7c3aed, #a855f7)')
                        : 'rgba(60,60,60,0.3)',
                      fontFamily: F, fontSize: 16,
                      color: (nextSlotCost.currency === 'gold' ? wallet.gold >= nextSlotCost.cost : wallet.diamond >= nextSlotCost.cost) ? '#fff' : 'rgba(255,255,255,0.25)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      boxShadow: (nextSlotCost.currency === 'gold' ? wallet.gold >= nextSlotCost.cost : wallet.diamond >= nextSlotCost.cost)
                        ? '0 4px 20px rgba(255,215,0,0.25)' : 'none',
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      handleBuySlot();
                      setShowUpgradePanel(false);
                    }}
                  >
                    <Plus size={18} />
                    {t('bag.unlockSlot')} #{bagSlots + 1}
                  </motion.button>
                </>
              ) : (
                <div className="text-center py-4">
                  <Sparkles size={24} color="#ffd700" className="mx-auto mb-2" />
                  <p style={{ fontFamily: F, fontSize: 14, color: '#ffd700' }}>{t('bag.maxSlots')}</p>
                  <p style={{ fontFamily: F, fontSize: 11, color: 'rgba(200,184,138,0.4)' }}>
                    {BAG_MAX_SLOTS} {t('bag.allSlotsUnlocked')}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail sheet ── */}
      <AnimatePresence>
        {selectedItem && (
          <DetailSheet
            item={selectedItem}
            imageUrl={assetMap[selectedItem.imageSlug] || null}
            wallet={wallet}
            mode={tab}
            quantity={inventory[selectedItem.id]}
            onBuy={handleBuy}
            onUse={handleUse}
            onClose={() => setSelectedItem(null)}
            isEquipped={isItemEquipped(selectedItem.id)}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
          />
        )}
      </AnimatePresence>

      {/* ── Burst ── */}
      <AnimatePresence>
        {burst && <PurchaseBurst onDone={() => setBurst(false)} />}
      </AnimatePresence>

      {/* ── Use-item effect feedback ── */}
      <AnimatePresence>
        {useEffectLines && <UseEffectFeedback lines={useEffectLines} onDone={() => setUseEffectLines(null)} />}
      </AnimatePresence>

      {/* Fonts & keyframes */}
      <link href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Cinzel+Decorative:wght@400;700;900&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes cardShimmer {
          0%, 100% { left: -100%; }
          50% { left: 130%; }
        }
        @keyframes bagFloat {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          15% { opacity: 0.7; }
          85% { opacity: 0.3; }
          100% { transform: translateY(-150px) translateX(15px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}