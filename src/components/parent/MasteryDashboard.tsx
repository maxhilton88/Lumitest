import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Star, Swords, Eye, Shield, Flame, ChevronLeft, ChevronRight,
  Trophy, TrendingUp, Target, Crown, Award, Zap, Lock, X, ArrowRight, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { SpiderWebChart } from '../SpiderWebChart';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import {
  calculateTP,
  calculateSubjectBreakdowns,
  buildRadarData,
  calculateReadiness,
  calculateTotalStars,
  generateRecommendations,
  type DetailedAnswer,
  type SubjectAgeBreakdown,
} from '../../utils/report-calculations';
import { fetchActivityTimeline, fetchAssessmentHistory } from '../../utils/parent-api';
import { useLanguage } from '../LanguageContext';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';

// ===== THEME CONSTANTS =====
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CINZEL = "'Cinzel Decorative', serif";
const DARK_BG = 'linear-gradient(135deg, rgba(26,18,10,0.95) 0%, rgba(35,26,14,0.95) 100%)';
const LEGENDARY_ORANGE = '#e8722a';

// Chart color palette (RPG-themed)
const CHART_COLORS = ['#d4a44a', '#e67e22', '#9b59b6', '#27ae60', '#3498db', '#e74c3c'];
const AGE_COLORS: Record<number, string> = {
  4: '#3498db',
  5: '#27ae60',
  6: '#e67e22',
  7: '#e74c3c',
};

// ===== HERO RANK SYSTEM =====
interface HeroRank {
  title: string;
  minStars: number;
  color: string;
  glow: string;
  emoji: string;
}

const HERO_RANKS: HeroRank[] = [
  { title: 'Little Explorer', minStars: 0, color: '#8B7355', glow: 'rgba(139,115,85,0.3)', emoji: '\u{1F9ED}' },
  { title: 'Rising Hero', minStars: 3, color: '#6BA368', glow: 'rgba(107,163,104,0.3)', emoji: '\u{2694}\uFE0F' },
  { title: 'Brave Scholar', minStars: 6, color: '#4A90D9', glow: 'rgba(74,144,217,0.3)', emoji: '\u{1F4DA}' },
  { title: 'Grand Adventurer', minStars: 10, color: '#9B59B6', glow: 'rgba(155,89,182,0.3)', emoji: '\u{1F3C6}' },
  { title: 'Legendary Master', minStars: 14, color: '#E67E22', glow: 'rgba(230,126,34,0.3)', emoji: '\u{1F451}' },
  { title: 'Mythic Champion', minStars: 18, color: '#FFD700', glow: 'rgba(255,215,0,0.4)', emoji: '\u{2728}' },
];

function getHeroRank(totalStars: number): HeroRank {
  let rank = HERO_RANKS[0];
  for (const r of HERO_RANKS) {
    if (totalStars >= r.minStars) rank = r;
  }
  return rank;
}

// ===== ANIMATED COUNTER =====
const AnimatedCounter: React.FC<{ target: number; duration?: number; suffix?: string }> = ({
  target, duration = 1200, suffix = '',
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span>{count}{suffix}</span>;
};

// ===== SPARKLE PARTICLES =====
const SparkleParticles: React.FC = () => {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 4}s`,
    size: 2 + Math.random() * 3,
    duration: `${3 + Math.random() * 3}s`,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-pulse"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, ${GOLD_LIGHT} 0%, transparent 70%)`,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
};

// ===== FANTASY CHART TOOLTIP =====
const FantasyTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'rgba(26,18,10,0.95)',
        border: `1px solid ${GOLD}50`,
        color: PARCHMENT,
        boxShadow: `0 4px 12px rgba(0,0,0,0.5)`,
      }}
    >
      <p className="font-bold mb-1" style={{ color: GOLD_LIGHT }}>{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} style={{ color: entry.color || GOLD }}>
          {entry.name}: {entry.value}{typeof entry.value === 'number' && entry.value <= 100 ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

// ===== SECTION HEADER =====
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({
  icon, title, subtitle,
}) => (
  <div className="flex items-center gap-3 mb-4">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}
    >
      {icon}
    </div>
    <div>
      <h3 className="text-base font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
        {title}
      </h3>
      {subtitle && (
        <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>{subtitle}</p>
      )}
    </div>
  </div>
);

// ===== LOCKED PREVIEW PLACEHOLDER =====
const LockedPreview: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  height?: number;
  children?: React.ReactNode;
}> = ({ icon, title, subtitle, description, height, children }) => {
  const { t } = useLanguage();
  return (
  <FantasyPanel className="p-5 md:p-6 relative overflow-hidden">
    {/* Dim overlay */}
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center"
      style={{ background: 'rgba(26,18,10,0.55)', backdropFilter: 'blur(2px)' }}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{
          background: `radial-gradient(circle, ${GOLD}15 0%, transparent 70%)`,
          border: `2px dashed ${GOLD}35`,
        }}
      >
        <Lock className="w-6 h-6" style={{ color: `${GOLD}70` }} />
      </div>
      <h4 className="text-sm font-bold text-center mb-1" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
        {description}
      </h4>
      <p className="text-[11px] text-center max-w-xs" style={{ color: `${PARCHMENT}70` }}>
        {t('mastery.unlockSection')}
      </p>
    </div>
    {/* Ghost content behind overlay */}
    <div style={{ opacity: 0.15, pointerEvents: 'none' }}>
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      {children || (
        <div style={{ height: height || 180 }} className="flex items-center justify-center">
          <div className="w-full h-full rounded-xl" style={{ background: `${GOLD}06`, border: `1px dashed ${GOLD}12` }} />
        </div>
      )}
    </div>
  </FantasyPanel>
  );
};

// ===== ACTIVITY CALENDAR MAP =====
interface ActivityDay {
  date: string;
  tests: number;
  watches: number;
  practices: number;
  questions_total?: number;
  questions_correct?: number;
}

