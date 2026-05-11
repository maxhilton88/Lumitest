/**
 * BattleScreen.tsx — Pokémon-style PvP Battle UI (Phase 2: MCQ-gated attacks + animations)
 *
 * Classic Pokémon layout with MCQ question popup on skill use.
 * Correct answer → elemental hit animation (particles + flash + shake) + damage
 * Wrong answer / timeout → fizzle miss + opponent normal counter-attack
 *
 * Timer: age 4-6 = 8s, 7-9 = 6s, 10-12 = 4s
 * Stats formula (Bible v5): HP = 50+Lv×15, ATK = 10+Lv×3, DEF = equip only (base 0)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Swords, ShoppingBag, DoorOpen, RefreshCw,
  Flame, Zap, Mountain, Droplets, Leaf,
  ChevronLeft, Shield, Clock, Heart, Crown, Sparkles,
} from 'lucide-react';
import {
  fetchBattleSkills, fetchRPGAssets, fetchQuestionBank,
  type BattleSkillDef, type RPGAsset,
  fetchShopItems, type ShopItemDef,
  loadEquipmentBonuses, rpgGameListEntities,
} from '../../utils/api';
import { useRealmContext, type PartySlot } from '../../contexts/RealmContext';
import { useLanguage } from '../LanguageContext';
import { toast } from 'sonner@2.0.3';
import { BattleMCQPopup, type BattleMCQQuestion } from './BattleMCQPopup';
import { recordMasteryAnswers, fetchMasteryProfile, type MasterySubject } from '../../utils/mastery-api';
import { startBattleBGM, stopBattleBGM, playSfx } from '../../utils/battle-sfx';
import {
  HitFlash, HitParticles, MissFizzle,
  ScreenShake, OpponentHitReaction, PlayerMissReaction,
  CounterFlash, CounterParticles, PlayerHitReaction,
  FloatingDamageNumber, LowHPPulse, HPBarPulse,
} from './BattleAnimations';
import { FOXY_STAGES, WILD_SPIRITS } from '../admin/spirit-seed-data';

/** Slugify a move name the same way extractUniqueMoves does in SkillManager */
function moveSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Max skills shown per spirit in battle (Pokémon-style 4-move limit) */
const MAX_BATTLE_SKILLS = 4;

/* ── Fonts & colors ── */
const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';

/* ── Lumicore catch rates ── */
const LUMICORE_CATCH_RATES: Record<string, number> = {
  'lumicore-basic': 0.40,
  'lumicore-great': 0.65,
  'lumicore-ultra': 0.85,
};
/** HP factor: lower enemy HP = higher catch chance. Range: 0.5 (full HP) → 1.0 (1 HP) */
function catchHpFactor(currentHp: number, maxHp: number): number {
  if (maxHp <= 0) return 1;
  return 0.5 + 0.5 * (1 - Math.max(0, currentHp) / maxHp);
}

/* ── Stat formulas (Bible v5 — equipment bonus applied additively) ── */
function calcHP(level: number, bonus = 0) { return 50 + level * 15 + bonus; }
function calcATK(level: number, bonus = 0) { return 10 + level * 3 + bonus; }
function calcDEF(bonus = 0) { return bonus; } // Bible v5: base DEF = 0, only from equipment

/**
 * Bible v5 speed bonus: based on how fast the MCQ was answered.
 * Equipment SPD bonus makes the player "faster" — each point of SPD
 * subtracts 0.2s from the effective elapsed time.
 *   >5s effective = 1.0× (normal)
 *   3-5s effective = 1.15× (fast)
 *   <3s effective = 1.3× (lightning)
 */
function calcSpeedBonus(elapsedSeconds: number, equipSpeed = 0): number {
  const effective = Math.max(0, elapsedSeconds - equipSpeed * 0.2);
  if (effective < 3) return 1.3;
  if (effective <= 5) return 1.15;
  return 1.0;
}

/* ── Element icons ── */
const ELEMENT_ICONS: Record<string, any> = {
  fire: Flame, thunder: Zap, earth: Mountain, water: Droplets, nature: Leaf,
  wood: Leaf, shadow: Swords, gold: Zap,
};

/* ── Trilingual helper ── */
function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'en' ? en : lang === 'ms' ? ms : zh;
}

function getSkillName(skill: BattleSkillDef, lang: string): string {
  if (lang === 'ms' && skill.nameMs) return skill.nameMs;
  if (lang === 'zh' && skill.nameZh) return skill.nameZh;
  return skill.name;
}

/* ── HP bar color (Pokémon-style) ── */
function hpColor(ratio: number): string {
  if (ratio > 0.5) return '#22c55e';
  if (ratio > 0.2) return '#eab308';
  return '#ef4444';
}

/* ── Age → MCQ timer mapping ── */
function getTimerSeconds(age: number): number {
  if (age <= 6) return 8;
  if (age <= 9) return 6;
  return 4;
}

/* ── Transform raw bank question → BattleMCQQuestion ── */
function toBattleMCQ(bq: any): BattleMCQQuestion | null {
  // Only accept text MCQ (no image-answer questions)
  const inputType = bq.input_type || 'mcq';
  if (inputType !== 'mcq') return null;

  const optionsEn = Array.isArray(bq.options_en) ? bq.options_en : [];
  // Skip questions where answer options have images (IMAGE MCQ)
  const hasImageOptions = optionsEn.some((o: any) => o?.image);
  if (hasImageOptions) return null;
  if (optionsEn.length < 2) return null;

  const optionsMs = Array.isArray(bq.options_ms) ? bq.options_ms : [];
  const optionsZh = Array.isArray(bq.options_zh) ? bq.options_zh : [];

  const options = optionsEn.map((optEn: any, idx: number) => {
    const optMs = optionsMs[idx] || {};
    const optZh = optionsZh[idx] || {};
    return {
      id: optEn.id || String.fromCharCode(97 + idx),
      text: {
        en: typeof optEn === 'string' ? optEn : (optEn.text || ''),
        ms: typeof optMs === 'string' ? optMs : (optMs.text || ''),
        zh: typeof optZh === 'string' ? optZh : (optZh.text || ''),
      },
    };
  });

  return {
    id: bq.q_id || bq.id || `bq-${Math.random().toString(36).slice(2)}`,
    question: {
      en: bq.question_text_en || '',
      ms: bq.question_text_ms || '',
      zh: bq.question_text_zh || '',
    },
    questionImage: bq.image_url || undefined,
    options,
    correctAnswer: bq.correct_answer || 'a',
    dskpCode: bq.dskp_code || '',
    bankSubject: bq.subject || '',
    kssrLevel: bq.kssr_level || '',
    topic: bq.topic || '',
    skillName: bq.skill_name || '',
    _ageTarget: bq.age_target || null, // Add age target for sorting
    tts: (bq.tts_en || bq.tts_ms || bq.tts_zh) ? {
      en: bq.tts_en || undefined,
      ms: bq.tts_ms || undefined,
      zh: bq.tts_zh || undefined,
    } : undefined,
  };
}

/* ── Props ── */
export interface BattleScreenProps {
  myName: string;
  myLevel: number;
  opponentName: string;
  opponentLevel: number;
  stake: number;
  onBattleEnd: (result: 'win' | 'lose', remainingHP: number, maxHP: number) => void;
  onForfeit: (remainingHP: number, maxHP: number) => void;
  /** Child's age for MCQ difficulty + timer. Default 5. */
  age?: number;
  /** Foxy's realm HP ratio (0–1). Scales starting battle HP. Default 1 (full). */
  initialHpRatio?: number;
  /** Wild encounter: enables Lumicore catch mechanic in Bag. */
  isWildEncounter?: boolean;
  /** Spirit ID of the wild opponent — needed for catch/party-add. */
  opponentSpiritId?: string;
}

/* ═══════════════════════════════════════════
   HP BAR COMPONENT (Pokémon style)
   ═══════════════════════════════════════════ */
