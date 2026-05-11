/**
 * RealmTestPage.tsx — In-game test flow inside RealmShell
 *
 * Self-contained test experience with AAA RPG theming:
 *   RPG Winding-Path Map -> Test -> Victory + Loot Rewards -> back to map
 *
 * Reuses: fetchQuestionBank, fetchLiveQuests, QuestionScreen.
 * Auth required (user is already logged in).
 * Completion awards XP, gold, stars via RealmContext (persisted to KV).
 * Test completions are tracked in KV — completed tests show trophies & best stars.
 * Replaying a completed test only updates if the new score is better.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Star, Swords, Shield, Trophy,
  ChevronRight, Loader2, Zap, Crown, MapPin, RotateCcw,
  Lock, Play, ArrowLeft,
} from 'lucide-react';
import { QuestionScreen, type Question } from '../components/screens/QuestionScreen';
import { useRealmContext } from '../contexts/RealmContext';
import { useAppContext } from '../contexts/AppContext';
import { useLanguage } from '../components/LanguageContext';
import { fetchQuestionBank, fetchLiveQuests, fetchRewardConfig, recordDailyActivity } from '../utils/api';
import type { DetailedAnswer } from '../types/app-types';
import { AgeSelector } from '../components/realm/AgeSelector';
import { calculateConfigRewards, DEFAULT_REWARD_CONFIG } from '../types/reward-config';
import type { RealmRewardConfig } from '../types/reward-config';
import { useAccessGate, AccessBlockedModal, showGateNudge } from '../components/realm/AccessGate';
import { RealmHUD } from '../components/realm/RealmHUD';
import { DailyQuestsPanel, useDailyLog } from '../components/realm/DailyQuestsPanel';
import { SettingsPopup } from '../components/realm/SettingsPopup';
import {
  createAdaptiveStateFromAge,
  getNextQuestion,
  toQuestionScreenFormat,
} from '../utils/adaptive-engine';
import {
  getQuestionsByLevelAndSubject,
  getQuestionsByLevel,
  ALL_SAMPLE_QUESTIONS,
} from '../data/sample-questions';
import { deriveLevelFromAge } from '../utils/level-utils';
import { SUBJECT_BY_QUEST_ID } from '../data/kssr-taxonomy';
import { recordMasteryAnswers } from '../utils/mastery-api';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';

// Fallback quest map background
const FALLBACK_MAP_BG = 'https://images.unsplash.com/photo-1704226443195-c4e2151e924c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwZmFudGFzeSUyMGZvcmVzdCUyMHBhdGglMjBteXN0aWNhbHxlbnwxfHx8fDE3NzI4MjA5ODF8MA&ixlib=rb-4.1.0&q=80&w=1080';

// ── Quest branding for dark fantasy QuestionScreen ──
const REALM_BRANDING = {
  schoolName: 'Foxy Realm',
  logoUrl: '',
  primaryColor: '#d4a44a',
  kindergartenUrl: '',
  testPageBgColor: '#0a0a12',
  mapBackgroundImage: '',
  testBackgroundImage: '',
};

// ── Test node colours ──
const TEST_THEME: Record<string, { color: string; glow: string; icon: string }> = {
  english:    { color: '#7cc643', glow: 'rgba(124,198,67,0.35)',  icon: 'A' },
  numbers:    { color: '#4a90e2', glow: 'rgba(74,144,226,0.35)',  icon: '#' },
  math:       { color: '#4a90e2', glow: 'rgba(74,144,226,0.35)',  icon: '#' },
  bahasa:     { color: '#e74c3c', glow: 'rgba(231,76,60,0.35)',   icon: 'B' },
  mandarin:   { color: '#f39c12', glow: 'rgba(243,156,18,0.35)',  icon: 'Z' },
  science:    { color: '#9b59b6', glow: 'rgba(155,89,182,0.35)',  icon: 'S' },
  sejarah:    { color: '#d97706', glow: 'rgba(217,119,6,0.35)',   icon: 'H' },
  geography:  { color: '#059669', glow: 'rgba(5,150,105,0.35)',   icon: 'G' },
};
const DEFAULT_THEME = { color: '#d4a44a', glow: 'rgba(212,164,74,0.35)', icon: '?' };

// ── Reward result shape ──
interface TestRewards {
  xp: number;
  gold: number;
  bonusXp: number;
  bonusGold: number;
  stars: number;
  accuracy: number;
}

// ── Transform backend questions ──
function transformBankQuestions(bankQuestions: any[], questId: string): Question[] {
  return bankQuestions.map((bq: any) => {
    const optionsEn = Array.isArray(bq.options_en) ? bq.options_en : [];
    const optionsMs = Array.isArray(bq.options_ms) ? bq.options_ms : [];
    const optionsZh = Array.isArray(bq.options_zh) ? bq.options_zh : [];

    const mergedOptions = optionsEn.map((optEn: any, idx: number) => {
      const optMs = optionsMs[idx] || {};
      const optZh = optionsZh[idx] || {};
      const option: any = {
        id: optEn.id || String.fromCharCode(97 + idx),
        text: {
          en: typeof optEn === 'string' ? optEn : (optEn.text || ''),
          ms: typeof optMs === 'string' ? optMs : (optMs.text || ''),
          zh: typeof optZh === 'string' ? optZh : (optZh.text || ''),
        },
      };
      if (optEn.image) option.image = optEn.image;
      return option;
    });

    return {
      id: bq.q_id,
      type: (bq.input_type || 'mcq') as Question['type'],
      question: {
        en: bq.question_text_en || '',
        ms: bq.question_text_ms || '',
        zh: bq.question_text_zh || '',
      },
      options: mergedOptions,
      correctAnswer: bq.correct_answer || 'a',
      foxyMessage: bq.visual_prompt
        ? { en: bq.visual_prompt, ms: bq.visual_prompt, zh: bq.visual_prompt }
        : undefined,
      questionImage: bq.image_url || undefined,
      // Map uploaded TTS audio URLs from question bank (resolved by server from R2 keys)
      tts: (bq.tts_en || bq.tts_ms || bq.tts_zh)
        ? { en: bq.tts_en || undefined, ms: bq.tts_ms || undefined, zh: bq.tts_zh || undefined }
        : undefined,
      ageDifficulty: bq.age_target,
      quest: questId,
      dskpCode: bq.dskp_code || '',
      bankSubject: bq.subject || '',
      kssr_level: bq.kssr_level || '',
      topic: bq.topic || '',
      skill_name: bq.skill_name || '',
    } as Question & { ageDifficulty?: number; quest?: string; dskpCode?: string; bankSubject?: string; kssr_level?: string; topic?: string; skill_name?: string };
  });
}

// ═══════════════════════════════════════════════════
// AMBIENT PARTICLES (floating embers / fireflies)
// ═══════════════════════════════════════════════════
function MapParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 4,
      color: Math.random() > 0.5 ? 'rgba(255,215,0,0.4)' : 'rgba(212,164,74,0.3)',
    })),
  []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// WINDING PATH SVG (connects quest nodes)
// ═══════════════════════════════════════════════════
function WindingPath({ nodeCount, completedCount }: { nodeCount: number; completedCount: number }) {
  if (nodeCount < 2) return null;

  const nodeSpacing = 140;
  const width = 320;
  const height = nodeCount * nodeSpacing + 60;
  const centerX = width / 2;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const zigzag = i % 2 === 0 ? -55 : 55;
    points.push({ x: centerX + zigzag, y: 60 + i * nodeSpacing });
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${cpY}, ${curr.x} ${cpY}, ${curr.x} ${curr.y}`;
  }

  return (
    <svg
      className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none z-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ opacity: 0.5 }}
    >
      <defs>
        <linearGradient id="pathGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd700" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#d4a44a" stopOpacity="0.15" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={d} fill="none" stroke="rgba(100,80,50,0.25)" strokeWidth="4" strokeDasharray="8 6" />
      <path d={d} fill="none" stroke="url(#pathGlow)" strokeWidth="3" filter="url(#glow)" strokeLinecap="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════
// QUEST NODE (single node on the winding path)
// ═══════════════════════════════════════════════════
interface TestNodeProps {
  quest: any;
  index: number;
  total: number;
  isCompleted: boolean;
  stars: number;
  result: { score: number; total: number } | null;
  onSelect: (questId: string) => void;
  language: string;
}

function TestNode({ quest, index, total, isCompleted, stars, result, onSelect, language }: TestNodeProps) {
  const questId = quest.id || quest.subject;
  const theme = TEST_THEME[quest.subject] || TEST_THEME[questId] || DEFAULT_THEME;
  const name = quest.name?.[language] || quest.name?.en || quest.subject || questId;
  const zigzag = index % 2 === 0 ? 'mr-auto ml-4' : 'ml-auto mr-4';
  const nodeSize = 56;
  const isActive = quest._isActive;
  const isLocked = quest._isLocked;
  const isClickable = isActive || isCompleted; // completed = replay, active = start

  return (
    <motion.div
      className={`relative flex items-center gap-3 ${zigzag}`}
      style={{ maxWidth: 280, marginTop: index === 0 ? 0 : 20, cursor: isClickable ? 'pointer' : 'default' }}
      initial={{ opacity: 0, scale: 0.7, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
      onClick={() => { if (isClickable) onSelect(questId); }}
      whileTap={isClickable ? { scale: 0.95 } : undefined}
    >
      {/* Node circle */}
      <div
        className="relative shrink-0 rounded-full flex items-center justify-center"
        style={{
          width: nodeSize,
          height: nodeSize,
          background: isCompleted
            ? `linear-gradient(135deg, ${theme.color}30, ${theme.color}15)`
            : 'linear-gradient(135deg, rgba(20,16,10,0.95), rgba(30,24,14,0.98))',
          border: `2.5px solid ${isCompleted ? theme.color : isActive ? '#ffd700' : `${theme.color}30`}`,
          boxShadow: isCompleted
            ? `0 0 18px ${theme.glow}, 0 0 40px ${theme.glow}`
            : isActive
            ? '0 0 20px rgba(255,215,0,0.3), 0 0 40px rgba(255,215,0,0.1)'
            : '0 2px 12px rgba(0,0,0,0.5)',
          filter: isLocked ? 'grayscale(60%) brightness(0.55)' : 'none',
          opacity: isLocked ? 0.55 : 1,
        }}
      >
        {isCompleted ? (
          <Trophy className="w-6 h-6" style={{ color: theme.color, filter: `drop-shadow(0 0 6px ${theme.glow})` }} />
        ) : (
          <span style={{ fontFamily: F, fontSize: 20, color: isLocked ? '#555' : theme.color, textShadow: isLocked ? 'none' : `0 0 8px ${theme.glow}` }}>
            {theme.icon}
          </span>
        )}

        {isActive && !isCompleted && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid rgba(255,215,0,0.4)' }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            background: isCompleted ? theme.color : 'rgba(30,24,14,0.95)',
            border: `1.5px solid ${isCompleted ? theme.color : `${theme.color}55`}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontFamily: CINZEL, fontSize: 9, color: isCompleted ? '#1a1000' : theme.color }}>
            {index + 1}
          </span>
        </div>
      </div>

      {/* Quest info card */}
      <div
        className="flex-1 text-left"
        style={{
          background: 'linear-gradient(135deg, rgba(18,14,10,0.88), rgba(28,22,14,0.92))',
          border: `1px solid ${isCompleted ? `${theme.color}30` : isActive ? 'rgba(255,215,0,0.2)' : 'rgba(100,80,50,0.15)'}`,
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: isCompleted
            ? `0 0 12px ${theme.color}10`
            : isActive
            ? '0 0 12px rgba(255,215,0,0.08)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          filter: isLocked ? 'grayscale(50%) brightness(0.6)' : 'none',
          opacity: isLocked ? 0.55 : 1,
        }}
      >
        <p style={{
          fontFamily: F, fontSize: 14,
          color: isCompleted ? theme.color : isLocked ? '#666' : '#f0e6d0',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)', lineHeight: 1.2,
        }}>
          {name}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a' }}>
            {quest.question_count || 10}{' '}
            {language === 'en' ? 'questions' : language === 'ms' ? 'soalan' : '题'}
          </span>
          {isCompleted && result && (
            <span style={{ fontFamily: CINZEL, fontSize: 10, color: `${theme.color}99` }}>
              {result.score}/{result.total}
            </span>
          )}
        </div>

        {isCompleted && (
          <div className="flex items-center gap-0.5 mt-1">
            {[1, 2, 3].map(i => (
              <Star
                key={i}
                className="w-3.5 h-3.5"
                fill={i <= stars ? '#ffd700' : 'transparent'}
                stroke={i <= stars ? '#ffaa00' : '#ffffff18'}
                strokeWidth={2}
              />
            ))}
            <RotateCcw className="w-3 h-3 ml-1.5" style={{ color: '#8a7e6a', opacity: 0.5 }} />
          </div>
        )}

        {isActive && !isCompleted && (
          <div className="flex items-center gap-1 mt-1">
            <Swords className="w-3 h-3" style={{ color: '#ffd700' }} />
            <span style={{ fontFamily: F, fontSize: 9, color: '#ffd700' }}>
              {language === 'en' ? 'Up Next' : language === 'ms' ? 'Seterusnya' : '下一个'}
            </span>
          </div>
        )}

        {isLocked && (
          <div className="flex items-center gap-1 mt-1">
            <Lock className="w-3 h-3" style={{ color: '#55504a' }} />
            <span style={{ fontFamily: F, fontSize: 9, color: '#55504a' }}>
              {language === 'en' ? 'Locked' : language === 'ms' ? 'Dikunci' : '锁定'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════
// SCREEN: RPG QUEST MAP (winding path)
// ═══════════════════════════════════════════════════
interface TestMapProps {
  quests: any[];
  isLoading: boolean;
  onSelectQuest: (questId: string) => void;
  mapBgUrl: string | null;
  onBack: () => void;
}

function TestMap({ quests, isLoading, onSelectQuest, mapBgUrl, onBack }: TestMapProps) {
  const { language } = useLanguage();
  const realm = useRealmContext();
  const { stats, assets, musicOn, toggleMusicFn } = realm;
  const { log: dailyLog } = useDailyLog();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isLoading || realm.isLoadingStats) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: GOLD }} />
        <p style={{ fontFamily: F, fontSize: 14, color: GOLD }}>
          {language === 'en' ? 'Loading Tests...' : language === 'ms' ? 'Memuatkan Ujian...' : '加载测试中...'}
        </p>
      </div>
    );
  }

  const completedCount = quests.filter(q => realm.isQuestCompleted(q.id || q.subject)).length;
  const allCompleted = completedCount >= quests.length && quests.length > 0;
  const activeIndex = quests.findIndex(q => !realm.isQuestCompleted(q.id || q.subject));

  const enrichedQuests = quests.map((q, idx) => ({
    ...q,
    _isActive: idx === activeIndex,
    _isLocked: !realm.isQuestCompleted(q.id || q.subject) && idx !== activeIndex,
  }));

  const activeQuest = activeIndex >= 0 ? quests[activeIndex] : null;
  const activeQuestName = activeQuest
    ? (activeQuest.name?.[language] || activeQuest.name?.en || activeQuest.subject)
    : '';

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${mapBgUrl || FALLBACK_MAP_BG})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'brightness(0.35) saturate(0.7)',
      }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,4,2,0.65) 0%, rgba(10,8,4,0.80) 50%, rgba(5,4,2,0.90) 100%)' }} />
      <MapParticles />

      {/* ── Full RealmHUD — same as Realm hub ── */}
      <RealmHUD
        stats={stats}
        coinIconUrl={assets.iconCoin}
        diamondIconUrl={assets.iconDiamond}
        onSettings={() => setSettingsOpen(true)}
        onMusicToggle={() => toggleMusicFn()}
        onAvatarTap={() => navigate('/realm/mastery')}
        dailyLog={dailyLog}
        musicOn={musicOn}
      />

      {/* ── Small back pill overlaid on top-left, below HUD ── */}
      <motion.button
        onClick={onBack}
        className="absolute z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ top: 110, left: 12, background: 'rgba(212,164,74,0.15)', border: '1px solid rgba(212,164,74,0.3)' }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-4 h-4" style={{ color: GOLD }} />
        <span style={{ fontFamily: F, fontSize: 11, color: GOLD }}>
          {language === 'en' ? 'Realm' : language === 'ms' ? 'Alam' : '领域'}
        </span>
      </motion.button>

      {settingsOpen && (
        <SettingsPopup isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}

      <div className="absolute inset-0 overflow-y-auto z-20">
        <div className="relative px-4 pt-36 pb-36">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <h1 style={{
              fontFamily: F, fontSize: 24, color: '#ffd700',
              textShadow: '0 2px 16px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.15)',
            }}>
              {language === 'en' ? 'Test Map' : language === 'ms' ? 'Peta Ujian' : '测试地图'}
            </h1>
            <p style={{ fontFamily: F, fontSize: 11, color: '#c8b88a', marginTop: 6, opacity: 0.7 }}>
              {language === 'en' ? 'Complete all tests in order to earn XP & Gold'
                : language === 'ms' ? 'Selesaikan semua ujian mengikut turutan untuk peroleh XP & Emas'
                : '按顺序完成所有测试以获得经验值和金币'}
            </p>

            <div className="max-w-xs mx-auto mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a' }}>
                  {language === 'en' ? 'Progress' : language === 'ms' ? 'Kemajuan' : '进度'}
                </span>
                <span style={{ fontFamily: CINZEL, fontSize: 10, color: GOLD }}>
                  {completedCount}/{quests.length}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(100,80,50,0.2)', border: '1px solid rgba(100,80,50,0.15)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #d4a44a, #ffd700)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${quests.length > 0 ? (completedCount / quests.length) * 100 : 0}%` }}
                  transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>

          <div className="relative max-w-sm mx-auto" style={{ minHeight: quests.length * 140 + 60 }}>
            <WindingPath nodeCount={quests.length} completedCount={completedCount} />
            <div className="relative z-10 flex flex-col" style={{ gap: 90 }}>
              {enrichedQuests.map((quest, idx) => {
                const questId = quest.id || quest.subject;
                return (
                  <TestNode
                    key={questId}
                    quest={quest}
                    index={idx}
                    total={quests.length}
                    isCompleted={realm.isQuestCompleted(questId)}
                    stars={realm.getQuestStars(questId)}
                    result={realm.getQuestResult(questId)}
                    onSelect={onSelectQuest}
                    language={language}
                  />
                );
              })}
            </div>
          </div>

          {quests.length === 0 && (
            <div className="text-center py-20">
              <Shield className="w-14 h-14 mx-auto mb-4" style={{ color: '#444' }} />
              <p style={{ fontFamily: F, fontSize: 15, color: '#777' }}>
                {language === 'en' ? 'No tests available yet' : language === 'ms' ? 'Tiada ujian tersedia lagi' : '暂无测试'}
              </p>
              <p style={{ fontFamily: F, fontSize: 11, color: '#555', marginTop: 4 }}>
                {language === 'en' ? 'Ask your teacher to create test modules'
                  : language === 'ms' ? 'Minta guru anda mencipta modul ujian'
                  : '请让老师创建测试模块'}
              </p>
            </div>
          )}

          {allCompleted && (
            <motion.div
              className="text-center mt-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              <Crown className="w-10 h-10 mx-auto mb-2" style={{ color: '#ffd700', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.5))' }} />
              <p style={{ fontFamily: F, fontSize: 16, color: '#ffd700', textShadow: '0 0 12px rgba(255,215,0,0.3)' }}>
                {language === 'en' ? 'All Tests Conquered!' : language === 'ms' ? 'Semua Ujian Ditakluki!' : '所有测试已完成！'}
              </p>
              <p style={{ fontFamily: F, fontSize: 11, color: '#c8b88a', marginTop: 4 }}>
                {language === 'en' ? 'Replay any test to earn better stars'
                  : language === 'ms' ? 'Main semula mana-mana ujian untuk bintang lebih baik'
                  : '重玩任何测试以获得更好的星星'}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {!allCompleted && activeQuest && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pb-5 pt-8 px-6"
          style={{ background: 'linear-gradient(to top, rgba(5,4,2,0.95) 0%, rgba(5,4,2,0.8) 60%, transparent 100%)' }}
        >
          <motion.button
            onClick={() => onSelectQuest(activeQuest.id || activeQuest.subject)}
            className="w-full max-w-xs mx-auto block py-3.5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)',
              border: '2.5px solid #ffeaa7',
              boxShadow: '0 4px 24px rgba(212,164,74,0.5), 0 0 40px rgba(212,164,74,0.15), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            <div className="flex items-center justify-center gap-2.5">
              <Play className="w-5 h-5" fill="#2a1f0e" stroke="#2a1f0e" />
              <span style={{
                fontFamily: F, fontSize: 16, color: '#2a1f0e',
                textShadow: '0 1px 0 rgba(255,255,255,0.3)', letterSpacing: '0.05em',
              }}>
                {language === 'en' ? 'Start Test' : language === 'ms' ? 'Mula Ujian' : '开始测试'}
              </span>
            </div>
            <p style={{ fontFamily: F, fontSize: 10, color: '#5c3d00', marginTop: 2, opacity: 0.7, textAlign: 'center' }}>
              {activeQuestName}
            </p>
          </motion.button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SCREEN: VICTORY + LOOT REWARDS
// ═══════════════════════════════════════════════════
interface LootScreenProps {
  questName: string;
  rewards: TestRewards;
  wasReplay: boolean;
  improved: boolean;
  onClaim: () => void;
  claimed: boolean;
}

function LootScreen({ questName, rewards, wasReplay, improved, onClaim, claimed }: LootScreenProps) {
  const [showLoot, setShowLoot] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    const t1 = setTimeout(() => setShowLoot(true), 600);
    const t2 = setTimeout(() => setShowButton(true), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0" style={{ background: 'rgba(5,4,2,0.75)' }} />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        {/* Stars */}
        <motion.div
          className="flex items-center gap-3 mb-4"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
        >
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: i <= rewards.stars ? 1 : 0.6, opacity: i <= rewards.stars ? 1 : 0.25 }}
              transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 250 }}
            >
              <Star
                className={i === 2 ? 'w-12 h-12' : 'w-9 h-9'}
                fill={i <= rewards.stars ? '#ffd700' : 'transparent'}
                stroke={i <= rewards.stars ? '#ffaa00' : '#555'}
                strokeWidth={2}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Quest name */}
        <motion.p
          style={{ fontFamily: F, fontSize: 20, color: '#ffd700', textShadow: '0 2px 16px rgba(255,215,0,0.4)', textAlign: 'center' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {questName}
        </motion.p>

        {/* Accuracy */}
        <motion.p
          style={{ fontFamily: CINZEL, fontSize: 13, color: '#c8b88a', marginTop: 6 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {rewards.accuracy}% {language === 'en' ? 'accuracy' : language === 'ms' ? 'ketepatan' : '准确率'}
        </motion.p>

        {wasReplay && (
          <motion.p
            style={{ fontFamily: F, fontSize: 11, color: improved ? '#22c55e' : '#8a7e6a', marginTop: 4 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {improved
              ? (language === 'en' ? 'New best score!' : language === 'ms' ? 'Skor terbaik baharu!' : '新最高分！')
              : (language === 'en' ? 'Replay — no improvement' : language === 'ms' ? 'Main semula — tiada peningkatan' : '重玩 — 无提升')}
          </motion.p>
        )}

        {/* Loot cards */}
        <AnimatePresence>
          {showLoot && (
            <motion.div
              className="grid grid-cols-2 gap-3 w-full mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* XP */}
              <div className="rounded-xl p-4 text-center" style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))',
                border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <Zap className="w-6 h-6 mx-auto mb-1" style={{ color: '#22c55e' }} />
                <p style={{ fontFamily: F, fontSize: 18, color: '#22c55e' }}>+{rewards.xp}</p>
                <p style={{ fontFamily: F, fontSize: 10, color: '#6b7280' }}>XP</p>
              </div>
              {/* Gold */}
              <div className="rounded-xl p-4 text-center" style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.05))',
                border: '1px solid rgba(255,215,0,0.2)',
              }}>
                <div className="w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, #ffd700, #ff9800)', border: '1px solid #b8860b',
                }}>
                  <span style={{ fontFamily: F, fontSize: 10, color: '#5c3d00' }}>G</span>
                </div>
                <p style={{ fontFamily: F, fontSize: 18, color: '#ffd700' }}>+{rewards.gold}</p>
                <p style={{ fontFamily: F, fontSize: 10, color: '#6b7280' }}>Gold</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Claim button */}
        <AnimatePresence>
          {showButton && (
            <motion.button
              onClick={onClaim}
              className="mt-8 w-full max-w-xs py-3 rounded-xl"
              style={{
                background: claimed ? 'rgba(100,80,50,0.2)' : 'linear-gradient(135deg, #d4a44a, #f0d078, #d4a44a)',
                border: claimed ? '1px solid rgba(100,80,50,0.2)' : '2px solid #ffeaa7',
                boxShadow: claimed ? 'none' : '0 4px 20px rgba(212,164,74,0.4)',
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={claimed ? {} : { scale: 0.96 }}
              disabled={claimed}
            >
              <span style={{
                fontFamily: F, fontSize: 14,
                color: claimed ? '#8a7e6a' : '#2a1f0e',
              }}>
                {claimed
                  ? (language === 'en' ? 'Claimed!' : language === 'ms' ? 'Dituntut!' : '已领取！')
                  : (language === 'en' ? 'Claim Rewards' : language === 'ms' ? 'Tuntut Ganjaran' : '领取奖励')}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT — RealmTestPage
// ═══════════════════════════════════════════════════
type TestPhase = 'map' | 'testing' | 'loot';

export function RealmTestPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const realm = useRealmContext();
  const { user } = useAppContext();
  const accessGate = useAccessGate('test');
  const [showAccessBlocked, setShowAccessBlocked] = useState(false);

  const [phase, setPhase] = useState<TestPhase>('map');
  const [quests, setQuests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<DetailedAnswer[]>([]);
  const [rewards, setRewards] = useState<TestRewards | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [wasReplay, setWasReplay] = useState(false);
  const [improved, setImproved] = useState(false);
  const [rewardConfig, setRewardConfig] = useState<RealmRewardConfig>(DEFAULT_REWARD_CONFIG);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const answersRef = useRef<DetailedAnswer[]>([]);

  const age = realm.stats.age || 5;
  const currentQuestion = questions[currentQuestionIndex] || null;

  // Load quests + reward config on mount
  useEffect(() => {
    (async () => {
      try {
        const [liveQuests, config] = await Promise.all([
          fetchLiveQuests().catch(() => []),
          fetchRewardConfig().catch(() => DEFAULT_REWARD_CONFIG),
        ]);
        setRewardConfig(config || DEFAULT_REWARD_CONFIG);
        if (liveQuests && liveQuests.length > 0) {
          setQuests(liveQuests);
        } else {
          // Fallback: show sample quests from local data
          const subjects = ['english', 'math', 'bahasa', 'mandarin', 'science'];
          setQuests(subjects.map(s => ({
            id: s,
            subject: s,
            name: { en: s.charAt(0).toUpperCase() + s.slice(1), ms: s, zh: s },
            question_count: 10,
          })));
        }
      } catch (err) {
        console.error('[RealmTestPage] Failed to load quests:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Select quest → load questions
  const handleSelectQuest = useCallback(async (questId: string) => {
    // Access gate check
    if (!accessGate.canAccess && !accessGate.checking) {
      setShowAccessBlocked(true);
      return;
    }

    setSelectedQuestId(questId);
    setClaimed(false);
    setWasReplay(realm.isQuestCompleted(questId));
    setCurrentQuestionIndex(0);
    setAnswers([]);
    answersRef.current = [];

    try {
      // Try to fetch from question bank first
      // NOTE: Question bank stores subjects as the questId string (e.g. 'english', 'math', 'bahasa')
      // NOT as the taxonomy code (e.g. 'ENG', 'MAT', 'BM'). Use questId directly for the API query,
      // and also try the taxonomy's questId field as a fallback.
      const subjectDef = SUBJECT_BY_QUEST_ID[questId];
      const subjectCode = subjectDef?.questId || questId; // Use the questId form, not the taxonomy code
      const level = deriveLevelFromAge(age);
      console.log(`[RealmTestPage] Fetching questions: questId=${questId}, subjectCode=${subjectCode}, level=${level}`);
      const bankQuestions = await fetchQuestionBank({ subject: subjectCode, age_target: level, limit: 10 }).catch((err) => {
        console.warn('[RealmTestPage] fetchQuestionBank failed, will use fallback:', err);
        return [];
      });

      console.log(`[RealmTestPage] Bank returned ${bankQuestions?.length || 0} questions for ${subjectCode}`);
      if (bankQuestions && bankQuestions.length >= 3) {
        setQuestions(transformBankQuestions(bankQuestions, questId));
      } else {
        // Fallback to local sample questions
        const localQs = getQuestionsByLevelAndSubject(level, subjectCode);
        const fallback = localQs.length >= 3 ? localQs : getQuestionsByLevel(level);
        setQuestions(fallback.slice(0, 10));
      }
      setPhase('testing');
    } catch (err) {
      console.error('[RealmTestPage] Failed to load questions:', err);
      // Use any available sample questions as last resort
      const level = deriveLevelFromAge(age);
      setQuestions(ALL_SAMPLE_QUESTIONS.slice(0, 10));
      setPhase('testing');
    }
  }, [accessGate, realm, age]);

  // Test completed
  const handleTestComplete = useCallback((detailedAnswers: DetailedAnswer[]) => {
    setAnswers(detailedAnswers);
    answersRef.current = detailedAnswers;

    const correct = detailedAnswers.filter(a => a.isCorrect).length;
    const total = detailedAnswers.length;

    // Calculate rewards using config
    const configRewards = calculateConfigRewards(correct, total, rewardConfig);
    const testRewards: TestRewards = {
      xp: configRewards.xp,
      gold: configRewards.gold,
      bonusXp: configRewards.bonusXp,
      bonusGold: configRewards.bonusGold,
      stars: configRewards.stars,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
    setRewards(testRewards);

    // Check if improved over previous best
    if (selectedQuestId) {
      const prevResult = realm.getQuestResult(selectedQuestId);
      const prevStars = realm.getQuestStars(selectedQuestId);
      const didImprove = !prevResult || testRewards.stars > prevStars || correct > prevResult.score;
      setImproved(didImprove);

      // Only update if first time or improved
      if (!prevResult || didImprove) {
        realm.markQuestCompleted(selectedQuestId, correct, total, testRewards.stars);
      }
    }

    // Record mastery answers
    if (realm.userId && detailedAnswers.length > 0) {
      recordMasteryAnswers(realm.userId, detailedAnswers).catch(err => {
        console.error('[RealmTestPage] Failed to record mastery answers:', err);
      });
    }

    setPhase('loot');
  }, [selectedQuestId, realm, rewardConfig]);

  // Claim rewards
  const handleClaimRewards = useCallback(() => {
    if (claimed || !rewards) return;
    setClaimed(true);

    // Award XP + gold (only on first clear or if improved)
    if (!wasReplay || improved) {
      realm.addXP(rewards.xp);
      realm.addGold(rewards.gold);
      setTimeout(() => realm.flushStats(), 200);
    }

    // Record daily activity
    if (realm.userId) {
      recordDailyActivity(realm.userId, 'test').then(() => {
        showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'test', language);
        accessGate.recheck();
      }).catch(err => {
        console.error('[RealmTestPage] Failed to record daily activity:', err);
      });
    }

    // Return to map after delay
    setTimeout(() => {
      setPhase('map');
      setSelectedQuestId(null);
      setQuestions([]);
      setAnswers([]);
      setRewards(null);
    }, 1500);
  }, [claimed, rewards, wasReplay, improved, realm, accessGate, language]);

  const handleBack = useCallback(() => {
    if (phase === 'map') {
      navigate('/realm');
    } else {
      setPhase('map');
      setSelectedQuestId(null);
    }
  }, [phase, navigate]);

  // ── Question flow handlers (feed one question at a time to QuestionScreen) ──
  const handleAnswer = useCallback((answerId: string) => {
    if (!currentQuestion) return;
    const isCorrect = answerId === currentQuestion.correctAnswer;
    const detailedAnswer: DetailedAnswer = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      selectedAnswer: answerId,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      options: currentQuestion.options,
      questionType: currentQuestion.type || 'mcq',
      dskpCode: (currentQuestion as any).dskpCode || '',
      subject: (currentQuestion as any).bankSubject || (currentQuestion as any).quest || '',
      topic: (currentQuestion as any).topic || '',
      skill_name: (currentQuestion as any).skill_name || '',
    };
    answersRef.current = [...answersRef.current, detailedAnswer];
    setAnswers(answersRef.current);
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx >= questions.length) {
      // All questions answered — trigger completion
      handleTestComplete(answersRef.current);
    } else {
      setCurrentQuestionIndex(nextIdx);
    }
  }, [currentQuestionIndex, questions.length, handleTestComplete]);

  const selectedQuest = quests.find(q => (q.id || q.subject) === selectedQuestId);
  const questName = selectedQuest
    ? (selectedQuest.name?.[language] || selectedQuest.name?.en || selectedQuest.subject || selectedQuestId)
    : '';

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#0a0a12' }}>
      <AnimatePresence mode="wait">
        {phase === 'map' && (
          <motion.div
            key="map"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TestMap
              quests={quests}
              isLoading={isLoading}
              onSelectQuest={handleSelectQuest}
              mapBgUrl={realm.assets.questMapBg || null}
              onBack={handleBack}
            />
          </motion.div>
        )}

        {phase === 'testing' && questions.length > 0 && (
          <motion.div
            key="testing"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {currentQuestion && (
              <QuestionScreen
                question={currentQuestion}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={questions.length}
                onAnswer={handleAnswer}
                onNext={handleNext}
                onBack={handleBack}
                brandingSettings={REALM_BRANDING}
              />
            )}
          </motion.div>
        )}

        {phase === 'loot' && rewards && (
          <motion.div
            key="loot"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LootScreen
              questName={questName}
              rewards={rewards}
              wasReplay={wasReplay}
              improved={improved}
              onClaim={handleClaimRewards}
              claimed={claimed}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Access gate modal */}
      {showAccessBlocked && (
        <AccessBlockedModal
          feature="test"
          onClose={() => setShowAccessBlocked(false)}
        />
      )}
    </div>
  );
}