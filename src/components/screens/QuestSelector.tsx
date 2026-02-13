import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Lock, Play, Star, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { MusicToggle } from '../MusicToggle';
import { useLanguage } from '../LanguageContext';
import { VictoryBurst } from '../VictoryBurst';
import { toast } from 'sonner@2.0.3';
import { FantasyBackground, GoldOrnament, FantasyTitle, FantasyFooter } from '../FantasyBackground';
import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';

// Default card images per quest
const DEFAULT_CARD_IMAGES: Record<string, string> = {
  english: 'https://images.unsplash.com/photo-1586023038457-9171a7fd658b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
  numbers: 'https://images.unsplash.com/photo-1689892464353-c4f7b1335051?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
  bahasa: 'https://images.unsplash.com/photo-1578187218114-e14ccdab29ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
  mandarin: 'https://images.unsplash.com/photo-1732130318710-b41009faf549?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
  science: 'https://images.unsplash.com/photo-1761768857990-2d6997193dea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
};

interface QuestModule {
  id: string;
  name: { en: string; ms: string; zh: string };
  subtitle: { en: string; ms: string; zh: string };
  icon: string;
  color: string;
  conditional?: boolean;
}

const ALL_MODULES: QuestModule[] = [
  {
    id: 'english',
    name: { en: 'English Forest', ms: 'Hutan Bahasa Inggeris', zh: '英语森林' },
    subtitle: { en: 'Language & Literacy', ms: 'Bahasa & Literasi', zh: '语言与读写' },
    icon: '🌳',
    color: '#7cc643',
  },
  {
    id: 'numbers',
    name: { en: 'Numbers Island', ms: 'Pulau Nombor', zh: '数字岛' },
    subtitle: { en: 'Mathematics', ms: 'Matematik', zh: '数学' },
    icon: '🔢',
    color: '#4a90e2',
  },
  {
    id: 'bahasa',
    name: { en: 'Rimba Bahasa', ms: 'Rimba Bahasa', zh: '马来语丛林' },
    subtitle: { en: 'Bahasa Malaysia', ms: 'Bahasa Malaysia', zh: '马来语' },
    icon: '🇲🇾',
    color: '#e74c3c',
  },
  {
    id: 'mandarin',
    name: { en: 'Mandarin Mountain', ms: 'Gunung Mandarin', zh: '华语山' },
    subtitle: { en: 'Chinese Language', ms: 'Bahasa Cina', zh: '华语' },
    icon: '🏔️',
    color: '#f39c12',
    conditional: true,
  },
  {
    id: 'science',
    name: { en: 'Mystery Jungle', ms: 'Hutan Misteri', zh: '神秘丛林' },
    subtitle: { en: 'Science & Discovery', ms: 'Sains & Penemuan', zh: '科学与探索' },
    icon: '🔬',
    color: '#9b59b6',
  },
];

interface QuestSelectorProps {
  includeMandarinTest: boolean;
  onModuleSelect: (moduleId: string) => void;
  completedModules: string[];
  moduleResults: Record<string, { score: number; total: number }>;
  brandingSettings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
    questCardImages?: Record<string, string>;
  };
  justCompletedModule?: string | null;
  onAnimationComplete?: () => void;
  onBack?: () => void;
  liveQuests?: Array<{
    id: string;
    subject: string;
    name: { en: string; ms: string; zh: string };
    status: string;
    question_count: number;
    icon: string;
    is_mandarin: boolean;
    image_path: string | null;
    created_at: string;
  }>;
  /** Practice mode — all cards are unlocked and playable, no sequential locking */
  practiceMode?: boolean;
}

function getStarRating(score: number, total: number): number {
  if (total === 0) return 0;
  const pct = (score / total) * 100;
  if (pct >= 80) return 3;
  if (pct >= 60) return 2;
  return 1;
}