const getIntensity = (data: ActivityDay | null): number => {
  if (!data) return 0;
  const total = data.tests + data.watches + data.practices;
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

// Day detail modal — RPG parchment card style
const DayDetailModal: React.FC<{
  date: string;
  data: ActivityDay | null;
  isToday: boolean;
  onClose: () => void;
}> = ({ date, data, isToday, onClose }) => {
  const { t } = useLanguage();
  const total = data ? data.tests + data.watches + data.practices : 0;
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
        {/* Decorative top border */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between">
          <div>
            <h3
              className="text-base font-bold"
              style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}
            >
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
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
          >
            <X className="w-4 h-4" style={{ color: `${PARCHMENT}70` }} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          {total > 0 ? (
            <>
              {/* Total badge */}
              <div
                className="flex items-center justify-center gap-2 py-3 mb-4 rounded-xl"
                style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}20` }}
              >
                <Flame className="w-5 h-5" style={{ color: '#ff6b35' }} />
                <span className="text-lg font-bold" style={{ color: GOLD_LIGHT }}>
                  {total}
                </span>
                <span className="text-sm" style={{ color: `${PARCHMENT}80` }}>
                  {t('mastery.calendarAdventures')}
                </span>
              </div>

              {/* Breakdown */}
              <div className="space-y-2.5">
                {data!.tests > 0 && (
                  <div
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}12` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Swords className="w-4 h-4" style={{ color: '#e74c3c' }} />
                      <span className="text-sm" style={{ color: `${PARCHMENT}90` }}>
                        {t('mastery.quests')}
                      </span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>
                      {data!.tests}
                    </span>
                  </div>
                )}
                {data!.watches > 0 && (
                  <div
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}12` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Eye className="w-4 h-4" style={{ color: '#3498db' }} />
                      <span className="text-sm" style={{ color: `${PARCHMENT}90` }}>
                        {t('mastery.videos')}
                      </span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>
                      {data!.watches}
                    </span>
                  </div>
                )}
                {data!.practices > 0 && (
                  <div
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}12` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4" style={{ color: '#27ae60' }} />
                      <span className="text-sm" style={{ color: `${PARCHMENT}90` }}>
                        {t('mastery.training')}
                      </span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>
                      {data!.practices}
                    </span>
                  </div>
                )}
              </div>

              {/* Questions breakdown — ROI for parents */}
              {(data!.questions_total ?? 0) > 0 && (() => {
                const qTotal = data!.questions_total!;
                const qCorrect = data!.questions_correct ?? 0;
                const qWrong = qTotal - qCorrect;
                const pct = Math.round((qCorrect / qTotal) * 100);
                return (
                  <div
                    className="mt-4 rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${GOLD}20` }}
                  >
                    {/* Mini header */}
                    <div
                      className="px-3.5 py-2 flex items-center gap-2"
                      style={{ background: `${GOLD}10` }}
                    >
                      <Target className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      <span className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                        {t('mastery.calendarQuestions')}
                      </span>
                    </div>

                    {/* Score bar */}
                    <div className="px-3.5 pt-3 pb-2">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-bold" style={{ color: GOLD_LIGHT }}>
                          {qTotal}
                        </span>
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

                      {/* Progress bar */}
                      <div
                        className="h-2.5 rounded-full overflow-hidden mb-3"
                        style={{ background: `${GOLD}10` }}
                      >
                        <div className="h-full flex">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${(qCorrect / qTotal) * 100}%`,
                              background: 'linear-gradient(90deg, #27ae60, #4cbb7a)',
                              borderRadius: qWrong > 0 ? '9999px 0 0 9999px' : '9999px',
                            }}
                          />
                          {qWrong > 0 && (
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${(qWrong / qTotal) * 100}%`,
                                background: 'linear-gradient(90deg, #c0392b, #e74c3c)',
                                borderRadius: qCorrect > 0 ? '0 9999px 9999px 0' : '9999px',
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Correct / Wrong pills */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4cbb7a' }} />
                          <span className="text-xs" style={{ color: `${PARCHMENT}70` }}>
                            {t('mastery.calendarCorrect')}
                          </span>
                          <span className="text-xs font-bold" style={{ color: '#4cbb7a' }}>
                            {qCorrect}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e74c3c' }} />
                          <span className="text-xs" style={{ color: `${PARCHMENT}70` }}>
                            {t('mastery.calendarWrong')}
                          </span>
                          <span className="text-xs font-bold" style={{ color: '#e74c3c' }}>
                            {qWrong}
                          </span>
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
              <p className="text-sm" style={{ color: `${PARCHMENT}60` }}>
                {t('mastery.calendarRestDay')}
              </p>
            </div>
          )}
        </div>

        {/* Bottom border */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)` }} />
      </div>
    </div>
  );
};

// Single calendar month grid
const CalendarMonth: React.FC<{
  year: number;
  month: number; // 0-indexed
  activities: ActivityDay[];
  onDayClick: (date: string, data: ActivityDay | null, isToday: boolean) => void;
}> = ({ year, month, activities, onDayClick }) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first: 0=Mon, 6=Sun
  const startDow = (firstDay.getDay() + 6) % 7;

  const dayHeaders = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((dh) => (
          <div key={dh} className="text-center text-[10px] py-1" style={{ color: `${PARCHMENT}50` }}>
            {dh}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const data = activities.find((a) => a.date === dateStr) || null;
          const intensity = isFuture ? -1 : getIntensity(data);
          const total = data ? data.tests + data.watches + data.practices : 0;

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
              {/* Tiny activity dot for days with data */}
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
};

const ActivityTimeline: React.FC<{ activities: ActivityDay[] }> = ({ activities }) => {
  const { t, language } = useLanguage();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    data: ActivityDay | null;
    isToday: boolean;
  } | null>(null);

  // Calculate streak from today backwards across ALL activity data
  const streak = (() => {
    let s = 0;
    for (let i = 0; ; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const data = activities.find((a) => a.date === dateStr) || null;
      if (getIntensity(data) > 0) s++;
      else break;
    }
    return s;
  })();

  // Navigation
  const goBack = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goForward = () => {
    const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();
    if (isCurrentMonth) return; // Don't go past current month
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();

  // Month name in current language locale
  const monthLocale = language === 'ms' ? 'ms-MY' : language === 'zh' ? 'zh-CN' : 'en-MY';
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(monthLocale, {
    month: 'long',
    year: 'numeric',
  });

  // Count active days this month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  let activeDaysThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = activities.find((a) => a.date === dateStr) || null;
    if (getIntensity(data) > 0) activeDaysThisMonth++;
  }

  return (
    <FantasyPanel className="p-5" gold>
      <SectionHeader
        icon={<Flame className="w-5 h-5" style={{ color: '#ff6b35' }} />}
        title={t('mastery.timeline')}
        subtitle={t('mastery.timelineSub')}
      />

      {/* Streak badge */}
      {streak > 0 && (
        <div className="flex justify-center mb-4">
          <div
            className="flex items-center gap-1.5 px-4 py-2 rounded-full"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
          >
            <Flame className="w-4 h-4" style={{ color: '#ff6b35' }} />
            <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>
              {streak}{t('mastery.streak')}
            </span>
          </div>
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: GOLD }} />
        </button>

        <div className="text-center">
          <h4
            className="text-sm font-bold capitalize"
            style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}
          >
            {monthName}
          </h4>
          <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}50` }}>
            {activeDaysThisMonth} {t('mastery.calendarAdventures')}
          </p>
        </div>

        <button
          onClick={goForward}
          disabled={isCurrentMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: `${GOLD}10`,
            border: `1px solid ${GOLD}20`,
            opacity: isCurrentMonth ? 0.3 : 1,
          }}
        >
          <ChevronRight className="w-4 h-4" style={{ color: GOLD }} />
        </button>
      </div>

      {/* Calendar grid */}
      <CalendarMonth
        year={viewYear}
        month={viewMonth}
        activities={activities}
        onDayClick={(date, data, isToday) => setSelectedDay({ date, data, isToday })}
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <span className="text-[10px]" style={{ color: `${PARCHMENT}65` }}>{t('mastery.less')}</span>
        {INTENSITY_COLORS.map((color, idx) => (
          <div
            key={idx}
            className="w-4 h-4 rounded"
            style={{ background: color, border: `1px solid ${GOLD}15` }}
          />
        ))}
        <span className="text-[10px]" style={{ color: `${PARCHMENT}65` }}>{t('mastery.more')}</span>
      </div>

      {/* Day detail modal — portaled to body so it's always viewport-centered */}
      {selectedDay && createPortal(
        <DayDetailModal
          date={selectedDay.date}
          data={selectedDay.data}
          isToday={selectedDay.isToday}
          onClose={() => setSelectedDay(null)}
        />,
        document.body
      )}
    </FantasyPanel>
  );
};

