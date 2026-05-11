/**
 * RealmContext.tsx — Shared state for the Foxy Realm
 *
 * Holds fox stats, wallet (gold/diamond), R2 asset URLs, quest tracking, and loading state.
 * Persists stats + quest completions to Supabase KV so they survive across sessions.
 * Provided by RealmShell; consumed by RealmHub, BagPage, QuestPage, and all realm sub-pages.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  fetchRPGAssets,
  fetchRealmStats,
  saveRealmStats,
  fetchRealmQuests,
  saveRealmQuests,
  preloadImages,
  loadEquipmentBonuses,
  fetchDiamondInbox,
  claimDiamondInbox,
} from '../utils/api';
import {
  isMusicEnabled,
  isMusicPlaying,
  toggleMusic as toggleMusicService,
  playMusic,
  subscribe as subscribeMusic,
} from '../utils/music-service';
import { projectId } from '../utils/supabase/info';
import { isEggHatchedFromStats } from '../utils/hatch';
import { checkEvolution, getEvolutionDef, getEvolutionRewardItemId, type EvolutionStage } from '../utils/evolution';
import { emitReward, emitLevelUp } from '../utils/reward-events';

// ── Slug conventions for RPG Asset Manager ──
const BG_SLUG_PORTRAIT = 'realm-bg';
const BG_SLUG_LANDSCAPE = 'realm-bg-landscape';
const FOXY_EGG_SLUG = 'game_egg';
const FOXY_HATCHED_SLUG = 'foxy-practice';
const ICON_BAG_SLUG = 'realm_bag';
const ICON_BATTLE_SLUG = 'realm_shield';
const ICON_QUEST_SLUG = 'realm_map';
const ICON_COIN_SLUG = 'game-coin';
const ICON_DIAMOND_SLUG = 'game-diamond';
const MAGIC_BTN_SLUG = 'stroll';
const QUEST_MAP_BG_SLUG = 'quest_map_bg';

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
  /** Epoch ms when the egg countdown started — persisted so it survives across sessions/devices */
  hatchStartMs?: number;
  /** Bag inventory: itemId → quantity */
  inventory?: Record<string, number>;
  /** Equipment slots: slotName → itemId */
  equipped?: Record<string, string>;
  /** Total battle wins — used for Warrior evolution gate (Bible v5: 25 wins required) */
  battleWins?: number;
  /** Treasure Map: number of 3× gold rounds remaining (consumed by addGold) */
  treasureMapActive?: number;
  /** Number of bag slots unlocked (default: 5, max: 20). Equipment doesn't consume bag slots. */
  bagSlots?: number;
  /** Spirit party — 5 slots. Slot 0 is always Foxy. Each entry is a spiritId + currentHp. */
  party?: (PartySlot | null)[];
  /** Index of currently viewed spirit on the Realm page (0-4) */
  activePartyIndex?: number;
  /** Spiritlab — overflow storage for caught spirits not in the active party (PC box) */
  spiritlab?: SpiritlabSlot[];
}

/** A single spirit party slot */
export interface PartySlot {
  spiritId: string;         // matches SpiritEntity.id from admin (e.g. 'foxy-stage-1', 'spirit-003')
  currentHp: number;        // current HP (may be lower than max if damaged in battle)
  nickname?: string;        // optional player-given nickname
}

/** A spirit stored in the Spiritlab (PC box) */
export interface SpiritlabSlot {
  spiritId: string;
  currentHp: number;
  nickname?: string;
}

export interface RealmAssets {
  realmBg: string | null;
  foxyImg: string | null;
  foxyEggImg: string | null;
  foxyHatchedImg: string | null;
  iconBag?: string;
  iconBattle?: string;
  iconQuest?: string;
  iconCoin?: string;
  iconDiamond?: string;
  magicBtnImg?: string;
  questMapBg?: string;
}

export interface QuestProgress {
  completedQuests: string[];
  moduleResults: Record<string, { score: number; total: number }>;
  questStars: Record<string, number>;
}

const DEFAULT_STATS: FoxyStats = {
  name: 'Foxy',
  level: 1,
  xp: 0,
  xpToNext: 100,
  hp: 100,
  maxHp: 100,
  gold: 100,
  diamond: 5,
  hunger: 70,
  thirst: 60,
  isSick: false,
  evolutionStage: 'egg',
  rank: 0,
  age: 5,
  party: [
    { spiritId: 'foxy-stage-1', currentHp: 100 },
    null, null, null, null,
  ],
  activePartyIndex: 0,
};

const DEFAULT_QUEST_PROGRESS: QuestProgress = {
  completedQuests: [],
  moduleResults: {},
  questStars: {},
};

// Debounce delay for persisting stats to KV (ms)
const SAVE_DEBOUNCE_MS = 800;

/**
 * Progressive XP curve — each level requires more XP than the last.
 * Formula: baseXP * (1 + growthRate)^(level-1), rounded to nearest 10.
 * Level 1→2: 100 XP, Level 2→3: ~130, Level 5→6: ~285, Level 10→11: ~760, etc.
 */
