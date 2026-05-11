/**
 * RealmMasteryPage.tsx — Mastery Grimoire (Realm Shell)
 *
 * The new mastery dashboard inside the Realm world.
 * Reads exclusively from mastery_log (no hybrid with old parent_assessment snapshots).
 * Designed for the full schema from day 1 — gracefully shows empty states
 * until mastery_log backend + mode wiring are completed.
 *
 * Sections:
 * 1. Hero header (child name, overall stats)
 * 2. 7-axis radar (always shows all 7 KSSR subjects)
 * 3. Subject mastery cards (expandable topic drill-down)
 * 4. Mode filter toggle (All/Quest/Practice/Battle/Test)
 * 5. Recommendations
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, BookOpen, Swords, Shield, FlaskConical, ScrollText,
  Globe2, Languages, ChevronDown, ChevronUp, Sparkles, Lock,
  TrendingUp, Target, Award, BarChart3, Filter,
  Flame, ChevronLeft, ChevronRight, X, Eye, Music, Zap, Calendar,
  ArrowRight, Star, Crown,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, Cell,
} from 'recharts';
import { useAppContext } from '../contexts/AppContext';
import { useRealmContext } from '../contexts/RealmContext';
import { useLanguage } from '../components/LanguageContext';
import { getStoredParentData } from '../utils/parent-api';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { getFreshParentToken, isJwtExpired } from '../utils/supabase-client';
import {
  getStageEmoji, getStageName, getNextEvolutionTarget,
  EVOLUTION_DEFS, type EvolutionStage,
} from '../utils/evolution';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';

// ===== THEME =====
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CHERRY = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const DARK_BG = 'rgba(12,10,6,0.92)';
const CARD_BG = 'linear-gradient(145deg, rgba(28,22,12,0.92) 0%, rgba(15,12,6,0.96) 100%)';
const CARD_BORDER = `1px solid rgba(212,164,74,0.2)`;
const LEGENDARY_ORANGE = '#e8722a';
const CHART_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#fbbf24', '#2dd4bf'];

// ===== ACTIVITY TYPES =====
interface ActivityDay {
  date: string;
  tests: number;
  watches: number;
  practices: number;
  questions_total?: number;
  questions_correct?: number;
  videos_watched?: number;
  songs_listened?: number;
  flashcards_completed?: number;
  battles?: number;
}

const getActivityTotal = (d: ActivityDay | null): number => {
  if (!d) return 0;
  return (d.tests || 0) + (d.watches || 0) + (d.practices || 0)
    + (d.videos_watched || 0) + (d.songs_listened || 0)
    + (d.flashcards_completed || 0) + (d.battles || 0);
};

const getIntensity = (data: ActivityDay | null): number => {
  const total = getActivityTotal(data);
  if (total === 0) return 0;
  if (total === 1) return 1;
  if (total <= 3) return 2;
  return 3;
};

const INTENSITY_COLORS = [
  `${GOLD}10`,
  `${GOLD}35`,
  `${GOLD}65`,
  GOLD,
];

// ===== 7 CANONICAL KSSR SUBJECTS =====
interface SubjectDef {
  id: string;
  name: { en: string; ms: string; zh: string };
  icon: React.ReactNode;
  color: string;
  emoji: string;
}

const SUBJECTS: SubjectDef[] = [
  { id: 'english',   name: { en: 'English',    ms: 'Bahasa Inggeris', zh: '英语' },   icon: <BookOpen size={18} />,     color: '#4ade80', emoji: '\u{1F332}' },
  { id: 'numbers',   name: { en: 'Mathematics', ms: 'Matematik',      zh: '数学' },   icon: <Target size={18} />,      color: '#60a5fa', emoji: '\u{1F3DD}\uFE0F' },
  { id: 'bahasa',    name: { en: 'Bahasa Melayu', ms: 'Bahasa Melayu', zh: '马来语' }, icon: <Languages size={18} />,   color: '#f472b6', emoji: '\u{1F33F}' },
  { id: 'mandarin',  name: { en: 'Mandarin',   ms: 'Bahasa Mandarin', zh: '华语' },   icon: <ScrollText size={18} />,  color: '#fb923c', emoji: '\u26F0\uFE0F' },
  { id: 'science',   name: { en: 'Science',    ms: 'Sains',           zh: '科学' },   icon: <FlaskConical size={18} />, color: '#a78bfa', emoji: '\u{1F52C}' },
  { id: 'sejarah',   name: { en: 'History',    ms: 'Sejarah',         zh: '历史' },   icon: <Shield size={18} />,      color: '#fbbf24', emoji: '\u{1F4DC}' },
  { id: 'geography', name: { en: 'Geography',  ms: 'Geografi',        zh: '地理' },   icon: <Globe2 size={18} />,      color: '#2dd4bf', emoji: '\u{1F30F}' },
];

// ===== TYPES =====
type ModeKey = 'all' | 'test' | 'practice' | 'battle' | 'quest';

interface TopicMastery {
  topicName: string;
  skillCodes: string[];
  totalAttempts: number;
  totalCorrect: number;
  percentage: number;
}

interface SubjectMastery {
  subjectId: string;
  totalAttempts: number;
  totalCorrect: number;
  percentage: number;
  topics: TopicMastery[];
  skills?: {
    skillCode: string;
    skillName: string;
    topicName: string;
    level: string;
    totalAttempts: number;
    totalCorrect: number;
    percentage: number;
  }[];
  byMode: Record<string, { attempts: number; correct: number }>;
}

interface MasteryProfile {
  subjects: SubjectMastery[];
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: string | null;
}

// ===== DATA HOOK =====
function useMasteryProfile(): { data: MasteryProfile | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<MasteryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      try {
        const parentId = localStorage.getItem('parent_id');
        if (!parentId) {
          setData(null);
          setLoading(false);
          return;
        }

        // Get a fresh token (auto-refreshes if expired)
        let token: string | null = null;
        try {
          token = await getFreshParentToken();
        } catch {}
        if (!token) {
          // Fallback to raw localStorage
          const rawToken = localStorage.getItem('parent_access_token');
          if (rawToken && !isJwtExpired(rawToken)) {
            token = rawToken;
          }
        }
        if (!token) {
          console.warn('[MASTERY] No valid auth token — cannot fetch mastery profile');
          setData(null);
          setLoading(false);
          return;
        }

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/parent/mastery-profile`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              'X-User-Token': `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          if (res.status === 404) {
            console.warn('[MASTERY] mastery-profile endpoint returned 404 — no data yet');
            if (!cancelled) setData(null);
          } else {
            const err = await res.json().catch(() => ({ error: 'Unknown' }));
            console.warn('[MASTERY] Fetch failed:', err);
            if (!cancelled) setError(err.error || 'Failed to load mastery data');
          }
          if (!cancelled) setLoading(false);
          return;
        }

        const profile = await res.json();
        console.log('[MASTERY] Profile loaded:', {
          subjects: profile?.subjects?.map((s: any) => `${s.subjectId}(${s.percentage}%)`),
          totalQuestions: profile?.totalQuestions,
          totalCorrect: profile?.totalCorrect,
        });
        if (!cancelled) setData(profile);
      } catch (err) {
        console.warn('[MASTERY] Network error:', err);
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

// ===== MODE FILTER DEFINITIONS =====
const MODES: { key: ModeKey; label: { en: string; ms: string; zh: string }; icon: React.ReactNode }[] = [
  { key: 'all',      label: { en: 'All',      ms: 'Semua',       zh: '全部' },     icon: <BarChart3 size={14} /> },
  { key: 'quest',    label: { en: 'Quest',    ms: 'Pencarian',   zh: '任务' },     icon: <ScrollText size={14} /> },
  { key: 'practice', label: { en: 'Practice', ms: 'Latihan',     zh: '练习' },     icon: <Swords size={14} /> },
  { key: 'battle',   label: { en: 'Battle',   ms: 'Pertempuran', zh: '对战' },     icon: <Shield size={14} /> },
  { key: 'test',     label: { en: 'Test',     ms: 'Ujian',       zh: '测试' },     icon: <Target size={14} /> },
];

// ===== STRENGTH TAG =====
function getStrengthTag(pct: number): { label: { en: string; ms: string; zh: string }; color: string } {
  if (pct >= 80) return { label: { en: 'Excellent', ms: 'Cemerlang', zh: '优秀' }, color: '#4ade80' };
  if (pct >= 60) return { label: { en: 'Good', ms: 'Baik', zh: '良好' }, color: '#60a5fa' };
  if (pct >= 40) return { label: { en: 'Developing', ms: 'Berkembang', zh: '发展中' }, color: '#fbbf24' };
  return { label: { en: 'Needs Practice', ms: 'Perlu Latihan', zh: '需要练习' }, color: '#f87171' };
}

// ===== RADAR CUSTOM TICK =====
function RadarTick(props: any) {
  const { x, y, payload } = props;
  // dataKey is subjectId — look up the localized display name
  const subjectId: string = payload.value || '';
  const subDef = SUBJECTS.find((s) => s.id === subjectId);
  const name = subDef ? (subDef.name[props.language || 'en'] || subDef.name.en) : subjectId;
  const truncated = name.length > 10 ? name.slice(0, 9) + '\u2026' : name;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      style={{
        fontSize: 10,
        fontFamily: CHERRY,
        fill: GOLD_LIGHT,
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}
    >
      {truncated}
    </text>
  );
}

// ===== EMPTY STATE COMPONENT =====
function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{ background: `${GOLD}15`, border: `1.5px dashed ${GOLD}40` }}
      >
        {icon}
      </div>
      <p style={{ fontFamily: CHERRY, fontSize: 13, color: GOLD_LIGHT }}>{title}</p>
      <p className="mt-1" style={{ fontSize: 11, color: `${PARCHMENT}60` }}>{subtitle}</p>
    </div>
  );
}

// ===== SUBJECT CARD =====
function SubjectCard({
  subject,
  mastery,
  isExcluded,
  language,
  selectedMode,
}: {
  subject: SubjectDef;
  mastery: SubjectMastery | null;
  isExcluded: boolean;
  language: 'en' | 'ms' | 'zh';
  selectedMode: ModeKey;
}) {
  const [expanded, setExpanded] = useState(false);

  const pct = mastery?.percentage ?? 0;
  const attempts = mastery?.totalAttempts ?? 0;
  const correct = mastery?.totalCorrect ?? 0;
  const tag = getStrengthTag(pct);
  const hasData = attempts > 0;
  const topics = mastery?.topics ?? [];

  // Build skillCode → skillName lookup from the skills array
  const skillNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (mastery?.skills) {
      for (const sk of mastery.skills) {
        if (sk.skillCode && sk.skillName) {
          map[sk.skillCode] = sk.skillName;
        }
      }
    }
    return map;
  }, [mastery?.skills]);

  // Mode-specific stats
  const modeStats = selectedMode !== 'all' && mastery?.byMode?.[selectedMode];
  const modePct = modeStats ? (modeStats.attempts > 0 ? Math.round((modeStats.correct / modeStats.attempts) * 100) : 0) : pct;
  const displayPct = selectedMode === 'all' ? pct : modePct;

  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        opacity: isExcluded ? 0.45 : 1,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isExcluded ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Card Header */}
      <button
        onClick={() => !isExcluded && setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3"
        disabled={isExcluded}
      >
        {/* Subject icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: `${subject.color}15`,
            border: `1.5px solid ${subject.color}40`,
            color: subject.color,
          }}
        >
          {subject.icon}
        </div>

        {/* Name + stats */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: CHERRY, fontSize: 13, color: GOLD_LIGHT }}>
              {subject.name[language]}
            </span>
            {isExcluded && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: `${PARCHMENT}60` }}
              >
                Opted out
              </span>
            )}
          </div>
          {hasData && !isExcluded ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span style={{ fontSize: 10, color: `${PARCHMENT}70` }}>
                {correct}/{attempts} correct
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                style={{ background: `${tag.color}15`, color: tag.color }}
              >
                {tag.label[language]}
              </span>
            </div>
          ) : !isExcluded ? (
            <span style={{ fontSize: 10, color: `${PARCHMENT}40` }}>No data yet</span>
          ) : null}
        </div>

        {/* Percentage ring */}
        {!isExcluded && (
          <div className="relative w-11 h-11 flex-shrink-0">
            <svg viewBox="0 0 44 44" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke={`${GOLD}15`} strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke={hasData ? tag.color : `${GOLD}20`}
                strokeWidth="3"
                strokeDasharray={`${(displayPct / 100) * 113.1} 113.1`}
                strokeLinecap="round"
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ fontFamily: CHERRY, fontSize: 11, color: hasData ? tag.color : `${PARCHMENT}40` }}
            >
              {hasData ? `${displayPct}%` : '--'}
            </span>
          </div>
        )}

        {/* Expand chevron */}
        {!isExcluded && (
          <div style={{ color: `${PARCHMENT}50` }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {/* Expanded: Topic Breakdown */}
      <AnimatePresence>
        {expanded && !isExcluded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 space-y-2"
              style={{ borderTop: `1px solid ${GOLD}10` }}
            >
              {topics.length > 0 ? (
                topics.map((topic, i) => {
                  const tTag = getStrengthTag(topic.percentage);
                  return (
                    <div
                      key={`${topic.topicName}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: `${GOLD}06` }}
                    >
                      <div className="flex-1 min-w-0">
                        <span style={{ fontSize: 11, color: GOLD_LIGHT, fontWeight: 600 }}>
                          {topic.topicName}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {topic.skillCodes.slice(0, 3).map((code, cIdx) => {
                            const displayName = skillNameMap[code] || code;
                            return (
                              <span
                                key={`${code || 'skill'}-${cIdx}`}
                                className="text-[8px] px-1.5 py-0.5 rounded truncate max-w-[140px]"
                                style={{ background: `${GOLD}10`, color: `${PARCHMENT}60` }}
                                title={`${displayName} (${code})`}
                              >
                                {displayName}
                              </span>
                            );
                          })}
                          {topic.skillCodes.length > 3 && (
                            <span className="text-[8px]" style={{ color: `${PARCHMENT}40` }}>
                              +{topic.skillCodes.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
                          {topic.totalCorrect}/{topic.totalAttempts}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${tTag.color}15`, color: tTag.color }}
                        >
                          {topic.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={<Sparkles size={20} style={{ color: GOLD }} />}
                  title="Topic breakdown coming soon"
                  subtitle="Complete more activities to see skill-level details"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===== CALENDAR MONTH GRID =====
function CalendarMonth({
  year,
  month,
  activities,
  onDayClick,
}: {
  year: number;
  month: number;
  activities: ActivityDay[];
  onDayClick: (date: string, data: ActivityDay | null, isToday: boolean) => void;
}) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7;
  const dayHeaders = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((dh) => (
          <div key={dh} className="text-center text-[10px] py-1" style={{ color: `${PARCHMENT}50` }}>
            {dh}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const data = activities.find((a) => a.date === dateStr) || null;
          const intensity = isFuture ? -1 : getIntensity(data);
          const total = getActivityTotal(data);

          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && onDayClick(dateStr, data, isToday)}
              disabled={isFuture}
              className="aspect-square rounded-lg flex items-center justify-center relative transition-all"
              style={{
                background: isFuture ? `${GOLD}05` : INTENSITY_COLORS[Math.max(intensity, 0)],
                border: isToday
                  ? `2px solid ${GOLD_LIGHT}`
                  : `1px solid ${isFuture ? `${GOLD}08` : `${GOLD}15`}`,
                boxShadow: intensity === 3 ? `0 0 8px ${GOLD}30` : 'none',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.35 : 1,
              }}
            >
              <span
                className="text-[11px] font-medium leading-none"
                style={{
                  color: isToday
                    ? GOLD_LIGHT
                    : intensity > 0
                      ? '#1a120a'
                      : `${PARCHMENT}${isFuture ? '30' : '55'}`,
                  fontWeight: isToday ? 800 : intensity > 0 ? 700 : 500,
                }}
              >
                {day}
              </span>
              {total > 0 && !isFuture && (
                <div
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: intensity >= 2 ? '#1a120a' : GOLD }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===== DAY DETAIL MODAL =====
function DayDetailModal({
  date,
  data,
  isToday,
  onClose,
  language,
}: {
  date: string;
  data: ActivityDay | null;
  isToday: boolean;
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
}) {
  const { t } = useLanguage();
  const total = getActivityTotal(data);
  const dateObj = new Date(date + 'T00:00:00');
  const monthLocale = language === 'ms' ? 'ms-MY' : language === 'zh' ? 'zh-CN' : 'en-MY';
  const formattedDate = dateObj.toLocaleDateString(monthLocale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const breakdown: { icon: React.ReactNode; label: string; count: number; color: string }[] = [];
  if (data) {
    if ((data.tests || 0) > 0) breakdown.push({ icon: <Swords className="w-4 h-4" />, label: t('mastery.quests'), count: data.tests || 0, color: '#e74c3c' });
    if ((data.watches || 0) > 0) breakdown.push({ icon: <Eye className="w-4 h-4" />, label: t('mastery.videos'), count: data.watches || 0, color: '#3498db' });
    if ((data.practices || 0) > 0) breakdown.push({ icon: <Shield className="w-4 h-4" />, label: t('mastery.training'), count: data.practices || 0, color: '#27ae60' });
    if ((data.videos_watched || 0) > 0) breakdown.push({ icon: <Eye className="w-4 h-4" />, label: language === 'en' ? 'Videos Watched' : language === 'ms' ? 'Video Ditonton' : '\u89C2\u770B\u89C6\u9891', count: data.videos_watched!, color: '#9b59b6' });
    if ((data.songs_listened || 0) > 0) breakdown.push({ icon: <Music className="w-4 h-4" />, label: language === 'en' ? 'Songs Listened' : language === 'ms' ? 'Lagu Didengar' : '\u542C\u6B4C', count: data.songs_listened!, color: '#f39c12' });
    if ((data.flashcards_completed || 0) > 0) breakdown.push({ icon: <BookOpen className="w-4 h-4" />, label: t('mastery.flashcards'), count: data.flashcards_completed!, color: '#3498db' });
    if ((data.battles || 0) > 0) breakdown.push({ icon: <Shield className="w-4 h-4" />, label: t('mastery.battles'), count: data.battles!, color: '#e74c3c' });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #2a1f12 0%, #1a120a 50%, #2a1f12 100%)',
          border: `2px solid ${GOLD}50`,
          boxShadow: `0 0 40px rgba(0,0,0,0.6), 0 0 15px ${GOLD}15`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <div className="px-5 pt-4 pb-3 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}>
              {formattedDate}
            </h3>
            {isToday && (
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}30` }}
              >
                {t('mastery.calendarToday')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
          >
            <X className="w-4 h-4" style={{ color: `${PARCHMENT}70` }} />
          </button>
        </div>
        <div className="px-5 pb-5">
          {total > 0 ? (
            <>
              <div
                className="flex items-center justify-center gap-2 py-3 mb-4 rounded-xl"
                style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}20` }}
              >
                <Flame className="w-5 h-5" style={{ color: '#ff6b35' }} />
                <span className="text-lg font-bold" style={{ color: GOLD_LIGHT }}>{total}</span>
                <span className="text-sm" style={{ color: `${PARCHMENT}80` }}>{t('mastery.calendarAdventures')}</span>
              </div>
              <div className="space-y-2.5">
                {breakdown.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}12` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: item.color }}>{item.icon}</span>
                      <span className="text-sm" style={{ color: `${PARCHMENT}90` }}>{item.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>{item.count}</span>
                  </div>
                ))}
              </div>
              {(data!.questions_total ?? 0) > 0 && (() => {
                const qTotal = data!.questions_total!;
                const qCorrect = data!.questions_correct ?? 0;
                const qWrong = qTotal - qCorrect;
                const pct = Math.round((qCorrect / qTotal) * 100);
                return (
                  <div className="mt-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}20` }}>
                    <div className="px-3.5 py-2 flex items-center gap-2" style={{ background: `${GOLD}10` }}>
                      <Target className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      <span className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>{t('mastery.calendarQuestions')}</span>
                    </div>
                    <div className="px-3.5 pt-3 pb-2">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-bold" style={{ color: GOLD_LIGHT }}>{qTotal}</span>
                        <span
                          className="text-sm font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: pct >= 70 ? 'rgba(39,174,96,0.15)' : pct >= 40 ? 'rgba(230,126,34,0.15)' : 'rgba(231,76,60,0.15)',
                            color: pct >= 70 ? '#4cbb7a' : pct >= 40 ? '#e67e22' : '#e74c3c',
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: `${GOLD}10` }}>
                        <div className="h-full flex">
                          <div className="h-full" style={{ width: `${(qCorrect / qTotal) * 100}%`, background: 'linear-gradient(90deg, #27ae60, #4cbb7a)', borderRadius: qWrong > 0 ? '9999px 0 0 9999px' : '9999px' }} />
                          {qWrong > 0 && <div className="h-full" style={{ width: `${(qWrong / qTotal) * 100}%`, background: 'linear-gradient(90deg, #c0392b, #e74c3c)', borderRadius: qCorrect > 0 ? '0 9999px 9999px 0' : '9999px' }} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4cbb7a' }} />
                          <span className="text-xs" style={{ color: `${PARCHMENT}70` }}>{t('mastery.calendarCorrect')}</span>
                          <span className="text-xs font-bold" style={{ color: '#4cbb7a' }}>{qCorrect}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e74c3c' }} />
                          <span className="text-xs" style={{ color: `${PARCHMENT}70` }}>{t('mastery.calendarWrong')}</span>
                          <span className="text-xs font-bold" style={{ color: '#e74c3c' }}>{qWrong}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-3" style={{ opacity: 0.5 }}>&#x1F319;</div>
              <p className="text-sm" style={{ color: `${PARCHMENT}60` }}>{t('mastery.calendarRestDay')}</p>
            </div>
          )}
        </div>
        <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)` }} />
      </div>
    </div>
  );
}

// ===== EVOLUTION PROGRESS CARD =====
function EvolutionProgressCard({
  stage,
  level,
  battleWins,
  language,
}: {
  stage: EvolutionStage;
  level: number;
  battleWins: number;
  language: string;
}) {
  const emoji = getStageEmoji(stage);
  const name = getStageName(stage, language);
  const next = getNextEvolutionTarget(stage);
  const stageColor = stage === 'warrior' ? '#fbbf24' : stage === 'young' ? '#60a5fa' : stage === 'baby' ? '#4ade80' : '#a78bfa';

  // Stage visual config for the timeline
  const stages: { key: EvolutionStage; emoji: string; color: string }[] = [
    { key: 'egg', emoji: '\u{1F95A}', color: '#a78bfa' },
    { key: 'baby', emoji: '\u{1F98A}', color: '#4ade80' },
    { key: 'young', emoji: '\u{1F525}', color: '#60a5fa' },
    { key: 'warrior', emoji: '\u2694\uFE0F', color: '#fbbf24' },
  ];
  const currentIdx = stages.findIndex(s => s.key === stage);

  // Level progress to next evolution
  const levelPct = next ? Math.min(100, Math.round((level / next.levelRequired) * 100)) : 100;
  const winsPct = next && next.winsRequired > 0 ? Math.min(100, Math.round((battleWins / next.winsRequired) * 100)) : 100;

  return (
    <motion.div
      className="rounded-2xl p-4 mb-5"
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} style={{ color: GOLD }} />
        <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>
          {language === 'en' ? 'Evolution Path' : language === 'ms' ? 'Laluan Evolusi' : '\u8FDB\u5316\u4E4B\u8DEF'}
        </span>
      </div>

      {/* Stage Timeline */}
      <div className="flex items-center justify-between mb-4 px-2">
        {stages.map((s, i) => {
          const isActive = i <= currentIdx;
          const isCurrent = s.key === stage;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className="flex-1 h-0.5 mx-1" style={{
                  background: i <= currentIdx
                    ? `linear-gradient(90deg, ${stages[i - 1].color}, ${s.color})`
                    : 'rgba(255,255,255,0.08)',
                  borderRadius: 1,
                }} />
              )}
              <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                <motion.div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: isCurrent ? 40 : 32,
                    height: isCurrent ? 40 : 32,
                    background: isActive
                      ? `linear-gradient(135deg, ${s.color}25, ${s.color}10)`
                      : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${isActive ? `${s.color}60` : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isCurrent ? `0 0 12px ${s.color}30` : 'none',
                  }}
                  animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span style={{ fontSize: isCurrent ? 18 : 14, opacity: isActive ? 1 : 0.35 }}>
                    {s.emoji}
                  </span>
                </motion.div>
                <span style={{
                  fontFamily: CHERRY,
                  fontSize: 8,
                  color: isCurrent ? s.color : isActive ? `${PARCHMENT}70` : `${PARCHMENT}30`,
                  marginTop: 4,
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}>
                  {getStageName(s.key, language).split(' ').pop()}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Current stage info */}
      <div className="flex items-center gap-3 mb-3 px-2">
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <div className="flex-1">
          <span style={{ fontFamily: CHERRY, fontSize: 14, color: stageColor, textShadow: `0 0 8px ${stageColor}30` }}>
            {name}
          </span>
          <div className="flex items-center gap-3 mt-0.5">
            <span style={{ fontFamily: CHERRY, fontSize: 11, color: `${PARCHMENT}70` }}>
              Lv {level}
            </span>
            <span style={{ fontFamily: CHERRY, fontSize: 11, color: `${PARCHMENT}70` }}>
              {language === 'en' ? `${battleWins} Wins` : language === 'ms' ? `${battleWins} Kemenangan` : `${battleWins}\u6B21\u80DC\u5229`}
            </span>
          </div>
        </div>
      </div>

      {/* Next evolution requirements */}
      {next ? (
        <div className="space-y-2.5 px-2">
          <p style={{ fontSize: 10, color: `${PARCHMENT}50`, fontFamily: CHERRY }}>
            {language === 'en'
              ? `Next: ${getStageName(next.nextStage, language)}`
              : language === 'ms'
                ? `Seterusnya: ${getStageName(next.nextStage, language)}`
                : `\u4E0B\u4E00\u9636\u6BB5: ${getStageName(next.nextStage, language)}`}
          </p>

          {/* Level progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: CHERRY, fontSize: 9, color: `${PARCHMENT}60` }}>
                {language === 'en' ? 'Level' : language === 'ms' ? 'Tahap' : '\u7B49\u7EA7'}
              </span>
              <span style={{ fontFamily: CHERRY, fontSize: 9, color: GOLD_LIGHT }}>
                {Math.min(level, next.levelRequired)} / {next.levelRequired}
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{
              height: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${stageColor}, ${stages[Math.min(currentIdx + 1, stages.length - 1)].color})`,
                  boxShadow: `0 0 8px ${stageColor}40`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${levelPct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Battle wins progress bar (only for Warrior gate) */}
          {next.winsRequired > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontFamily: CHERRY, fontSize: 9, color: `${PARCHMENT}60` }}>
                  <Swords size={10} className="inline mr-1" style={{ color: `${PARCHMENT}60` }} />
                  {language === 'en' ? 'Battle Wins' : language === 'ms' ? 'Kemenangan' : '\u6218\u6597\u80DC\u5229'}
                </span>
                <span style={{ fontFamily: CHERRY, fontSize: 9, color: GOLD_LIGHT }}>
                  {Math.min(battleWins, next.winsRequired)} / {next.winsRequired}
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{
                height: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #f97316, #fbbf24)',
                    boxShadow: '0 0 8px rgba(251,191,36,0.4)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${winsPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>
          )}

          {/* Reward preview */}
          {next.rewardItemId && (
            <div className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg" style={{
              background: `${next.nextStage === 'warrior' ? '#c084fc' : '#60a5fa'}08`,
              border: `1px solid ${next.nextStage === 'warrior' ? '#c084fc' : '#60a5fa'}15`,
            }}>
              <Crown size={12} style={{ color: next.nextStage === 'warrior' ? '#c084fc' : '#60a5fa' }} />
              <span style={{ fontFamily: CHERRY, fontSize: 9, color: next.nextStage === 'warrior' ? '#c084fc' : '#60a5fa' }}>
                {language === 'en' ? 'Reward: Evolution Gear!'
                  : language === 'ms' ? 'Ganjaran: Peralatan Evolusi!'
                  : '\u5956\u52B1: \u8FDB\u5316\u88C5\u5907\uFF01'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-2">
          <span style={{ fontFamily: CHERRY, fontSize: 11, color: '#fbbf24' }}>
            {language === 'en' ? 'Max Evolution Reached!' : language === 'ms' ? 'Evolusi Maksimum Dicapai!' : '\u5DF2\u8FBE\u6700\u9AD8\u8FDB\u5316\uFF01'}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ===== ADVENTURE STATS CARDS =====
function AdventureStatsSection({
  activities,
  language,
  streak,
}: {
  activities: ActivityDay[];
  language: 'en' | 'ms' | 'zh';
  streak: number;
}) {
  const totalAdventures = activities.reduce((sum, a) => sum + getActivityTotal(a), 0);
  const activeDays = activities.filter((a) => getActivityTotal(a) > 0).length;

  const modeCounts: Record<string, number> = { tests: 0, practices: 0, battles: 0, flashcards: 0 };
  activities.forEach((a) => {
    modeCounts.tests += (a.tests || 0);
    modeCounts.practices += (a.practices || 0);
    modeCounts.battles += (a.battles || 0);
    modeCounts.flashcards += (a.flashcards_completed || 0);
  });
  const favMode = Object.entries(modeCounts).sort(([, a], [, b]) => b - a)[0];
  const favLabels: Record<string, { en: string; ms: string; zh: string }> = {
    tests: { en: 'Quests', ms: 'Pencarian', zh: '\u4EFB\u52A1' },
    practices: { en: 'Practice', ms: 'Latihan', zh: '\u7EC3\u4E60' },
    battles: { en: 'Battles', ms: 'Pertempuran', zh: '\u5BF9\u6218' },
    flashcards: { en: 'Flashcards', ms: 'Kad Imbas', zh: '\u95EA\u5361' },
  };

  const stats = [
    { icon: <Zap size={16} style={{ color: '#fb923c' }} />, value: String(totalAdventures), label: language === 'en' ? 'Total Adventures' : language === 'ms' ? 'Jumlah Pengembaraan' : '\u603B\u5192\u9669\u6B21\u6570' },
    { icon: <Flame size={16} style={{ color: '#ff6b35' }} />, value: String(streak), label: language === 'en' ? 'Day Streak' : language === 'ms' ? 'Hari Berturut' : '\u8FDE\u7EED\u5929\u6570' },
    { icon: <Calendar size={16} style={{ color: '#60a5fa' }} />, value: String(activeDays), label: language === 'en' ? 'Active Days' : language === 'ms' ? 'Hari Aktif' : '\u6D3B\u8DC3\u5929\u6570' },
    { icon: <Award size={16} style={{ color: '#a78bfa' }} />, value: favMode[1] > 0 ? (favLabels[favMode[0]]?.[language] || favMode[0]) : '--', label: language === 'en' ? 'Favorite Mode' : language === 'ms' ? 'Mod Kegemaran' : '\u6700\u7231\u6A21\u5F0F' },
  ];

  return (
    <motion.div
      className="rounded-2xl p-4 mb-5"
      style={{ background: CARD_BG, border: CARD_BORDER, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} style={{ color: GOLD }} />
        <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>
          {language === 'en' ? 'Adventure Stats' : language === 'ms' ? 'Statistik Pengembaraan' : '\u5192\u9669\u7EDF\u8BA1'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-xl px-3 py-3 text-center" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}12` }}>
            <div className="flex justify-center mb-1.5">{stat.icon}</div>
            <div className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>{stat.value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: `${PARCHMENT}60` }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ===== ACTIVITY TIMELINE SECTION =====
function ActivityTimelineSection({
  activities,
  language,
  streak,
}: {
  activities: ActivityDay[];
  language: 'en' | 'ms' | 'zh';
  streak: number;
}) {
  const { t } = useLanguage();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<{ date: string; data: ActivityDay | null; isToday: boolean } | null>(null);

  const goBack = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goForward = () => {
    const isCurrent = viewMonth === today.getMonth() && viewYear === today.getFullYear();
    if (isCurrent) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };
  const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const monthLocale = language === 'ms' ? 'ms-MY' : language === 'zh' ? 'zh-CN' : 'en-MY';
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(monthLocale, { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  let activeDaysThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (getIntensity(activities.find((a) => a.date === dateStr) || null) > 0) activeDaysThisMonth++;
  }

  return (
    <>
      <motion.div
        className="rounded-2xl p-5 mb-5"
        style={{ background: CARD_BG, border: CARD_BORDER, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-5 h-5" style={{ color: '#ff6b35' }} />
          <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>{t('mastery.timeline')}</span>
        </div>
        <p className="mb-3 text-[10px]" style={{ color: `${PARCHMENT}60` }}>{t('mastery.timelineSub')}</p>

        {streak > 0 && (
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
              <Flame className="w-4 h-4" style={{ color: '#ff6b35' }} />
              <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>{streak}{t('mastery.streak')}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <button onClick={goBack} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
            <ChevronLeft className="w-4 h-4" style={{ color: GOLD }} />
          </button>
          <div className="text-center">
            <h4 className="text-sm font-bold capitalize" style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}>{monthName}</h4>
            <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}50` }}>{activeDaysThisMonth} {t('mastery.calendarAdventures')}</p>
          </div>
          <button onClick={goForward} disabled={isCurrentMonth} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20`, opacity: isCurrentMonth ? 0.3 : 1 }}>
            <ChevronRight className="w-4 h-4" style={{ color: GOLD }} />
          </button>
        </div>

        <CalendarMonth year={viewYear} month={viewMonth} activities={activities} onDayClick={(date, data, isToday) => setSelectedDay({ date, data, isToday })} />

        <div className="flex items-center justify-center gap-3 mt-4">
          <span className="text-[10px]" style={{ color: `${PARCHMENT}65` }}>{t('mastery.less')}</span>
          {INTENSITY_COLORS.map((color, idx) => (
            <div key={idx} className="w-4 h-4 rounded" style={{ background: color, border: `1px solid ${GOLD}15` }} />
          ))}
          <span className="text-[10px]" style={{ color: `${PARCHMENT}65` }}>{t('mastery.more')}</span>
        </div>
      </motion.div>

      {selectedDay && createPortal(
        <DayDetailModal date={selectedDay.date} data={selectedDay.data} isToday={selectedDay.isToday} onClose={() => setSelectedDay(null)} language={language} />,
        document.body
      )}
    </>
  );
}

// ===== FUNCTIONAL AGE HELPER =====
// Estimates a "functional age" from mastery percentage (KSSR ages 4-7).
function estimateFunctionalAge(pct: number): number {
  if (pct >= 75) return 7;
  if (pct >= 50) return 6;
  if (pct >= 25) return 5;
  return 4;
}

// ===== AGE COMPARISON SECTION =====
function AgeComparisonSection({
  subjects,
  subjectMap,
  excludedSubjects,
  childAge,
  childName,
  language,
}: {
  subjects: SubjectDef[];
  subjectMap: Record<string, SubjectMastery>;
  excludedSubjects: string[];
  childAge: number;
  childName: string;
  language: 'en' | 'ms' | 'zh';
}) {
  const { t } = useLanguage();
  const activeSubjects = subjects.filter(s => !excludedSubjects.includes(s.id) && subjectMap[s.id]);
  if (activeSubjects.length === 0) return null;

  const getAgeDiffLabel = (functionalAge: number) => {
    const diff = functionalAge - childAge;
    if (diff > 0) return { text: `+${diff} ${t('mastery.ahead')}`, color: '#7cc643' };
    if (diff < 0) return { text: `${Math.abs(diff)} ${t('mastery.behind')}`, color: '#e74c3c' };
    return { text: t('mastery.onTrack'), color: GOLD };
  };

  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-center gap-2 justify-center mb-3">
        <Crown size={14} style={{ color: GOLD }} />
        <p className="text-center text-[11px] font-bold uppercase tracking-wider" style={{ color: `${PARCHMENT}75` }}>
          {childName} ({t('mastery.age')} {childAge}) {'\u2014'} {t('mastery.functionalAge')}
        </p>
      </div>
      {activeSubjects.map((sub) => {
        const mastery = subjectMap[sub.id];
        const pct = mastery?.percentage ?? 0;
        const functionalAge = estimateFunctionalAge(pct);
        const diff = getAgeDiffLabel(functionalAge);
        const isAbove = functionalAge > childAge;
        const isMax = functionalAge >= 7;
        return (
          <div
            key={sub.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: isAbove ? `${diff.color}08` : `${GOLD}06`,
              border: `1px solid ${isAbove ? `${diff.color}20` : `${GOLD}15`}`,
            }}
          >
            <span className="text-xl flex-shrink-0">{sub.emoji}</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                {sub.name[language]}
              </span>
              <div className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>
                {pct}% {t('mastery.overall')}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Zap className="w-3 h-3" style={{ color: diff.color }} />
              <span
                className="text-xs font-black px-2 py-1 rounded-md"
                style={{
                  background: isMax
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,170,0,0.15))'
                    : `${diff.color}15`,
                  color: isMax ? '#ffd700' : diff.color,
                  border: `1px solid ${isMax ? 'rgba(255,215,0,0.3)' : `${diff.color}30`}`,
                  boxShadow: isMax ? '0 0 8px rgba(255,215,0,0.2)' : 'none',
                }}
              >
                {language === 'en' ? 'Age' : language === 'ms' ? 'Umur' : '\u5E74\u9F84'} {functionalAge}{isMax ? ' \u2728' : ''}
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: diff.color, background: `${diff.color}12` }}
              >
                {diff.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== SUBJECT COMPARISON BAR CHART =====
function SubjectComparisonBarChart({
  subjects,
  subjectMap,
  excludedSubjects,
  language,
}: {
  subjects: SubjectDef[];
  subjectMap: Record<string, SubjectMastery>;
  excludedSubjects: string[];
  language: 'en' | 'ms' | 'zh';
}) {
  const { t } = useLanguage();
  const data = subjects
    .filter(s => !excludedSubjects.includes(s.id))
    .map((s, idx) => ({
      name: s.name[language].length > 10 ? s.name[language].slice(0, 9) + '\u2026' : s.name[language],
      fullName: s.name[language],
      score: subjectMap[s.id]?.percentage ?? 0,
      fill: s.color || CHART_COLORS[idx % CHART_COLORS.length],
    }));

  if (data.every(d => d.score === 0)) return null;

  return (
    <motion.div
      className="rounded-2xl p-4 mb-5"
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={16} style={{ color: GOLD }} />
        <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>
          {t('mastery.subjectComparison')}
        </span>
      </div>
      <p className="mb-3" style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
        {t('mastery.subjectComparisonSub')}
      </p>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: `${PARCHMENT}70`, fontSize: 10 }}
              axisLine={{ stroke: `${GOLD}20` }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: `${PARCHMENT}70`, fontSize: 10 }}
              axisLine={{ stroke: `${GOLD}20` }}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: 'rgba(15,12,6,0.95)',
                      border: `1px solid ${GOLD}30`,
                      color: PARCHMENT,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                    }}
                  >
                    <p className="font-bold mb-1" style={{ color: GOLD_LIGHT }}>{d.fullName}</p>
                    <p style={{ color: d.fill }}>{d.score}%</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="score" name="Score" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={`subj-bar-${index}`} fill={entry.fill} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ===== FOXY PROMO CARD =====
function FoxyPromoCard({ language, onUpgrade }: { language: 'en' | 'ms' | 'zh'; onUpgrade: () => void }) {
  const { t } = useLanguage();
  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative mb-5"
      style={{
        background: CARD_BG,
        border: `2px solid ${LEGENDARY_ORANGE}50`,
        boxShadow: `0 0 25px ${LEGENDARY_ORANGE}20, inset 0 0 25px ${LEGENDARY_ORANGE}08`,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.4 }}
    >
      {/* Limited Intro Offer ribbon */}
      <div
        className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
        style={{
          background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
          color: '#fff',
          boxShadow: `0 2px 10px ${LEGENDARY_ORANGE}60`,
          fontFamily: CHERRY,
        }}
      >
        {t('plan.limitedIntro')}
      </div>

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Toy image */}
          <div className="flex-shrink-0">
            <div
              className="w-24 h-24 rounded-xl overflow-hidden flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #fff5eb, #ffe8d5)',
                border: `2px solid ${LEGENDARY_ORANGE}30`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }}
            >
              <img
                src={foxyToyImage}
                alt="FOXY-o1 AI Toy"
                className="w-full h-full object-contain p-1"
              />
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0 pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4" style={{ color: LEGENDARY_ORANGE }} />
              <h3
                className="text-sm font-black tracking-wide"
                style={{
                  fontFamily: CHERRY,
                  color: GOLD_LIGHT,
                  textShadow: `0 0 10px ${LEGENDARY_ORANGE}30`,
                }}
              >
                {t('plan.foxyTitle')}
              </h3>
            </div>
            <p className="text-xs font-bold mb-1.5" style={{ color: LEGENDARY_ORANGE }}>
              {t('plan.foxySubtitle')}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: `${PARCHMENT}bb` }}>
              {t('plan.foxyDesc')}
            </p>
          </div>
        </div>

        {/* Bundle pricing */}
        <div
          className="mt-4 p-3 rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}12, ${LEGENDARY_ORANGE}06)`,
            border: `1px solid ${LEGENDARY_ORANGE}25`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${PARCHMENT}90` }}>
            {t('plan.foxyBundle')}
          </p>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span
              className="text-xl font-black"
              style={{
                color: LEGENDARY_ORANGE,
                fontFamily: CHERRY,
                textShadow: `0 0 12px ${LEGENDARY_ORANGE}30`,
              }}
            >
              RM365
            </span>
            <span className="text-sm line-through" style={{ color: `${PARCHMENT}60` }}>
              RM730
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${LEGENDARY_ORANGE}20`, color: LEGENDARY_ORANGE }}
            >
              -50%
            </span>
            <span
              className="text-[11px] font-black px-2 py-0.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, #f0d078)`,
                color: '#2a1f0e',
                boxShadow: `0 0 10px ${GOLD}40`,
              }}
            >
              {t('plan.perDay')}
            </span>
          </div>
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: `${PARCHMENT}80` }}>
            {t('plan.earlyAdopter')}
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={onUpgrade}
          className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all hover:brightness-110"
          style={{
            background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
            color: '#fff',
            fontFamily: CHERRY,
            boxShadow: `0 4px 20px ${LEGENDARY_ORANGE}50`,
          }}
        >
          <Sparkles className="w-4 h-4" />
          {t('plan.foxyCta')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ===== MAIN PAGE =====
export function RealmMasteryPage() {
  const navigate = useNavigate();
  const ctx = useAppContext();
  const realm = useRealmContext();
  const { isLandscape } = realm;
  const { language, t } = useLanguage();
  const { data: masteryProfile, loading } = useMasteryProfile();
  const [selectedMode, setSelectedMode] = useState<ModeKey>('all');
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Fetch activity timeline — use realm userId (same ID used by daily-log writes)
  const realmUserId = realm.userId;

  useEffect(() => {
    // Use realm userId (matches the ID used by POST /realm/daily-log/:userId cross-writes)
    const userId = realmUserId || localStorage.getItem('parent_id');
    if (!userId) {
      console.warn('[MASTERY] No userId — skipping activity fetch');
      setActivityLoading(false);
      return;
    }
    console.log('[MASTERY] Fetching activity timeline for userId:', userId);

    // Get a fresh token for auth (async)
    const doFetch = async () => {
      let token: string | null = null;
      try { token = await getFreshParentToken(); } catch {}
      if (!token) {
        const raw = localStorage.getItem('parent_access_token');
        if (raw && !isJwtExpired(raw)) token = raw;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      if (token) headers['X-User-Token'] = `Bearer ${token}`;

      return fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/realm/activity/${userId}`,
        { headers }
      );
    };

    doFetch()
      .then((res) => {
        if (!res.ok) {
          console.warn('[MASTERY] Activity fetch failed:', res.status);
          return { activities: [] };
        }
        return res.json();
      })
      .then((result) => setActivityData(result.activities || []))
      .catch((e) => console.error('[MASTERY] Activity load failed:', e))
      .finally(() => setActivityLoading(false));
  }, [realmUserId]);

  // Calculate streak
  const streak = useMemo(() => {
    const today = new Date();
    let s = 0;
    for (let i = 0; ; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const data = activityData.find((a) => a.date === dateStr) || null;
      if (getIntensity(data) > 0) s++;
      else break;
    }
    return s;
  }, [activityData]);

  // Get child info
  const parentData = useMemo(() => getStoredParentData(), []);
  const childName = parentData?.child_name || ctx.leadData?.childName || 'Explorer';
  const childAge: number = parentData?.child_age || ctx.leadData?.childAge || 5;
  const excludedSubjects: string[] = parentData?.excluded_subjects || ctx.excludedSubjects || [];
  const subStatus = parentData?.subscription_status || 'free';
  const isPaidUser = subStatus === 'active' || subStatus === 'founder';
  const isPaidPlanB = isPaidUser && (parentData?.subscription_plan || '').toUpperCase() === 'B';

  // Build radar data — always 7 axes
  const radarData = useMemo(() => {
    const result = SUBJECTS.map((sub) => {
      const mastery = masteryProfile?.subjects?.find((s) => s.subjectId.toLowerCase() === sub.id);
      const isExcluded = excludedSubjects.includes(sub.id);
      return {
        subject: sub.name[language],
        subjectId: sub.id,
        percentage: isExcluded ? 0 : (mastery?.percentage ?? 0),
        fullMark: 100,
        isExcluded,
        _matched: !!mastery,
      };
    });
    // Debug: log which subjects matched / didn't
    if (masteryProfile?.subjects?.length) {
      const serverIds = masteryProfile.subjects.map((s) => s.subjectId);
      const matched = result.filter(r => r._matched).map(r => r.subjectId);
      const unmatched = serverIds.filter(sid => !matched.includes(sid.toLowerCase()));
      console.log('[MASTERY] Radar matching:', {
        serverSubjects: serverIds,
        matched,
        unmatchedFromServer: unmatched,
      });
    }
    return result;
  }, [masteryProfile, language, excludedSubjects]);

  // Overall stats
  const totalQuestions = masteryProfile?.totalQuestions ?? 0;
  const totalCorrect = masteryProfile?.totalCorrect ?? 0;
  const overallPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const hasAnyData = totalQuestions > 0;

  // Subject mastery lookup
  const subjectMap = useMemo(() => {
    const map: Record<string, SubjectMastery> = {};
    masteryProfile?.subjects?.forEach((s) => { map[s.subjectId.toLowerCase()] = s; });
    return map;
  }, [masteryProfile]);

  return (
    <div className="w-full h-full overflow-y-auto pb-20" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* ── Background overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(8,6,3,0.7) 0%, rgba(8,6,3,0.4) 30%, rgba(8,6,3,0.6) 100%)',
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-4">
        {/* ── Back Button ── */}
        <motion.button
          onClick={() => navigate('/realm')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full mb-4"
          style={{
            background: CARD_BG,
            border: `1.5px solid rgba(255,215,0,0.3)`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: GOLD }} />
          <span style={{ fontFamily: CHERRY, fontSize: 11, color: GOLD }}>
            {t('realm.backToRealm')}
          </span>
        </motion.button>

        {/* ── Hero Header ── */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            style={{
              fontFamily: CINZEL,
              fontSize: 22,
              color: GOLD,
              textShadow: '0 2px 12px rgba(255,215,0,0.3)',
              letterSpacing: '0.04em',
            }}
          >
            {language === 'en' ? 'Mastery Grimoire' : language === 'ms' ? 'Grimoire Penguasaan' : '\u638C\u63E1\u9B54\u5178'}
          </h1>
          <p className="mt-1" style={{ fontFamily: CHERRY, fontSize: 13, color: `${PARCHMENT}80` }}>
            {childName}{language === 'en' ? "'s KSSR Journey" : language === 'ms' ? ' \u2014 Perjalanan KSSR' : '\u7684KSSR\u65C5\u7A0B'}
          </p>

          {/* Overall stats row */}
          {hasAnyData && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Target size={14} style={{ color: GOLD }} />
                <span style={{ fontSize: 12, color: GOLD_LIGHT, fontFamily: CHERRY }}>{overallPct}%</span>
                <span style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
                  {language === 'en' ? 'overall' : language === 'ms' ? 'keseluruhan' : '\u603B\u4F53'}
                </span>
              </div>
              <div className="w-px h-4" style={{ background: `${GOLD}30` }} />
              <div className="flex items-center gap-1.5">
                <Award size={14} style={{ color: GOLD }} />
                <span style={{ fontSize: 12, color: GOLD_LIGHT, fontFamily: CHERRY }}>{totalQuestions}</span>
                <span style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
                  {language === 'en' ? 'questions' : language === 'ms' ? 'soalan' : '\u9898\u76EE'}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Mode Filter ── */}
        <motion.div
          className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 px-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex items-center gap-1 mr-2">
            <Filter size={12} style={{ color: `${PARCHMENT}50` }} />
            <span style={{ fontSize: 10, color: `${PARCHMENT}50`, whiteSpace: 'nowrap' }}>
              {language === 'en' ? 'View by:' : language === 'ms' ? 'Lihat:' : '\u67E5\u770B:'}
            </span>
          </div>
          {MODES.map((mode) => {
            const isActive = selectedMode === mode.key;
            const isDisabled = mode.key !== 'all' && !hasAnyData;
            return (
              <button
                key={mode.key}
                onClick={() => !isDisabled && setSelectedMode(mode.key)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full whitespace-nowrap transition-all"
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${GOLD}30, ${GOLD}15)`
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? `${GOLD}50` : 'rgba(255,255,255,0.08)'}`,
                  color: isActive ? GOLD_LIGHT : `${PARCHMENT}${isDisabled ? '30' : '60'}`,
                  fontSize: 11,
                  fontFamily: CHERRY,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
                disabled={isDisabled}
              >
                {mode.icon}
                {mode.label[language]}
              </button>
            );
          })}
        </motion.div>

        {/* ── Spider Web Radar ── */}
        <motion.div
          className="rounded-2xl p-4 mb-5"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} style={{ color: GOLD }} />
            <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>
              {t('mastery.readinessRadar')}
            </span>
          </div>
          <p className="mb-3" style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
            {language === 'en'
              ? '7 KSSR subjects \u2022 Ring = 0% \u2192 100% mastery'
              : language === 'ms'
                ? '7 subjek KSSR \u2022 Bulatan = 0% \u2192 100% penguasaan'
                : '7\u4E2AKSSR\u79D1\u76EE \u2022 \u73AF = 0% \u2192 100%\u638C\u63E1\u5EA6'}
          </p>

          <div className="w-full" style={{ minHeight: 320 }}>
            <ResponsiveContainer width="100%" height={320} minWidth={200}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid
                  key="polar-grid"
                  stroke={`${GOLD}18`}
                  strokeDasharray="3 3"
                  gridType="polygon"
                />
                <PolarAngleAxis
                  key="polar-angle"
                  dataKey="subjectId"
                  tick={<RadarTick language={language} />}
                  stroke={`${GOLD}25`}
                />
                <PolarRadiusAxis
                  key="polar-radius"
                  angle={90}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  key="radar-mastery"
                  name="Mastery"
                  dataKey="percentage"
                  stroke={GOLD}
                  fill={GOLD}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: GOLD,
                    stroke: '#0a0a12',
                    strokeWidth: 2,
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div
                        className="px-3 py-2 rounded-lg"
                        style={{
                          background: 'rgba(15,12,6,0.95)',
                          border: `1px solid ${GOLD}30`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                        }}
                      >
                        <p style={{ fontFamily: CHERRY, fontSize: 12, color: GOLD_LIGHT }}>{d.subject}</p>
                        <p style={{ fontSize: 11, color: d.isExcluded ? `${PARCHMENT}50` : PARCHMENT }}>
                          {d.isExcluded ? 'Opted out' : `${d.percentage}% mastery`}
                        </p>
                      </div>
                    );
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend for excluded subjects */}
          {excludedSubjects.length > 0 && (
            <div className="flex items-center gap-2 mt-2 justify-center">
              <div className="w-3 h-0.5" style={{ background: `${PARCHMENT}30`, borderRadius: 1 }} />
              <span style={{ fontSize: 9, color: `${PARCHMENT}40` }}>
                {language === 'en' ? 'Greyed = opted out' : language === 'ms' ? 'Kelabu = tidak dipilih' : '\u7070\u8272 = \u672A\u9009\u62E9'}
              </span>
            </div>
          )}

          {/* ── Age Comparison Per Subject ── */}
          {hasAnyData && (
            <AgeComparisonSection
              subjects={SUBJECTS}
              subjectMap={subjectMap}
              excludedSubjects={excludedSubjects}
              childAge={childAge}
              childName={childName}
              language={language}
            />
          )}
        </motion.div>

        {/* ── Subject Mastery Cards ── */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} style={{ color: GOLD }} />
            <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>
              {t('mastery.subjectMastery')}
            </span>
          </div>
          <p className="mb-3" style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
            {language === 'en'
              ? 'Tap a subject to see topic & skill breakdown'
              : language === 'ms'
                ? 'Ketik subjek untuk melihat pecahan topik & kemahiran'
                : '\u70B9\u51FB\u79D1\u76EE\u67E5\u770B\u4E3B\u9898\u548C\u6280\u80FD\u5206\u89E3'}
          </p>

          <div className="space-y-2.5">
            {SUBJECTS.map((sub, i) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
              >
                <SubjectCard
                  subject={sub}
                  mastery={subjectMap[sub.id] || null}
                  isExcluded={excludedSubjects.includes(sub.id)}
                  language={language}
                  selectedMode={selectedMode}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Subject Comparison Bar Chart ── */}
        {hasAnyData && (
          <SubjectComparisonBarChart
            subjects={SUBJECTS}
            subjectMap={subjectMap}
            excludedSubjects={excludedSubjects}
            language={language}
          />
        )}

        {/* ── Recommendations ── */}
        <motion.div
          className="rounded-2xl p-4 mb-5"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} style={{ color: GOLD }} />
            <span style={{ fontFamily: CINZEL, fontSize: 14, color: GOLD }}>
              {t('mastery.recommendations')}
            </span>
          </div>
          <p className="mb-2" style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
            {language === 'en'
              ? 'Cross-mode insights based on all your activities'
              : language === 'ms'
                ? 'Pandangan merentas mod berdasarkan semua aktiviti anda'
                : '\u57FA\u4E8E\u6240\u6709\u6D3B\u52A8\u7684\u8DE8\u6A21\u5F0F\u6D1E\u5BDF'}
          </p>

          {hasAnyData ? (
            <div className="space-y-2">
              {/* Recommendations will be generated from mastery_log data */}
              {masteryProfile?.subjects
                ?.filter((s) => s.percentage < 60 && s.totalAttempts > 0)
                .slice(0, 3)
                .map((s) => {
                  const subDef = SUBJECTS.find((d) => d.id === s.subjectId.toLowerCase());
                  return (
                    <div
                      key={s.subjectId}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                      style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}10` }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${subDef?.color || GOLD}15`, color: subDef?.color || GOLD }}
                      >
                        {subDef?.icon || <Target size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 11, color: GOLD_LIGHT, fontWeight: 600 }}>
                          {language === 'en'
                            ? `Focus on ${subDef?.name.en || s.subjectId}`
                            : language === 'ms'
                              ? `Fokus pada ${subDef?.name.ms || s.subjectId}`
                              : `\u4E13\u6CE8\u4E8E${subDef?.name.zh || s.subjectId}`}
                        </p>
                        <p style={{ fontSize: 10, color: `${PARCHMENT}60` }}>
                          {s.percentage}% mastery ({s.totalCorrect}/{s.totalAttempts})
                          {language === 'en'
                            ? ' \u2014 try practice mode for targeted improvement'
                            : language === 'ms'
                              ? ' \u2014 cuba mod latihan untuk peningkatan bersasar'
                              : ' \u2014 \u5C1D\u8BD5\u7EC3\u4E60\u6A21\u5F0F\u8FDB\u884C\u6709\u9488\u5BF9\u6027\u7684\u63D0\u5347'}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles size={20} style={{ color: GOLD }} />}
              title={
                language === 'en'
                  ? 'Recommendations unlock with data'
                  : language === 'ms'
                    ? 'Cadangan dibuka dengan data'
                    : '\u5EFA\u8BAE\u5C06\u968F\u6570\u636E\u89E3\u9501'
              }
              subtitle={
                language === 'en'
                  ? 'Complete quests, practice, or battles to get personalized tips'
                  : language === 'ms'
                    ? 'Selesaikan pencarian, latihan, atau pertempuran untuk mendapat petua peribadi'
                    : '\u5B8C\u6210\u4EFB\u52A1\u3001\u7EC3\u4E60\u6216\u5BF9\u6218\u4EE5\u83B7\u53D6\u4E2A\u6027\u5316\u63D0\u793A'
              }
            />
          )}
        </motion.div>

        {/* ── Adventure Stats ── */}
        {!activityLoading && activityData.length > 0 && (
          <AdventureStatsSection activities={activityData} language={language} streak={streak} />
        )}

        {/* ── Evolution Path & Battle Stats ── */}
        <EvolutionProgressCard
          stage={realm.stats.evolutionStage as EvolutionStage}
          level={realm.stats.level}
          battleWins={realm.stats.battleWins || 0}
          language={language}
        />

        {/* ── Activity Timeline / Monthly Calendar ── */}
        {!activityLoading && (
          <ActivityTimelineSection activities={activityData} language={language} streak={streak} />
        )}

        {/* ── Bring Home Foxy Promo (only if not on Plan B) ── */}
        {!isPaidPlanB && (
          <FoxyPromoCard language={language} onUpgrade={() => navigate('/parent/plan')} />
        )}

        {/* ── No Data Overall Banner ── */}
        {!hasAnyData && !loading && (
          <motion.div
            className="rounded-2xl p-6 mb-5 text-center"
            style={{
              background: CARD_BG,
              border: `1.5px dashed ${GOLD}30`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: `${GOLD}10`, border: `2px dashed ${GOLD}25` }}
            >
              <ScrollText size={28} style={{ color: GOLD }} />
            </div>
            <h3 style={{ fontFamily: CHERRY, fontSize: 15, color: GOLD_LIGHT }}>
              {language === 'en'
                ? 'Your Grimoire Awaits'
                : language === 'ms'
                  ? 'Grimoire Anda Menunggu'
                  : '\u60A8\u7684\u9B54\u5178\u5728\u7B49\u5F85'}
            </h3>
            <p className="mt-1 mb-4" style={{ fontSize: 11, color: `${PARCHMENT}60`, maxWidth: 280, margin: '4px auto 16px' }}>
              {language === 'en'
                ? 'Complete quests, practice sessions, battles, or tests to fill your mastery grimoire with knowledge.'
                : language === 'ms'
                  ? 'Selesaikan pencarian, sesi latihan, pertempuran, atau ujian untuk mengisi grimoire penguasaan anda dengan ilmu.'
                  : '\u5B8C\u6210\u4EFB\u52A1\u3001\u7EC3\u4E60\u3001\u5BF9\u6218\u6216\u6D4B\u8BD5\uFF0C\u7528\u77E5\u8BC6\u586B\u6EE1\u60A8\u7684\u638C\u63E1\u9B54\u5178\u3002'}
            </p>
            <button
              onClick={() => navigate('/realm')}
              className="px-4 py-2 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}15)`,
                border: `1.5px solid ${GOLD}50`,
                fontFamily: CHERRY,
                fontSize: 12,
                color: GOLD_LIGHT,
              }}
            >
              {language === 'en' ? 'Start Adventuring' : language === 'ms' ? 'Mula Pengembaraan' : '\u5F00\u59CB\u5192\u9669'}
            </button>
          </motion.div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-12 h-12 rounded-full mb-3"
              style={{
                border: '2.5px solid transparent',
                borderTopColor: GOLD,
                borderRightColor: `${GOLD}60`,
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ fontFamily: CHERRY, fontSize: 12, color: `${PARCHMENT}60` }}>
              {language === 'en' ? 'Opening grimoire...' : language === 'ms' ? 'Membuka grimoire...' : '\u6253\u5F00\u9B54\u5178...'}
            </p>
          </div>
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}