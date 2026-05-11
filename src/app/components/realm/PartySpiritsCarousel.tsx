/**
 * PartySpiritsCarousel.tsx — Swipeable spirit cards for the Realm page.
 *
 * Shows up to 5 party slots (Foxy in slot 0, rest are caught spirits).
 * Swipe left/right to browse. Each card shows:
 *  - Spirit sprite (or placeholder)
 *  - Name + type badges
 *  - HP bar (unique per spirit based on stat multiplier)
 *  - Level/XP inherited from Lumi (same for all)
 *
 * Spirits have NO individual levels — all inherit Lumi's education level.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { ChevronLeft, ChevronRight, Crown, Heart, Sparkles } from 'lucide-react';
import { useRealmContext, type PartySlot } from '../../contexts/RealmContext';
import { rpgGameListEntities, rpgGameSignedUrls } from '../../utils/api';

const F = "'Cherry Bomb One', cursive";
const GOLD = '#d4a44a';

// Element config for type badges
const ELEMENT_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  fire: { emoji: '🔥', color: '#e05a2b', label: 'Fire' },
  water: { emoji: '💧', color: '#2e7fbf', label: 'Water' },
  wood: { emoji: '🌿', color: '#4a9c3f', label: 'Wood' },
  thunder: { emoji: '⚡', color: '#c49a1a', label: 'Thunder' },
  earth: { emoji: '🪨', color: '#7a6a52', label: 'Earth' },
  shadow: { emoji: '🌑', color: '#6b4fa8', label: 'Shadow' },
  gold: { emoji: '✨', color: '#d4a843', label: 'Gold' },
};

interface SpiritData {
  id: string;
  name: string;
  types: string[];
  statMultipliers: { hp: number; atk: number; def: number };
  isFoxy?: boolean;
  foxyStage?: number;
  assets: { icon?: string; overworld?: string; battle?: string };
}

interface Props {
  isLandscape?: boolean;
}

export function PartySpiritsCarousel({ isLandscape }: Props) {
  const { stats, setActivePartyIndex } = useRealmContext();
  const [spiritDataMap, setSpiritDataMap] = useState<Record<string, SpiritData>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  const party = stats.party || [];
  const activeIdx = stats.activePartyIndex || 0;

  // Load spirit entity data from KV
  useEffect(() => {
    (async () => {
      try {
        const entities = await rpgGameListEntities('spirit');
        const map: Record<string, SpiritData> = {};
        const paths: string[] = [];

        for (const e of entities as any[]) {
          map[e.id] = {
            id: e.id,
            name: e.name || 'Unknown',
            types: e.types || (e.element ? [e.element] : ['fire']),
            statMultipliers: e.statMultipliers || { hp: 1, atk: 1, def: 1 },
            isFoxy: e.isFoxy,
            foxyStage: e.foxyStage,
            assets: e.assets || {},
          };
          // Collect image paths
          if (e.assets?.icon) paths.push(e.assets.icon);
          if (e.assets?.overworld) paths.push(e.assets.overworld);
        }

        setSpiritDataMap(map);

        if (paths.length > 0) {
          const urls = await rpgGameSignedUrls(paths);
          setSignedUrls(urls);
        }
        setDataLoaded(true);
      } catch (err) {
        console.warn('[PARTY] Failed to load spirit data:', err);
        setDataLoaded(true);
      }
    })();
  }, []);

  // Swipe handling
  const swipeThreshold = 50;

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const filledSlots = party.map((s, i) => ({ slot: s, idx: i })).filter(x => x.slot !== null);
    if (filledSlots.length <= 1) return;

    const currentFilledIdx = filledSlots.findIndex(x => x.idx === activeIdx);
    let nextFilledIdx: number;

    if (direction === 'left') {
      nextFilledIdx = (currentFilledIdx + 1) % filledSlots.length;
    } else {
      nextFilledIdx = (currentFilledIdx - 1 + filledSlots.length) % filledSlots.length;
    }

    setActivePartyIndex(filledSlots[nextFilledIdx].idx);
  }, [party, activeIdx, setActivePartyIndex]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > swipeThreshold) {
      handleSwipe(info.offset.x < 0 ? 'left' : 'right');
    }
  }, [handleSwipe]);

  // Current spirit
  const currentSlot: PartySlot | null = party[activeIdx] || null;
  const spiritData = currentSlot ? spiritDataMap[currentSlot.spiritId] : null;

  // Calculate HP for this spirit
  const baseMaxHp = stats.maxHp || 100;
  const hpMultiplier = spiritData?.statMultipliers?.hp || 1.0;
  const spiritMaxHp = Math.round(baseMaxHp * hpMultiplier);
  const spiritCurrentHp = currentSlot ? Math.min(currentSlot.currentHp, spiritMaxHp) : spiritMaxHp;
  const hpPercent = spiritMaxHp > 0 ? (spiritCurrentHp / spiritMaxHp) * 100 : 100;

  // Dot indicators for filled slots
  const filledSlots = party.map((s, i) => ({ slot: s, idx: i })).filter(x => x.slot !== null);

  // Get spirit image
  const getSpiritImage = (): string | null => {
    if (!spiritData) return null;
    const { icon, overworld } = spiritData.assets;
    if (icon && signedUrls[icon]) return signedUrls[icon];
    if (overworld && signedUrls[overworld]) return signedUrls[overworld];
    return null;
  };

  const spiritImg = getSpiritImage();
  const isFoxy = spiritData?.isFoxy;
  const types = spiritData?.types || [];

  return (
    <div className="flex flex-col items-center gap-1" style={{ pointerEvents: 'auto' }}>
      {/* Spirit card — swipeable */}
      <motion.div
        className="relative select-none touch-pan-y"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        style={{ cursor: 'grab' }}
      >
        {/* Left/Right arrow buttons for non-touch users */}
        {filledSlots.length > 1 && (
          <>
            <button
              className="absolute -left-8 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(10,8,18,0.8)',
                border: `1px solid ${GOLD}30`,
              }}
              onClick={(e) => { e.stopPropagation(); handleSwipe('right'); }}
            >
              <ChevronLeft className="w-3.5 h-3.5" style={{ color: GOLD }} />
            </button>
            <button
              className="absolute -right-8 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(10,8,18,0.8)',
                border: `1px solid ${GOLD}30`,
              }}
              onClick={(e) => { e.stopPropagation(); handleSwipe('left'); }}
            >
              <ChevronRight className="w-3.5 h-3.5" style={{ color: GOLD }} />
            </button>
          </>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlot?.spiritId || 'empty'}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center"
          >
            {currentSlot && spiritData ? (
              <>
                {/* Spirit name + type badges */}
                <div className="flex items-center gap-1.5 mb-1">
                  {isFoxy && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 13,
                      color: isFoxy ? '#ffeaa7' : '#e8dcc8',
                      textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                    }}
                  >
                    {currentSlot.nickname || spiritData.name}
                  </span>
                  {types.map(t => {
                    const el = ELEMENT_CONFIG[t];
                    if (!el) return null;
                    return (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                        style={{
                          background: `${el.color}30`,
                          color: el.color,
                          textShadow: `0 0 4px ${el.color}40`,
                        }}
                      >
                        {el.emoji}
                      </span>
                    );
                  })}
                </div>

                {/* HP bar */}
                <div className="flex items-center gap-1.5 mb-0.5" style={{ width: 140 }}>
                  <Heart
                    className="w-3 h-3 shrink-0"
                    style={{ color: hpPercent > 50 ? '#ef4444' : hpPercent > 20 ? '#f59e0b' : '#dc2626' }}
                    fill={hpPercent > 0 ? 'currentColor' : 'none'}
                  />
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: hpPercent > 50
                          ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                          : hpPercent > 20
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #ef4444, #f87171)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${hpPercent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span style={{
                    fontFamily: F,
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.6)',
                    minWidth: 36,
                    textAlign: 'right',
                  }}>
                    {spiritCurrentHp}/{spiritMaxHp}
                  </span>
                </div>

                {/* Level (same as Lumi) */}
                <span style={{
                  fontFamily: F,
                  fontSize: 9,
                  color: `${GOLD}90`,
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                }}>
                  Lv.{stats.level} — {stats.xp}/{stats.xpToNext} XP
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center py-2">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center opacity-30">
                  <Sparkles className="w-5 h-5 text-gray-500" />
                </div>
                <span style={{ fontFamily: F, fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                  Empty Slot
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Dot indicators */}
      {filledSlots.length > 1 && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {filledSlots.map(({ idx }) => {
            const isActive = idx === activeIdx;
            const slotData = party[idx];
            const slotSpirit = slotData ? spiritDataMap[slotData.spiritId] : null;
            const slotIsFoxy = slotSpirit?.isFoxy;
            return (
              <button
                key={idx}
                onClick={() => setActivePartyIndex(idx)}
                className="transition-all"
                style={{
                  width: isActive ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: isActive
                    ? (slotIsFoxy ? GOLD : 'rgba(255,255,255,0.7)')
                    : 'rgba(255,255,255,0.25)',
                  boxShadow: isActive ? `0 0 6px ${slotIsFoxy ? GOLD : 'rgba(255,255,255,0.3)'}` : 'none',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}