// ===== SUBJECT MASTERY CARD =====
const SubjectCard: React.FC<{
  questName: string;
  icon: string;
  functionalAge: number;
  overallPercentage: number;
  strengthTag: string;
  ageLevels: { age: number; correct: number; total: number; passed: boolean }[];
}> = ({ questName, icon, functionalAge, overallPercentage, strengthTag, ageLevels }) => {
  const stars = overallPercentage >= 80 ? 3 : overallPercentage >= 50 ? 2 : overallPercentage > 0 ? 1 : 0;

  const tagColors: Record<string, string> = {
    Excellent: '#4CAF50',
    Good: '#8BC34A',
    Developing: '#FF9800',
    'Needs Practice': '#9E9E9E',
  };
  const tagColor = tagColors[strengthTag] || GOLD;

  return (
    <FantasyPanel className="p-4 min-w-[200px] max-w-[220px] flex-shrink-0">
      <div className="text-center mb-3">
        <span className="text-3xl">{icon}</span>
        <h4 className="text-xs font-bold mt-1.5 truncate" style={{ color: GOLD_LIGHT, fontFamily: CINZEL }}>
          {questName}
        </h4>
      </div>

      <div
        className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${GOLD} 0%, #a67c2e 100%)`,
          border: `2px solid ${GOLD_LIGHT}`,
          boxShadow: `0 0 12px ${GOLD}30`,
        }}
      >
        <div className="text-center">
          <div className="text-white text-[9px] leading-tight">Age</div>
          <div className="text-white text-lg font-black" style={{ fontFamily: CINZEL }}>{functionalAge}</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-0.5 mb-2">
        {[0, 1, 2].map((i) => (
          <Star
            key={i}
            className="w-4 h-4"
            fill={i < stars ? '#ffd700' : 'transparent'}
            stroke={i < stars ? '#ffaa00' : `${GOLD}30`}
            strokeWidth={2}
          />
        ))}
      </div>

      <div className="text-center">
        <span className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
          {overallPercentage}%
        </span>
        <div
          className="text-[9px] font-medium mt-1 px-2 py-0.5 rounded-full mx-auto inline-block"
          style={{ background: `${tagColor}20`, color: tagColor, border: `1px solid ${tagColor}40` }}
        >
          {strengthTag}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {ageLevels.filter(a => a.total > 0).map((al) => {
          const pct = al.total > 0 ? Math.round((al.correct / al.total) * 100) : 0;
          return (
            <div key={al.age} className="flex items-center gap-1.5">
              <span className="text-[9px] w-6 text-right flex-shrink-0" style={{ color: `${PARCHMENT}75` }}>
                {al.age}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `${GOLD}10` }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: al.passed ? `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` : `${GOLD}35`,
                  }}
                />
              </div>
              <span className="text-[9px] w-7 flex-shrink-0" style={{ color: al.passed ? '#7cc643' : `${PARCHMENT}60` }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </FantasyPanel>
  );
};