function StarDisplay({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={`w-5 h-5 md:w-6 md:h-6 transition-all duration-500 ${
            i <= count ? 'drop-shadow-[0_0_6px_rgba(255,200,0,0.8)]' : 'opacity-30'
          }`}
          fill={i <= count ? '#ffd700' : 'transparent'}
          stroke={i <= count ? '#ffaa00' : '#ffffff44'}
          strokeWidth={2}
        />
      ))}
    </div>
  );
}

/**
 * StarDropAnimation — giant golden stars that form from particles at the top
 * of the screen, then drop down and shrink into the quest card.
 * Each star spawns staggered: Star 1 at 0ms, Star 2 at 400ms, Star 3 at 800ms.
 */
let starDropStylesInjected = false;
function injectStarDropStyles() {
  if (starDropStylesInjected) return;
  starDropStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'star-drop-css';
  style.textContent = `
@keyframes star-form{0%{transform:scale(0) rotate(-30deg);opacity:0;filter:blur(8px)}30%{transform:scale(1.4) rotate(10deg);opacity:1;filter:blur(0)}50%{transform:scale(1.2) rotate(0);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes star-drop{0%{transform:translateY(0) scale(1);opacity:1}20%{transform:translateY(-15px) scale(1.1);opacity:1}100%{transform:translateY(var(--drop-distance)) scale(0.35);opacity:0.9}}
@keyframes star-land{0%{transform:scale(0.35);opacity:0.9}40%{transform:scale(1.3);opacity:1}70%{transform:scale(0.9);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes star-ring{0%{transform:scale(0);opacity:0.8}100%{transform:scale(3);opacity:0}}
@keyframes star-sparkle-burst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--sx),var(--sy)) scale(0);opacity:0}}
`;
  document.head.appendChild(style);
}