const BASE_XP = 100;
const GROWTH_RATE = 0.3; // 30% more XP per level
export function xpRequiredForLevel(level: number): number {
  return Math.round((BASE_XP * Math.pow(1 + GROWTH_RATE, level - 1)) / 10) * 10;
}

interface RealmContextValue {
  stats: FoxyStats;
  setStats: React.Dispatch<React.SetStateAction<FoxyStats>>;
  assets: RealmAssets;
  isLoading: boolean;
  isLoadingStats: boolean;
  isLandscape: boolean;
  userId: string | null;
  // Music (global singleton via music-service.ts)
  musicOn: boolean;
  toggleMusicFn: () => void;
  // Wallet helpers
  addGold: (amount: number) => void;
  addDiamond: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  spendDiamond: (amount: number) => boolean;
  // XP + leveling — uses functional updater so it's safe to call
  // right after addGold/spendGold in the same event handler batch.
  addXP: (amount: number) => { levelsGained: number; newLevel: number };
  // Immediate persist (for critical operations like purchases & battle results)
  flushStats: () => void;
  // Quest tracking (persisted to KV)
  questProgress: QuestProgress;
  markQuestCompleted: (questId: string, score: number, total: number, stars: number) => void;
  isQuestCompleted: (questId: string) => boolean;
  getQuestStars: (questId: string) => number;
  getQuestResult: (questId: string) => { score: number; total: number } | null;
  /** Pending evolution stage — set when a level-up triggers evolution. Consumer should show EvolutionCeremony then clear it. */
  pendingEvolution: EvolutionStage | null;
  clearPendingEvolution: () => void;
  /** Record a battle win (increments battleWins counter, checks warrior evolution gate) */
  recordBattleWin: () => void;
  /** Party helpers */
  setActivePartyIndex: (idx: number) => void;
  addSpiritToParty: (spiritId: string, maxHp: number) => boolean;
  removeSpiritFromParty: (slotIdx: number) => void;
  /** Spiritlab (PC box) helpers */
  addToSpiritlab: (spiritId: string, maxHp: number, nickname?: string) => void;
  removeFromSpiritlab: (spiritId: string) => void;
  movePartyToSpiritlab: (partySlotIdx: number) => void;
  moveSpiritlabToParty: (spiritId: string) => boolean;
}

const RealmContext = createContext<RealmContextValue | null>(null);

export function useRealmContext() {
  const ctx = useContext(RealmContext);
  if (!ctx) throw new Error('useRealmContext must be used within a RealmProvider');
  return ctx;
}