function HPBar({ current, max, showNumbers = true }: { current: number; max: number; showNumbers?: boolean }) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const color = hpColor(ratio);

  return (
    <div className="w-full">
      <div className="relative h-3 rounded-full overflow-hidden" style={{
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
          initial={{ width: '100%' }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 rounded-full" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 60%)',
        }} />
      </div>
      {showNumbers && (
        <div className="flex justify-end mt-0.5">
          <span style={{ fontFamily: CINZEL, fontSize: 9, color: '#c8b88a' }}>
            {Math.round(current)} / {Math.round(max)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   STAT PLATE (name + level + HP)
   ═════════════════════════════════════════��═ */
function StatPlate({ name, level, hp, maxHp, side }: {
  name: string; level: number; hp: number; maxHp: number; side: 'left' | 'right';
}) {
  return (
    <motion.div
      className="rounded-xl px-3 py-2"
      style={{
        background: 'rgba(10,8,18,0.85)',
        border: '1.5px solid rgba(212,164,74,0.25)',
        backdropFilter: 'blur(8px)',
        minWidth: 155,
      }}
      initial={{ opacity: 0, x: side === 'left' ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: 'spring' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span style={{ fontFamily: F, fontSize: 12, color: '#f0e6d0' }}>{name}</span>
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            fontFamily: CINZEL, fontSize: 9,
            color: '#d4a44a', background: 'rgba(212,164,74,0.12)',
            border: '1px solid rgba(212,164,74,0.2)',
          }}
        >
          Lv{level}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontFamily: CINZEL, fontSize: 8, color: '#22c55e' }}>HP</span>
        <div className="flex-1">
          <HPBar current={hp} max={maxHp} />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   SKILL BUTTON
   ════════════════════════════════════════ */
function SkillButton({ skill, lang, onSelect, iconUrl, disabled }: {
  skill: BattleSkillDef; lang: string; onSelect: (skill: BattleSkillDef) => void;
  iconUrl?: string | null; disabled?: boolean;
}) {
  const Icon = ELEMENT_ICONS[skill.element] || Zap;
  return (
    <motion.button
      onClick={() => !disabled && onSelect(skill)}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left w-full"
      style={{
        background: `${skill.color}15`,
        border: `1.5px solid ${skill.color}40`,
        opacity: disabled ? 0.5 : 1,
      }}
      whileHover={!disabled ? { scale: 1.02, borderColor: skill.color + '80' } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: `${skill.color}20`,
          border: `1px solid ${skill.color}30`,
          boxShadow: `0 0 10px ${skill.glowColor || skill.color}25`,
        }}
      >
        {iconUrl ? (
          <img src={iconUrl} alt="" className="w-5 h-5 object-contain" />
        ) : (
          <Icon size={18} style={{ color: skill.color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontFamily: F, fontSize: 11, color: '#f0e6d0' }}>
          {getSkillName(skill, lang)}
        </p>
        <p style={{ fontFamily: CINZEL, fontSize: 8, color: skill.color }}>
          DMG {skill.baseDamage}
        </p>
      </div>
      <div className="px-1.5 py-0.5 rounded-full" style={{ background: `${skill.color}20` }}>
        <Icon size={10} style={{ color: skill.color }} />
      </div>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════
   MAIN BATTLE SCREEN
   ═══════════════════════════════════════════ */
export function BattleScreen({
  myName, myLevel, opponentName, opponentLevel,
  stake, onBattleEnd, onForfeit,
  age = 5,
  initialHpRatio = 1,
  isWildEncounter = false,
  opponentSpiritId,
}: BattleScreenProps) {
  const realm = useRealmContext();
  const { language } = useLanguage();

  /* ── Asset loading ── */
  const [assets, setAssets] = useState<{
    bgUrl: string | null; foxyBack: string | null; foxyFront: string | null;
  }>({ bgUrl: null, foxyBack: null, foxyFront: null });
  const [skills, setSkills] = useState<BattleSkillDef[]>([]);
  const [allAssets, setAllAssets] = useState<RPGAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false); // user must tap to start (enables audio)

  /* ── Battle state ── */
  // Load player equipment bonuses (ATK, DEF, max_hp, speed)
  const equipBonuses = loadEquipmentBonuses();
  const myMaxHP = calcHP(myLevel, equipBonuses.max_hp);
  const oppMaxHP = calcHP(opponentLevel); // opponent has no equipment data
  const [myHP, setMyHP] = useState(myMaxHP * initialHpRatio);
  const [oppHP, setOppHP] = useState(oppMaxHP);
  const [actionMode, setActionMode] = useState<'main' | 'fight' | 'bag' | 'switch'>('main');
  const [battleLog, setBattleLog] = useState<string>('');
  const [turn, setTurn] = useState(1);

  /* ── Party-aware battle spirit tracking ── */
  const party = realm.stats.party || [{ spiritId: 'foxy-stage-1', currentHp: 100 }, null, null, null, null];
  const [activeBattleIdx, setActiveBattleIdx] = useState(0); // index in party
  const [partyHP, setPartyHP] = useState<Record<number, number>>(() => {
    const hp: Record<number, number> = {};
    party.forEach((slot, i) => {
      if (slot) hp[i] = slot.currentHp > 0 ? myMaxHP : 0; // fainted spirits stay at 0
    });
    return hp;
  });

  // Spirit entity data for type/name resolution
  const [spiritEntityMap, setSpiritEntityMap] = useState<Record<string, any>>({});

  // Seed data lookup for moves
  const ALL_SPIRITS_SEED = [...FOXY_STAGES, ...WILD_SPIRITS];
  const getSeedSpirit = (spiritId: string) => ALL_SPIRITS_SEED.find(s => s.id === spiritId);

  // Load spirit entity data from KV for name/type resolution
  useEffect(() => {
    const map: Record<string, any> = {};
    for (const s of ALL_SPIRITS_SEED) {
      map[s.id] = s;
    }
    rpgGameListEntities('spirit').then((entities: any[]) => {
      for (const e of entities) {
        if (!map[e.id]) map[e.id] = e;
      }
      setSpiritEntityMap({ ...map });
    }).catch(() => setSpiritEntityMap({ ...map }));
  }, []);

  // Current active spirit info
  const activePartySlot = party[activeBattleIdx];
  const activeSpiritSeed = activePartySlot ? getSeedSpirit(activePartySlot.spiritId) : FOXY_STAGES[0];
  const activeSpiritName = activeSpiritSeed?.name || activePartySlot?.spiritId || 'Foxy';

  /* ── MCQ question pool ── */
  const [mcqPool, setMcqPool] = useState<BattleMCQQuestion[]>([]);
  const mcqIndexRef = useRef(0);
  const [mcqLoading, setMcqLoading] = useState(false);

  /* ── MCQ popup state ── */
  const [showMCQ, setShowMCQ] = useState(false);
  const [currentMCQ, setCurrentMCQ] = useState<BattleMCQQuestion | null>(null);
  const pendingSkillRef = useRef<BattleSkillDef | null>(null);
  const [animLocked, setAnimLocked] = useState(false); // lock actions during animation

  /** Ref for doCounterAttack (defined later; used by handleUseBagItem Lumicore catch-fail path) */
  const doCounterAttackRef = useRef<() => void>(() => {});

  /* ── Animation states ── */
  const [hitFlashVisible, setHitFlashVisible] = useState(false);
  const [hitParticlesVisible, setHitParticlesVisible] = useState(false);
  const [missFizzleVisible, setMissFizzleVisible] = useState(false);
  const [screenShaking, setScreenShaking] = useState(false);
  const [oppHitReaction, setOppHitReaction] = useState(false);
  const [playerMissReaction, setPlayerMissReaction] = useState(false);
  const [currentElement, setCurrentElement] = useState('fire');

  /* ── Counter-attack animation states ── */
  const [counterFlashVisible, setCounterFlashVisible] = useState(false);
  const [counterParticlesVisible, setCounterParticlesVisible] = useState(false);
  const [playerHitReaction, setPlayerHitReaction] = useState(false);

  /* ── Floating damage number states ── */
  const [oppDmgPopup, setOppDmgPopup] = useState<{ amount: number; key: number } | null>(null);
  const [myDmgPopup, setMyDmgPopup] = useState<{ amount: number; key: number } | null>(null);
  const dmgKeyRef = useRef(0);

  const showOppDamage = useCallback((amount: number) => {
    const key = ++dmgKeyRef.current;
    setOppDmgPopup({ amount, key });
    setTimeout(() => setOppDmgPopup(prev => prev?.key === key ? null : prev), 950);
  }, []);
  const showMyDamage = useCallback((amount: number) => {
    const key = ++dmgKeyRef.current;
    setMyDmgPopup({ amount, key });
    setTimeout(() => setMyDmgPopup(prev => prev?.key === key ? null : prev), 950);
  }, []);

  // Refs for latest HP (to avoid stale closures in counter-attack timeouts)
  const oppHPRef = useRef(oppHP);
  const myHPRef = useRef(myHP);
  useEffect(() => { oppHPRef.current = oppHP; }, [oppHP]);
  useEffect(() => { myHPRef.current = myHP; }, [myHP]);

  const timerSeconds = getTimerSeconds(age);

  /* ── Battle Bag: inventory + ephemeral buffs ── */
  const [bagItems, setBagItems] = useState<ShopItemDef[]>([]);
  const [bagInv, setBagInv] = useState<Record<string, number>>({});
  const [bagUsedThisBattle, setBagUsedThisBattle] = useState<Record<string, number>>({});
  const [shieldMultiplier, setShieldMultiplier] = useState(1); // 1 = no shield
  const [extraTimerSeconds, setExtraTimerSeconds] = useState(0);
  const [bagFeedback, setBagFeedback] = useState<string | null>(null);
  const shieldMultiplierRef = useRef(shieldMultiplier);
  useEffect(() => { shieldMultiplierRef.current = shieldMultiplier; }, [shieldMultiplier]);

  // Load inventory + battle-category shop items on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load inventory from RealmContext (KV-backed, survives sessions)
        const inv: Record<string, number> = realm.stats.inventory || {};

        // Fetch shop item definitions
        const shopRes = await fetchShopItems();
        if (cancelled) return;

        // Filter: all usable items the player owns (consumable + battle; exclude treasure/equipment)
        const allItems = (shopRes.items || []).filter((i: ShopItemDef) => i.isActive);
        const usableItems = allItems.filter(i => i.category !== 'treasure' && (inv[i.id] || 0) > 0);

        setBagItems(usableItems);
        setBagInv(inv);
        console.log(`[BattleScreen] Bag loaded: ${usableItems.length} usable items available`);
      } catch (err) {
        console.error('[BattleScreen] Failed to load bag items:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [realm.stats.inventory]);

  // Use a battle item
  const handleUseBagItem = useCallback((item: ShopItemDef) => {
    const owned = bagInv[item.id] || 0;
    if (owned <= 0) return;

    // Check per-battle limit
    const usedCount = bagUsedThisBattle[item.id] || 0;
    const limit = item.battleLimit || Infinity;
    if (usedCount >= limit) {
      setBagFeedback(t3('Limit reached!', 'Had dicapai!', '已达上限！', language));
      setTimeout(() => setBagFeedback(null), 1500);
      return;
    }

    // ── LUMICORE CATCH LOGIC ──
    const baseCatchRate = LUMICORE_CATCH_RATES[item.id];
    if (baseCatchRate !== undefined) {
      if (!isWildEncounter || !opponentSpiritId) {
        setBagFeedback(t3(
          'Lumicores only work in wild encounters!',
          'Lumicore hanya berfungsi dalam pertempuran liar!',
          '光核只能在野外遭遇中使用！',
          language,
        ));
        setTimeout(() => setBagFeedback(null), 2500);
        return;
      }

      // Consume the Lumicore
      const newInv = { ...bagInv, [item.id]: owned - 1 };
      if (newInv[item.id] <= 0) delete newInv[item.id];
      setBagInv(newInv);
      realm.setStats(prev => ({ ...prev, inventory: newInv }));
      setBagUsedThisBattle(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));

      // Calculate catch chance: baseRate × hpFactor × typeModifier
      const hpFactor = catchHpFactor(oppHP, oppMaxHP);
      const typeModifier = 1.0; // TODO: type advantage modifiers
      const finalRate = Math.min(0.99, baseCatchRate * hpFactor * typeModifier);

      setAnimLocked(true);
      setActionMode('main');

      const catchRatePercent = Math.round(finalRate * 100);
      setBattleLog(t3(
        `${myName} threw a ${item.name}!`,
        `${myName} melempar ${item.name}!`,
        `${myName}投出了${item.name}！`,
        language,
      ));
      setBagFeedback(t3(
        `Catch rate: ${catchRatePercent}%`,
        `Kadar tangkap: ${catchRatePercent}%`,
        `捕获率：${catchRatePercent}%`,
        language,
      ));

      // Dramatic pause before catch result
      setTimeout(() => {
        const roll = Math.random();
        if (roll < finalRate) {
          // ── CATCH SUCCESS ──
          playSfx('catch_success');
          setBattleLog(t3(
            `Gotcha! ${opponentName} was caught!`,
            `Berjaya! ${opponentName} telah ditangkap!`,
            `抓住了！${opponentName}被捕获了！`,
            language,
          ));
          setBagFeedback(t3('✨ Caught!', '✨ Ditangkap!', '✨ 捕获成功！', language));

          // Add to party or spiritlab
          const added = realm.addSpiritToParty(opponentSpiritId, oppMaxHP);
          if (!added) {
            realm.addToSpiritlab(opponentSpiritId, oppMaxHP);
            setTimeout(() => {
              setBattleLog(t3(
                `Party full! ${opponentName} sent to Spiritlab.`,
                `Parti penuh! ${opponentName} dihantar ke Spiritlab.`,
                `队伍已满！${opponentName}已送往灵兽仓。`,
                language,
              ));
            }, 1200);
          }

          // End battle as win after short delay
          setTimeout(() => {
            setAnimLocked(false);
            onBattleEnd('win', myHP, myMaxHP);
          }, 2200);
        } else {
          // ── CATCH FAILED ──
          playSfx('catch_fail');
          setBattleLog(t3(
            `${opponentName} broke free!`,
            `${opponentName} terlepas!`,
            `${opponentName}挣脱了！`,
            language,
          ));
          setBagFeedback(t3('Oh no! It escaped!', 'Aduh! Ia terlepas!', '糟糕！它逃脱了！', language));

          // Enemy gets a free attack
          setTimeout(() => {
            setBagFeedback(null);
            doCounterAttackRef.current();
          }, 1200);
        }
      }, 1500);

      return; // skip normal item logic
    }

    // Decrement inventory — local copy AND RealmContext (KV-persisted)
    const newInv = { ...bagInv, [item.id]: owned - 1 };
    if (newInv[item.id] <= 0) delete newInv[item.id];
    setBagInv(newInv);
    realm.setStats(prev => ({ ...prev, inventory: newInv }));

    // Increment per-battle usage
    setBagUsedThisBattle(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));

    // Apply each effect as an ephemeral buff
    let feedbackParts: string[] = [];
    for (const eff of (item.effects || [])) {
      if (eff.type === 'shield') {
        // Shield: value is the damage multiplier (e.g., 0.5 = take 50% damage)
        // If isPercent, treat value as reduction % (e.g., 50 = 50% reduction → multiply by 0.5)
        const mult = eff.isPercent ? Math.max(0, 1 - eff.value / 100) : Math.max(0, eff.value);
        setShieldMultiplier(prev => Math.min(prev, mult)); // keep strongest shield
        feedbackParts.push(t3(
          `Shield active! -${eff.isPercent ? eff.value : Math.round((1 - eff.value) * 100)}% DMG`,
          `Perisai aktif! -${eff.isPercent ? eff.value : Math.round((1 - eff.value) * 100)}% DMG`,
          `护盾激活！-${eff.isPercent ? eff.value : Math.round((1 - eff.value) * 100)}%伤害`,
          language,
        ));
      } else if (eff.type === 'time_extend') {
        const secs = eff.value;
        setExtraTimerSeconds(prev => prev + secs);
        feedbackParts.push(t3(
          `+${secs}s MCQ time`,
          `+${secs}s masa MCQ`,
          `+${secs}秒答题时间`,
          language,
        ));
      } else if (eff.type === 'hp') {
        // Heal during battle
        playSfx('heal');
        const healAmt = eff.isPercent ? Math.round(myMaxHP * eff.value / 100) : eff.value;
        setMyHP(prev => Math.min(myMaxHP, prev + healAmt));
        feedbackParts.push(t3(`+${healAmt} HP`, `+${healAmt} HP`, `+${healAmt} HP`, language));
      }
    }

    const feedback = feedbackParts.join(' · ') || item.name;
    setBagFeedback(feedback);
    setBattleLog(t3(
      `${myName} used ${item.name}! ${feedback}`,
      `${myName} guna ${item.name}! ${feedback}`,
      `${myName}使用了${item.name}！${feedback}`,
      language,
    ));
    setTimeout(() => setBagFeedback(null), 2000);
    setActionMode('main');
  }, [bagInv, bagUsedThisBattle, language, myMaxHP, myName, realm, isWildEncounter, opponentSpiritId, oppHP, oppMaxHP, onBattleEnd, myHP]);

  // Remaining bag items the player can use
  const usableBagItems = bagItems.filter(i => (bagInv[i.id] || 0) > 0);

  /* ── Load MCQ question pool (Bible v5: prioritize weak skill nodes) ── */
  const loadMCQPool = useCallback(async () => {
    setMcqLoading(true);
    try {
      console.log(`[BattleScreen] Loading MCQ pool for age ${age} (with weak-node priority)`);

      // Parallel fetch: questions + player's mastery profile
      const [allRaw, masteryProfile] = await Promise.all([
        fetchQuestionBank({}),
        fetchMasteryProfile().catch(() => null), // graceful fallback if auth fails
      ]);

      // Build weak-node subject/skill sets from mastery profile
      // Weak = accuracy < 60% (with at least 3 attempts) OR never-attempted subjects
      const weakSubjects = new Set<string>();
      const weakSkillCodes = new Set<string>();
      const ALL_SUBJECTS = ['english', 'numbers', 'bahasa', 'mandarin', 'science', 'sejarah', 'geography'];
      const attemptedSubjects = new Set<string>();

      if (masteryProfile?.subjects) {
        for (const subj of masteryProfile.subjects) {
          attemptedSubjects.add(subj.subjectId);
          if (subj.totalAttempts >= 3 && subj.percentage < 60) {
            weakSubjects.add(subj.subjectId);
            // Also collect weak topic skill codes
            for (const topic of (subj.topics || [])) {
              if (topic.totalAttempts >= 2 && topic.percentage < 60) {
                for (const sc of topic.skillCodes) weakSkillCodes.add(sc);
              }
            }
          }
        }
        // Subjects never attempted = also weak
        for (const sid of ALL_SUBJECTS) {
          if (!attemptedSubjects.has(sid)) weakSubjects.add(sid);
        }
      }

      console.log(`[BattleScreen] Weak nodes: ${weakSubjects.size} subjects, ${weakSkillCodes.size} skill codes`);

      // Transform + filter: only text MCQ
      const transformed = allRaw
        .map(toBattleMCQ)
        .filter((q): q is BattleMCQQuestion => q !== null);

      // Deduplicate by ID
      const seen = new Set<string>();
      const deduped = transformed.filter(q => {
        if (seen.has(q.id)) return false;
        seen.add(q.id);
        return true;
      });

      // 3-tier priority sort (Bible v5: draw from player's weak skill nodes first)
      const isWeakQ = (q: BattleMCQQuestion) => {
        const subj = (q.bankSubject || '').toLowerCase();
        return weakSubjects.has(subj) || weakSkillCodes.has(q.dskpCode || '');
      };
      const isAgeMatch = (q: BattleMCQQuestion) => q._ageTarget === age || q._ageTarget == null;

      const tier1 = deduped.filter(q => isWeakQ(q) && isAgeMatch(q));  // weak + age-matched (best)
      const tier2 = deduped.filter(q => !isWeakQ(q) && isAgeMatch(q)); // normal age-matched
      const tier3 = deduped.filter(q => !isAgeMatch(q));               // other ages
      const shuffleArr = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
      const unique = [...shuffleArr(tier1), ...shuffleArr(tier2), ...shuffleArr(tier3)];

      console.log(`[BattleScreen] MCQ pool loaded: ${unique.length} questions (${tier1.length} weak-node, ${tier2.length} age-matched, ${tier3.length} other)`);
      setMcqPool(unique);
      mcqIndexRef.current = 0;
    } catch (err) {
      console.error('[BattleScreen] Failed to load MCQ pool:', err);
      setMcqPool([]);
    } finally {
      setMcqLoading(false);
    }
  }, [age]);

  /* ── Get next MCQ question from pool ── */
  const getNextMCQ = useCallback((): BattleMCQQuestion | null => {
    if (mcqPool.length === 0) return null;
    const idx = mcqIndexRef.current % mcqPool.length;
    mcqIndexRef.current = idx + 1;

    // If we've cycled through all questions, trigger a background refetch
    if (mcqIndexRef.current >= mcqPool.length) {
      console.log('[BattleScreen] MCQ pool exhausted, will reshuffle');
      setMcqPool(prev => [...prev].sort(() => Math.random() - 0.5));
      mcqIndexRef.current = 0;
    }

    return mcqPool[idx];
  }, [mcqPool]);

  /* ── Load assets + skills + MCQ pool on mount ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [assetRes, skillRes] = await Promise.all([
          fetchRPGAssets(),
          fetchBattleSkills(),
        ]);
        if (cancelled) return;

        const fetched = assetRes.assets || [];
        setAllAssets(fetched);
        const find = (slug: string) => fetched.find(a => a.slug === slug)?.publicUrl || null;

        setAssets({
          bgUrl: find('battle-ground'),
          foxyBack: find('foxy_back'),
          foxyFront: find('foxy-practice'),
        });

        const activeSkills = (skillRes.skills || []).filter(s => s.isActive);

        // ── Pokémon-style: only show the active spirit's moves (4 weakest) ──
        // Active spirit is derived from party slot; defaults to Foxkit.
        const activeSpirit = activeSpiritSeed || FOXY_STAGES[0];
        const spiritMoveSlugs = new Set(activeSpirit.moves.map(m => moveSlug(m.name)));
        const spiritSkills = activeSkills
          .filter(s => spiritMoveSlugs.has(s.id))
          .sort((a, b) => (a.baseDamage ?? 0) - (b.baseDamage ?? 0)) // weakest first
          .slice(0, MAX_BATTLE_SKILLS);

        // Fallback: if no spirit-specific skills found (sync hasn't happened), show 4 weakest from all
        const finalSkills = spiritSkills.length > 0
          ? spiritSkills
          : activeSkills
              .sort((a, b) => (a.baseDamage ?? 0) - (b.baseDamage ?? 0))
              .slice(0, MAX_BATTLE_SKILLS);

        setSkills(finalSkills);
        console.log(`[BattleScreen] Spirit "${activeSpirit.name}" → ${finalSkills.length} moves (of ${activeSkills.length} total skills)`);

        setBattleLog(t3(
          `A wild ${opponentName} appeared!`,
          `${opponentName} liar muncul!`,
          `野生的${opponentName}出现了！`,
          language,
        ));
        setLoaded(true);
      } catch (err) {
        console.error('[BattleScreen] Load error:', err);
        setBattleLog('Failed to load battle data...');
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [opponentName, language]);

  // Load MCQ pool separately (so it can be re-triggered)
  useEffect(() => { loadMCQPool(); }, [loadMCQPool]);

  /* ── Reload skills when active battle spirit changes ── */
  const loadSkillsForSpirit = useCallback(async (spirit: typeof FOXY_STAGES[0]) => {
    try {
      const skillRes = await fetchBattleSkills();
      const activeSkills = (skillRes.skills || []).filter((s: BattleSkillDef) => s.isActive);
      const spiritMoveSlugs = new Set(spirit.moves.map(m => moveSlug(m.name)));
      const spiritSkills = activeSkills
        .filter((s: BattleSkillDef) => spiritMoveSlugs.has(s.id))
        .sort((a: BattleSkillDef, b: BattleSkillDef) => (a.baseDamage ?? 0) - (b.baseDamage ?? 0))
        .slice(0, MAX_BATTLE_SKILLS);
      const finalSkills = spiritSkills.length > 0
        ? spiritSkills
        : activeSkills.sort((a: BattleSkillDef, b: BattleSkillDef) => (a.baseDamage ?? 0) - (b.baseDamage ?? 0)).slice(0, MAX_BATTLE_SKILLS);
      setSkills(finalSkills);
      console.log(`[BattleScreen] Switched to "${spirit.name}" → ${finalSkills.length} moves`);
    } catch (err) {
      console.error('[BattleScreen] Failed to reload skills for spirit:', err);
    }
  }, []);

  /* ── Handle Switch Spirit (costs 1 turn) ── */
  const handleSwitchSpirit = useCallback((partyIdx: number) => {
    if (animLocked || partyIdx === activeBattleIdx) return;
    const targetSlot = party[partyIdx];
    if (!targetSlot) return;
    const targetHP = partyHP[partyIdx] ?? 0;
    if (targetHP <= 0) return; // can't switch to fainted spirit

    setAnimLocked(true);

    // Save current spirit's HP
    setPartyHP(prev => ({ ...prev, [activeBattleIdx]: myHP }));

    // Switch
    const targetSeed = getSeedSpirit(targetSlot.spiritId) || FOXY_STAGES[0];
    const targetName = targetSeed.name || targetSlot.spiritId;

    setActiveBattleIdx(partyIdx);
    setMyHP(targetHP);

    // Reload skills for new spirit
    loadSkillsForSpirit(targetSeed);

    setBattleLog(t3(
      `${myName} switched to ${targetName}!`,
      `${myName} bertukar ke ${targetName}!`,
      `${myName}换上了${targetName}！`,
      language,
    ));
    setActionMode('main');

    // Enemy gets a free attack on the incoming spirit (use ref to avoid TDZ)
    setTimeout(() => {
      doCounterAttackRef.current();
    }, 800);
  }, [animLocked, activeBattleIdx, party, partyHP, myHP, myName, language, loadSkillsForSpirit]);

  /* ── Check for party wipe (all fainted) ── */
  useEffect(() => {
    if (!battleStarted) return;
    const allFainted = party.every((slot, i) => {
      if (!slot) return true; // empty slot
      const hp = i === activeBattleIdx ? myHP : (partyHP[i] ?? 0);
      return hp <= 0;
    });
    if (allFainted && myHP <= 0) {
      // Already handled by normal KO logic
    }
  }, [myHP, partyHP, party, activeBattleIdx, battleStarted]);

  // ── Battle BGM: stop on unmount (BGM is started in the "Tap to Battle" click handler) ──
  useEffect(() => {
    if (!battleStarted) return;
    // BGM already started in click handler (user-gesture context).
    // Only register cleanup to stop it on unmount.
    return () => { stopBattleBGM(); };
  }, [battleStarted]);

  /* ── Skill icon URL helper ── */
  const getSkillIconUrl = useCallback((slug: string) => {
    if (!slug) return null;
    return allAssets.find(a => a.slug === slug)?.publicUrl || null;
  }, [allAssets]);

  /* ── Opponent counter-attack logic (reusable) ── */
  const doCounterAttack = useCallback(() => {
    const oppATK = calcATK(opponentLevel); // opponent has no equipment
    const myDEF = calcDEF(equipBonuses.defense); // player DEF = equipment only
    const rawCounterDmg = Math.max(1, Math.round((oppATK - myDEF) * (0.8 + Math.random() * 0.4)));

    // Apply shield buff (reduces incoming damage)
    const shield = shieldMultiplierRef.current;
    const counterDmg = Math.max(1, Math.round(rawCounterDmg * shield));
    const shieldActive = shield < 1;

    // Phase 1: Show "charging" message
    setBattleLog(t3(
      `${opponentName} prepares to strike!`,
      `${opponentName} bersiap menyerang!`,
      `${opponentName}准备反击！`,
      language,
    ));

    // Phase 2: After 0.6s, play counter-attack animations + deal damage
    setTimeout(() => {
      playSfx(shieldActive ? 'shield' : 'counter');
      setCounterFlashVisible(true);
      setCounterParticlesVisible(true);
      setScreenShaking(true);
      setPlayerHitReaction(true);
      showMyDamage(counterDmg);

      setMyHP(prev => {
        const next = Math.max(0, prev - counterDmg);
        if (next <= 0) {
          playSfx('ko');
          // Check if any other party spirit is still alive
          const hasAlivePartyMember = party.some((slot, i) => {
            if (!slot || i === activeBattleIdx) return false;
            return (partyHP[i] ?? 0) > 0;
          });
          if (hasAlivePartyMember) {
            // Force switch: save fainted HP, open switch panel
            setTimeout(() => {
              setPartyHP(p => ({ ...p, [activeBattleIdx]: 0 }));
              setBattleLog(t3(
                'Your spirit fainted! Choose another!',
                'Spirit anda pengsan! Pilih yang lain!',
                '你的灵兽倒下了！请选择另一只！',
                language,
              ));
              setActionMode('switch');
              setAnimLocked(false);
            }, 800);
          } else {
            // Total party wipe = defeat
            setTimeout(() => { playSfx('defeat'); stopBattleBGM(); }, 600);
            setTimeout(() => onBattleEnd('lose', next, myMaxHP), 1200);
          }
        }
        return next;
      });

      const shieldNote = shieldActive
        ? t3(' (Shield absorbed some damage!)', ' (Perisai menyerap sebahagian!)', ' (护盾吸收了部分伤害！)', language)
        : '';
      setBattleLog(t3(
        `${opponentName} strikes back! ${counterDmg} damage!${shieldNote}`,
        `${opponentName} menyerang balas! ${counterDmg} kerosakan!${shieldNote}`,
        `${opponentName}反击了！造成${counterDmg}点伤害！${shieldNote}`,
        language,
      ));

      // Phase 3: Clear counter animations after 700ms
      setTimeout(() => {
        setCounterFlashVisible(false);
        setCounterParticlesVisible(false);
        setScreenShaking(false);
        setPlayerHitReaction(false);
        setTurn(t => t + 1);
        setAnimLocked(false);
      }, 700);
    }, 600);
  }, [opponentLevel, equipBonuses, opponentName, language, onBattleEnd, myMaxHP, showMyDamage, party, activeBattleIdx, partyHP]);

  // Keep ref in sync for use by handleUseBagItem (Lumicore catch-fail path)
  useEffect(() => { doCounterAttackRef.current = doCounterAttack; }, [doCounterAttack]);

  /* ═══════════════════════════════════════
     MCQ GATED SKILL FLOW
     ══════════════════════════════════════ */

  /** Step 1: Player picks a skill → show MCQ popup */
  const handleSkillSelect = useCallback((skill: BattleSkillDef) => {
    if (animLocked) return;

    const question = getNextMCQ();
    if (!question) {
      // No MCQ questions in pool — block the attack and warn the player.
      // This happens when the PG `questions` table is empty (migration not yet run).
      console.warn('[BattleScreen] No MCQ questions available — blocking attack');
      toast.error(t3(
        'No questions loaded! Ask your teacher to add questions first.',
        'Tiada soalan dimuat! Minta guru anda menambah soalan dahulu.',
        '没有加载题目！请让老师先添加题目。',
        language,
      ));
      setBattleLog(t3(
        'The spell fizzled… No questions available!',
        'Mantera gagal… Tiada soalan tersedia!',
        '咒语失败了…没有可用的题目！',
        language,
      ));
      // Try reloading MCQ pool in background
      loadMCQPool();
      return;
    }

    playSfx('select');
    pendingSkillRef.current = skill;
    setCurrentElement(skill.element || 'fire');
    setCurrentMCQ(question);
    setShowMCQ(true);
    setActionMode('main');

    const skillName = getSkillName(skill, language);
    setBattleLog(t3(
      `${myName} prepares ${skillName}... Answer to attack!`,
      `${myName} sediakan ${skillName}... Jawab untuk menyerang!`,
      `${myName}准备使用${skillName}…回答问题来攻击！`,
      language,
    ));
  }, [animLocked, getNextMCQ, language, myName, loadMCQPool]);

  /** Fallback: direct damage if no MCQ pool */
  const handleDirectDamage = useCallback((skill: BattleSkillDef) => {
    setAnimLocked(true);
    const myATK = calcATK(myLevel, equipBonuses.attack); // player ATK with equipment
    const oppDEF = calcDEF(); // opponent has no equipment → DEF = 0
    const rawDmg = Math.max(1, skill.baseDamage + myATK - oppDEF);
    const dmg = Math.max(1, Math.round(rawDmg * (0.8 + Math.random() * 0.4)));

    // Play hit animation + SFX
    playSfx('hit');
    setCurrentElement(skill.element || 'fire');
    setHitFlashVisible(true);
    setHitParticlesVisible(true);
    setScreenShaking(true);
    setOppHitReaction(true);
    showOppDamage(dmg);

    setTimeout(() => {
      setHitFlashVisible(false);
      setHitParticlesVisible(false);
      setScreenShaking(false);
      setOppHitReaction(false);
    }, 700);

    setOppHP(prev => {
      const next = Math.max(0, prev - dmg);
      if (next <= 0) {
        playSfx('ko'); setTimeout(() => { playSfx('victory'); stopBattleBGM(); }, 600);
        setTimeout(() => onBattleEnd('win', myHPRef.current, myMaxHP), 1200);
        setAnimLocked(false);
      }
      return next;
    });

    const skillName = getSkillName(skill, language);
    setBattleLog(t3(
      `${myName} used ${skillName}! ${dmg} damage!`,
      `${myName} guna ${skillName}! ${dmg} kerosakan!`,
      `${myName}使用了${skillName}！造成${dmg}点伤害！`,
      language,
    ));
    setActionMode('main');

    // Counter-attack after animation
    setTimeout(() => {
      if (oppHPRef.current <= 0) { setAnimLocked(false); return; }
      doCounterAttack();
    }, 1800);
  }, [myLevel, opponentLevel, equipBonuses, myName, language, onBattleEnd, doCounterAttack, myMaxHP, showOppDamage]);

  /** Step 2a: MCQ answered correctly → hit animation + deal damage with speed bonus */
  const handleMCQCorrect = useCallback((elapsedSeconds: number) => {
    // Record mastery answer (fire & forget) — capture before nulling
    if (currentMCQ) {
      recordMasteryAnswers([{
        subjectId: (currentMCQ.bankSubject || 'mixed').toLowerCase(),
        skillCode: currentMCQ.dskpCode || currentMCQ.id || 'BATTLE-Q',
        topicName: currentMCQ.topic || 'Battle',
        isCorrect: true,
        mode: 'battle',
        level: currentMCQ.kssrLevel || '',
        skillName: currentMCQ.skillName || '',
      }]).catch(err => console.error('[BATTLE] Mastery record failed:', err));
    }

    setShowMCQ(false);
    setCurrentMCQ(null);
    setAnimLocked(true);

    const skill = pendingSkillRef.current;
    if (!skill) { setAnimLocked(false); return; }

    // Bible v5: damage = (baseATK + equip_ATK + skill) × speed_bonus – equip_DEF (min 1)
    const speedBonus = calcSpeedBonus(elapsedSeconds, equipBonuses.speed);
    const myATK = calcATK(myLevel, equipBonuses.attack);
    const oppDEF = calcDEF(); // opponent has no equipment → DEF = 0
    const rawDmg = Math.max(1, Math.round((skill.baseDamage + myATK) * speedBonus) - oppDEF);
    const dmg = Math.max(1, Math.round(rawDmg * (0.8 + Math.random() * 0.4)));

    // 🎯 HIT ANIMATION + SFX: flash + particles + shake + opponent reaction
    playSfx(speedBonus >= 1.3 ? 'critical' : 'hit');
    setCurrentElement(skill.element || 'fire');
    setHitFlashVisible(true);
    setHitParticlesVisible(true);
    setScreenShaking(true);
    setOppHitReaction(true);
    showOppDamage(dmg);

    const skillName = getSkillName(skill, language);
    const speedLabel = speedBonus > 1.0
      ? (speedBonus >= 1.3
        ? t3(' ⚡Lightning!', ' ⚡Kilat!', ' ⚡闪电！', language)
        : t3(' 🏃Fast!', ' 🏃Pantas!', ' 🏃快速！', language))
      : '';
    setBattleLog(t3(
      `${myName} used ${skillName}! ${dmg} damage!${speedLabel}`,
      `${myName} guna ${skillName}! ${dmg} kerosakan!${speedLabel}`,
      `${myName}使用了${skillName}！造成${dmg}点伤害！${speedLabel}`,
      language,
    ));

    // Clear hit animations after 700ms
    setTimeout(() => {
      setHitFlashVisible(false);
      setHitParticlesVisible(false);
      setScreenShaking(false);
      setOppHitReaction(false);
    }, 700);

    // Apply damage
    setOppHP(prev => {
      const next = Math.max(0, prev - dmg);
      if (next <= 0) {
        playSfx('ko'); setTimeout(() => { playSfx('victory'); stopBattleBGM(); }, 600);
        setTimeout(() => onBattleEnd('win', myHPRef.current, myMaxHP), 1200);
        setTimeout(() => setAnimLocked(false), 1200);
      }
      return next;
    });

    // Opponent counter-attack after 2s
    setTimeout(() => {
      if (oppHPRef.current <= 0) { setAnimLocked(false); return; }
      doCounterAttack();
    }, 2000);

    pendingSkillRef.current = null;
  }, [currentMCQ, myLevel, opponentLevel, equipBonuses, myName, language, onBattleEnd, doCounterAttack, myMaxHP, showOppDamage]);

  /** Step 2b: MCQ answered wrong or timed out → fizzle miss + opponent counter */
  const handleMCQWrong = useCallback(() => {
    // Record mastery answer (fire & forget) — capture before nulling
    if (currentMCQ) {
      recordMasteryAnswers([{
        subjectId: (currentMCQ.bankSubject || 'mixed').toLowerCase(),
        skillCode: currentMCQ.dskpCode || currentMCQ.id || 'BATTLE-Q',
        topicName: currentMCQ.topic || 'Battle',
        isCorrect: false,
        mode: 'battle',
        level: currentMCQ.kssrLevel || '',
        skillName: currentMCQ.skillName || '',
      }]).catch(err => console.error('[BATTLE] Mastery record failed:', err));
    }

    setShowMCQ(false);
    setCurrentMCQ(null);
    setAnimLocked(true);

    const skill = pendingSkillRef.current;
    const skillName = skill ? getSkillName(skill, language) : '???';

    // 💨 MISS ANIMATION + SFX: fizzle puff + player dip
    playSfx('miss');
    setMissFizzleVisible(true);
    setPlayerMissReaction(true);

    setBattleLog(t3(
      `${myName}'s ${skillName} missed!`,
      `${skillName} ${myName} terlepas!`,
      `${myName}的${skillName}落空了！`,
      language,
    ));

    // Clear miss animations
    setTimeout(() => {
      setMissFizzleVisible(false);
      setPlayerMissReaction(false);
    }, 700);

    // Opponent counter-attack (normal damage, skill missed entirely)
    setTimeout(() => {
      doCounterAttack();
    }, 1500);

    pendingSkillRef.current = null;
  }, [currentMCQ, myName, language, doCounterAttack]);

  /* ── Handle Run ── */
  const handleRun = useCallback(() => {
    if (animLocked) return;
    setBattleLog(t3(
      `${myName} fled from battle!`,
      `${myName} melarikan diri!`,
      `${myName}逃跑了！`,
      language,
    ));
    setTimeout(() => onForfeit(myHP, myMaxHP), 1000);
  }, [myName, language, onForfeit, animLocked, myHP, myMaxHP]);

  /* ── Loading state ── */
  if (!loaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{
        background: 'linear-gradient(180deg, #0a0a12 0%, #1a1020 50%, #0a0a12 100%)',
      }}>
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Swords className="w-10 h-10" style={{ color: '#d4a44a' }} />
          </motion.div>
          <p style={{ fontFamily: F, fontSize: 14, color: '#d4a44a' }}>
            {t3('Preparing battle...', 'Menyediakan pertempuran...', '准备战斗...', language)}
          </p>
        </motion.div>
      </div>
    );
  }

  /* ── "Tap to Start" interstitial (needed for browser audio policy) ── */
  if (!battleStarted) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center cursor-pointer"
        style={{
          background: 'linear-gradient(180deg, #0a0a12 0%, #1a1020 50%, #0a0a12 100%)',
        }}
        onClick={async () => {
          // MUST call startBattleBGM() directly in click handler to satisfy
          // browser's Web Audio API user-gesture requirement.
          await startBattleBGM();
          setBattleStarted(true);
        }}
      >
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Swords className="w-14 h-14" style={{ color: '#d4a44a', filter: 'drop-shadow(0 0 12px rgba(212,164,74,0.5))' }} />
          </motion.div>
          <p style={{ fontFamily: CINZEL, fontSize: 18, color: '#d4a44a', textShadow: '0 0 20px rgba(212,164,74,0.3)' }}>
            {t3(
              `A wild ${opponentName} appeared!`,
              `${opponentName} liar muncul!`,
              `野生的${opponentName}出现了！`,
              language,
            )}
          </p>
          <motion.div
            className="mt-3 px-8 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #d4a44a 0%, #b8860b 100%)',
              boxShadow: '0 0 25px rgba(212,164,74,0.4)',
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <p style={{ fontFamily: F, fontSize: 16, color: '#1a1020', fontWeight: 'bold' }}>
              {t3('Tap to Battle!', 'Ketuk untuk Bertarung!', '点击开始战斗！', language)}
            </p>
          </motion.div>
          {mcqLoading ? (
            <p style={{ fontFamily: F, fontSize: 10, color: '#aaa', marginTop: 4 }}>
              {t3('Loading questions...', 'Memuat soalan...', '加载题目中...', language)}
            </p>
          ) : mcqPool.length > 0 ? (
            <p style={{ fontFamily: F, fontSize: 10, color: '#888', marginTop: 4 }}>
              {t3(
                `${mcqPool.length} questions loaded`,
                `${mcqPool.length} soalan dimuat`,
                `已加载${mcqPool.length}道题目`,
                language,
              )}
            </p>
          ) : (
            <p style={{ fontFamily: F, fontSize: 11, color: '#e74c3c', marginTop: 8, maxWidth: 260, textAlign: 'center', lineHeight: 1.4 }}>
              {t3(
                '⚠️ No questions found! Attacks will be blocked. Please upload questions via SuperAdmin.',
                '⚠️ Tiada soalan ditemui! Serangan akan disekat. Sila muat naik soalan melalui SuperAdmin.',
                '⚠️ 未找到题目！攻击将被阻止。请通过超级管理员上传题目。',
                language,
              )}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // True KO only if ALL party spirits are fainted (or opponent is KO'd)
  const hasAlivePartyBackup = party.some((slot, i) => {
    if (!slot || i === activeBattleIdx) return false;
    return (partyHP[i] ?? 0) > 0;
  });
  const isKO = (myHP <= 0 && !hasAlivePartyBackup) || oppHP <= 0;
  const actionsDisabled = animLocked || showMCQ;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* ═══════════════════════════════════
          BATTLE ARENA (top ~55%)
         ══════════════════════════════════ */}
      <div className="relative flex-1 min-h-0">
        <ScreenShake active={screenShaking}>
          <div className="relative w-full h-full">
            {/* Background */}
            {assets.bgUrl ? (
              <img
                src={assets.bgUrl}
                alt="Battle Arena"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
              }} />
            )}

            {/* Dark overlay for readability */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)',
            }} />

            {/* ── Opponent (top-right) ── */}
            <div className="absolute z-10" style={{ top: '18%', right: '5%', width: 'auto' }}>
              <HPBarPulse ratio={oppMaxHP > 0 ? oppHP / oppMaxHP : 1}>
                <StatPlate
                  name={opponentName}
                  level={opponentLevel}
                  hp={oppHP}
                  maxHp={oppMaxHP}
                  side="right"
                />
              </HPBarPulse>
            </div>

            {/* Opponent Foxy sprite (front view) */}
            <motion.div
              className="absolute z-5"
              style={{ bottom: '28%', right: '10%', width: '42%', maxWidth: 200 }}
              initial={{ opacity: 0, x: 60, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
            >
              <LowHPPulse ratio={oppMaxHP > 0 ? oppHP / oppMaxHP : 1}>
                <OpponentHitReaction hit={oppHitReaction}>
                  {assets.foxyFront ? (
                    <motion.img
                      src={assets.foxyFront}
                      alt="Opponent"
                      className="w-full h-auto drop-shadow-2xl"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : (
                    <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.4)' }}>
                      <span style={{ fontSize: 40 }}>🐺</span>
                    </div>
                  )}
                </OpponentHitReaction>
              </LowHPPulse>
              <div className="mx-auto mt-1 rounded-full" style={{
                width: '70%', height: 8,
                background: 'radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)',
              }} />
            </motion.div>

            {/* ── Your Foxy (bottom-left) ── */}
            <motion.div
              className="absolute overflow-hidden"
              style={{ bottom: 0, left: '2%', width: '52%', maxWidth: 220, height: '38%', zIndex: 5 }}
              initial={{ opacity: 0, x: -60, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
            >
              <LowHPPulse ratio={myMaxHP > 0 ? myHP / myMaxHP : 1}>
                <PlayerHitReaction hit={playerHitReaction}>
                  <PlayerMissReaction miss={playerMissReaction}>
                    {assets.foxyBack ? (
                      <motion.img
                        src={assets.foxyBack}
                        alt="Your Foxy"
                        className="w-full h-auto drop-shadow-2xl"
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : (
                      <div className="w-28 h-28 mx-auto rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(167,139,250,0.2)', border: '2px solid rgba(167,139,250,0.4)' }}>
                        <span style={{ fontSize: 48 }}>🦊</span>
                      </div>
                    )}
                  </PlayerMissReaction>
                </PlayerHitReaction>
              </LowHPPulse>
            </motion.div>

            {/* Your HP plate (bottom-right of arena) — shows active spirit name */}
            <div className="absolute bottom-3 right-3 z-10">
              <HPBarPulse ratio={myMaxHP > 0 ? myHP / myMaxHP : 1}>
                <StatPlate
                  name={activeSpiritName}
                  level={myLevel}
                  hp={myHP}
                  maxHp={myMaxHP}
                  side="right"
                />
              </HPBarPulse>
            </div>

            {/* Turn counter */}
            <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-lg" style={{
              background: 'rgba(10,8,18,0.7)',
              border: '1px solid rgba(212,164,74,0.2)',
            }}>
              <span style={{ fontFamily: CINZEL, fontSize: 9, color: '#d4a44a' }}>
                Turn {turn}
              </span>
            </div>

            {/* ── Animation overlays ── */}
            <HitFlash element={currentElement} visible={hitFlashVisible} />
            <HitParticles element={currentElement} visible={hitParticlesVisible} />
            <MissFizzle visible={missFizzleVisible} />
            <CounterFlash visible={counterFlashVisible} />
            <CounterParticles visible={counterParticlesVisible} />

            {/* ── Floating damage numbers ── */}
            {oppDmgPopup && (
              <FloatingDamageNumber
                key={oppDmgPopup.key}
                amount={oppDmgPopup.amount}
                visible={true}
                position="opponent"
              />
            )}
            {myDmgPopup && (
              <FloatingDamageNumber
                key={myDmgPopup.key}
                amount={myDmgPopup.amount}
                visible={true}
                position="player"
              />
            )}

            {/* KO Flash */}
            <AnimatePresence>
              {isKO && (
                <motion.div
                  className="absolute inset-0 z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0, 0.8, 0] }}
                  transition={{ duration: 0.8 }}
                  style={{ background: 'white' }}
                />
              )}
            </AnimatePresence>
          </div>
        </ScreenShake>
      </div>

      {/* ═══════════════════════════════════
          BOTTOM PANEL (~45%)
         ══════════════════════════════════ */}
      <div className="shrink-0" style={{
        background: 'linear-gradient(180deg, #0f0b1a 0%, #1a1428 100%)',
        borderTop: '2px solid rgba(212,164,74,0.2)',
      }}>
        {/* Message box */}
        <div className="px-4 py-2.5" style={{
          borderBottom: '1px solid rgba(212,164,74,0.1)',
          minHeight: 44,
        }}>
          <motion.p
            key={battleLog}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: F, fontSize: 12, color: '#e8dcc8', lineHeight: 1.4 }}
          >
            {battleLog}
          </motion.p>
        </div>

        {/* Action area */}
        <div className="px-3 py-3 pb-5">
          <AnimatePresence mode="wait">
            {/* ── MAIN ACTIONS ── */}
            {actionMode === 'main' && !isKO && (
              <motion.div
                key="main-actions"
                className="grid grid-cols-2 gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {/* FIGHT */}
                <motion.button
                  onClick={() => !actionsDisabled && setActionMode('fight')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))',
                    border: '1.5px solid rgba(239,68,68,0.35)',
                    opacity: actionsDisabled ? 0.5 : 1,
                  }}
                  whileTap={!actionsDisabled ? { scale: 0.95 } : {}}
                >
                  <Swords size={18} style={{ color: '#ef4444' }} />
                  <span style={{ fontFamily: F, fontSize: 14, color: '#ef4444' }}>
                    {t3('Fight', 'Lawan', '战斗', language)}
                  </span>
                </motion.button>

                {/* BAG */}
                <motion.button
                  onClick={() => !actionsDisabled && setActionMode('bag')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.1))',
                    border: '1.5px solid rgba(234,179,8,0.35)',
                    opacity: actionsDisabled ? 0.5 : 1,
                  }}
                  whileTap={!actionsDisabled ? { scale: 0.95 } : {}}
                >
                  <ShoppingBag size={18} style={{ color: '#eab308' }} />
                  <span style={{ fontFamily: F, fontSize: 14, color: '#eab308' }}>
                    {t3('Bag', 'Beg', '背包', language)}
                  </span>
                </motion.button>

                {/* SWITCH SPIRIT */}
                <motion.button
                  onClick={() => !actionsDisabled && setActionMode('switch')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))',
                    border: '1.5px solid rgba(34,197,94,0.35)',
                    opacity: actionsDisabled ? 0.5 : 1,
                  }}
                  whileTap={!actionsDisabled ? { scale: 0.95 } : {}}
                >
                  <RefreshCw size={18} style={{ color: '#22c55e' }} />
                  <span style={{ fontFamily: F, fontSize: 14, color: '#22c55e' }}>
                    {t3('Switch', 'Tukar', '换灵', language)}
                  </span>
                </motion.button>

                {/* RUN */}
                <motion.button
                  onClick={handleRun}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(100,100,100,0.2), rgba(80,80,80,0.1))',
                    border: '1.5px solid rgba(120,120,120,0.35)',
                    opacity: actionsDisabled ? 0.5 : 1,
                  }}
                  whileTap={!actionsDisabled ? { scale: 0.95 } : {}}
                >
                  <DoorOpen size={18} style={{ color: '#9ca3af' }} />
                  <span style={{ fontFamily: F, fontSize: 14, color: '#9ca3af' }}>
                    {t3('Run', 'Lari', '逃跑', language)}
                  </span>
                </motion.button>
              </motion.div>
            )}

            {/* ── FIGHT → SKILL SELECT ── */}
            {actionMode === 'fight' && !isKO && (
              <motion.div
                key="fight-skills"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={() => setActionMode('main')}
                  className="flex items-center gap-1 mb-2 px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <ChevronLeft size={14} style={{ color: '#888' }} />
                  <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>
                    {t3('Back', 'Kembali', '返回', language)}
                  </span>
                </button>

                {skills.length === 0 ? (
                  <div className="text-center py-6">
                    <p style={{ fontFamily: F, fontSize: 12, color: '#666' }}>
                      {t3('No skills available', 'Tiada kemahiran', '没有可用技能', language)}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {skills.map(skill => (
                      <SkillButton
                        key={skill.id}
                        skill={skill}
                        lang={language}
                        onSelect={handleSkillSelect}
                        iconUrl={getSkillIconUrl(skill.iconSlug)}
                        disabled={actionsDisabled}
                      />
                    ))}
                  </div>
                )}

                {mcqLoading && (
                  <div className="mt-2 text-center">
                    <span style={{ fontFamily: CINZEL, fontSize: 8, color: '#d4a44a' }}>
                      {t3('Loading questions...', 'Memuat soalan...', '加载题目中...', language)}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── BAG ── */}
            {actionMode === 'bag' && !isKO && (
              <motion.div
                key="bag-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={() => setActionMode('main')}
                  className="flex items-center gap-1 mb-2 px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <ChevronLeft size={14} style={{ color: '#888' }} />
                  <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>
                    {t3('Back', 'Kembali', '返回', language)}
                  </span>
                </button>

                {/* Active buff indicators */}
                {(shieldMultiplier < 1 || extraTimerSeconds > 0) && (
                  <div className="flex items-center gap-2 mb-2 px-2">
                    {shieldMultiplier < 1 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
                        <Shield size={10} style={{ color: '#3b82f6' }} />
                        <span style={{ fontFamily: CINZEL, fontSize: 8, color: '#93c5fd' }}>
                          -{Math.round((1 - shieldMultiplier) * 100)}% DMG
                        </span>
                      </div>
                    )}
                    {extraTimerSeconds > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)' }}>
                        <Clock size={10} style={{ color: '#22c55e' }} />
                        <span style={{ fontFamily: CINZEL, fontSize: 8, color: '#86efac' }}>
                          +{extraTimerSeconds}s
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {usableBagItems.length === 0 ? (
                  <div className="text-center py-6">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2" style={{ color: '#555' }} />
                    <p style={{ fontFamily: F, fontSize: 12, color: '#666' }}>
                      {t3('No items in bag', 'Tiada item dalam beg', '背包里没有物品', language)}
                    </p>
                    <p style={{ fontFamily: F, fontSize: 9, color: '#555', marginTop: 4 }}>
                      {t3('Buy items from the shop!', 'Beli item dari kedai!', '从商店购买物品！', language)}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 max-h-44 overflow-y-auto">
                    {usableBagItems.map(item => {
                      const qty = bagInv[item.id] || 0;
                      const used = bagUsedThisBattle[item.id] || 0;
                      const limit = item.battleLimit || Infinity;
                      const atLimit = used >= limit;
                      const iconUrl = allAssets.find(a => a.slug === item.imageSlug)?.publicUrl;
                      const hasShield = item.effects?.some(e => e.type === 'shield');
                      const hasTimer = item.effects?.some(e => e.type === 'time_extend');
                      const hasHP = item.effects?.some(e => e.type === 'hp');
                      const effectColor = hasShield ? '#3b82f6' : hasTimer ? '#22c55e' : hasHP ? '#ef4444' : '#eab308';

                      // ── Lumicore special handling ──
                      const isLumicore = !!LUMICORE_CATCH_RATES[item.id];
                      const lumicoreColor = '#a855f7';
                      const lumicoreDisabled = isLumicore && !isWildEncounter;
                      const displayColor = isLumicore ? lumicoreColor : effectColor;
                      const displayDisabled = atLimit || lumicoreDisabled;
                      const catchPct = isLumicore ? Math.round((LUMICORE_CATCH_RATES[item.id] || 0) * 100) : 0;

                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => !displayDisabled && handleUseBagItem(item)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-left"
                          style={{
                            background: `${displayColor}10`,
                            border: `1.5px solid ${displayColor}${displayDisabled ? '15' : '40'}`,
                            opacity: displayDisabled ? 0.45 : 1,
                          }}
                          whileTap={!displayDisabled ? { scale: 0.95 } : {}}
                        >
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 relative"
                            style={{ background: `${displayColor}20`, border: `1px solid ${displayColor}30` }}
                          >
                            {iconUrl ? (
                              <img src={iconUrl} alt="" className="w-8 h-8 object-contain" />
                            ) : isLumicore ? (
                              <Sparkles size={22} style={{ color: lumicoreColor }} />
                            ) : hasShield ? (
                              <Shield size={22} style={{ color: effectColor }} />
                            ) : hasTimer ? (
                              <Clock size={22} style={{ color: effectColor }} />
                            ) : (
                              <ShoppingBag size={22} style={{ color: effectColor }} />
                            )}
                            {isLumicore && (
                              <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded text-[6px] font-bold" style={{
                                background: lumicoreColor, color: '#fff', lineHeight: 1,
                              }}>
                                {catchPct}%
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate" style={{ fontFamily: F, fontSize: 13, color: '#f0e6d0' }}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span style={{ fontFamily: CINZEL, fontSize: 10, color: displayColor }}>
                                ×{qty}
                              </span>
                              {limit < Infinity && (
                                <span style={{ fontFamily: CINZEL, fontSize: 9, color: atLimit ? '#ef4444' : '#888' }}>
                                  {used}/{limit}
                                </span>
                              )}
                              {lumicoreDisabled && (
                                <span style={{ fontFamily: CINZEL, fontSize: 8, color: '#ef4444' }}>
                                  {t3('Wild only', 'Liar sahaja', '仅野外', language)}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Feedback toast */}
                <AnimatePresence>
                  {bagFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center mt-2"
                    >
                      <span style={{ fontFamily: F, fontSize: 10, color: '#d4a44a' }}>
                        {bagFeedback}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── SWITCH SPIRIT ── */}
            {actionMode === 'switch' && !isKO && (
              <motion.div
                key="switch-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={() => setActionMode('main')}
                  className="flex items-center gap-1 mb-2 px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <ChevronLeft size={14} style={{ color: '#888' }} />
                  <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>
                    {t3('Back', 'Kembali', '返回', language)}
                  </span>
                </button>
                <p style={{ fontFamily: F, fontSize: 10, color: '#888', marginBottom: 6, paddingLeft: 4 }}>
                  {t3('Choose a spirit (costs 1 turn)', 'Pilih spirit (kos 1 giliran)', '选择灵兽（消耗1回合）', language)}
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {party.map((slot, idx) => {
                    if (!slot) return null;
                    const isActive = idx === activeBattleIdx;
                    const hp = isActive ? myHP : (partyHP[idx] ?? 0);
                    const isFainted = hp <= 0;
                    const seed = getSeedSpirit(slot.spiritId);
                    const spiritName = seed?.name || slot.spiritId;
                    const types = seed?.types || [];
                    const maxHP = myMaxHP; // simplified — all spirits use player level for now
                    const hpRatio = maxHP > 0 ? Math.max(0, hp / maxHP) : 0;
                    const isFoxy = seed?.isFoxy;

                    return (
                      <motion.button
                        key={idx}
                        onClick={() => !isActive && !isFainted && !actionsDisabled && handleSwitchSpirit(idx)}
                        disabled={isActive || isFainted || actionsDisabled}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left"
                        style={{
                          background: isActive ? 'rgba(34,197,94,0.12)' : isFainted ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                          border: `1.5px solid ${isActive ? 'rgba(34,197,94,0.35)' : isFainted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                          opacity: isFainted ? 0.4 : 1,
                        }}
                        whileTap={!isActive && !isFainted ? { scale: 0.97 } : {}}
                      >
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                          background: isFoxy ? `${GOLD}15` : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isFoxy ? GOLD + '25' : 'rgba(255,255,255,0.08)'}`,
                        }}>
                          {isFoxy ? (
                            <Crown size={14} style={{ color: GOLD }} />
                          ) : (
                            <Sparkles size={14} style={{ color: types[0] ? (ELEMENT_ICONS[types[0]] ? '#aaa' : '#888') : '#888' }} />
                          )}
                        </div>

                        {/* Name + type + HP */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate" style={{ fontFamily: F, fontSize: 11, color: isActive ? '#86efac' : isFainted ? '#ef4444' : '#e8dcc8' }}>
                              {spiritName}
                            </span>
                            {types.slice(0, 2).map(t => {
                              const cfg: Record<string, string> = { fire: '🔥', water: '💧', wood: '🌿', thunder: '⚡', earth: '🪨', shadow: '🌑', gold: '✨' };
                              return <span key={t} className="text-[8px]">{cfg[t] || ''}</span>;
                            })}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Heart size={8} style={{ color: hpColor(hpRatio) }} fill={hp > 0 ? hpColor(hpRatio) : 'none'} />
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
                              <div className="h-full rounded-full" style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio), transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontFamily: CINZEL, fontSize: 7, color: '#888' }}>
                              {Math.round(hp)}/{maxHP}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="shrink-0">
                          {isActive ? (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
                              {t3('Active', 'Aktif', '出战', language)}
                            </span>
                          ) : isFainted ? (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                              {t3('Fainted', 'Pengsan', '倒下', language)}
                            </span>
                          ) : null}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══════════════════════════════════
          MCQ POPUP OVERLAY
         ═══════════════════════════════════ */}
      <AnimatePresence>
        {showMCQ && currentMCQ && (
          <BattleMCQPopup
            key={currentMCQ.id}
            question={currentMCQ}
            timerSeconds={timerSeconds + extraTimerSeconds}
            language={language}
            skillColor={pendingSkillRef.current?.color || '#a855f7'}
            skillName={pendingSkillRef.current ? getSkillName(pendingSkillRef.current, language) : ''}
            onCorrect={handleMCQCorrect}
            onWrong={handleMCQWrong}
          />
        )}
      </AnimatePresence>
    </div>
  );
}