// ===== SUBJECT COMPARISON BAR CHART =====
const SubjectComparisonChart: React.FC<{ breakdowns: SubjectAgeBreakdown[] }> = ({ breakdowns }) => {
  const { t } = useLanguage();
  const data = breakdowns.map((b, idx) => ({
    name: b.questName.length > 10 ? b.questName.slice(0, 9) + '..' : b.questName,
    fullName: b.questName,
    score: b.overallPercentage,
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <FantasyPanel className="p-5">
      <SectionHeader
        icon={<Target className="w-5 h-5" style={{ color: GOLD }} />}
        title={t('mastery.subjectComparison')}
        subtitle={t('mastery.subjectComparisonSub')}
      />
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
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<FantasyTooltip />} />
            <Bar
              dataKey="score"
              name="Score"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </FantasyPanel>
  );
};

// ===== AGE DISTRIBUTION DONUT CHART =====
const AgeDistributionChart: React.FC<{ answers: DetailedAnswer[] }> = ({ answers }) => {
  const { t } = useLanguage();
  const ageGroups: Record<number, { total: number; correct: number }> = {};
  answers.forEach(a => {
    const age = a.ageDifficulty || 4;
    if (!ageGroups[age]) ageGroups[age] = { total: 0, correct: 0 };
    ageGroups[age].total++;
    if (a.isCorrect) ageGroups[age].correct++;
  });

  const data = Object.entries(ageGroups)
    .map(([age, { total, correct }]) => ({
      name: `Age ${age}`,
      value: total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      fill: AGE_COLORS[Number(age)] || GOLD,
    }))
    .sort((a, b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]));

  const totalQ = answers.length;

  return (
    <FantasyPanel className="p-5">
      <SectionHeader
        icon={<Crown className="w-5 h-5" style={{ color: '#e67e22' }} />}
        title={t('mastery.ageLevelSplit')}
        subtitle={t('mastery.ageLevelSplitSub')}
      />
      <div className="flex items-center gap-4" style={{ height: 200 }}>
        <div style={{ width: '55%', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(26,18,10,0.95)', border: `1px solid ${GOLD}50`, color: PARCHMENT }}
                  >
                    <p className="font-bold" style={{ color: GOLD_LIGHT }}>{d.name}</p>
                    <p>{d.value} questions ({Math.round((d.value / totalQ) * 100)}%)</p>
                    <p>Accuracy: {d.accuracy}%</p>
                  </div>
                );
              }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.fill }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: `${PARCHMENT}80` }}>{d.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: GOLD_LIGHT }}>{d.accuracy}%</span>
                </div>
                <div className="h-1.5 rounded-full mt-0.5" style={{ background: `${GOLD}10` }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${d.accuracy}%`, background: d.fill, opacity: 0.75 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FantasyPanel>
  );
};

// ===== ACCURACY BY AGE LEVEL GROUPED BAR =====
const AccuracyByAgeChart: React.FC<{ breakdowns: SubjectAgeBreakdown[] }> = ({ breakdowns }) => {
  const { t } = useLanguage();
  // Build data: one row per age level, columns per subject
  const ages = [4, 5, 6, 7];
  const data = ages.map(age => {
    const row: any = { name: `Age ${age}` };
    breakdowns.forEach((b, idx) => {
      const ageLevel = b.ageLevels.find(a => a.age === age);
      const pct = ageLevel && ageLevel.total > 0
        ? Math.round((ageLevel.correct / ageLevel.total) * 100)
        : 0;
      const shortName = b.questName.length > 8 ? b.questName.slice(0, 7) + '..' : b.questName;
      row[shortName] = pct;
    });
    return row;
  });

  // Get subject keys (excluding 'name')
  const subjectKeys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'name') : [];

  return (
    <FantasyPanel className="p-5">
      <SectionHeader
        icon={<TrendingUp className="w-5 h-5" style={{ color: '#27ae60' }} />}
        title={t('mastery.accuracyByAge')}
        subtitle={t('mastery.accuracyByAgeSub')}
      />
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={`${GOLD}10`} />
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
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<FantasyTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, color: `${PARCHMENT}80` }}
              iconType="circle"
              iconSize={8}
            />
            {subjectKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                name={key}
                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                fillOpacity={0.8}
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </FantasyPanel>
  );
};

// ===== PROGRESS OVER TIME LINE CHART =====
interface AssessmentSnapshot {
  date: string;
  timestamp: string;
  overallPct: number;
  totalStars: number;
  readinessPct: number;
  tpLevel: number;
  subjectSummary: { name: string; pct: number; functionalAge: number }[];
}

const ProgressOverTimeChart: React.FC<{ history: AssessmentSnapshot[] }> = ({ history }) => {
  const { t } = useLanguage();
  if (history.length < 2) return null;

  const data = history.map((h, idx) => ({
    name: new Date(h.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }),
    score: h.overallPct,
    readiness: h.readinessPct,
    stars: h.totalStars,
    tp: h.tpLevel,
  }));

  return (
    <FantasyPanel className="p-5" gold>
      <SectionHeader
        icon={<TrendingUp className="w-5 h-5" style={{ color: '#3498db' }} />}
        title={t('mastery.progressOverTime')}
        subtitle={t('mastery.progressOverTimeSub')}
      />
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={`${GOLD}10`} />
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
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<FantasyTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, color: `${PARCHMENT}80` }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="score"
              name={t('mastery.overallScore')}
              stroke={GOLD}
              strokeWidth={2.5}
              dot={{ fill: GOLD_LIGHT, stroke: GOLD, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: GOLD_LIGHT }}
            />
            <Line
              type="monotone"
              dataKey="readiness"
              name={t('mastery.readiness')}
              stroke="#27ae60"
              strokeWidth={2}
              dot={{ fill: '#27ae60', stroke: '#1e8449', strokeWidth: 2, r: 3 }}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </FantasyPanel>
  );
};

// ===== MAIN COMPONENT =====
interface MasteryDashboardProps {
  childName: string;
  childAge: number;
  allAnswers: DetailedAnswer[];
  moduleResults: Record<string, { score: number; total: number }>;
  /** True only after a full assessment is completed and persisted.
   *  When false, live allAnswers/moduleResults are treated as in-progress
   *  partial data and ignored in favour of the last saved backend snapshot. */
  assessmentCompleted?: boolean;
  liveQuests: any[];
  parentData?: any;
  onShowUpgrade?: () => void;
}

export const MasteryDashboard: React.FC<MasteryDashboardProps> = ({
  childName,
  childAge,
  allAnswers,
  moduleResults,
  assessmentCompleted = false,
  liveQuests,
  parentData,
  onShowUpgrade,
}) => {
  const { t } = useLanguage();
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentSnapshot[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine if parent already has Plan B
  const isPaidPlanB = parentData?.subscription_status === 'active' && (parentData?.subscription_plan || '').toUpperCase() === 'B';

  // Load activity timeline + assessment history
  useEffect(() => {
    fetchActivityTimeline()
      .then(setActivityData)
      .catch((e) => console.error('[MASTERY] Activity load failed:', e));

    fetchAssessmentHistory()
      .then(setAssessmentHistory)
      .catch((e) => console.error('[MASTERY] History load failed:', e));
  }, []);

  // Build quest name map
  const questNameMap: Record<string, { name: string; icon: string }> = {};
  if (liveQuests && liveQuests.length > 0) {
    liveQuests.forEach((q: any) => {
      questNameMap[q.id] = { name: q.name?.en || q.subject || q.id, icon: q.icon || '\u{1F4DD}' };
    });
  } else {
    Object.assign(questNameMap, {
      english: { name: 'English Forest', icon: '\u{1F332}' },
      numbers: { name: 'Numbers Island', icon: '\u{1F3DD}\uFE0F' },
      bahasa: { name: 'Rimba Bahasa', icon: '\u{1F33F}' },
      mandarin: { name: 'Mandarin Mountain', icon: '\u{26F0}\uFE0F' },
      science: { name: 'Mystery Jungle', icon: '\u{1F52C}' },
    });
  }

  // Calculate metrics — only trust live in-memory answers when the full
  // assessment has been completed.  Partial / in-progress answers are ignored
  // so the dashboard falls back to the last persisted backend snapshot.
  const hasData = assessmentCompleted && allAnswers.length > 0;
  
  // Try to load last assessment snapshot when no completed live data exists
  const lastSnapshot = !hasData && assessmentHistory.length > 0
    ? assessmentHistory[assessmentHistory.length - 1]
    : null;
  const hasSnapshot = !!lastSnapshot;

  // Live calculations from allAnswers (if available)
  const tpLive = hasData ? calculateTP(allAnswers) : null;
  const subjectBreakdownsLive = hasData ? calculateSubjectBreakdowns(allAnswers, questNameMap) : [];
  const radarDataLive = hasData ? buildRadarData(subjectBreakdownsLive) : [];
  const readinessLive = hasData ? calculateReadiness(allAnswers) : { score: 0, total: 0, percentage: 0 };
  const { earned: totalStarsLive, possible: maxStarsLive } = calculateTotalStars(moduleResults);
  const totalCorrectLive = allAnswers.filter((a) => a.isCorrect).length;
  const totalQuestionsLive = allAnswers.length;
  const overallPctLive = totalQuestionsLive > 0 ? Math.round((totalCorrectLive / totalQuestionsLive) * 100) : 0;
  const recommendationsLive = hasData ? generateRecommendations(subjectBreakdownsLive, childName) : [];

  // Build synthetic data from last snapshot (fallback when no live answers)
  const snapshotSubjectBreakdowns: SubjectAgeBreakdown[] = lastSnapshot?.subjectSummary
    ? lastSnapshot.subjectSummary.map((s, idx) => {
        const questInfo = Object.values(questNameMap).find(q => q.name === s.name)
          || { name: s.name, icon: ['\u{1F332}', '\u{1F3DD}\uFE0F', '\u{1F33F}', '\u{26F0}\uFE0F', '\u{1F52C}'][idx] || '\u{1F4DD}' };
        const strengthTag = s.pct >= 80 ? 'Excellent' : s.pct >= 60 ? 'Good' : s.pct >= 40 ? 'Developing' : 'Needs Practice';
        return {
          questId: s.name.toLowerCase().replace(/\s+/g, '_'),
          questName: s.name,
          icon: questInfo.icon,
          overallScore: 0,
          overallTotal: 0,
          overallPercentage: s.pct,
          functionalAge: s.functionalAge,
          ageLevels: [],
          strengthTag,
        };
      })
    : [];
  const snapshotRadarData = snapshotSubjectBreakdowns.map(b => ({
    subject: b.questName,
    functionalAge: b.functionalAge,
    fullMark: 7,
  }));

  // TP scale reference for snapshot fallback
  const TP_LABELS: Record<number, { en: string; bm: string; zh: string; desc: string }> = {
    1: { en: 'Not Yet Proficient', bm: 'Belum Menguasai', zh: '\u5C1A\u672A\u638C\u63E1', desc: 'has not yet demonstrated understanding of Year 1-level concepts.' },
    2: { en: 'Minimally Proficient', bm: 'Menguasai Minimum', zh: '\u57FA\u672C\u638C\u63E1', desc: 'shows beginning awareness of Year 1 concepts but needs significant support.' },
    3: { en: 'Basic Proficiency', bm: 'Menguasai Asas', zh: '\u57FA\u7840\u638C\u63E1', desc: 'can follow basic instructions and recognise some Year 1 concepts.' },
    4: { en: 'Proficient', bm: 'Menguasai', zh: '\u638C\u63E1', desc: 'demonstrates solid understanding of Year 1 concepts.' },
    5: { en: 'Advanced', bm: 'Menguasai Cemerlang', zh: '\u4F18\u79C0\u638C\u63E1', desc: 'shows strong command of Year 1 concepts.' },
    6: { en: 'Exceptional', bm: 'Menguasai Tertinggi', zh: '\u5353\u8D8A\u638C\u63E1', desc: 'demonstrates exceptional mastery of Year 1 concepts.' },
  };

  const snapshotTp = lastSnapshot ? {
    level: lastSnapshot.tpLevel,
    labelEN: TP_LABELS[lastSnapshot.tpLevel]?.en || `TP${lastSnapshot.tpLevel}`,
    labelBM: TP_LABELS[lastSnapshot.tpLevel]?.bm || '',
    labelZH: TP_LABELS[lastSnapshot.tpLevel]?.zh || '',
    age7Accuracy: 0,
    description: { en: TP_LABELS[lastSnapshot.tpLevel]?.desc || '', ms: '', zh: '' },
  } : null;

  // Use live data if available, otherwise fallback to snapshot
  const tp = tpLive || snapshotTp;
  const subjectBreakdowns = hasData ? subjectBreakdownsLive : snapshotSubjectBreakdowns;
  const radarData = hasData ? radarDataLive : snapshotRadarData;
  const readinessResult = hasData ? readinessLive : {
    score: 0, total: 0, percentage: lastSnapshot?.readinessPct || 0,
  };
  const totalStars = hasData ? totalStarsLive : (lastSnapshot?.totalStars || 0);
  const maxStars = hasData ? maxStarsLive : Math.max(lastSnapshot?.totalStars || 0, maxStarsLive);
  const overallPct = hasData ? overallPctLive : (lastSnapshot?.overallPct || 0);
  const recommendations = hasData
    ? recommendationsLive
    : (snapshotSubjectBreakdowns.length > 0 ? generateRecommendations(snapshotSubjectBreakdowns, childName) : []);

  // Hero rank
  const heroRank = getHeroRank(totalStars);

  // Activity stats from parentData
  const totalTests = parentData?.total_tests || 0;
  const totalWatches = parentData?.total_watches || 0;
  const totalPractices = parentData?.total_practices || 0;
  const totalPracticeQuestions = parentData?.total_practice_questions || 0;
  const todayTests = parentData?.test_count_today || 0;
  const todayWatches = parentData?.watch_count_today || 0;
  const todayPractices = parentData?.practice_count_today || 0;

  // Subject card scroll
  const scrollSubjects = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = dir === 'left' ? -230 : 230;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // ===== EMPTY STATE =====
  // (removed early return — we always show the full layout with locked placeholders)

  // TP color helper
  const tpColor = tp
    ? tp.level >= 5 ? '#7cc643' : tp.level >= 4 ? GOLD : tp.level >= 3 ? '#4dabf7' : '#e74c3c'
    : GOLD;

  // Age comparison helper
  const getAgeDiffLabel = (functionalAge: number) => {
    const diff = functionalAge - childAge;
    if (diff > 0) return { text: `+${diff} ${t('mastery.ahead')}`, color: '#7cc643' };
    if (diff < 0) return { text: `${Math.abs(diff)} ${t('mastery.behind')}`, color: '#e74c3c' };
    return { text: t('mastery.onTrack'), color: GOLD };
  };

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════
          SECTION 1: TITLE — "Mastery Dashboard"
         ═══════════════════════════════════════════ */}
      <div className="text-center relative">
        <SparkleParticles />
        <FantasyTitle size="md">{t('mastery.title')}</FantasyTitle>
        <p className="mt-1 text-sm" style={{ color: `${PARCHMENT}70` }}>
          {childName}{t('mastery.subtitle')} {'\u2014'} {t('mastery.age')} {childAge}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 2: BIG SPIDER WEB — THE HERO PIECE
         ═══════════════════════════════════════════ */}
      {radarData.length > 0 ? (
        <FantasyPanel className="p-5 md:p-8" gold>
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5" style={{ color: GOLD }} />
              <h2 className="text-lg md:text-xl font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                {t('mastery.readinessRadar')}
              </h2>
              <Crown className="w-5 h-5" style={{ color: GOLD }} />
            </div>
            <p className="text-[11px]" style={{ color: `${PARCHMENT}80` }}>
              {t('mastery.radarDesc')} {'\u2022'} {t('mastery.radarRings')} {'\u2022'} {t('mastery.shadedArea')} = {childName}
            </p>
          </div>

          {/* Big spider web chart */}
          <div className="w-full mx-auto" style={{ maxWidth: 520, height: 420 }}>
            <SpiderWebChart data={radarData} childAge={childAge} chartHeight={410} maxWidth={520} />
          </div>

          {/* Subject age comparison — the money insight */}
          <div className="mt-5 space-y-2">
            <p className="text-center text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: `${PARCHMENT}75` }}>
              {childName} ({t('mastery.age')} {childAge}) {'\u2014'} {t('mastery.functionalAge')}
            </p>
            {subjectBreakdowns.map((sb) => {
              const diff = getAgeDiffLabel(sb.functionalAge);
              const isAbove = sb.functionalAge > childAge;
              const isMax = sb.functionalAge >= 7;
              return (
                <div
                  key={sb.questId}
                  className="flex items-center gap-3 px-3 md:px-4 py-2.5 rounded-xl"
                  style={{
                    background: isAbove ? `${diff.color}08` : `${GOLD}06`,
                    border: `1px solid ${isAbove ? `${diff.color}20` : `${GOLD}15`}`,
                  }}
                >
                  <span className="text-xl flex-shrink-0">{sb.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                      {sb.questName}
                    </span>
                    <div className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>
                      {sb.overallPercentage}% {t('mastery.overall')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md hidden sm:inline-block" style={{ background: `${GOLD}10`, color: `${PARCHMENT}75` }}>
                      Age {childAge}
                    </span>
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
                      Age {sb.functionalAge}{isMax ? ' \u2728' : ''}
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
        </FantasyPanel>
      ) : (
        <LockedPreview
          icon={<Crown className="w-5 h-5" style={{ color: GOLD }} />}
          title={t('mastery.readinessRadar')}
          subtitle={t('mastery.functionalAge')}
          description={t('mastery.readinessRadar')}
          height={350}
        >
          <div className="flex flex-col items-center gap-4">
            <div style={{ width: 280, height: 280 }} className="relative">
              <svg viewBox="0 0 280 280" className="w-full h-full">
                {[0.3, 0.5, 0.7, 0.9].map((scale, i) => (
                  <polygon
                    key={i}
                    points={[0, 1, 2, 3, 4].map(j => {
                      const angle = (j * 72 - 90) * Math.PI / 180;
                      const r = 120 * scale;
                      return `${140 + r * Math.cos(angle)},${140 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth="1"
                    opacity="0.3"
                  />
                ))}
                {[0, 1, 2, 3, 4].map(j => {
                  const angle = (j * 72 - 90) * Math.PI / 180;
                  return (
                    <line
                      key={j}
                      x1="140" y1="140"
                      x2={140 + 108 * Math.cos(angle)}
                      y2={140 + 108 * Math.sin(angle)}
                      stroke={GOLD}
                      strokeWidth="1"
                      opacity="0.2"
                    />
                  );
                })}
              </svg>
            </div>
            <div className="w-full space-y-2 px-4">
              {Object.values(questNameMap).slice(0, 5).map((q, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: `${GOLD}04`, border: `1px solid ${GOLD}08` }}>
                  <span className="text-lg">{q.icon}</span>
                  <div className="flex-1">
                    <div className="h-3 rounded w-24" style={{ background: `${GOLD}15` }} />
                  </div>
                  <div className="h-5 w-14 rounded-md" style={{ background: `${GOLD}10` }} />
                </div>
              ))}
            </div>
          </div>
        </LockedPreview>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 3: TP BADGE + READINESS SUMMARY
         ═══════════════════════════════════════════ */}
      {tp ? (
        <FantasyPanel className="p-5 md:p-6" gold>
          <SectionHeader
            icon={<Award className="w-5 h-5" style={{ color: tpColor }} />}
            title={t('mastery.proficiency')}
            subtitle={t('mastery.proficiencyDesc')}
          />

          <div className="flex items-start gap-4 md:gap-5">
            {/* TP Circle Badge */}
            <div
              className="w-18 h-18 md:w-20 md:h-20 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                width: 72, height: 72,
                background: `linear-gradient(135deg, ${tpColor}33 0%, ${tpColor}11 100%)`,
                border: `3px solid ${tpColor}`,
                boxShadow: `0 0 20px ${tpColor}33`,
              }}
            >
              <div className="text-center">
                <div className="text-xl font-black leading-none" style={{ color: tpColor, fontFamily: CINZEL }}>
                  TP{tp.level}
                </div>
                <div className="text-[8px] mt-0.5 opacity-60" style={{ color: tpColor }}>of 6</div>
              </div>
            </div>

            {/* TP Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-sm md:text-base font-bold" style={{ color: GOLD_LIGHT }}>
                  {tp.labelEN}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${tpColor}15`, color: tpColor, border: `1px solid ${tpColor}30` }}>
                  {tp.labelBM}
                </span>
              </div>
              <p className="text-[11px] md:text-xs leading-relaxed mb-2" style={{ color: `${PARCHMENT}80` }}>
                {childName} {tp.description.en}
              </p>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="text-[10px] flex-shrink-0" style={{ color: `${PARCHMENT}75` }}>
                  Age 7: <span className="font-bold" style={{ color: tpColor }}>{tp.age7Accuracy}%</span>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: `${GOLD}10` }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(tp.level / 6) * 100}%`,
                      background: `linear-gradient(90deg, ${tpColor}88, ${tpColor})`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-bold flex-shrink-0" style={{ color: tpColor }}>
                  {tp.level}/6
                </div>
              </div>
            </div>
          </div>

          {/* Quick readiness summary row */}
          {(hasData || hasSnapshot) && (
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4" style={{ borderTop: `1px solid ${GOLD}15` }}>
              <div className="text-center">
                <div className="text-xl font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                  <AnimatedCounter target={overallPct} suffix="%" />
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>{t('mastery.overallScore')}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                  <AnimatedCounter target={readinessResult.percentage} suffix="%" />
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>{t('mastery.readiness')}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4" fill="#ffd700" stroke="#ffaa00" strokeWidth={2} />
                  <span className="text-xl font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                    <AnimatedCounter target={totalStars} />
                  </span>
                  <span className="text-sm" style={{ color: `${PARCHMENT}65` }}>/{maxStars}</span>
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>{t('mastery.totalStars')}</div>
              </div>
            </div>
          )}
        </FantasyPanel>
      ) : (
        <LockedPreview
          icon={<Award className="w-5 h-5" style={{ color: GOLD }} />}
          title="Proficiency Level (TP)"
          subtitle={`Tahap Penguasaan \u2014 from Age 7 questions only`}
          description="Proficiency Level (TP)"
        >
          <div className="flex items-start gap-4">
            <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center flex-shrink-0"
              style={{ border: `3px solid ${GOLD}30`, background: `${GOLD}08` }}>
              <div className="text-center">
                <div className="text-xl font-black" style={{ fontFamily: CINZEL, color: `${GOLD}40` }}>TP?</div>
                <div className="text-[8px]" style={{ color: `${GOLD}25` }}>of 6</div>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded w-32" style={{ background: `${GOLD}12` }} />
              <div className="h-3 rounded w-48" style={{ background: `${GOLD}08` }} />
              <div className="h-2 rounded-full w-full" style={{ background: `${GOLD}08` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4" style={{ borderTop: `1px solid ${GOLD}10` }}>
            {['Overall Score', 'Readiness', 'Stars'].map((label) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black" style={{ fontFamily: CINZEL, color: `${GOLD}25` }}>{'\u2014'}</div>
                <div className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}25` }}>{label}</div>
              </div>
            ))}
          </div>
        </LockedPreview>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 4: HERO BANNER (compact — rank + name)
         ═══════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: DARK_BG,
          border: `1px solid ${GOLD}20`,
          boxShadow: `0 0 30px ${heroRank.glow}`,
        }}
      >
        <SparkleParticles />
        <div className="relative z-10 p-4 md:p-5 flex items-center gap-4">
          {/* Rank emblem */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: `radial-gradient(circle, ${heroRank.color}25 0%, transparent 70%)`,
              border: `2px solid ${heroRank.color}40`,
              boxShadow: `0 0 15px ${heroRank.glow}`,
            }}
          >
            <span className="text-2xl">{heroRank.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full mb-0.5"
              style={{ background: `${heroRank.color}15`, border: `1px solid ${heroRank.color}30` }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: heroRank.color }}>
                {heroRank.title}
              </span>
            </div>
            <h2 className="text-base md:text-lg font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
              {childName || 'Explorer'}
            </h2>
            <p className="text-[11px]" style={{ color: `${PARCHMENT}75` }}>
              {t('mastery.age')} {childAge} {'\u2022'} {totalStars}/{maxStars} {t('mastery.totalStars')}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 5: ADVENTURE STATS — 3 RPG CARDS
         ═══════════════════════════════════════════ */}
      <div>
        <SectionHeader
          icon={<Trophy className="w-5 h-5" style={{ color: GOLD }} />}
          title={t('mastery.stats')}
          subtitle={t('mastery.statsSub')}
        />
        <div className="grid grid-cols-3 gap-3">
          {/* Quests */}
          <FantasyPanel className="p-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{ background: 'radial-gradient(circle at 50% 20%, #ff6b35, transparent 70%)' }} />
            <div className="relative z-10">
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2"
                style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)' }}
              >
                <Swords className="w-6 h-6" style={{ color: '#ff6b35' }} />
              </div>
              <div className="text-2xl font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                <AnimatedCounter target={totalTests} />
              </div>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                {t('mastery.totalQuests')}
              </p>
              {todayTests > 0 && (
                <p className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full inline-block"
                  style={{ background: 'rgba(255,107,53,0.1)', color: '#ff8c5a', border: '1px solid rgba(255,107,53,0.2)' }}>
                  +{todayTests} {t('game.today')}
                </p>
              )}
            </div>
          </FantasyPanel>

          {/* Videos */}
          <FantasyPanel className="p-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{ background: 'radial-gradient(circle at 50% 20%, #9b59b6, transparent 70%)' }} />
            <div className="relative z-10">
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2"
                style={{ background: 'rgba(155,89,182,0.12)', border: '1px solid rgba(155,89,182,0.25)' }}
              >
                <Eye className="w-6 h-6" style={{ color: '#9b59b6' }} />
              </div>
              <div className="text-2xl font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                <AnimatedCounter target={totalWatches} />
              </div>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                {t('mastery.totalVideos')}
              </p>
              {todayWatches > 0 && (
                <p className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full inline-block"
                  style={{ background: 'rgba(155,89,182,0.1)', color: '#b07cc8', border: '1px solid rgba(155,89,182,0.2)' }}>
                  +{todayWatches} {t('game.today')}
                </p>
              )}
            </div>
          </FantasyPanel>

          {/* Practices */}
          <FantasyPanel className="p-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{ background: 'radial-gradient(circle at 50% 20%, #27ae60, transparent 70%)' }} />
            <div className="relative z-10">
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2"
                style={{ background: 'rgba(39,174,96,0.12)', border: '1px solid rgba(39,174,96,0.25)' }}
              >
                <Shield className="w-6 h-6" style={{ color: '#27ae60' }} />
              </div>
              <div className="text-2xl font-black" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                <AnimatedCounter target={totalPractices} />
              </div>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                {t('mastery.totalTraining')}
              </p>
              {/* Show both sessions and questions */}
              <div className="mt-1.5 space-y-1">
                {totalPracticeQuestions > 0 && (
                  <p className="text-[10px] px-2 py-0.5 rounded-full inline-block"
                    style={{ background: 'rgba(39,174,96,0.08)', color: '#4cbb7a', border: '1px solid rgba(39,174,96,0.15)' }}>
                    {totalPracticeQuestions} {t('mastery.questionsAnswered')}
                  </p>
                )}
                {todayPractices > 0 && (
                  <p className="text-[10px] px-2 py-0.5 rounded-full inline-block"
                    style={{ background: 'rgba(39,174,96,0.1)', color: '#4cbb7a', border: '1px solid rgba(39,174,96,0.2)' }}>
                    +{todayPractices} {t('game.today')}
                  </p>
                )}
              </div>
            </div>
          </FantasyPanel>
        </div>
      </div>

      {/* ===== SECTION 6: PERFORMANCE ANALYTICS CHARTS ===== */}
      {(hasData || hasSnapshot) && subjectBreakdowns.length > 0 ? (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
              {t('mastery.subjectComparison')}
            </h2>
            <GoldOrnament className="mt-2" />
          </div>

          {/* Row: Subject Comparison + Age Distribution (age dist needs raw answers) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SubjectComparisonChart breakdowns={subjectBreakdowns} />
            {hasData ? (
              <AgeDistributionChart answers={allAnswers} />
            ) : (
              <LockedPreview
                icon={<Crown className="w-5 h-5" style={{ color: '#e67e22' }} />}
                title={t('mastery.ageLevelSplit')}
                subtitle={t('mastery.ageLevelSplitSub')}
                description={t('mastery.ageLevelSplit')}
                height={200}
              />
            )}
          </div>

          {/* Full-width: Accuracy by Age Level (needs ageLevels — only live data) */}
          {hasData ? (
            <AccuracyByAgeChart breakdowns={subjectBreakdowns} />
          ) : null}

          {/* Progress Over Time (only if 2+ assessments) */}
          <ProgressOverTimeChart history={assessmentHistory} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT, opacity: 0.4 }}>
              {t('mastery.subjectComparison')}
            </h2>
            <GoldOrnament className="mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LockedPreview
              icon={<Target className="w-5 h-5" style={{ color: GOLD }} />}
              title={t('mastery.subjectComparison')}
              subtitle={t('mastery.subjectComparisonSub')}
              description={t('mastery.subjectComparison')}
              height={200}
            />
            <LockedPreview
              icon={<Crown className="w-5 h-5" style={{ color: '#e67e22' }} />}
              title={t('mastery.ageLevelSplit')}
              subtitle={t('mastery.ageLevelSplitSub')}
              description={t('mastery.ageLevelSplit')}
              height={200}
            />
          </div>
          <LockedPreview
            icon={<TrendingUp className="w-5 h-5" style={{ color: '#27ae60' }} />}
            title={t('mastery.accuracyByAge')}
            subtitle={t('mastery.accuracyByAgeSub')}
            description={t('mastery.accuracyByAge')}
            height={220}
          />
        </div>
      )}

      {/* ===== SECTION 7: SUBJECT MASTERY CARDS — HORIZONTAL SCROLL ===== */}
      {subjectBreakdowns.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              icon={<Star className="w-5 h-5" style={{ color: '#ffd700' }} />}
              title={t('mastery.subjectMastery')}
              subtitle={t('mastery.subjectMasterySub')}
            />
            {subjectBreakdowns.length > 2 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { playMenuSelect(); scrollSubjects('left'); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
                >
                  <ChevronLeft className="w-4 h-4" style={{ color: GOLD }} />
                </button>
                <button
                  onClick={() => { playMenuSelect(); scrollSubjects('right'); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
                >
                  <ChevronRight className="w-4 h-4" style={{ color: GOLD }} />
                </button>
              </div>
            )}
          </div>

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-3 scroll-smooth scrollbar-hide"
          >
            {subjectBreakdowns.map((sb) => (
              <SubjectCard
                key={sb.questId}
                questName={sb.questName}
                icon={sb.icon}
                functionalAge={sb.functionalAge}
                overallPercentage={sb.overallPercentage}
                strengthTag={sb.strengthTag}
                ageLevels={sb.ageLevels}
              />
            ))}
          </div>
        </div>
      ) : (
        <LockedPreview
          icon={<Star className="w-5 h-5" style={{ color: '#ffd700' }} />}
          title={t('mastery.subjectMastery')}
          subtitle={t('mastery.subjectMasterySub')}
          description={t('mastery.subjectMastery')}
        >
          <div className="flex gap-3 overflow-hidden">
            {Object.values(questNameMap).slice(0, 4).map((q, i) => (
              <div key={i} className="min-w-[160px] rounded-xl p-4 text-center"
                style={{ background: `${GOLD}04`, border: `1px solid ${GOLD}10` }}>
                <span className="text-2xl">{q.icon}</span>
                <div className="h-3 rounded w-16 mx-auto mt-2" style={{ background: `${GOLD}12` }} />
                <div className="w-10 h-10 rounded-full mx-auto mt-3" style={{ background: `${GOLD}08`, border: `2px solid ${GOLD}15` }} />
                <div className="flex justify-center gap-0.5 mt-2">
                  {[0, 1, 2].map(s => (
                    <Star key={s} className="w-3 h-3" fill="transparent" stroke={`${GOLD}20`} strokeWidth={2} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </LockedPreview>
      )}

      {/* ===== SECTION 8: ACTIVITY TIMELINE HEATMAP ===== */}
      <ActivityTimeline activities={activityData} />

      {/* ===== FOXY-o1 PROMO CARD (only if not on Plan B) ===== */}
      {!isPaidPlanB && (
        <FantasyPanel className="p-0 overflow-hidden relative">
          {/* Legendary glow border effect */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              border: `2px solid ${LEGENDARY_ORANGE}50`,
              boxShadow: `0 0 25px ${LEGENDARY_ORANGE}20, inset 0 0 25px ${LEGENDARY_ORANGE}08`,
            }}
          />

          {/* Limited Intro Offer ribbon */}
          <div
            className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
            style={{
              background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
              color: '#fff',
              boxShadow: `0 2px 10px ${LEGENDARY_ORANGE}60`,
              fontFamily: CINZEL,
            }}
          >
            {t('plan.limitedIntro')}
          </div>

          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              {/* Toy image */}
              <div className="flex-shrink-0">
                <div
                  className="w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, #fff5eb, #ffe8d5)`,
                    border: `2px solid ${LEGENDARY_ORANGE}30`,
                    boxShadow: `0 4px 16px rgba(0,0,0,0.2)`,
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4" style={{ color: LEGENDARY_ORANGE }} />
                  <h3
                    className="text-sm md:text-base font-black tracking-wide"
                    style={{
                      fontFamily: CINZEL,
                      color: GOLD_LIGHT,
                      textShadow: `0 0 10px ${LEGENDARY_ORANGE}30`,
                    }}
                  >
                    {t('plan.foxyTitle')}
                  </h3>
                </div>
                <p
                  className="text-xs font-bold mb-1.5"
                  style={{ color: LEGENDARY_ORANGE }}
                >
                  {t('plan.foxySubtitle')}
                </p>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: `${PARCHMENT}bb` }}
                >
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
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${PARCHMENT}90` }}>
                  {t('plan.foxyBundle')}
                </p>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span
                    className="text-xl md:text-2xl font-black"
                    style={{
                      color: LEGENDARY_ORANGE,
                      fontFamily: CINZEL,
                      textShadow: `0 0 12px ${LEGENDARY_ORANGE}30`,
                    }}
                  >
                    RM365
                  </span>
                  <span
                    className="text-sm line-through"
                    style={{ color: `${PARCHMENT}60` }}
                  >
                    RM730
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${LEGENDARY_ORANGE}20`,
                      color: LEGENDARY_ORANGE,
                    }}
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
              </div>
              <p
                className="text-[10px] mt-2 leading-relaxed"
                style={{ color: `${PARCHMENT}80` }}
              >
                {t('plan.earlyAdopter')}
              </p>
            </div>

            {/* CTA Button — navigates to Plan & Billing */}
            <button
              onClick={onShowUpgrade}
              className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
                color: '#fff',
                fontFamily: CINZEL,
                boxShadow: `0 4px 20px ${LEGENDARY_ORANGE}50`,
              }}
            >
              <Sparkles className="w-4 h-4" />
              {t('plan.foxyCta')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </FantasyPanel>
      )}

      {/* ===== SECTION 9: QUEST TIPS / RECOMMENDATIONS ===== */}
      {recommendations.length > 0 ? (
        <FantasyPanel className="p-5">
          <SectionHeader
            icon={<Target className="w-5 h-5" style={{ color: '#3498db' }} />}
            title={t('mastery.recommendations')}
            subtitle={t('mastery.recommendationsSub')}
          />
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: `${GOLD}05`, border: `1px solid ${GOLD}12` }}
              >
                <span className="text-xl flex-shrink-0">{rec.icon}</span>
                <div>
                  <div className="text-xs font-bold mb-0.5" style={{ color: GOLD_LIGHT }}>
                    {rec.subject}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: `${PARCHMENT}85` }}>
                    {rec.tip.en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </FantasyPanel>
      ) : (
        <LockedPreview
          icon={<Target className="w-5 h-5" style={{ color: '#3498db' }} />}
          title={t('mastery.recommendations')}
          subtitle={t('mastery.recommendationsSub')}
          description={t('mastery.recommendations')}
        >
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: `${GOLD}03`, border: `1px solid ${GOLD}06` }}>
                <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: `${GOLD}08` }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded w-20" style={{ background: `${GOLD}10` }} />
                  <div className="h-2 rounded w-full" style={{ background: `${GOLD}06` }} />
                  <div className="h-2 rounded w-3/4" style={{ background: `${GOLD}06` }} />
                </div>
              </div>
            ))}
          </div>
        </LockedPreview>
      )}
    </div>
  );
};