/**
 * VideoModeCarousel.tsx — Sliding Game Mode Cards with Video Playback
 *
 * Each card represents a game mode from Foxy Adventure.
 * Clicking plays a YouTube video about that mode.
 * Styled as a horizontal snap-scroll carousel (matching practice/quest card UX).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Play, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSkeleton } from '../ui/ImageSkeleton';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

interface GameMode {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  videoId: string;
  imageSlug: string;
  comingSoon?: boolean;
  isSpecial?: boolean;
}

const MODES: GameMode[] = [
  {
    id: 'test',
    title: 'Test Mode',
    subtitle: 'KSSR Assessment',
    description: 'Gamified KSSR readiness assessment across English, BM, Math, and Mandarin — built as a dark-fantasy RPG adventure.',
    color: '#dc2626',
    gradientFrom: '#b91c1c',
    gradientTo: '#ef4444',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'test_mode_2',
  },
  {
    id: 'practice',
    title: 'Practice Mode',
    subtitle: 'Daily Practice',
    description: 'Adaptive daily practice sessions that adjust difficulty based on your child\'s mastery level. Build skills every day.',
    color: '#1a1a1a',
    gradientFrom: '#0a0a0a',
    gradientTo: '#2d2d2d',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'homepage_test_mode',
  },
  {
    id: 'battle',
    title: 'Battle Mode',
    subtitle: 'Challenge Mode',
    description: 'Face timed boss encounters that test speed and accuracy. Earn gold and rare items for your Foxy companion.',
    color: '#92400e',
    gradientFrom: '#78350f',
    gradientTo: '#b45309',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'homepage_practice_mode',
  },
  {
    id: 'card',
    title: 'Card Mode',
    subtitle: 'Memory Training',
    description: 'Spaced-repetition flashcards for vocabulary, math facts, and character recognition in all three languages.',
    color: '#059669',
    gradientFrom: '#047857',
    gradientTo: '#10b981',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'durian_monster',
  },
  {
    id: 'music',
    title: 'Music Mode',
    subtitle: 'Songs & Stories',
    description: 'Nursery rhymes, learning songs, and bedtime stories in all three languages. Perfect for audio learners.',
    color: '#e74c8b',
    gradientFrom: '#db2777',
    gradientTo: '#f472b6',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'music_mode',
  },
  {
    id: 'video',
    title: 'Video Mode',
    subtitle: 'Learn & Watch',
    description: 'Curated educational videos across 8 categories — from phonics to science experiments — in BM, English, and Mandarin.',
    color: '#9b59b6',
    gradientFrom: '#7c3aed',
    gradientTo: '#c084fc',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'video_mode_homepage',
  },
  {
    id: 'quest',
    title: 'Quest Mode',
    subtitle: 'Pokémon-like RPG',
    description: 'Explore a Pokémon-inspired RPG world where learning meets adventure — capture knowledge, level up skills, and become the ultimate scholar.',
    color: '#d4a017',
    gradientFrom: '#0a0a0a',
    gradientTo: '#1a1a1a',
    videoId: 'LHJWRS6xffY',
    imageSlug: 'quest_mode-homepage',
    comingSoon: true,
    isSpecial: true,
  },
];

export function VideoModeCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [centeredIndex, setCenteredIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [imageMap, setImageMap] = useState<globalThis.Map<string, string>>(new globalThis.Map());

  // Fetch R2 assets for game mode images
  useEffect(() => {
    fetch(`${API}/rpg-assets`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const assets: any[] = data?.assets || [];
        const lookup = new globalThis.Map<string, string>();
        for (const a of assets) {
          if (a.slug && a.publicUrl) {
            lookup.set(a.slug, a.publicUrl);
            lookup.set(a.slug.toLowerCase(), a.publicUrl);
          }
        }
        setImageMap(lookup);
      })
      .catch(err => {
        console.error('[VideoModeCarousel] RPG assets fetch failed:', err);
      });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const scrollToCard = useCallback(
    (idx: number) => {
      const el = cardRefs.current[idx];
      if (!el || !scrollRef.current) return;
      const container = scrollRef.current;
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const scrollLeft = cardCenter - container.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      setCenteredIndex(idx);
    },
    []
  );

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const center = container.scrollLeft + container.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(center - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = idx;
      }
    });
    setCenteredIndex(closest);
  }, []);

  const goLeft = () => scrollToCard(Math.max(0, centeredIndex - 1));
  const goRight = () => scrollToCard(Math.min(MODES.length - 1, centeredIndex + 1));

  return (
    <>
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-4">
              <Play className="w-3 h-3 text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                Inside Foxy Adventure
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              Explore the game modes
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Click any card to watch how it works.
            </p>
          </motion.div>

          {/* Carousel */}
          <div className="relative">
            {/* Arrows (desktop) */}
            {!isMobile && centeredIndex > 0 && (
              <button
                onClick={goLeft}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-white border border-gray-200 shadow-lg hover:border-gray-400 transition-all -ml-3"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            {!isMobile && centeredIndex < MODES.length - 1 && (
              <button
                onClick={goRight}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-white border border-gray-200 shadow-lg hover:border-gray-400 transition-all -mr-3"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            )}

            {/* Scrollable */}
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4"
              style={{
                scrollPaddingInline: '16%',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
              onScroll={handleScroll}
            >
              {/* Left spacer */}
              <div
                className="flex-shrink-0"
                style={{ width: isMobile ? '6%' : '18%' }}
              />

              {MODES.map((mode, idx) => {
                const isCentered = idx === centeredIndex;
                const charImg = imageMap.get(mode.imageSlug);
                return (
                  <div
                    key={mode.id}
                    ref={(el) => {
                      cardRefs.current[idx] = el;
                    }}
                    className="flex-shrink-0 snap-center cursor-pointer transition-all duration-300"
                    style={{
                      width: isMobile ? '72%' : '260px',
                      maxWidth: '280px',
                      transform: isCentered ? 'scale(1)' : 'scale(0.88)',
                      opacity: isCentered ? 1 : 0.55,
                    }}
                    onClick={() => {
                      if (isCentered) {
                        setActiveVideo(mode.videoId);
                      } else {
                        scrollToCard(idx);
                      }
                    }}
                  >
                    {/* Supercell-style card: rounded square with character overflowing top */}
                    <div className="relative" style={{ paddingTop: '140px', paddingBottom: '8px' }}>
                      {/* Magical spell aura for special cards (Quest) */}
                      {mode.isSpecial && isCentered && (
                        <>
                          {/* Outer rotating magical ring */}
                          <div
                            className="absolute z-0 left-1/2 pointer-events-none"
                            style={{
                              top: '100px',
                              width: '300px',
                              height: '200px',
                              transform: 'translateX(-50%)',
                            }}
                          >
                            <div
                              className="w-full h-full rounded-[28px]"
                              style={{
                                background: 'transparent',
                                border: '2px solid rgba(255,215,0,0.15)',
                                animation: 'quest-pulse 3s ease-in-out infinite',
                                boxShadow: '0 0 30px rgba(255,215,0,0.1), inset 0 0 30px rgba(255,215,0,0.05)',
                              }}
                            />
                          </div>
                          {/* Floating sparkle particles */}
                          {[...Array(8)].map((_, i) => (
                            <div
                              key={i}
                              className="absolute z-20 pointer-events-none"
                              style={{
                                left: `${20 + (i * 9) % 60}%`,
                                top: `${110 + (i * 17) % 80}px`,
                                width: `${3 + (i % 3)}px`,
                                height: `${3 + (i % 3)}px`,
                                borderRadius: '50%',
                                background: i % 2 === 0 ? '#ffd700' : '#fff8dc',
                                boxShadow: `0 0 ${4 + i}px ${i % 2 === 0 ? 'rgba(255,215,0,0.8)' : 'rgba(255,248,220,0.6)'}`,
                                animation: `quest-sparkle-${i % 4} ${1.5 + (i % 3) * 0.5}s ease-in-out infinite`,
                                animationDelay: `${i * 0.25}s`,
                                opacity: 0.8,
                              }}
                            />
                          ))}
                          {/* Golden glow behind card */}
                          <div
                            className="absolute z-0 left-1/2 pointer-events-none"
                            style={{
                              bottom: '8px',
                              width: '260px',
                              height: '150px',
                              transform: 'translateX(-50%)',
                              borderRadius: '20px',
                              background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.05) 50%, transparent 70%)',
                              animation: 'quest-glow 2s ease-in-out infinite alternate',
                            }}
                          />
                          <style>{`
                            @keyframes quest-pulse {
                              0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
                              50% { transform: translateX(-50%) scale(1.04); opacity: 1; }
                            }
                            @keyframes quest-glow {
                              0% { opacity: 0.5; }
                              100% { opacity: 1; }
                            }
                            @keyframes quest-sparkle-0 {
                              0%, 100% { transform: translateY(0) scale(1); opacity: 0; }
                              20% { opacity: 1; }
                              50% { transform: translateY(-25px) scale(1.3); opacity: 0.8; }
                              80% { opacity: 0.3; }
                            }
                            @keyframes quest-sparkle-1 {
                              0%, 100% { transform: translateY(0) scale(0.8); opacity: 0; }
                              30% { opacity: 1; }
                              60% { transform: translateY(-30px) scale(1.2); opacity: 0.7; }
                            }
                            @keyframes quest-sparkle-2 {
                              0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
                              25% { opacity: 0.9; }
                              50% { transform: translate(5px, -20px) scale(1.4); opacity: 0.6; }
                            }
                            @keyframes quest-sparkle-3 {
                              0%, 100% { transform: translate(0, 0) scale(0.6); opacity: 0; }
                              15% { opacity: 1; }
                              45% { transform: translate(-5px, -28px) scale(1.1); opacity: 0.5; }
                            }
                          `}</style>
                        </>
                      )}

                      {/* Character image — overflows above the card top */}
                      <div
                        className="absolute z-10 pointer-events-none left-1/2"
                        style={{
                          top: '0px',
                          width: '240px',
                          height: '240px',
                          transform: `translateX(-50%) ${isCentered ? 'scale(1.05)' : 'scale(0.92)'}`,
                          transition: 'transform 0.3s ease',
                        }}
                      >
                        {charImg ? (
                          <img
                            src={charImg}
                            alt={mode.title}
                            className="w-full h-full object-contain"
                            style={{
                              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))',
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-end justify-center">
                            <div
                              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                              style={{
                                background: `linear-gradient(135deg, ${mode.gradientFrom}25, ${mode.gradientTo}25)`,
                                border: `2px dashed ${mode.color}35`,
                              }}
                            >
                              <Play className="w-8 h-8" style={{ color: `${mode.color}50` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Colored card body — compact, character pops above */}
                      <div
                        className={`relative rounded-[20px] overflow-hidden transition-all duration-300 ${mode.isSpecial ? 'ring-2 ring-yellow-400/40' : ''}`}
                        style={{
                          height: '150px',
                          background: mode.isSpecial
                            ? `linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 60%, #2a1f00 100%)`
                            : `linear-gradient(160deg, ${mode.gradientFrom}, ${mode.gradientTo})`,
                          boxShadow: mode.isSpecial && isCentered
                            ? '0 12px 40px rgba(255,215,0,0.3), 0 4px 12px rgba(255,215,0,0.15), inset 0 1px 0 rgba(255,215,0,0.3), 0 0 60px rgba(255,215,0,0.1)'
                            : isCentered
                            ? '0 12px 32px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.15)'
                            : '0 4px 16px rgba(0,0,0,0.1)',
                        }}
                      >
                        {/* Gold edge accent for special cards */}
                        {mode.isSpecial && (
                          <div
                            className="absolute inset-0 rounded-[20px] pointer-events-none"
                            style={{
                              border: '1.5px solid rgba(255,215,0,0.25)',
                              background: 'linear-gradient(180deg, rgba(255,215,0,0.08) 0%, transparent 30%, transparent 70%, rgba(255,215,0,0.05) 100%)',
                            }}
                          />
                        )}

                        {/* Inner highlight sheen */}
                        <div
                          className="absolute inset-0 rounded-[24px] pointer-events-none"
                          style={{
                            background: mode.isSpecial
                              ? 'linear-gradient(180deg, rgba(255,215,0,0.12) 0%, rgba(255,215,0,0.03) 30%, transparent 60%)'
                              : 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
                          }}
                        />

                        {/* Play button icon — top left */}
                        <div
                          className="absolute top-3 left-3 z-10 flex items-center justify-center rounded-full"
                          style={{
                            width: '28px',
                            height: '28px',
                            background: mode.isSpecial
                              ? 'rgba(255,215,0,0.2)'
                              : 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(4px)',
                            border: mode.isSpecial
                              ? '1px solid rgba(255,215,0,0.3)'
                              : '1px solid rgba(255,255,255,0.2)',
                          }}
                        >
                          <Play
                            className="w-3 h-3"
                            style={{
                              color: mode.isSpecial ? '#ffd700' : 'rgba(255,255,255,0.8)',
                              fill: mode.isSpecial ? '#ffd700' : 'rgba(255,255,255,0.8)',
                              marginLeft: '1px',
                            }}
                          />
                        </div>

                        {/* Text content pinned to bottom */}
                        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-8 text-left"
                          style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
                          }}
                        >
                          {/* Coming Soon badge */}
                          {mode.comingSoon && (
                            <div className="inline-block px-2.5 py-0.5 mb-2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/30 text-white/90 backdrop-blur-sm">
                              Coming Soon
                            </div>
                          )}

                          <h3 className="text-[18px] font-bold text-white drop-shadow-md leading-tight">
                            {mode.title}
                          </h3>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-medium text-white/60">
                              Foxy Adventure
                            </span>
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: 'rgba(255,255,255,0.2)',
                                color: '#fff',
                              }}
                            >
                              {mode.subtitle}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Right spacer */}
              <div
                className="flex-shrink-0"
                style={{ width: isMobile ? '6%' : '18%' }}
              />
            </div>

            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mt-2">
              {MODES.map((mode, idx) => (
                <button
                  key={mode.id}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: idx === centeredIndex ? 20 : 8,
                    height: 8,
                    background:
                      idx === centeredIndex
                        ? mode.color
                        : '#e5e7eb',
                    boxShadow:
                      idx === centeredIndex
                        ? `0 0 8px ${mode.color}40`
                        : 'none',
                  }}
                  onClick={() => scrollToCard(idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video Modal */}
      <AnimatePresence>
        {activeVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm"
              onClick={() => setActiveVideo(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-[92%] max-w-3xl z-10"
            >
              <button
                onClick={() => setActiveVideo(null)}
                className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="rounded-2xl overflow-hidden bg-gray-950 shadow-2xl aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1&rel=0`}
                  title="Game Mode Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}