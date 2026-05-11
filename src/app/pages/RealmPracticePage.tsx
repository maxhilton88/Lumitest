/**
 * RealmPracticePage — "Training Arena" — Full-Screen Pokémon Stadium Arena Selector
 *
 * Redesigned layout:
 *   ┌────────────────────────────────────┐
 *   │  ← Back                            │
 *   │                                    │
 *   │   ◄  FULL-SCREEN ARENA IMAGE  ►   │  ← swipeable / arrow-navigated
 *   │      (from Quest Manager)          │
 *   │                                    │
 *   │   ┌─ Arena Name ─────────────┐     │
 *   │   │  +120G  ⚡+80XP          │     │
 *   │   └──────────────────────────┘     │
 *   │                                    │
 *   │        ▲                           │
 *   │    ╭──────╮                        │
 *   │    │  AGE │                        │
 *   │    │  8   │  ← big glowing badge   │
 *   │    ╰──────╯                        │
 *   │        ▼                           │
 *   │                                    │
 *   │   [ ENTER ARENA ]                  │
 *   └────────────────────────────────────┘
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router';
import { PracticeScreen } from '../components/screens/PracticeScreen';
import { useAppContext } from '../contexts/AppContext';
import { useRealmContext } from '../contexts/RealmContext';
import { useLanguage } from '../components/LanguageContext';
import { ARENA_SUBJECT_ALIASES } from '../utils/subject-aliases';
import { recordDailyActivity, fetchRewardConfig } from '../utils/api';
import { getLootPreview, calculateConfigRewards, DEFAULT_REWARD_CONFIG } from '../types/reward-config';
import type { RealmRewardConfig } from '../types/reward-config';
import { ArrowLeft, Zap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Swords } from 'lucide-react';
import { useAccessGate, AccessBlockedModal, showGateNudge } from '../components/realm/AccessGate';
import { isEggHatchedFromStats } from '../utils/hatch';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';

// ── Age Tiers ──
const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const AGE_TIERS: Record<number, { color: string; glow: string }> = {
  4:  { color: '#7cc643', glow: 'rgba(124,198,67,0.4)' },
  5:  { color: '#4ecdc4', glow: 'rgba(78,205,196,0.4)' },
  6:  { color: '#4a90e2', glow: 'rgba(74,144,226,0.4)' },
  7:  { color: '#a78bfa', glow: 'rgba(167,139,250,0.4)' },
  8:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  9:  { color: '#f97316', glow: 'rgba(249,115,22,0.4)' },
  10: { color: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  11: { color: '#ec4899', glow: 'rgba(236,72,153,0.4)' },
  12: { color: '#ffd700', glow: 'rgba(255,215,0,0.5)' },
};

const DEFAULT_CARD_IMAGES: Record<string, string> = {
  english: 'https://images.unsplash.com/photo-1586023038457-9171a7fd658b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  numbers: 'https://images.unsplash.com/photo-1689892464353-c4f7b1335051?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  bahasa: 'https://images.unsplash.com/photo-1578187218114-e14ccdab29ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  mandarin: 'https://images.unsplash.com/photo-1732130318710-b41009faf549?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  science: 'https://images.unsplash.com/photo-1761768857990-2d6997193dea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  sejarah: 'https://images.unsplash.com/photo-1598177183308-ec8555cbfe76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  geography: 'https://images.unsplash.com/photo-1660296445609-755420b2db19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
};

// ── Subject Arenas ──
interface ArenaSubject {
  id: string;
  name: { en: string; ms: string; zh: string };
  subtitle: { en: string; ms: string; zh: string };
  color: string;
  conditional?: boolean;
}

function findQuestForArena(
  arenaId: string,
  liveQuests: Array<{ id: string; subject: string; is_mandarin?: boolean; [k: string]: any }>
): { id: string; subject: string } | null {
  const lower = arenaId.toLowerCase();
  const exact = liveQuests.find(q => q.subject.toLowerCase() === lower);
  if (exact) return exact;
  if (lower === 'mandarin') {
    const byFlag = liveQuests.find(q => q.is_mandarin);
    if (byFlag) return byFlag;
  }
  const aliases = ARENA_SUBJECT_ALIASES[lower] || [lower];
  for (const q of liveQuests) {
    const qSubject = q.subject.toLowerCase();
    for (const alias of aliases) {
      if (qSubject === alias || qSubject.includes(alias) || alias.includes(qSubject)) return q;
    }
  }
  const startsWith = liveQuests.find(q => q.subject.toLowerCase().startsWith(lower));
  if (startsWith) return startsWith;
  return null;
}

const ARENA_SUBJECTS: ArenaSubject[] = [
  { id: 'english', name: { en: 'English Forest', ms: 'Hutan Inggeris', zh: '英语森林' }, subtitle: { en: 'Language & Literacy', ms: 'Bahasa & Literasi', zh: '语言与读写' }, color: '#7cc643' },
  { id: 'numbers', name: { en: 'Numbers Island', ms: 'Pulau Nombor', zh: '数字岛' }, subtitle: { en: 'Mathematics', ms: 'Matematik', zh: '数学' }, color: '#4a90e2' },
  { id: 'bahasa', name: { en: 'Rimba Bahasa', ms: 'Rimba Bahasa', zh: '马来语丛林' }, subtitle: { en: 'Bahasa Malaysia', ms: 'Bahasa Malaysia', zh: '马来语' }, color: '#e74c3c' },
  { id: 'mandarin', name: { en: 'Mandarin Mountain', ms: 'Gunung Mandarin', zh: '华语山' }, subtitle: { en: 'Chinese Language', ms: 'Bahasa Cina', zh: '华语' }, color: '#f39c12', conditional: true },
  { id: 'science', name: { en: 'Mystery Jungle', ms: 'Hutan Misteri', zh: '神秘丛林' }, subtitle: { en: 'Science & Discovery', ms: 'Sains & Penemuan', zh: '科学与探索' }, color: '#9b59b6' },
  { id: 'sejarah', name: { en: 'Chronicle Ruins', ms: 'Runtuhan Kronik', zh: '编年史遗迹' }, subtitle: { en: 'History (Sejarah)', ms: 'Sejarah', zh: '历史' }, color: '#d97706' },
  { id: 'geography', name: { en: 'Atlas Peaks', ms: 'Puncak Atlas', zh: '地图之巅' }, subtitle: { en: 'Geography', ms: 'Geografi', zh: '地理' }, color: '#059669' },
];

// ── Gold Coin ──
function GoldCoin({ size = 14 }: { size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #ffd700, #ff9800)', border: '1px solid #b8860b', boxShadow: '0 1px 3px rgba(255,215,0,0.3)' }}>
      <span style={{ fontFamily: F, fontSize: size * 0.5, color: '#5c3d00', lineHeight: 1 }}>G</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FLOATING EMBERS — atmospheric particles that match arena color
// ═══════════════════════════════════════════════════════════════
function FloatingEmbers({ color, count = 18 }: { color: string; count?: number }) {
  const seeds = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 5 + (i * 37 + 13) % 90,
      size: 2 + (i * 7 % 30) / 10,
      dur: 4 + (i * 11 % 40) / 10,
      delay: (i * 13 % 50) / 10,
      drift: -30 + (i * 19 % 60),
    })), [count]
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {seeds.map(s => (
        <motion.div
          key={s.id}
          className="absolute rounded-full"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.x}%`,
            bottom: `${5 + s.id % 40}%`,
            background: s.id % 3 === 0 ? `${color}bb` : s.id % 3 === 1 ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.2)',
            boxShadow: s.id % 3 === 0 ? `0 0 6px ${color}` : 'none',
          }}
          animate={{
            y: [0, -80 - s.drift, -(120 + s.drift)],
            x: [0, s.drift * 0.3, s.drift * 0.6],
            opacity: [0, 0.9, 0],
            scale: [0.5, 1.2, 0.3],
          }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AGE BADGE — Glowing gem-cut badge with left/right controls
// ═══════════════════════════════════════════════════════════════
interface AgeBadgeProps {
  age: number;
  actualAge: number;
  onUp: () => void;
  onDown: () => void;
  color: string;
  glow: string;
  language: string;
}

function AgeBadge({ age, actualAge, onUp, onDown, color, glow, language }: AgeBadgeProps) {
  const canUp = age < 12;
  const canDown = age > 4;
  const isRecommended = age === actualAge;

  return (
    <div className="flex items-center gap-0">
      {/* Left arrow (decrease age) */}
      <motion.button
        onClick={onDown}
        disabled={!canDown}
        className="relative z-10 flex items-center justify-center"
        style={{
          width: 36, height: 48,
          opacity: canDown ? 1 : 0.2,
        }}
        whileTap={canDown ? { scale: 0.85, x: -3 } : {}}
      >
        <div style={{
          width: 0, height: 0,
          borderTop: '14px solid transparent',
          borderBottom: '14px solid transparent',
          borderRight: `16px solid ${color}`,
          filter: `drop-shadow(0 0 8px ${glow})`,
        }} />
      </motion.button>

      {/* Main badge — hexagonal/gem shape via clip-path */}
      <motion.div
        className="relative flex items-center justify-center"
        style={{ width: 100, height: 108, marginLeft: -4, marginRight: -4 }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute"
          style={{
            width: 110, height: 118,
            clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
            background: `${color}25`,
            filter: `blur(4px)`,
          }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Badge body */}
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{
            width: 94, height: 102,
            clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
            background: `linear-gradient(160deg, ${color}40 0%, #0a0818 40%, #0a0818 60%, ${color}30 100%)`,
            border: 'none',
          }}
        >
          {/* Inner faceted highlight */}
          <div className="absolute inset-0" style={{
            clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
            background: `linear-gradient(180deg, ${color}15 0%, transparent 40%, transparent 60%, ${color}10 100%)`,
          }} />

          {/* AGE label */}
          <span style={{
            fontFamily: F,
            fontSize: 10,
            color: `${color}cc`,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 4,
            lineHeight: 1,
          }}>
            {language === 'en' ? 'AGE' : language === 'ms' ? 'UMUR' : '年龄'}
          </span>

          {/* Big age number */}
          <motion.span
            key={age}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            style={{
              fontFamily: CINZEL,
              fontSize: 42,
              fontWeight: 'bold',
              color: '#fff',
              lineHeight: 1,
              textShadow: `0 0 30px ${glow}, 0 0 60px ${glow}, 0 2px 8px rgba(0,0,0,0.8)`,
            }}
          >
            {age}
          </motion.span>

          {/* Recommended indicator */}
          {isRecommended && (
            <span style={{
              fontFamily: F,
              fontSize: 7,
              color: '#ffd700cc',
              letterSpacing: '0.06em',
              lineHeight: 1,
              marginTop: -2,
            }}>
              ★ {language === 'en' ? 'YOUR LEVEL' : language === 'ms' ? 'TAHAP ANDA' : '你的等级'}
            </span>
          )}
        </div>

        {/* Animated border */}
        <svg className="absolute" width="94" height="102" viewBox="0 0 94 102" style={{ left: 3, top: 3 }}>
          <motion.polygon
            points="47,1 91,26 91,76 47,101 3,76 3,26"
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            animate={{ strokeDashoffset: [0, -300] }}
            style={{ strokeDasharray: '8 12' }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
        </svg>
      </motion.div>

      {/* Right arrow (increase age) */}
      <motion.button
        onClick={onUp}
        disabled={!canUp}
        className="relative z-10 flex items-center justify-center"
        style={{
          width: 36, height: 48,
          opacity: canUp ? 1 : 0.2,
        }}
        whileTap={canUp ? { scale: 0.85, x: 3 } : {}}
      >
        <div style={{
          width: 0, height: 0,
          borderTop: '14px solid transparent',
          borderBottom: '14px solid transparent',
          borderLeft: `16px solid ${color}`,
          filter: `drop-shadow(0 0 8px ${glow})`,
        }} />
      </motion.button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
type Phase = 'arena' | 'practice';

export function RealmPracticePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ctx = useAppContext();
  const realm = useRealmContext();
  const { language } = useLanguage();
  const accessGate = useAccessGate('practice');
  const [showAccessBlocked, setShowAccessBlocked] = useState(false);

  const actualAge = ctx.age || realm.stats.age || 5;
  const [selectedAge, setSelectedAge] = useState(actualAge);
  const [phase, setPhase] = useState<Phase>('arena');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const recordedRef = useRef(false);

  // Current arena index for the full-screen card swiper
  const [arenaIndex, setArenaIndex] = useState(0);

  // Swipe tracking
  const touchStartX = useRef<number | null>(null);
  const swipeThreshold = 50;

  // R2 assets — reuse RealmContext
  const hatched = isEggHatchedFromStats(realm.stats.hatchStartMs, undefined, realm.stats.evolutionStage);
  const foxyImg = hatched
    ? (realm.assets.foxyHatchedImg || realm.assets.foxyEggImg)
    : (realm.assets.foxyEggImg || realm.assets.foxyHatchedImg);

  // Reward config
  const [config, setConfig] = useState<RealmRewardConfig>(DEFAULT_REWARD_CONFIG);
  useEffect(() => {
    fetchRewardConfig().then(c => { if (c) setConfig(c); }).catch(() => {});
  }, []);

  // Build dynamic subject list from live quests
  const subjects = useMemo(() => {
    const matched = new Set<string>();
    const result: ArenaSubject[] = [];

    for (const arena of ARENA_SUBJECTS) {
      const quest = findQuestForArena(arena.id, ctx.liveQuests);
      if (quest) {
        result.push(arena);
        matched.add(quest.id);
      }
    }

    for (const q of ctx.liveQuests) {
      if (matched.has(q.id)) continue;
      if (q.status !== 'live') continue;
      const subjectLower = q.subject.toLowerCase();
      const alreadyCovered = result.some(r => {
        const aliases = ARENA_SUBJECT_ALIASES[r.id] || [r.id];
        return aliases.some(a => subjectLower === a || subjectLower.includes(a) || a.includes(subjectLower));
      });
      if (alreadyCovered) continue;

      const dynamicColors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#d97706'];
      const colorIdx = q.subject.split('').reduce((sum: number, ch: string) => sum + ch.charCodeAt(0), 0) % dynamicColors.length;
      result.push({
        id: q.subject.toLowerCase(),
        name: { en: q.name?.en || q.subject, ms: q.name?.ms || q.subject, zh: q.name?.zh || q.subject },
        subtitle: { en: q.subject, ms: q.subject, zh: q.subject },
        color: dynamicColors[colorIdx],
      });
    }

    return result;
  }, [ctx.liveQuests]);

  // Clamp arena index
  useEffect(() => {
    if (arenaIndex >= subjects.length) setArenaIndex(Math.max(0, subjects.length - 1));
  }, [subjects.length, arenaIndex]);

  // Auto-select subject from ?subject= query param (deep-link from WeaknessSpotlight)
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (!subjectParam || subjects.length === 0) return;

    const target = subjectParam.toLowerCase();
    const aliases = ARENA_SUBJECT_ALIASES[target] || [target];

    const idx = subjects.findIndex(s => {
      const sid = s.id.toLowerCase();
      if (sid === target) return true;
      return aliases.some(a => sid === a || sid.includes(a) || a.includes(sid));
    });

    if (idx >= 0) {
      setArenaIndex(idx);
      console.log(`[PRACTICE] Deep-linked to subject "${subjectParam}" → arena index ${idx}`);
    } else {
      console.warn(`[PRACTICE] Subject "${subjectParam}" not found in arena subjects`);
    }

    // Clear the query param so back-navigation doesn't re-trigger
    setSearchParams({}, { replace: true });
  }, [subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSubject = subjects[arenaIndex] || subjects[0];

  const handleRoundComplete = useCallback(() => {
    if (recordedRef.current || !realm.userId) return;
    recordedRef.current = true;
    recordDailyActivity(realm.userId, 'practice').then(() => {
      showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'practice', language);
      accessGate.recheck();
    }).catch(err => { console.error('[PRACTICE]', err); recordedRef.current = false; });
  }, [realm.userId, accessGate, language]);

  const handleSessionComplete = useCallback(async (result: {
    correct: number; total: number; score: number; subject: string;
  }): Promise<{ gold: number; xp: number } | null> => {
    if (!realm.userId) return null;
    try {
      const configLoot = calculateConfigRewards(config, 'practice', selectedAge, result.correct, result.total);
      const goldEarned = configLoot.totalGold;
      const xpEarned = configLoot.totalXp;
      if (goldEarned > 0) realm.addGold(goldEarned);
      if (xpEarned > 0) realm.addXP(xpEarned);
      realm.flushStats();
      recordDailyActivity(realm.userId, 'practice', {
        questionsTotal: result.total,
        questionsCorrect: result.correct,
      }).then(() => {
        showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'practice', language);
        accessGate.recheck();
      }).catch(err => {
        console.error('[PRACTICE] Daily activity record failed:', err);
      });
      recordedRef.current = true;
      return { gold: goldEarned, xp: xpEarned };
    } catch (err) {
      console.error('[PRACTICE] Session complete error:', err);
      return null;
    }
  }, [realm.userId, realm.addGold, realm.addXP, realm.flushStats, accessGate, config, selectedAge]);

  const handleSubjectTap = useCallback((subjectId: string) => {
    if (!accessGate.canAccess && !accessGate.checking) { setShowAccessBlocked(true); return; }
    setSelectedSubjectId(subjectId);
    setPhase('practice');
  }, [accessGate]);

  const handleBack = useCallback(() => {
    if (phase === 'practice') { setPhase('arena'); setSelectedSubjectId(null); recordedRef.current = false; }
    else navigate('/realm');
  }, [phase, navigate]);

  const goNextArena = useCallback(() => {
    if (subjects.length === 0) return;
    setArenaIndex(prev => (prev + 1) % subjects.length);
  }, [subjects.length]);

  const goPrevArena = useCallback(() => {
    if (subjects.length === 0) return;
    setArenaIndex(prev => (prev - 1 + subjects.length) % subjects.length);
  }, [subjects.length]);

  const goAgeUp = useCallback(() => {
    setSelectedAge(prev => Math.min(12, prev + 1));
  }, []);

  const goAgeDown = useCallback(() => {
    setSelectedAge(prev => Math.max(4, prev - 1));
  }, []);

  // Touch swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > swipeThreshold) {
      if (diff < 0) goNextArena();
      else goPrevArena();
    }
    touchStartX.current = null;
  }, [goNextArena, goPrevArena]);

  const tier = AGE_TIERS[selectedAge];

  // ═══ PRACTICE PHASE ═══
  if (phase === 'practice') {
    return (
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div key="practice" className="absolute inset-0 overflow-y-auto"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="relative z-10">
              <PracticeScreen
                liveQuests={ctx.liveQuests} brandingSettings={ctx.brandingSettings}
                questCardImageUrls={ctx.questCardImageUrls} selectedAge={selectedAge}
                onExit={handleBack} onRoundComplete={handleRoundComplete}
                autoStartModule={selectedSubjectId || undefined}
                onSessionComplete={handleSessionComplete}
                trainingRewards={(() => {
                  const loot = getLootPreview(config, selectedAge, 10);
                  return { xp: loot.maxXp, gold: loot.maxGold };
                })()} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!currentSubject) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#060410' }}>
        <p style={{ fontFamily: F, color: '#c8b88a77' }}>No arenas available</p>
      </div>
    );
  }

  // ═══ Resolve card image for current arena ═══
  const matchedQuest = findQuestForArena(currentSubject.id, ctx.liveQuests);
  const cardImage = (matchedQuest
    ? (ctx.questCardImageUrls[matchedQuest.id] || ctx.questCardImageUrls[matchedQuest.subject] || ctx.questCardImageUrls[matchedQuest.subject.toLowerCase()])
    : ctx.questCardImageUrls[currentSubject.id]
  ) || DEFAULT_CARD_IMAGES[currentSubject.id] || '';

  const loot = getLootPreview(config, selectedAge, 10);
  const arenaColor = currentSubject.color;

  // ═══ ARENA SELECTION — FULL SCREEN CARD ═══
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: '#060410' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Full-screen arena background image ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`arena-bg-${arenaIndex}`}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <img
            src={cardImage}
            alt={currentSubject.name[language]}
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.55) saturate(1.3)' }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Cinematic vignette overlays */}
      <div className="absolute inset-0 z-10" style={{
        background: 'radial-gradient(ellipse 80% 70% at 50% 40%, transparent 20%, rgba(6,4,16,0.7) 100%)',
      }} />
      <div className="absolute bottom-0 left-0 right-0 h-[55%] z-10" style={{
        background: 'linear-gradient(to top, #060410 0%, #060410e0 30%, #06041080 60%, transparent 100%)',
      }} />
      {/* Arena color tint */}
      <motion.div
        key={`tint-${arenaIndex}`}
        className="absolute inset-0 z-10 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 35%, ${arenaColor}12 0%, transparent 60%)`,
        }}
      />

      {/* Embers */}
      <FloatingEmbers color={arenaColor} />

      {/* ── Top nav bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-3 pb-2">
        <motion.button
          onClick={() => navigate('/realm')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(212,164,74,0.25)', backdropFilter: 'blur(8px)' }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: GOLD }} />
        </motion.button>

        {/* Page counter dots */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          {subjects.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{
                width: i === arenaIndex ? 14 : 6,
                height: 6,
                background: i === arenaIndex ? arenaColor : 'rgba(255,255,255,0.2)',
                borderRadius: 3,
                transition: 'all 0.3s ease',
                boxShadow: i === arenaIndex ? `0 0 8px ${arenaColor}80` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* ═══ TOP HUD — Arena name + subtitle + rewards ═══ */}
      <div className="absolute top-14 left-0 right-0 z-30 flex flex-col items-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={`name-${arenaIndex}`}
            className="flex flex-col items-center"
            initial={{ y: -15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 15, opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Subtitle (category) */}
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
              >
                <Swords className="w-4 h-4" style={{ color: arenaColor }} />
              </motion.div>
              <span style={{
                fontFamily: F, fontSize: 11, color: `${arenaColor}cc`,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {currentSubject.subtitle[language]}
              </span>
            </div>

            {/* Arena Name */}
            <h2 style={{
              fontFamily: F, fontSize: 24,
              color: '#ffeaa7',
              textShadow: `0 0 20px ${arenaColor}60, 0 0 40px ${arenaColor}30, 0 3px 10px rgba(0,0,0,0.9)`,
              lineHeight: 1.2,
              textAlign: 'center',
            }}>
              {currentSubject.name[language]}
            </h2>

            {/* Reward chips row (live updating with age) */}
            <motion.div
              key={`loot-${selectedAge}`}
              className="flex items-center gap-3 mt-2"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.18)', backdropFilter: 'blur(6px)' }}>
                <GoldCoin size={14} />
                <span style={{ fontFamily: F, fontSize: 14, color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.3)' }}>
                  +{loot.maxGold}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', backdropFilter: 'blur(6px)' }}>
                <Zap className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                <span style={{ fontFamily: F, fontSize: 14, color: '#22c55e', textShadow: '0 0 8px rgba(34,197,94,0.3)' }}>
                  +{loot.maxXp}
                </span>
              </div>
            </motion.div>

            {/* Pass / Gold threshold rules */}
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontFamily: F, fontSize: 9, color: '#a78bfacc' }}>
                  {language === 'en' ? '60% to Pass' : language === 'ms' ? '60% untuk Lulus' : '60%通过'}
                </span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
                <GoldCoin size={9} />
                <span style={{ fontFamily: F, fontSize: 9, color: '#ffd700aa' }}>
                  {language === 'en' ? '80% to Earn Gold' : language === 'ms' ? '80% untuk Emas' : '80%获得金币'}
                </span>
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Left / Right gold navigation arrows ── */}
      {subjects.length > 1 && (
        <>
          <motion.button
            onClick={goPrevArena}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center"
            style={{
              width: 44, height: 64,
              background: 'linear-gradient(135deg, rgba(212,164,74,0.15), rgba(212,164,74,0.05))',
              borderRadius: 12,
              border: '1px solid rgba(212,164,74,0.2)',
              backdropFilter: 'blur(4px)',
            }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ background: 'linear-gradient(135deg, rgba(212,164,74,0.25), rgba(212,164,74,0.1))' }}
          >
            <ChevronLeft className="w-6 h-6" style={{ color: GOLD, filter: 'drop-shadow(0 0 4px rgba(212,164,74,0.5))' }} />
          </motion.button>
          <motion.button
            onClick={goNextArena}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center"
            style={{
              width: 44, height: 64,
              background: 'linear-gradient(135deg, rgba(212,164,74,0.05), rgba(212,164,74,0.15))',
              borderRadius: 12,
              border: '1px solid rgba(212,164,74,0.2)',
              backdropFilter: 'blur(4px)',
            }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ background: 'linear-gradient(135deg, rgba(212,164,74,0.1), rgba(212,164,74,0.25))' }}
          >
            <ChevronRight className="w-6 h-6" style={{ color: GOLD, filter: 'drop-shadow(0 0 4px rgba(212,164,74,0.5))' }} />
          </motion.button>
        </>
      )}

      {/* ═══ BOTTOM HUD — Age badge + Enter button ═══ */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-5 px-4">

        {/* Age badge with horizontal arrows */}
        <AgeBadge
          age={selectedAge}
          actualAge={actualAge}
          onUp={goAgeUp}
          onDown={goAgeDown}
          color={tier.color}
          glow={tier.glow}
          language={language}
        />

        {/* Enter arena button — full width below badge */}
        <motion.button
          onClick={() => handleSubjectTap(currentSubject.id)}
          className="relative overflow-hidden rounded-2xl mt-3 w-full max-w-[220px]"
          style={{
            padding: '14px 24px',
            background: `linear-gradient(135deg, ${arenaColor}dd, ${arenaColor}88)`,
            border: `2px solid ${arenaColor}`,
            boxShadow: `0 0 20px ${arenaColor}40, 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)`,
          }}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
        >
          {/* Shine sweep */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          />
          <span style={{
            fontFamily: F,
            fontSize: 15,
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            letterSpacing: '0.08em',
            position: 'relative',
            zIndex: 1,
            whiteSpace: 'nowrap',
            display: 'block',
            textAlign: 'center',
          }}>
            {language === 'en' ? 'ENTER ARENA' : language === 'ms' ? 'MASUK ARENA' : '进入竞技场'}
          </span>
        </motion.button>

        {/* Age tier color bar — subtle visual indicator */}
        <motion.div
          key={`bar-${selectedAge}`}
          className="mt-3 rounded-full"
          style={{
            width: 60,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
            boxShadow: `0 0 12px ${tier.glow}`,
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Access blocked modal */}
      <AccessBlockedModal
        isOpen={showAccessBlocked} onClose={() => setShowAccessBlocked(false)}
        activityType="practice" maxPerDay={accessGate.maxPerDay}
        isPaid={accessGate.isPaid} onUpgrade={() => navigate('/parent/plan')} />
    </div>
  );
}

export default RealmPracticePage;