export function RealmProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<FoxyStats>(DEFAULT_STATS);
  const [questProgress, setQuestProgress] = useState<QuestProgress>(DEFAULT_QUEST_PROGRESS);
  const [assets, setAssets] = useState<RealmAssets>({ realmBg: null, foxyImg: null, foxyEggImg: null, foxyHatchedImg: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // ── Music state — synced with global music-service singleton ──
  const [musicOn, setMusicOn] = useState(isMusicPlaying());

  // Subscribe to music-service state changes so UI stays in sync
  useEffect(() => {
    return subscribeMusic((isPlaying) => setMusicOn(isPlaying));
  }, []);

  // Auto-start music on first user interaction if preference is enabled
  useEffect(() => {
    if (!isMusicEnabled()) return;
    const startOnInteraction = () => {
      if (isMusicEnabled() && !isMusicPlaying()) {
        playMusic();
      }
      document.removeEventListener('click', startOnInteraction);
      document.removeEventListener('touchstart', startOnInteraction);
    };
    document.addEventListener('click', startOnInteraction, { once: true });
    document.addEventListener('touchstart', startOnInteraction, { once: true });
    return () => {
      document.removeEventListener('click', startOnInteraction);
      document.removeEventListener('touchstart', startOnInteraction);
    };
  }, []);

  const toggleMusicFn = useCallback(() => {
    toggleMusicService();
  }, []);

  // Get userId from localStorage (set during login)
  // Parent users store their ID as 'parent_id', KG/Admin users as 'user_id'.
  // We check both so realm stats persist for ALL user types.
  const userId = typeof window !== 'undefined'
    ? (localStorage.getItem('user_id') || localStorage.getItem('parent_id'))
    : null;

  // Refs for debounced saving
  const statsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsInitializedRef = useRef(false);
  const questsInitializedRef = useRef(false);
  const latestStatsRef = useRef(stats);
  // Use useLayoutEffect for synchronous ref update — ensures latestStatsRef
  // is always current BEFORE any setTimeout callbacks (like flushStats) run.
  // This prevents the race condition where flushStats reads stale stats.
  useLayoutEffect(() => { latestStatsRef.current = stats; }, [stats]);
  const latestQuestsRef = useRef(questProgress);
  useLayoutEffect(() => { latestQuestsRef.current = questProgress; }, [questProgress]);

  // Also cache stats to localStorage as a fast backup layer.
  // This prevents data loss when KV save races with KV load on re-login.
  // NOTE: We intentionally do NOT guard with statsInitializedRef here so that
  // every single setStats (including from KV load + migration) is cached.
  // This ensures localStorage always has the latest snapshot.
  useLayoutEffect(() => {
    if (userId) {
      try {
        localStorage.setItem(`foxy_stats_cache_${userId}`, JSON.stringify(stats));
      } catch {}
    }
  }, [stats, userId]);

  // Track orientation
  useEffect(() => {
    const handle = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // ── Load stats from KV on mount ──
  useEffect(() => {
    if (!userId) {
      setIsLoadingStats(false);
      console.log('[REALM CTX] No userId, using default stats');
      return;
    }

    // Immediately apply localStorage cache for instant display (avoids flash of defaults)
    try {
      const cached = localStorage.getItem(`foxy_stats_cache_${userId}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        setStats({ ...DEFAULT_STATS, ...parsedCache });
        console.log(`[REALM CTX] Applied localStorage cache: level=${parsedCache.level}, gold=${parsedCache.gold}`);
      }
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const [savedStats, savedQuests] = await Promise.all([
          fetchRealmStats(userId),
          fetchRealmQuests(userId),
        ]);

        if (cancelled) return;

        if (savedStats) {
          // Merge saved stats with defaults (in case we added new fields)
          // Compare with localStorage cache — use whichever has the more recent updatedAt
          let bestStats = savedStats;
          try {
            const cached = localStorage.getItem(`foxy_stats_cache_${userId}`);
            if (cached) {
              const parsedCache = JSON.parse(cached);
              // If localStorage cache has a higher level or more gold/xp, it's likely newer
              // (covers the race condition where KV save hadn't completed before re-login)
              const kvUpdated = savedStats.updatedAt ? new Date(savedStats.updatedAt).getTime() : 0;
              const cacheLevel = parsedCache.level || 1;
              const kvLevel = savedStats.level || 1;
              const cacheXP = (parsedCache.xp || 0) + (cacheLevel * 1000);
              const kvXP = (savedStats.xp || 0) + (kvLevel * 1000);
              if (cacheXP > kvXP || cacheLevel > kvLevel) {
                console.log(`[REALM CTX] localStorage cache is newer (cache level=${cacheLevel}, KV level=${kvLevel}), using cache`);
                bestStats = parsedCache;
              }
            }
          } catch {}
          setStats(prev => ({ ...DEFAULT_STATS, ...bestStats }));
          console.log(`[REALM CTX] Loaded stats from KV: level=${savedStats.level}, gold=${savedStats.gold}, xp=${savedStats.xp}`);
        } else {
          console.log('[REALM CTX] No saved stats in KV, using defaults (or localStorage cache if available)');
        }

        // ── Migrate legacy localStorage data into stats (one-time) ──
        // Hatch timer: was stored under global key 'foxy_egg_hatch_start'
        // Inventory: was stored under global key 'foxy_inventory_v2'
        // Equipped: was stored under global key 'foxy_equipped_v1'
        // These now live inside FoxyStats for proper per-user KV persistence.
        setStats(prev => {
          let migrated = false;
          const next = { ...prev };

          // Migrate hatch timer
          if (!next.hatchStartMs) {
            try {
              const legacyHatch = localStorage.getItem('foxy_egg_hatch_start');
              if (legacyHatch) {
                next.hatchStartMs = parseInt(legacyHatch, 10);
                migrated = true;
                console.log(`[REALM CTX] Migrated hatchStartMs from localStorage: ${next.hatchStartMs}`);
              }
            } catch {}
          }
          // ── CRITICAL: ensure hatchStartMs is ALWAYS initialised ──
          // Without this, getHatchStartFromStats() creates a fresh Date.now() on
          // every hydration but never saves it, so the 48hr timer resets forever.
          if (!next.hatchStartMs && next.evolutionStage === 'egg') {
            next.hatchStartMs = Date.now();
            migrated = true;
            console.log(`[REALM CTX] Initialized hatchStartMs (no KV/localStorage value found): ${next.hatchStartMs}`);
          }

          // Migrate inventory
          if (!next.inventory || Object.keys(next.inventory).length === 0) {
            try {
              const legacyInv = localStorage.getItem('foxy_inventory_v2');
              if (legacyInv) {
                const parsed = JSON.parse(legacyInv);
                if (parsed && Object.keys(parsed).length > 0) {
                  next.inventory = parsed;
                  migrated = true;
                  console.log(`[REALM CTX] Migrated inventory from localStorage: ${Object.keys(parsed).length} items`);
                }
              }
            } catch {}
          }

          // Migrate equipped
          if (!next.equipped || Object.keys(next.equipped).length === 0) {
            try {
              const legacyEquip = localStorage.getItem('foxy_equipped_v1');
              if (legacyEquip) {
                const parsed = JSON.parse(legacyEquip);
                if (parsed && Object.keys(parsed).length > 0) {
                  next.equipped = parsed;
                  migrated = true;
                  console.log(`[REALM CTX] Migrated equipped from localStorage: ${Object.keys(parsed).length} slots`);
                }
              }
            } catch {}
          }

          if (migrated) console.log('[REALM CTX] Legacy data migrated into stats — will persist to KV on next debounce');
          return migrated ? next : prev;
        });

        // ── Auto-promote evolutionStage on hydration ──
        // Bible v5: Egg → Baby requires BOTH 48hr timer AND Level 5.
        // Baby → Young (Lv20) and Young → Warrior (Lv30 + 25 wins) also checked.
        // This covers: KV had old data without evolutionStage promotion,
        // or localStorage cache was from before this fix was deployed.
        //
        // CRITICAL FIX: We must NOT call setPendingEvolution inside setStats updater
        // (side effects in updaters are anti-pattern). We also must immediately flush
        // the promoted stats to KV — the debounced save guard (statsInitializedRef)
        // isn't set yet, so the normal debounce path would skip this critical write.
        let hydrationPromotedStage: EvolutionStage | null = null;
        setStats(prev => {
          let eggHatched = isEggHatchedFromStats(prev.hatchStartMs, undefined, prev.evolutionStage);

          // ── Level-based recovery for lost timer data ──
          if (!eggHatched && prev.evolutionStage === 'egg' && prev.level >= 5) {
            console.log(`[REALM CTX] Level-based hatch recovery: level=${prev.level}, evolutionStage=egg, forcing eggHatched=true`);
            eggHatched = true;
            prev = { ...prev, hatchStartMs: Date.now() - (49 * 60 * 60 * 1000) };
          }

          const nextStage = checkEvolution(
            prev.evolutionStage as EvolutionStage,
            prev.level,
            prev.battleWins || 0,
            eggHatched,
          );
          if (!nextStage) return prev;
          const def = getEvolutionDef(nextStage);
          const goldReward = def?.reward.gold || 0;
          console.log(`[REALM CTX] Auto-promoting evolutionStage: ${prev.evolutionStage} → ${nextStage} (hydration, reward: ${goldReward}g)`);
          hydrationPromotedStage = nextStage;
          return { ...prev, evolutionStage: nextStage, gold: prev.gold + goldReward };
        });

        // Show evolution ceremony OUTSIDE the setStats updater (no side effects in updaters)
        // and immediately flush promoted stats to KV so the promotion persists.
        if (hydrationPromotedStage) {
          setPendingEvolution(hydrationPromotedStage);
          // Immediately persist promoted stats to KV — don't rely on debounced save
          // because statsInitializedRef is still false at this point.
          setTimeout(() => {
            const promotedStats = latestStatsRef.current;
            console.log(`[REALM CTX] Immediate KV flush after hydration promotion: stage=${promotedStats.evolutionStage}, gold=${promotedStats.gold}`);
            saveRealmStats(userId, promotedStats).catch(err => {
              console.error('[REALM CTX] Failed to flush promoted stats to KV:', err);
            });
          }, 50);
        }

        // ── Bible v5: Consume diamond inbox (referral rewards) ──
        // Diamonds granted server-side (e.g. referral +1/+3/+5💎) are queued
        // in realm_diamond_inbox:{userId}. We claim them here on init.
        try {
          const inbox = await fetchDiamondInbox(userId);
          if (!cancelled && inbox.total > 0) {
            console.log(`[REALM CTX] 💎 Diamond inbox: ${inbox.total} pending from ${inbox.grants.length} grants`);
            setStats(prev => ({ ...prev, diamond: prev.diamond + inbox.total }));
            // Emit reward notification for each grant
            for (const grant of inbox.grants) {
              emitReward('diamond', grant.amount);
            }
            // Claim (clear) the inbox so it doesn't double-apply
            await claimDiamondInbox(userId);
            console.log(`[REALM CTX] 💎 Claimed ${inbox.total} diamonds from inbox`);
          }
        } catch (inboxErr) {
          console.warn('[REALM CTX] Diamond inbox check failed (non-critical):', inboxErr);
        }

        if (savedQuests) {
          setQuestProgress({
            completedQuests: savedQuests.completedQuests || [],
            moduleResults: savedQuests.moduleResults || {},
            questStars: savedQuests.questStars || {},
          });
          console.log(`[REALM CTX] Loaded quest progress: ${(savedQuests.completedQuests || []).length} completed quests`);
        }

        // Mark as initialized so debounced saves can start
        setTimeout(() => {
          statsInitializedRef.current = true;
          questsInitializedRef.current = true;
        }, 100);
      } catch (err) {
        console.warn('[REALM CTX] Failed to load from KV, using defaults:', err);
        statsInitializedRef.current = true;
        questsInitializedRef.current = true;
      } finally {
        if (!cancelled) setIsLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Debounced persist stats to KV ──
  useEffect(() => {
    if (!userId || !statsInitializedRef.current) return;

    if (statsSaveTimerRef.current) clearTimeout(statsSaveTimerRef.current);
    statsSaveTimerRef.current = setTimeout(() => {
      saveRealmStats(userId, latestStatsRef.current).catch(err => {
        console.error('[REALM CTX] Failed to save stats to KV:', err);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (statsSaveTimerRef.current) clearTimeout(statsSaveTimerRef.current);
    };
  }, [stats, userId]);

  // ── Debounced persist quest progress to KV ──
  useEffect(() => {
    if (!userId || !questsInitializedRef.current) return;

    if (questSaveTimerRef.current) clearTimeout(questSaveTimerRef.current);
    questSaveTimerRef.current = setTimeout(() => {
      saveRealmQuests(userId, latestQuestsRef.current).catch(err => {
        console.error('[REALM CTX] Failed to save quest progress to KV:', err);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (questSaveTimerRef.current) clearTimeout(questSaveTimerRef.current);
    };
  }, [questProgress, userId]);

  // ── Emergency flush on unmount — saves any pending changes immediately ──
  // This fires when RealmProvider unmounts (e.g. navigating from /realm to /kg).
  // Without this, the debounce cleanup would cancel pending timers and lose data.
  const userIdRef = useRef(userId);
  useEffect(() => { if (userId) userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    return () => {
      const uid = userIdRef.current;
      if (!uid || !statsInitializedRef.current) return;

      // Cancel pending debounced saves (we'll do an immediate one)
      if (statsSaveTimerRef.current) clearTimeout(statsSaveTimerRef.current);
      if (questSaveTimerRef.current) clearTimeout(questSaveTimerRef.current);

      // Fire-and-forget final saves with latest refs
      const currentStats = latestStatsRef.current;
      const currentQuests = latestQuestsRef.current;
      console.log(`[REALM CTX] Unmount flush: gold=${currentStats.gold}, xp=${currentStats.xp}, hp=${currentStats.hp}`);
      saveRealmStats(uid, currentStats).catch(err => {
        console.error('[REALM CTX] Unmount flush stats failed:', err);
      });
      if (questsInitializedRef.current) {
        saveRealmQuests(uid, currentQuests).catch(err => {
          console.error('[REALM CTX] Unmount flush quests failed:', err);
        });
      }
    };
  }, []); // Empty deps — only fires on unmount

  // ── beforeunload — survive page refresh / tab close ──
  // React effects do NOT run on page unload. We use beforeunload + sendBeacon
  // to guarantee stats reach the server before the browser kills the page.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const uid = userIdRef.current;
      if (!uid || !statsInitializedRef.current) return;

      const currentStats = latestStatsRef.current;
      const currentQuests = latestQuestsRef.current;

      // Build beacon payloads — sendBeacon is the only reliable way to send
      // data during page unload (fetch gets cancelled by the browser).
      const statsUrl = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/realm/stats/${uid}`;
      const questsUrl = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/realm/quests/${uid}`;

      try {
        const statsBlob = new Blob(
          [JSON.stringify({ stats: { ...currentStats, updatedAt: new Date().toISOString() } })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(statsUrl, statsBlob);
        console.log(`[REALM CTX] beforeunload beacon: gold=${currentStats.gold}, xp=${currentStats.xp}`);
      } catch (e) {
        console.warn('[REALM CTX] beforeunload stats beacon failed:', e);
      }

      if (questsInitializedRef.current) {
        try {
          const questsBlob = new Blob(
            [JSON.stringify({ quests: currentQuests })],
            { type: 'application/json' }
          );
          navigator.sendBeacon(questsUrl, questsBlob);
        } catch (e) {
          console.warn('[REALM CTX] beforeunload quests beacon failed:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Fetch R2 assets once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { assets: fetched } = await fetchRPGAssets();
        if (cancelled) return;
        if (fetched && fetched.length > 0) {
          const bgSlug = isLandscape ? BG_SLUG_LANDSCAPE : BG_SLUG_PORTRAIT;
          const bgMatch =
            fetched.find(a => a.slug === bgSlug) ||
            fetched.find(a => a.slug === BG_SLUG_PORTRAIT) ||
            fetched.find(a => a.category === 'background');
          const foxyMatch =
            fetched.find(a => a.slug === FOXY_EGG_SLUG) ||
            fetched.find(a => a.category === 'foxy');
          const foxyHatchedMatch =
            fetched.find(a => a.slug === FOXY_HATCHED_SLUG);
          const findIcon = (slug: string) => fetched.find(a => a.slug === slug)?.publicUrl;

          const eggUrl = foxyMatch?.publicUrl ?? null;
          const hatchedUrl = foxyHatchedMatch?.publicUrl ?? null;

          setAssets({
            realmBg: bgMatch?.publicUrl ?? null,
            foxyImg: eggUrl,            // legacy — always the egg
            foxyEggImg: eggUrl,         // explicit egg
            foxyHatchedImg: hatchedUrl,  // foxy after hatch
            iconBag: findIcon(ICON_BAG_SLUG),
            iconBattle: findIcon(ICON_BATTLE_SLUG),
            iconQuest: findIcon(ICON_QUEST_SLUG),
            iconCoin: findIcon(ICON_COIN_SLUG),
            iconDiamond: findIcon(ICON_DIAMOND_SLUG),
            magicBtnImg: findIcon(MAGIC_BTN_SLUG),
            questMapBg: findIcon(QUEST_MAP_BG_SLUG),
          });
          console.log('[REALM CTX] Assets loaded:', fetched.length);

          // Preload key images into browser cache for instant rendering on navigation
          preloadImages([
            bgMatch?.publicUrl,
            foxyMatch?.publicUrl,
            foxyHatchedMatch?.publicUrl,
            findIcon(ICON_BAG_SLUG),
            findIcon(ICON_BATTLE_SLUG),
            findIcon(ICON_QUEST_SLUG),
            findIcon(ICON_COIN_SLUG),
            findIcon(ICON_DIAMOND_SLUG),
            findIcon(MAGIC_BTN_SLUG),
            findIcon(QUEST_MAP_BG_SLUG),
          ]);
        }
      } catch (err) {
        console.warn('[REALM CTX] Could not load RPG assets:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLandscape]);

  // Wallet helpers
  const addGold = useCallback((amount: number) => {
    setStats(prev => {
      // Bible v5: Treasure Map gives 3× gold for one round, then consumed
      let finalAmount = amount;
      let mapCharges = prev.treasureMapActive || 0;
      if (mapCharges > 0 && amount > 0) {
        finalAmount = amount * 3;
        mapCharges -= 1;
        console.log(`[REALM CTX] Treasure Map active! ${amount}g × 3 = ${finalAmount}g (${mapCharges} charges left)`);
      }
      return { ...prev, gold: prev.gold + finalAmount, treasureMapActive: mapCharges };
    });
    if (amount > 0) emitReward('gold', amount);
  }, []);
  const addDiamond = useCallback((amount: number) => {
    setStats(prev => ({ ...prev, diamond: prev.diamond + amount }));
    if (amount > 0) emitReward('diamond', amount);
  }, []);
  const spendGold = useCallback((amount: number) => {
    let success = false;
    setStats(prev => {
      if (prev.gold >= amount) {
        success = true;
        return { ...prev, gold: prev.gold - amount };
      }
      return prev;
    });
    return success;
  }, []);
  const spendDiamond = useCallback((amount: number) => {
    let success = false;
    setStats(prev => {
      if (prev.diamond >= amount) {
        success = true;
        return { ...prev, diamond: prev.diamond - amount };
      }
      return prev;
    });
    return success;
  }, []);

  // Evolution helpers (must be defined before addXP which references tryEvolve)
  const [pendingEvolution, setPendingEvolution] = useState<EvolutionStage | null>(null);
  const clearPendingEvolution = useCallback(() => {
    setPendingEvolution(null);
  }, []);

  /**
   * Internal: check if stats qualify for evolution. If so, promote stage, 
   * grant gold reward, and set pendingEvolution for the ceremony modal.
   * Called after level-ups (addXP) and battle wins (recordBattleWin).
   */
  const tryEvolve = useCallback((s: FoxyStats): FoxyStats => {
    let eggHatched = isEggHatchedFromStats(s.hatchStartMs, undefined, s.evolutionStage);

    // ── Level-based recovery (same as hydration) ──
    // If timer data is lost/reset but user clearly qualifies, force it
    if (!eggHatched && s.evolutionStage === 'egg' && s.level >= 5) {
      console.log(`[REALM CTX] tryEvolve: level-based hatch recovery (level=${s.level})`);
      eggHatched = true;
      s = { ...s, hatchStartMs: Date.now() - (49 * 60 * 60 * 1000) };
    }

    const nextStage = checkEvolution(
      s.evolutionStage as EvolutionStage,
      s.level,
      s.battleWins || 0,
      eggHatched,
    );
    if (!nextStage) return s;

    const def = getEvolutionDef(nextStage);
    const goldReward = def?.reward.gold || 0;
    const rewardItemId = getEvolutionRewardItemId(nextStage);

    // Grant evolution reward item to inventory (by ID only — item def lives in ShopManager KV)
    // Also add to local stats.inventory so BagPage sees it immediately
    let updatedInventory = { ...(s.inventory || {}) };
    if (rewardItemId) {
      updatedInventory[rewardItemId] = (updatedInventory[rewardItemId] || 0) + 1;
      // Primary persistence: setStats → debounced KV save to realm_stats:{userId}.inventory
      // No separate server call needed — realm_stats is the canonical inventory source.
    }

    console.log(`[REALM CTX] Evolution triggered: ${s.evolutionStage} → ${nextStage} (reward: ${goldReward}g${rewardItemId ? `, itemId: ${rewardItemId}` : ''})`);
    setPendingEvolution(nextStage);

    // Update Foxy's spiritId in party slot 0 to match the new evolution stage
    const EVOLUTION_FOXY_MAP: Record<string, string> = {
      baby: 'foxy-stage-1',   // just hatched (Foxkit)
      young: 'foxy-stage-2',  // Foxara
      warrior: 'foxy-stage-3', // Foxen (Forveil = stage-4 requires special unlock)
    };
    const updatedParty = [...(s.party || [{ spiritId: 'foxy-stage-1', currentHp: s.maxHp }, null, null, null, null])];
    const newFoxyId = EVOLUTION_FOXY_MAP[nextStage];
    if (newFoxyId && updatedParty[0]) {
      updatedParty[0] = { ...updatedParty[0], spiritId: newFoxyId };
    }

    return {
      ...s,
      evolutionStage: nextStage,
      gold: s.gold + goldReward,
      inventory: updatedInventory,
      party: updatedParty,
    };
  }, [userId]);

  const recordBattleWin = useCallback(() => {
    setStats(prev => {
      const withWin = { ...prev, battleWins: (prev.battleWins || 0) + 1 };
      return tryEvolve(withWin);
    });
  }, [tryEvolve]);

  // XP + leveling — uses functional updater so it's safe to call
  // right after addGold/spendGold in the same event handler batch.
  // Bible v5: Equipment XP% bonus (e.g. Focus Necklace +10%) applied as multiplier.
  const addXP = useCallback((amount: number) => {
    let levelsGained = 0;
    let computedLevel = 0;

    // Apply equipment XP% bonus (e.g. xp_percent=10 → 1.1× multiplier)
    const equipBonus = loadEquipmentBonuses();
    const xpMultiplier = 1 + (equipBonus.xp_percent || 0) / 100;
    const adjustedAmount = Math.round(amount * xpMultiplier);

    setStats(prev => {
      let newLevel = prev.level;
      let newXP = prev.xp + adjustedAmount;
      let newXPToNext = prev.xpToNext;

      while (newXP >= newXPToNext) {
        newXP -= newXPToNext;
        newLevel += 1;
        newXPToNext = xpRequiredForLevel(newLevel);
        levelsGained += 1;
      }

      computedLevel = newLevel;

      const updated = {
        ...prev,
        level: newLevel,
        xp: newXP,
        xpToNext: newXPToNext,
      };

      // Check evolution on level-up (Bible v5: baby@Lv5, young@Lv20, warrior@Lv30+25wins)
      if (levelsGained > 0) {
        return tryEvolve(updated);
      }
      return updated;
    });

    // levelsGained & computedLevel are set inside the updater which React
    // calls synchronously, so these return values are accurate for the caller.
    if (adjustedAmount > 0) emitReward('xp', adjustedAmount);
    if (levelsGained > 0) emitLevelUp(computedLevel, levelsGained);
    return { levelsGained, newLevel: computedLevel };
  }, [tryEvolve]);

  // Immediate persist (for critical operations like purchases & battle results)
  // Uses latestStatsRef so it always saves the most recent state, even when
  // called from a stale closure (e.g. setTimeout after spendGold).
  // Uses userIdRef instead of userId so it works even during logout transition
  // when localStorage keys are already cleared but the ref retains the last valid ID.
  const flushStats = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid || !statsInitializedRef.current) return;
    const current = latestStatsRef.current;
    console.log(`[REALM CTX] flushStats: userId=${uid}, gold=${current.gold}, xp=${current.xp}, hp=${current.hp}, level=${current.level}`);
    saveRealmStats(uid, current).catch(err => {
      console.error('[REALM CTX] flushStats failed:', err);
    });
  }, []);

  // Quest tracking helpers
  const markQuestCompleted = useCallback((questId: string, score: number, total: number, stars: number) => {
    setQuestProgress(prev => {
      const alreadyCompleted = prev.completedQuests.includes(questId);
      const existingStars = prev.questStars[questId] || 0;
      // Only update if new attempt is better (higher stars) or first time
      const bestStars = Math.max(existingStars, stars);
      const existingResult = prev.moduleResults[questId];
      const bestResult = !existingResult || score > existingResult.score
        ? { score, total }
        : existingResult;

      return {
        completedQuests: alreadyCompleted ? prev.completedQuests : [...prev.completedQuests, questId],
        moduleResults: { ...prev.moduleResults, [questId]: bestResult },
        questStars: { ...prev.questStars, [questId]: bestStars },
      };
    });
  }, []);

  const isQuestCompleted = useCallback((questId: string) => {
    return questProgress.completedQuests.includes(questId);
  }, [questProgress.completedQuests]);

  const getQuestStars = useCallback((questId: string) => {
    return questProgress.questStars[questId] || 0;
  }, [questProgress.questStars]);

  const getQuestResult = useCallback((questId: string) => {
    return questProgress.moduleResults[questId] || null;
  }, [questProgress.moduleResults]);

  // ── Party helpers ──
  // Party defaults are in DEFAULT_STATS, which merges during KV hydration.
  // No separate initialization useEffect needed.

  const setActivePartyIndex = useCallback((idx: number) => {
    if (idx < 0 || idx > 4) return;
    setStats(prev => ({ ...prev, activePartyIndex: idx }));
  }, []);

  const addSpiritToParty = useCallback((spiritId: string, maxHp: number): boolean => {
    let added = false;
    setStats(prev => {
      const party = [...(prev.party || [{ spiritId: 'foxy-stage-1', currentHp: prev.maxHp }, null, null, null, null])];
      // Find first empty slot (skip slot 0 = Foxy)
      const emptyIdx = party.findIndex((slot, i) => i > 0 && slot === null);
      if (emptyIdx === -1) return prev; // party full
      // Check if spirit already in party
      if (party.some(slot => slot && slot.spiritId === spiritId)) return prev;
      party[emptyIdx] = { spiritId, currentHp: maxHp };
      added = true;
      return { ...prev, party };
    });
    return added;
  }, []);

  const removeSpiritFromParty = useCallback((slotIdx: number) => {
    if (slotIdx === 0) return; // can't remove Foxy
    setStats(prev => {
      const party = [...(prev.party || [])];
      if (slotIdx < 0 || slotIdx >= party.length) return prev;
      party[slotIdx] = null;
      // If active index was on removed slot, reset to 0
      const activeIdx = prev.activePartyIndex || 0;
      return {
        ...prev,
        party,
        activePartyIndex: activeIdx === slotIdx ? 0 : activeIdx,
      };
    });
  }, []);

  // ── Spiritlab (PC box) helpers ──
  const addToSpiritlab = useCallback((spiritId: string, maxHp: number, nickname?: string) => {
    setStats(prev => {
      const spiritlab = [...(prev.spiritlab || [])];
      const existingIdx = spiritlab.findIndex(slot => slot.spiritId === spiritId);
      if (existingIdx !== -1) {
        // Update existing slot
        spiritlab[existingIdx] = { spiritId, currentHp: maxHp, nickname };
      } else {
        // Add new slot
        spiritlab.push({ spiritId, currentHp: maxHp, nickname });
      }
      return { ...prev, spiritlab };
    });
  }, []);

  const removeFromSpiritlab = useCallback((spiritId: string) => {
    setStats(prev => {
      const spiritlab = [...(prev.spiritlab || [])];
      const existingIdx = spiritlab.findIndex(slot => slot.spiritId === spiritId);
      if (existingIdx !== -1) {
        // Remove existing slot
        spiritlab.splice(existingIdx, 1);
      }
      return { ...prev, spiritlab };
    });
  }, []);

  const movePartyToSpiritlab = useCallback((partySlotIdx: number) => {
    setStats(prev => {
      const party = [...(prev.party || [])];
      const spiritlab = [...(prev.spiritlab || [])];
      if (partySlotIdx < 0 || partySlotIdx >= party.length) return prev;
      const slot = party[partySlotIdx];
      if (!slot) return prev;
      // Add to spiritlab
      const existingIdx = spiritlab.findIndex(s => s.spiritId === slot.spiritId);
      if (existingIdx !== -1) {
        // Update existing slot
        spiritlab[existingIdx] = { spiritId: slot.spiritId, currentHp: slot.currentHp, nickname: slot.nickname };
      } else {
        // Add new slot
        spiritlab.push({ spiritId: slot.spiritId, currentHp: slot.currentHp, nickname: slot.nickname });
      }
      // Remove from party
      party[partySlotIdx] = null;
      return { ...prev, party, spiritlab };
    });
  }, []);

  const moveSpiritlabToParty = useCallback((spiritId: string) => {
    let added = false;
    setStats(prev => {
      const party = [...(prev.party || [{ spiritId: 'foxy-stage-1', currentHp: prev.maxHp }, null, null, null, null])];
      const spiritlab = [...(prev.spiritlab || [])];
      // Find first empty slot (skip slot 0 = Foxy)
      const emptyIdx = party.findIndex((slot, i) => i > 0 && slot === null);
      if (emptyIdx === -1) return prev; // party full
      // Check if spirit already in party
      if (party.some(slot => slot && slot.spiritId === spiritId)) return prev;
      // Find spirit in spiritlab
      const labIdx = spiritlab.findIndex(slot => slot.spiritId === spiritId);
      if (labIdx === -1) return prev; // not found in spiritlab
      const slot = spiritlab[labIdx];
      if (!slot) return prev;
      party[emptyIdx] = { spiritId: slot.spiritId, currentHp: slot.currentHp, nickname: slot.nickname };
      added = true;
      // Remove from spiritlab
      spiritlab.splice(labIdx, 1);
      return { ...prev, party, spiritlab };
    });
    return added;
  }, []);

  return (
    <RealmContext.Provider
      value={{
        stats,
        setStats,
        assets,
        isLoading,
        isLoadingStats,
        isLandscape,
        userId,
        musicOn,
        toggleMusicFn,
        addGold,
        addDiamond,
        spendGold,
        spendDiamond,
        addXP,
        flushStats,
        questProgress,
        markQuestCompleted,
        isQuestCompleted,
        getQuestStars,
        getQuestResult,
        pendingEvolution,
        clearPendingEvolution,
        recordBattleWin,
        setActivePartyIndex,
        addSpiritToParty,
        removeSpiritFromParty,
        addToSpiritlab,
        removeFromSpiritlab,
        movePartyToSpiritlab,
        moveSpiritlabToParty,
      }}
    >
      {children}
    </RealmContext.Provider>
  );
}