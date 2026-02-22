import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Lock, Crown, Star, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { recordUsage } from '../../utils/parent-api';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { useLanguage } from '../LanguageContext';

// Foxy card art imports
import foxyTraining from "figma:asset/c9264c31f5248e04b916d2f28de9e1721d804652.png";
import foxyQuest from "figma:asset/4909f86eb99dac14feaa9ec15a27163d39eb02aa.png";
import foxyLibrary from "figma:asset/7336a28a8bcd6e29e14276dbc0dd1ac6cb18746b.png";

// Audio mode placeholder (dark fantasy harp)
import foxyMusic from "figma:asset/6fb74ba856886fccc83e66c520ed0e69cb6ee01f.png";

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const DARK_BASE = 'rgba(12,8,20,';

interface GameDashboardProps {
  parentData: any;
  onStartTest: () => void;
  onStartPractice: () => void;
  onShowUpgrade: () => void;
  moduleResults?: Record<string, { score: number; total: number }>;
  /** True only after a full assessment is completed and persisted */
  assessmentCompleted?: boolean;
  onViewResults?: () => void;
  onOpenLibrary?: () => void;
  onOpenAudio?: () => void;
}

export const GameDashboard: React.FC<GameDashboardProps> = ({
  parentData,
  onStartTest,
  onStartPractice,
  onShowUpgrade,
  moduleResults = {},
  assessmentCompleted = false,
  onViewResults,
  onOpenLibrary,
  onOpenAudio,
}) => {
  const { t } = useLanguage();
  const isPaid = parentData?.subscription_status === 'active';
  const todayTestCount = parentData?.test_count_today || 0;
  const todayWatchCount = parentData?.watch_count_today || 0;
  const todayPracticeCount = parentData?.practice_count_today || 0;
  const canTest = isPaid || todayTestCount < 1;
  const canWatch = isPaid || todayWatchCount < 1;
  const canPractice = isPaid || todayPracticeCount < 1;

  // Has completed assessment results? Only count live moduleResults when the
  // full assessment is completed — otherwise rely on the saved backend snapshot.
  const hasResults = (assessmentCompleted && Object.keys(moduleResults).length > 0) || !!parentData?.latest_assessment;

  // Carousel state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [centeredIndex, setCenteredIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleStartPractice = async () => {
    playMenuSelect();
    if (!canPractice) {
      onShowUpgrade();
      return;
    }
    try {
      const result = await recordUsage('practice');
      if (!result.allowed) {
        onShowUpgrade();
        return;
      }
      onStartPractice();
    } catch (err) {
      console.error('Practice usage error:', err);
      // If backend doesn't support 'practice' type yet, still allow
      onStartPractice();
    }
  };

  const handleStartTest = async () => {
    playMenuSelect();
    if (!canTest) {
      onShowUpgrade();
      return;
    }
    try {
      const result = await recordUsage('test');
      if (!result.allowed) {
        onShowUpgrade();
        return;
      }
      onStartTest();
    } catch (err) {
      console.error('Test usage error:', err);
      toast.error('Failed to start test. Please try again.');
    }
  };

  const handleStartWatch = () => {
    playMenuSelect();
    if (onOpenLibrary) {
      onOpenLibrary();
    }
  };

  const handleStartAudio = () => {
    playMenuSelect();
    if (onOpenAudio) {
      onOpenAudio();
    }
  };

  const modes = [
    {
      id: 'practice',
      title: t('game.training'),
      subtitle: t('game.practiceMode'),
      icon: '\u2694',
      description: t('game.practiceDesc'),
      color: '#7cc643',
      limit: isPaid ? `\u221E ${t('game.unlimited')}` : `${todayPracticeCount}/1 ${t('game.today')}`,
      limitColor: isPaid ? '#7cc643' : canPractice ? GOLD : '#e74c3c',
      action: handleStartPractice,
      actionLabel: canPractice ? t('game.startPractice') : t('game.upgradeToContine'),
      available: canPractice,
    },
    {
      id: 'watch',
      title: t('game.library'),
      subtitle: t('game.videoMode'),
      icon: '\uD83D\uDCDC',
      description: t('game.videoDesc'),
      color: '#9b59b6',
      limit: isPaid ? `\u221E ${t('game.unlimited')}` : t('game.freeBrowse'),
      limitColor: isPaid ? '#7cc643' : GOLD,
      action: handleStartWatch,
      actionLabel: t('game.browseVideos'),
      available: true,
    },
    {
      id: 'audio',
      title: t('game.foxyMusic'),
      subtitle: t('game.audioMode'),
      icon: '\uD83C\uDFB5',
      description: t('game.audioDesc'),
      color: '#5b6abf',
      limit: isPaid ? `\u221E ${t('game.unlimited')}` : t('game.freeBrowse'),
      limitColor: isPaid ? '#7cc643' : GOLD,
      action: handleStartAudio,
      actionLabel: t('game.browseMusic'),
      available: true,
    },
    {
      id: 'test',
      title: t('game.quest'),
      subtitle: t('game.assessmentMode'),
      icon: '\uD83C\uDFC6',
      description: t('game.assessmentDesc'),
      color: '#4a90e2',
      limit: isPaid ? `\u221E ${t('game.unlimited')}` : `${todayTestCount}/1 ${t('game.today')}`,
      limitColor: isPaid ? '#7cc643' : canTest ? GOLD : '#e74c3c',
      action: handleStartTest,
      actionLabel: canTest ? t('game.startAssessment') : t('game.upgradeToContine'),
      available: canTest,
    },
  ];

  const CARD_IMAGES: Record<string, string> = {
    practice: foxyTraining,
    test: foxyQuest,
    watch: foxyLibrary,
    audio: foxyMusic,
  };

  // ===== Scroll / snap logic (like QuestSelector) =====
  const scrollToCard = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollContainerRef.current;
      const card = cardRefs.current[index];
      if (!container || !card) return;
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const scrollLeft = card.offsetLeft - containerRect.width / 2 + cardRect.width / 2;
      container.scrollTo({ left: scrollLeft, behavior });
    },
    []
  );

  // Detect which card is centered after scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setCenteredIndex(closest);
  }, []);

  // Auto-center on first card on mount
  useEffect(() => {
    const timer = setTimeout(() => scrollToCard(0, 'auto' as ScrollBehavior), 100);
    return () => clearTimeout(timer);
  }, []);

  const goLeft = () => {
    const next = Math.max(0, centeredIndex - 1);
    scrollToCard(next);
  };

  const goRight = () => {
    const next = Math.min(modes.length - 1, centeredIndex + 1);
    scrollToCard(next);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">{t('game.title')}</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          {t('game.subtitle')}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Mode Cards — Swipeable Carousel */}
      <div className="relative">
        {/* Arrow buttons (desktop) */}
        {!isMobile && centeredIndex > 0 && (
          <button
            onClick={goLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 -ml-3"
            style={{
              background: `linear-gradient(135deg, rgba(26,18,9,0.9), rgba(42,31,14,0.9))`,
              border: `1.5px solid ${GOLD}50`,
              boxShadow: `0 0 15px rgba(0,0,0,0.5)`,
            }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: GOLD_LIGHT }} />
          </button>
        )}
        {!isMobile && centeredIndex < modes.length - 1 && (
          <button
            onClick={goRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 -mr-3"
            style={{
              background: `linear-gradient(135deg, rgba(26,18,9,0.9), rgba(42,31,14,0.9))`,
              border: `1.5px solid ${GOLD}50`,
              boxShadow: `0 0 15px rgba(0,0,0,0.5)`,
            }}
          >
            <ChevronRight className="w-5 h-5" style={{ color: GOLD_LIGHT }} />
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 no-scrollbar"
          style={{ scrollPaddingInline: '16%' }}
          onScroll={handleScroll}
        >
          {/* Left spacer for centering first card */}
          <div className="flex-shrink-0" style={{ width: isMobile ? '8%' : '20%' }} />

          {modes.map((mode, idx) => {
            const isCentered = idx === centeredIndex;
            return (
              <div
                key={mode.id}
                ref={(el) => { cardRefs.current[idx] = el; }}
                className="flex-shrink-0 snap-center relative overflow-hidden rounded-2xl group cursor-pointer transition-all duration-300"
                style={{
                  width: isMobile ? '78%' : '55%',
                  maxWidth: '380px',
                  border: `2px solid ${isCentered ? `${GOLD}70` : `${GOLD}25`}`,
                  boxShadow: isCentered
                    ? `0 8px 40px rgba(0,0,0,0.6), 0 0 30px ${GOLD}15, inset 0 1px 0 ${GOLD}20`
                    : `0 4px 20px rgba(0,0,0,0.4)`,
                  transform: isCentered ? 'scale(1)' : 'scale(0.92)',
                  opacity: isCentered ? 1 : 0.6,
                  filter: isCentered ? 'none' : 'brightness(0.7)',
                }}
                onClick={() => {
                  if (isCentered) {
                    mode.action();
                  } else {
                    scrollToCard(idx);
                  }
                }}
              >
                {/* Full background image */}
                <div className="absolute inset-0">
                  <img
                    src={CARD_IMAGES[mode.id]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Gold card border inner glow */}
                <div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    boxShadow: `inset 0 0 30px rgba(0,0,0,0.4)`,
                    borderRadius: 'inherit',
                  }}
                />

                {/* ===== TOP BANNER: Title left + Badge right ===== */}
                <div
                  className="relative z-10 flex items-start justify-between gap-2 px-4 pt-3 pb-14"
                  style={{
                    background: `linear-gradient(to bottom, ${DARK_BASE}0.95) 0%, ${DARK_BASE}0.9) 30%, ${DARK_BASE}0.7) 60%, ${DARK_BASE}0.3) 80%, ${DARK_BASE}0) 100%)`,
                  }}
                >
                  {/* Left: Title + subtitle */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-base md:text-lg font-bold leading-tight"
                      style={{
                        fontFamily: "'Cinzel Decorative', serif",
                        color: GOLD_LIGHT,
                        textShadow: `0 2px 6px rgba(0,0,0,0.9), 0 0 10px ${GOLD}30`,
                      }}
                    >
                      {mode.title}
                    </h3>
                    <p
                      className="text-[10px] mt-0.5 uppercase tracking-widest"
                      style={{ color: `${PARCHMENT}90`, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                    >
                      {mode.subtitle}
                    </p>
                  </div>

                  {/* Right: Usage badge */}
                  <div
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold mt-0.5"
                    style={{
                      background: `${DARK_BASE}0.7)`,
                      border: `1px solid ${mode.limitColor}50`,
                      color: mode.limitColor,
                      backdropFilter: 'blur(8px)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    }}
                  >
                    {isPaid && <Crown className="w-3 h-3" />}
                    {!mode.available && !isPaid && <Lock className="w-3 h-3" />}
                    {mode.limit}
                  </div>
                </div>

                {/* ===== MIDDLE: Empty — Foxy shows through ===== */}
                <div className="relative z-10 h-[180px] md:h-[200px]" />

                {/* ===== BOTTOM BANNER: Description + CTA ===== */}
                <div
                  className="relative z-10 px-4 pt-14 pb-4"
                  style={{
                    background: `linear-gradient(to top, ${DARK_BASE}0.97) 0%, ${DARK_BASE}0.93) 30%, ${DARK_BASE}0.8) 55%, ${DARK_BASE}0.4) 75%, ${DARK_BASE}0) 100%)`,
                  }}
                >
                  {/* Description */}
                  <p
                    className="text-[11px] leading-relaxed mb-3 text-left"
                    style={{ color: `${PARCHMENT}b0`, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {mode.description}
                  </p>

                  {/* CTA Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); playMenuSelect(); mode.action(); }}
                    className="w-full py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{
                      fontFamily: "'Cinzel Decorative', serif",
                      background: mode.available
                        ? `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`
                        : `rgba(212,164,74,0.12)`,
                      color: mode.available ? '#2a1f0e' : `${GOLD}80`,
                      border: `2px solid ${mode.available ? GOLD_LIGHT : `${GOLD}30`}`,
                      boxShadow: mode.available
                        ? `0 3px 0 #a67c2e, 0 0 20px ${GOLD}20`
                        : 'none',
                      textShadow: mode.available ? '0 1px 0 rgba(255,255,255,0.3)' : 'none',
                      backdropFilter: mode.available ? 'none' : 'blur(6px)',
                    }}
                  >
                    {!mode.available && <Lock className="w-3 h-3 inline mr-1.5 -mt-0.5" />}
                    {mode.actionLabel}
                  </button>

                  {/* View Results — Quest card only, shown when assessment data exists */}
                  {mode.id === 'test' && hasResults && onViewResults && (
                    <button
                      onClick={(e) => { e.stopPropagation(); playMenuSelect(); onViewResults(); }}
                      className="w-full mt-2 py-2 rounded-xl font-bold text-[11px] tracking-wider uppercase transition-all hover:brightness-125 active:scale-[0.98] flex items-center justify-center gap-1.5"
                      style={{
                        fontFamily: "'Cinzel Decorative', serif",
                        background: `${DARK_BASE}0.6)`,
                        color: GOLD_LIGHT,
                        border: `1.5px solid ${GOLD}35`,
                        backdropFilter: 'blur(6px)',
                        textShadow: `0 1px 4px rgba(0,0,0,0.8)`,
                      }}
                    >
                      <ScrollText className="w-3.5 h-3.5" />
                      {t('game.viewResults')}
                    </button>
                  )}
                </div>

                {/* Hover gold shimmer effect */}
                <div
                  className="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, transparent 30%, ${GOLD}08 50%, transparent 70%)`,
                  }}
                />
              </div>
            );
          })}

          {/* Right spacer */}
          <div className="flex-shrink-0" style={{ width: isMobile ? '8%' : '20%' }} />
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {modes.map((_, idx) => (
            <button
              key={idx}
              className="transition-all duration-300 rounded-full"
              style={{
                width: idx === centeredIndex ? 20 : 8,
                height: 8,
                background: idx === centeredIndex
                  ? `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`
                  : `${GOLD}30`,
                boxShadow: idx === centeredIndex ? `0 0 8px ${GOLD}40` : 'none',
              }}
              onClick={() => scrollToCard(idx)}
            />
          ))}
        </div>
      </div>

      {/* Last Activity Strip */}
      {parentData?.last_activity && (
        <FantasyPanel className="px-4 py-3 flex items-center gap-3">
          <Star className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} fill={GOLD} />
          <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
            <span style={{ color: GOLD_LIGHT }}>{t('game.lastSession')}</span>{' '}
            {parentData.last_activity}
          </p>
        </FantasyPanel>
      )}

      {/* No-scrollbar style */}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};