function StarDropAnimation({
  starCount,
  isActive,
  targetY,
}: {
  starCount: number;
  isActive: boolean;
  targetY: number; // px from top of viewport to card center
}) {
  React.useEffect(() => { injectStarDropStyles(); }, []);

  if (!isActive || starCount === 0) return null;

  // Sparkle burst particles per star landing
  const SPARKLES_PER_STAR = 8;
  const sparkleAngles = Array.from({ length: SPARKLES_PER_STAR }, (_, i) => {
    const angle = (360 / SPARKLES_PER_STAR) * i;
    const rad = (angle * Math.PI) / 180;
    const dist = 30 + (i % 3) * 15;
    return { sx: Math.cos(rad) * dist, sy: Math.sin(rad) * dist };
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {Array.from({ length: starCount }, (_, i) => {
        const delay = i * 0.4; // stagger each star
        const formEnd = delay + 0.6;
        const dropStart = formEnd + 0.15;
        const dropEnd = dropStart + 0.55;
        const landStart = dropEnd;
        const dropDist = targetY - 120; // from top area to card

        return (
          <React.Fragment key={i}>
            {/* The star itself */}
            <div
              className="absolute"
              style={{
                left: `${35 + i * 15}%`,
                top: '80px',
                ['--drop-distance' as string]: `${dropDist}px`,
              }}
            >
              {/* Phase 1: Form (scale up with glow) */}
              <div
                style={{
                  animation: `star-form 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both`,
                }}
              >
                {/* Phase 2: Drop down */}
                <div
                  style={{
                    animation: `star-drop 0.55s ease-in ${dropStart}s both`,
                    ['--drop-distance' as string]: `${dropDist}px`,
                  }}
                >
                  <Star
                    className="w-14 h-14 md:w-16 md:h-16"
                    fill="#ffd700"
                    stroke="#ffaa00"
                    strokeWidth={1.5}
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8)) drop-shadow(0 0 40px rgba(255,170,0,0.4))',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Golden ring burst on landing */}
            <div
              className="absolute rounded-full"
              style={{
                left: `${35 + i * 15}%`,
                top: `${targetY - 10}px`,
                width: 20,
                height: 20,
                marginLeft: -10,
                border: '2px solid #ffd700',
                animation: `star-ring 0.5s ease-out ${landStart}s both`,
              }}
            />

            {/* Sparkle burst particles on landing */}
            {sparkleAngles.map((sp, j) => (
              <div
                key={`sp-${i}-${j}`}
                className="absolute rounded-full"
                style={{
                  left: `${35 + i * 15}%`,
                  top: `${targetY}px`,
                  width: 4,
                  height: 4,
                  background: j % 2 === 0 ? '#ffd700' : '#ffeaa7',
                  boxShadow: `0 0 6px ${j % 2 === 0 ? '#ffd700' : '#ffeaa7'}`,
                  ['--sx' as string]: `${sp.sx}px`,
                  ['--sy' as string]: `${sp.sy}px`,
                  animation: `star-sparkle-burst 0.4s ease-out ${landStart + 0.05}s both`,
                }}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export const QuestSelector: React.FC<QuestSelectorProps> = ({
  includeMandarinTest,
  onModuleSelect,
  completedModules,
  moduleResults,
  brandingSettings,
  justCompletedModule,
  onAnimationComplete,
  onBack,
  liveQuests,
  practiceMode,
}) => {
  const { language } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [centeredIndex, setCenteredIndex] = useState(-1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [unlockingIndex, setUnlockingIndex] = useState<number | null>(null);
  const [starsAnimating, setStarsAnimating] = useState(false);
  const animationDoneRef = useRef(false);

  // Subject-to-color map for live quests
  const SUBJECT_COLORS: Record<string, string> = {
    'english': '#7cc643',
    'math': '#4a90e2',
    'mathematics': '#4a90e2',
    'bahasa melayu': '#e74c3c',
    'science': '#9b59b6',
    'mandarin': '#f39c12',
    'chinese': '#f39c12',
    'moral': '#e67e22',
    'art': '#1abc9c',
    'music': '#e91e63',
  };

  const SUBJECT_SUBTITLES: Record<string, { en: string; ms: string; zh: string }> = {
    'english': { en: 'Language & Literacy', ms: 'Bahasa & Literasi', zh: '语言与读写' },
    'math': { en: 'Mathematics', ms: 'Matematik', zh: '数学' },
    'mathematics': { en: 'Mathematics', ms: 'Matematik', zh: '数学' },
    'bahasa melayu': { en: 'Bahasa Malaysia', ms: 'Bahasa Malaysia', zh: '马来语' },
    'science': { en: 'Science & Discovery', ms: 'Sains & Penemuan', zh: '科学与探索' },
    'mandarin': { en: 'Chinese Language', ms: 'Bahasa Cina', zh: '华语' },
    'chinese': { en: 'Chinese Language', ms: 'Bahasa Cina', zh: '华语' },
    'moral': { en: 'Moral Education', ms: 'Pendidikan Moral', zh: '道德教育' },
    'art': { en: 'Visual Arts', ms: 'Seni Visual', zh: '美术' },
    'music': { en: 'Music', ms: 'Muzik', zh: '音乐' },
  };

  // Build modules from live quests if available, otherwise fall back to hardcoded
  const modules: QuestModule[] = React.useMemo(() => {
    if (liveQuests && liveQuests.length > 0) {
      return liveQuests
        .filter(q => !q.is_mandarin || includeMandarinTest)
        .map(q => ({
          id: q.id,
          name: q.name,
          subtitle: SUBJECT_SUBTITLES[q.subject.toLowerCase()] || { en: q.subject, ms: q.subject, zh: q.subject },
          icon: q.icon || '📚',
          color: SUBJECT_COLORS[q.subject.toLowerCase()] || '#7cc643',
          conditional: q.is_mandarin,
        }));
    }
    // Fallback to hardcoded modules
    return ALL_MODULES.filter(
      (m) => !m.conditional || (m.conditional && includeMandarinTest)
    );
  }, [liveQuests, includeMandarinTest]);

  // Determine active quest index (first non-completed)
  const activeIndex = modules.findIndex((m) => !completedModules.includes(m.id));
  const allCompleted = activeIndex === -1;

  // Get card image for a quest
  const getCardImage = (moduleId: string) => {
    return (
      brandingSettings.questCardImages?.[moduleId] ||
      DEFAULT_CARD_IMAGES[moduleId] ||
      ''
    );
  };

  // Scroll to a specific card index
  const scrollToCard = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollContainerRef.current;
      const card = cardRefs.current[index];
      if (!container || !card) return;

      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const scrollLeft =
        card.offsetLeft - containerRect.width / 2 + cardRect.width / 2;
      container.scrollTo({ left: scrollLeft, behavior });
    },
    []
  );

  // Auto-center on active quest on mount
  useEffect(() => {
    // If an unlock animation is about to play, don't auto-center —
    // the unlock animation effect handles scrolling itself.
    if (justCompletedModule) return;

    const targetIndex = allCompleted ? modules.length - 1 : activeIndex;
    const timer = setTimeout(() => {
      scrollToCard(targetIndex, 'auto' as ScrollBehavior);
      setCenteredIndex(targetIndex);
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Unlock animation sequence when a module was just completed
  // Flow: show old card → stars drop onto it → scroll to next card (unlock shimmer)
  useEffect(() => {
    if (!justCompletedModule || animationDoneRef.current) return;
    animationDoneRef.current = true;

    const completedIndex = modules.findIndex((m) => m.id === justCompletedModule);
    if (completedIndex === -1) return;

    // Phase 1: Immediately center on the COMPLETED card (old card)
    scrollToCard(completedIndex, 'auto' as ScrollBehavior);
    setCenteredIndex(completedIndex);

    // Phase 2: After a brief beat, start star drop animation on old card
    const starsTimer = setTimeout(() => {
      setStarsAnimating(true);
    }, 300);

    // Phase 3: Show confetti while stars are landing
    const confettiTimer = setTimeout(() => {
      setShowConfetti(true);
    }, 900);

    const nextIndex = completedIndex + 1;
    const hasNext = nextIndex < modules.length;

    // Phase 4: After stars have landed, scroll to the NEXT card (new card)
    const scrollTimer = setTimeout(() => {
      setStarsAnimating(false);
      if (hasNext) {
        setUnlockingIndex(nextIndex);
        scrollToCard(nextIndex, 'smooth');
        setCenteredIndex(nextIndex);
      }
    }, 2400);

    // Phase 5: Clean up
    const clearTimer = setTimeout(() => {
      setShowConfetti(false);
      setUnlockingIndex(null);
      onAnimationComplete?.();
    }, 3800);

    return () => {
      clearTimeout(starsTimer);
      clearTimeout(confettiTimer);
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [justCompletedModule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track centered card on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(containerCenter - cardCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setCenteredIndex(closestIndex);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCardTap = (module: QuestModule, index: number) => {
    // Practice mode — all cards are playable
    if (practiceMode) {
      onModuleSelect(module.id);
      return;
    }

    const isCompleted = completedModules.includes(module.id);
    const isActive = index === activeIndex;
    const isLocked = !isCompleted && !isActive;

    if (isCompleted) return;

    if (isActive) {
      onModuleSelect(module.id);
      return;
    }

    if (isLocked) {
      const prevModule = modules[index - 1];
      const prevName = prevModule?.name[language] || prevModule?.name.en;
      const messages = {
        en: `Complete "${prevName}" first!`,
        ms: `Selesaikan "${prevName}" dahulu!`,
        zh: `先完成 "${prevName}"！`,
      };
      toast.info(messages[language]);
    }
  };

  const navigateCard = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev'
      ? Math.max(0, centeredIndex - 1)
      : Math.min(modules.length - 1, centeredIndex + 1);
    scrollToCard(newIndex);
    setCenteredIndex(newIndex);
  };

  const bgImage = brandingSettings.mapBackgroundImage || questMapBg;

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      {/* Shared fantasy background — dark overlay, vignette, sparkles, Google Font */}
      <FantasyBackground bgImage={bgImage} />

      <VictoryBurst isActive={showConfetti} />

      {/* Star Drop Animation — stars form at top and drop onto completed card */}
      {justCompletedModule && starsAnimating && (() => {
        const completedIdx = modules.findIndex(m => m.id === justCompletedModule);
        const result = completedIdx >= 0 ? moduleResults[justCompletedModule] : null;
        const starCount = result ? getStarRating(result.score, result.total) : 0;
        // Approximate card center Y position (60% of viewport height)
        const targetY = Math.round(window.innerHeight * 0.58);
        return (
          <StarDropAnimation
            starCount={starCount}
            isActive={starsAnimating}
            targetY={targetY}
          />
        );
      })()}

      {/* Music Toggle - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <MusicToggle />
      </div>

      {/* Back Button - Top Left */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-20 group flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(30,22,12,0.7)',
            border: '1.5px solid rgba(212,164,74,0.3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" style={{ color: '#d4a44a' }} />
          <span
            className="text-xs md:text-sm font-bold hidden sm:inline"
            style={{ color: '#c8b88a', fontFamily: "'Cinzel Decorative', serif" }}
          >
            {language === 'en' ? 'Back' : language === 'ms' ? 'Kembali' : '返回'}
          </span>
        </button>
      )}

      {/* Header - Fantasy title */}
      <div className="relative z-10 text-center px-4 md:px-8 pt-8 md:pt-12 pb-2">
        {/* Decorative top ornament */}
        <GoldOrnament className="mb-3" />

        <FantasyTitle size="lg">
          {language === 'en'
            ? 'Choose Your Quest'
            : language === 'ms'
            ? 'Pilih Pengembaraan'
            : '选择你的任务'}
        </FantasyTitle>

        {/* Subtitle with parchment color */}
        <p
          className="text-sm md:text-base mt-2 tracking-widest uppercase font-medium"
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            color: practiceMode ? '#7cc643' : '#c8b88a',
            textShadow: '0 0 8px rgba(200,184,138,0.3)',
          }}
        >
          {practiceMode
            ? (language === 'en' ? 'Training Mode — No Limits'
              : language === 'ms' ? 'Mod Latihan — Tiada Had'
              : '训练模式 — 无限制')
            : (language === 'en'
              ? `${completedModules.length} of ${modules.length} completed`
              : language === 'ms'
              ? `${completedModules.length} daripada ${modules.length} selesai`
              : `${completedModules.length}/${modules.length} 已完成`)}
        </p>

        {/* Decorative bottom ornament */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent to-[#d4a44a]/40" />
          <div className="text-[#d4a44a]/60 text-xs">&#9830;</div>
          <div className="h-px w-16 md:w-24 bg-gradient-to-l from-transparent to-[#d4a44a]/40" />
        </div>
      </div>

      {/* Card Carousel */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        {/* Desktop Nav Arrows — fantasy styled */}
        <button
          onClick={() => navigateCard('prev')}
          className="hidden md:flex absolute left-4 lg:left-8 z-20 w-12 h-12 rounded-full items-center justify-center transition-all duration-300 disabled:opacity-20 hover:scale-110"
          disabled={centeredIndex <= 0}
          style={{
            background: 'linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)',
            border: '2px solid #d4a44a55',
            boxShadow: '0 0 15px rgba(212,164,74,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <ChevronLeft className="w-5 h-5 text-[#d4a44a]" />
        </button>

        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto scrollbar-hide px-[10vw] md:px-[30vw] py-4 md:py-8"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div className="flex gap-4 md:gap-6">
            {modules.map((module, index) => {
              const isCompleted = practiceMode ? false : completedModules.includes(module.id);
              const isActive = practiceMode ? true : (index === activeIndex && !allCompleted);
              const isLocked = practiceMode ? false : (!isCompleted && !isActive);
              const isCentered = centeredIndex === index;
              const isUnlocking = unlockingIndex === index;
              const result = moduleResults[module.id];
              const stars = result ? getStarRating(result.score, result.total) : 0;
              const cardImage = getCardImage(module.id);

              return (
                <div
                  key={module.id}
                  ref={(el) => { cardRefs.current[index] = el; }}
                  className="flex-shrink-0 scroll-snap-center"
                  style={{
                    scrollSnapAlign: 'center',
                    width: 'min(75vw, 300px)',
                  }}
                >
                  {/* Outer card frame — fantasy ornate border */}
                  <div
                    onClick={() => handleCardTap(module, index)}
                    className={`
                      relative overflow-hidden transition-all duration-500
                      ${isActive || practiceMode ? 'cursor-pointer' : 'cursor-default'}
                      ${isUnlocking ? 'quest-unlock-shimmer' : ''}
                    `}
                    style={{
                      aspectRatio: '3/4',
                      borderRadius: '16px',
                      transform: isCentered ? 'scale(1)' : 'scale(0.85)',
                      filter: isLocked && !isUnlocking ? 'grayscale(80%) brightness(0.5)' : 'none',
                      opacity: isLocked && !isUnlocking ? 0.6 : 1,
                      transition: 'transform 0.4s ease, filter 0.6s ease, opacity 0.6s ease',
                      // Fantasy card frame
                      border: (isActive && isCentered) || (practiceMode && isCentered)
                        ? '3px solid #d4a44a'
                        : isCompleted
                        ? '3px solid #d4a44a88'
                        : '3px solid #3a2f1e88',
                      boxShadow: (isActive && isCentered) || (practiceMode && isCentered)
                        ? '0 0 30px rgba(212,164,74,0.5), 0 0 60px rgba(212,164,74,0.2), inset 0 0 20px rgba(212,164,74,0.1)'
                        : isCentered
                        ? '0 8px 32px rgba(0,0,0,0.4), 0 0 15px rgba(212,164,74,0.1)'
                        : '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Inner ornate border */}
                    <div
                      className="absolute inset-[4px] rounded-[12px] z-[2] pointer-events-none"
                      style={{
                        border: '1px solid rgba(212,164,74,0.25)',
                      }}
                    />

                    {/* Corner ornaments */}
                    {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, idx) => (
                      <div
                        key={idx}
                        className={`absolute ${pos} w-4 h-4 z-[3] pointer-events-none`}
                        style={{
                          borderTop: pos.includes('top') ? '2px solid #d4a44a55' : 'none',
                          borderBottom: pos.includes('bottom') ? '2px solid #d4a44a55' : 'none',
                          borderLeft: pos.includes('left') ? '2px solid #d4a44a55' : 'none',
                          borderRight: pos.includes('right') ? '2px solid #d4a44a55' : 'none',
                          borderRadius: '4px',
                        }}
                      />
                    ))}

                    {/* Card Background Image */}
                    <div className="absolute inset-0">
                      {cardImage ? (
                        <img
                          src={cardImage}
                          alt={module.name.en}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{
                            background: `linear-gradient(135deg, ${module.color}33 0%, ${module.color}11 100%)`,
                          }}
                        />
                      )}
                    </div>

                    {/* Dark gradient overlay — more dramatic */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(to top, #0a0a12ee 0%, #0a0a12cc 25%, ${module.color}44 50%, transparent 70%)`,
                      }}
                    />

                    {/* Active golden glow pulse */}
                    {(isActive || practiceMode) && isCentered && (
                      <div
                        className="absolute inset-0 rounded-[13px] animate-pulse z-[1]"
                        style={{
                          boxShadow: 'inset 0 0 40px rgba(212,164,74,0.15)',
                        }}
                      />
                    )}

                    {/* Completed Badge — wax seal style */}
                    {isCompleted && !practiceMode && (
                      <div
                        className="absolute top-3 right-3 md:top-4 md:right-4 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg z-10"
                        style={{
                          background: 'linear-gradient(135deg, #d4a44a 0%, #a67c2e 100%)',
                          border: '2px solid #ffeaa7',
                          boxShadow: '0 0 12px rgba(212,164,74,0.5)',
                        }}
                      >
                        <span className="text-white text-base md:text-lg font-bold">&#10003;</span>
                      </div>
                    )}

                    {/* Lock Overlay — darker, more mysterious */}
                    {isLocked && !isUnlocking && !practiceMode && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                        <div
                          className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
                          style={{
                            background: 'radial-gradient(circle, rgba(30,20,10,0.9) 0%, rgba(20,15,8,0.7) 100%)',
                            border: '2px solid #d4a44a33',
                            boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                          }}
                        >
                          <Lock className="w-7 h-7 md:w-9 md:h-9 text-[#d4a44a]/60" />
                        </div>
                      </div>
                    )}

                    {/* Unlock Shimmer Effect */}
                    {isUnlocking && (
                      <div className="absolute inset-0 z-10 overflow-hidden rounded-[13px]">
                        <div className="quest-shimmer-bar" />
                      </div>
                    )}

                    {/* Quest Number Badge — shield/medallion style */}
                    <div
                      className="absolute top-3 left-3 md:top-4 md:left-4 z-10"
                    >
                      <div
                        className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center font-bold text-sm md:text-base"
                        style={{
                          fontFamily: "'Cinzel Decorative', serif",
                          background: 'linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)',
                          border: '2px solid #d4a44a88',
                          color: '#d4a44a',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }}
                      >
                        {index + 1}
                      </div>
                    </div>

                    {/* Card Content (Bottom) */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 z-10">
                      {/* Thin gold separator line */}
                      <div className="w-10 h-0.5 mb-3 rounded-full" style={{
                        background: 'linear-gradient(90deg, #d4a44a, transparent)',
                      }} />

                      {/* Quest Name — fantasy font */}
                      <h3
                        className="text-lg md:text-xl font-bold leading-tight"
                        style={{
                          fontFamily: "'Cinzel Decorative', serif",
                          color: '#ffeaa7',
                          textShadow: '0 0 10px rgba(212,164,74,0.3), 0 2px 4px rgba(0,0,0,0.8)',
                        }}
                      >
                        {module.name[language]}
                      </h3>

                      {/* Subtitle */}
                      <p
                        className="text-xs md:text-sm mt-1.5"
                        style={{
                          color: '#c8b88a',
                          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {module.subtitle[language]}
                      </p>

                      {/* Stars (completed) */}
                      {isCompleted && result && !practiceMode && (
                        <div className={`mt-3 ${starsAnimating && justCompletedModule === module.id ? 'animate-bounce' : ''}`}>
                          <StarDisplay count={stars} />
                          <p className="text-xs mt-1" style={{ color: '#c8b88a99' }}>
                            {result.score}/{result.total}{' '}
                            {language === 'en' ? 'correct' : language === 'ms' ? 'betul' : '正确'}
                          </p>
                        </div>
                      )}

                      {/* PLAY Button (active + centered) — golden fantasy button */}
                      {(isActive || practiceMode) && isCentered && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onModuleSelect(module.id);
                          }}
                          className="mt-4 w-full py-3 md:py-3.5 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 hover:scale-[1.02] tracking-wider uppercase"
                          style={{
                            fontFamily: "'Cinzel Decorative', serif",
                            background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)',
                            color: '#2a1f0e',
                            border: '2px solid #ffeaa7',
                            boxShadow: '0 4px 20px rgba(212,164,74,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                            textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                          }}
                        >
                          <Play className="w-4 h-4 md:w-5 md:h-5" fill="#2a1f0e" />
                          {practiceMode
                            ? (language === 'en' ? 'TRAIN' : language === 'ms' ? 'LATIH' : '训练')
                            : (language === 'en' ? 'PLAY' : language === 'ms' ? 'MULA' : '开始')}
                        </button>
                      )}

                      {/* Locked text */}
                      {isLocked && !isUnlocking && isCentered && !practiceMode && (
                        <div className="mt-3 text-center">
                          <p className="text-xs md:text-sm italic" style={{ color: '#d4a44a66' }}>
                            {language === 'en'
                              ? `Complete Quest ${index} first`
                              : language === 'ms'
                              ? `Selesaikan Quest ${index} dahulu`
                              : `先完成任务 ${index}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop Nav Arrow Right */}
        <button
          onClick={() => navigateCard('next')}
          className="hidden md:flex absolute right-4 lg:right-8 z-20 w-12 h-12 rounded-full items-center justify-center transition-all duration-300 disabled:opacity-20 hover:scale-110"
          disabled={centeredIndex >= modules.length - 1}
          style={{
            background: 'linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)',
            border: '2px solid #d4a44a55',
            boxShadow: '0 0 15px rgba(212,164,74,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <ChevronRight className="w-5 h-5 text-[#d4a44a]" />
        </button>
      </div>

      {/* Progress gems — diamond shapes instead of dots */}
      <div className="relative z-10 flex items-center justify-center gap-2.5 py-3 md:py-4">
        {modules.map((m, i) => {
          const isCompleted = practiceMode ? false : completedModules.includes(m.id);
          const isActive = practiceMode ? true : (i === activeIndex);
          const isSel = centeredIndex === i;
          return (
            <button
              key={m.id}
              onClick={() => {
                scrollToCard(i);
                setCenteredIndex(i);
              }}
              className="transition-all duration-300"
              style={{
                width: isSel ? '12px' : '8px',
                height: isSel ? '12px' : '8px',
                transform: 'rotate(45deg)',
                background: isCompleted
                  ? 'linear-gradient(135deg, #d4a44a, #ffeaa7)'
                  : isActive
                  ? 'linear-gradient(135deg, #d4a44a, #f0d078)'
                  : '#3a2f1e',
                border: isSel
                  ? '1.5px solid #ffeaa7'
                  : isCompleted || isActive
                  ? '1px solid #d4a44a88'
                  : '1px solid #d4a44a33',
                boxShadow: isSel
                  ? '0 0 8px rgba(212,164,74,0.5)'
                  : isCompleted
                  ? '0 0 4px rgba(212,164,74,0.3)'
                  : 'none',
                opacity: !isCompleted && !isActive ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>

      {/* Swipe Hint (mobile only, shown briefly) */}
      <SwipeHint language={language} />

      {/* Footer */}
      <FantasyFooter />

      {/* Fantasy Animations CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .quest-unlock-shimmer {
          animation: quest-unlock 1.2s ease-out forwards;
        }

        @keyframes quest-unlock {
          0% {
            filter: grayscale(80%) brightness(0.5);
            opacity: 0.6;
          }
          50% {
            filter: grayscale(40%) brightness(0.8);
            opacity: 0.85;
          }
          100% {
            filter: grayscale(0%) brightness(1);
            opacity: 1;
          }
        }

        .quest-shimmer-bar {
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(212, 164, 74, 0.4) 50%,
            transparent 100%
          );
          animation: shimmer-slide 1s ease-out forwards;
        }

        @keyframes shimmer-slide {
          0% { left: -60%; }
          100% { left: 120%; }
        }

        @keyframes swipe-hint {
          0%, 100% { transform: translateX(0); opacity: 1; }
          50% { transform: translateX(10px); opacity: 0.6; }
        }

        .swipe-hint-anim {
          animation: swipe-hint 1.5s ease-in-out 3;
        }
      `}</style>
    </div>
  );
};

// Small swipe hint component that auto-hides
function SwipeHint({ language }: { language: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative z-10 flex items-center justify-center gap-2 pb-2 md:hidden">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs swipe-hint-anim"
        style={{
          backgroundColor: 'rgba(42,31,14,0.6)',
          color: '#c8b88a',
          border: '1px solid #d4a44a33',
        }}
      >
        <ChevronLeft className="w-3 h-3" />
        {language === 'en' ? 'Swipe to explore' : language === 'ms' ? 'Leret untuk meneroka' : '滑动探索'}
        <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  );
}