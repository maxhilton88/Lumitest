import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, ChevronLeft, ChevronRight, X, Lock, Crown, Clock, Sparkles, Star,
  ArrowLeft, Tv, Loader2, Globe, SlidersHorizontal, ChevronDown,
} from 'lucide-react';

import { playMenuSelect } from '../../hooks/useSoundEffects';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { fetchVideos, fetchWatchHistory } from '../../utils/parent-api';
import { useLanguage } from '../LanguageContext';

// ===== THEME CONSTANTS =====
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CINZEL = "'Cinzel Decorative', serif";
const CHERRY = "'Cherry Bomb One', cursive";

// ===== DATA TYPES =====
interface Video {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  duration: string;
  episode?: number | null;
  isPremium: boolean;
  dyntubeKey?: string;
  isNew?: boolean;
  isFeatured?: boolean;
  seriesId?: string | null;
  category?: string;
  language?: string;
  createdAt?: string;
}

interface Series {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  episodes: Video[];
}

// ===== DEMO DATA =====
const DEMO_VIDEOS: Video[] = [
  { id: 'en1', title: 'The Magic Alphabet', thumbnail: 'https://images.unsplash.com/photo-1769072385024-c962e061c523?w=480&h=270&fit=crop', duration: '4:32', episode: 1, isPremium: false, isNew: true, isFeatured: true, category: 'english' },
  { id: 'en2', title: "Foxy's Phonics Quest", thumbnail: 'https://images.unsplash.com/photo-1655664333751-e01783bb8bf3?w=480&h=270&fit=crop', duration: '5:15', episode: 2, isPremium: false, category: 'english' },
  { id: 'en3', title: 'Vowel Valley Adventure', thumbnail: 'https://images.unsplash.com/photo-1655532391070-ef6c6e922e39?w=480&h=270&fit=crop', duration: '4:48', episode: 3, isPremium: false, category: 'english' },
  { id: 'nu1', title: 'Counting Coconuts', thumbnail: 'https://images.unsplash.com/photo-1740062446976-94a8837e0dde?w=480&h=270&fit=crop', duration: '3:45', episode: 1, isPremium: false, isNew: true, category: 'numbers' },
  { id: 'nu2', title: 'Treasure Map Shapes', thumbnail: 'https://images.unsplash.com/photo-1646237023864-8f1daf930976?w=480&h=270&fit=crop', duration: '4:20', episode: 2, isPremium: false, category: 'numbers' },
  { id: 'bm1', title: 'Huruf Ajaib A-Z', thumbnail: 'https://images.unsplash.com/photo-1541802802036-1d572ba70147?w=480&h=270&fit=crop', duration: '4:10', episode: 1, isPremium: false, category: 'bahasa' },
  { id: 'sc1', title: 'Rainforest Secrets', thumbnail: 'https://images.unsplash.com/photo-1759435147483-f3c7052b1b9f?w=480&h=270&fit=crop', duration: '5:45', episode: 1, isPremium: false, isNew: true, category: 'science' },
  { id: 'mu1', title: 'ABC Sing-Along', thumbnail: 'https://images.unsplash.com/photo-1554343594-1c9d305bd51f?w=480&h=270&fit=crop', duration: '3:00', isPremium: false, category: 'music' },
  { id: 'mv1', title: "Foxy's Great Adventure", subtitle: 'A journey across enchanted lands', thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&h=270&fit=crop', duration: '1:05:00', isPremium: false, isNew: true, isFeatured: true, category: 'movie' },
  { id: 'mv2', title: 'The Secret of Crystal Cave', subtitle: 'Discover the hidden crystals of power', thumbnail: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=480&h=270&fit=crop', duration: '52:30', isPremium: true, category: 'movie' },
  { id: 'sl1', title: "Foxy's Starlight Lullaby", thumbnail: 'https://images.unsplash.com/photo-1732519633369-5c0209e47668?w=480&h=270&fit=crop', duration: '12:00', isPremium: false, category: 'sleep' },
  { id: 'sl2', title: 'The Sleepy Forest', thumbnail: 'https://images.unsplash.com/photo-1662368355359-830b331349ef?w=480&h=270&fit=crop', duration: '15:00', isPremium: false, category: 'sleep' },
];

const DEMO_SERIES: Series[] = [
  {
    id: 'ser_en', title: 'English Knight Adventures', description: 'Language & literacy adventures with Foxy', thumbnail: 'https://images.unsplash.com/photo-1562576650-27130b06c0ab?w=480&h=320&fit=crop', category: 'english',
    episodes: DEMO_VIDEOS.filter(v => v.category === 'english'),
  },
  {
    id: 'ser_nu', title: 'Numbers Sorcerer', description: 'Counting, shapes & number magic', thumbnail: 'https://images.unsplash.com/photo-1740062446976-94a8837e0dde?w=480&h=320&fit=crop', category: 'numbers',
    episodes: DEMO_VIDEOS.filter(v => v.category === 'numbers'),
  },
];

// ===== HORIZONTAL SCROLL ROW =====
const ScrollRow: React.FC<{
  title: string;
  subtitle?: string;
  color?: string;
  badge?: string;
  items: Video[];
  isPaid: boolean;
  onPlay: (video: Video) => void;
  landscape?: boolean;
  watchedIds?: Set<string>;
}> = ({ title, subtitle, color = GOLD, badge, items, isPaid, onPlay, landscape = true, watchedIds }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 20);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', checkScroll);
    return () => { if (el) el.removeEventListener('scroll', checkScroll); };
  }, [items.length]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}50` }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm md:text-base font-bold tracking-wide" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
            {title}
          </h3>
          {subtitle && <p className="text-[10px] md:text-xs mt-0.5" style={{ color: `${PARCHMENT}80` }}>{subtitle}</p>}
        </div>
        {badge && (
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ color, border: `1px solid ${color}40`, background: `${color}10` }}>
            {badge}
          </div>
        )}
      </div>

      <div className="relative group">
        {showLeft && (
          <button onClick={() => { playMenuSelect(); scroll('left'); }} className="absolute left-0 top-0 bottom-0 z-20 w-10 md:w-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(to right, rgba(12,8,20,0.95), transparent)' }}>
            <ChevronLeft className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
          </button>
        )}
        {showRight && (
          <button onClick={() => { playMenuSelect(); scroll('right'); }} className="absolute right-0 top-0 bottom-0 z-20 w-10 md:w-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(to left, rgba(12,8,20,0.95), transparent)' }}>
            <ChevronRight className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
          </button>
        )}

        <div ref={scrollRef} className="flex gap-3 md:gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {items.map((video) => {
            const locked = video.isPremium && !isPaid;
            return (
              <button
                key={video.id}
                onClick={() => { playMenuSelect(); onPlay(video); }}
                className="flex-shrink-0 group/card relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:z-10 focus:outline-none"
                style={{
                  width: landscape ? 'clamp(200px, 42vw, 260px)' : 'clamp(140px, 30vw, 180px)',
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                <div className={`relative ${landscape ? 'aspect-video' : 'aspect-[2/3]'} overflow-hidden`}>
                  <ImageWithFallback src={video.thumbnail} alt={video.title} className={`w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110 ${locked ? 'brightness-50' : ''}`} />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md" style={{ background: locked ? 'rgba(0,0,0,0.6)' : `${GOLD}dd`, border: `2px solid ${locked ? '#ffffff30' : GOLD_LIGHT}` }}>
                      {locked ? <Lock className="w-5 h-5 text-white/70" /> : <Play className="w-5 h-5 ml-0.5" style={{ color: '#2a1f0e' }} />}
                    </div>
                  </div>

                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                    <Clock className="w-2.5 h-2.5" /> {video.duration}
                  </div>

                  {video.episode && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${color}cc`, color: '#fff', border: `1.5px solid ${color}` }}>
                      {video.episode}
                    </div>
                  )}

                  {video.isNew && !locked && !watchedIds?.has(video.id) && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5" style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}>
                      <Sparkles className="w-2.5 h-2.5" /> NEW
                    </div>
                  )}

                  {locked && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: GOLD_LIGHT }}>
                      <Crown className="w-2.5 h-2.5" /> Premium
                    </div>
                  )}
                </div>

                <div className="px-3 py-2.5" style={{ background: 'linear-gradient(135deg, rgba(20,14,8,0.98), rgba(30,22,12,0.95))' }}>
                  <p className="text-[11px] md:text-xs font-bold leading-tight truncate text-left" style={{ color: locked ? `${PARCHMENT}60` : `${PARCHMENT}d0`, fontFamily: CINZEL }}>
                    {video.title}
                  </p>
                  {video.subtitle && (
                    <p className="text-[9px] md:text-[10px] leading-tight truncate text-left mt-0.5" style={{ color: locked ? `${PARCHMENT}40` : `${PARCHMENT}70` }}>
                      {video.subtitle}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ===== FEATURED HERO CAROUSEL =====
const FeaturedCarousel: React.FC<{
  videos: Video[];
  onPlay: (video: Video) => void;
  watchedIds?: Set<string>;
}> = ({ videos, onPlay, watchedIds }) => {
  const { t } = useLanguage();
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (videos.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % videos.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [videos.length]);

  const goTo = (idx: number) => {
    setActiveIdx(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setActiveIdx(prev => (prev + 1) % videos.length), 5000);
  };

  if (videos.length === 0) return null;
  const featured = videos[activeIdx];

  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 md:mb-8" style={{ border: `2px solid ${GOLD}30` }}>
      <div className="relative aspect-[21/9] md:aspect-[3/1]">
        <ImageWithFallback src={featured.thumbnail} alt={featured.title} className="w-full h-full object-cover transition-all duration-700" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(12,8,4,0.95) 0%, rgba(12,8,4,0.6) 40%, rgba(12,8,4,0.2) 70%, rgba(12,8,4,0.5) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,8,4,0.95) 0%, transparent 50%)' }} />

        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={{ background: GOLD, color: '#2a1f0e' }}>
              {t('video.featured') || 'Featured'}
            </span>
            {featured.isNew && !watchedIds?.has(featured.id) && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5" style={{ background: 'rgba(255,255,255,0.15)', color: GOLD_LIGHT }}>
                <Sparkles className="w-2.5 h-2.5" /> NEW
              </span>
            )}
          </div>

          <h2 className="text-lg md:text-3xl font-bold leading-tight mb-1 md:mb-2 max-w-md" style={{ fontFamily: CHERRY, color: GOLD_LIGHT, textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
            {featured.title}
          </h2>

          <p className="text-xs md:text-sm mb-3 md:mb-4 max-w-sm" style={{ color: `${PARCHMENT}90` }}>
            {featured.subtitle || ''}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { playMenuSelect(); onPlay(featured); }}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
              style={{
                fontFamily: CINZEL,
                background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 3px 0 #a67c2e, 0 0 20px ${GOLD}20`,
              }}
            >
              <Play className="w-4 h-4" /> {t('video.watchNow') || 'Watch Now'}
            </button>
            <span className="text-[10px] md:text-xs flex items-center gap-1" style={{ color: `${PARCHMENT}70` }}>
              <Clock className="w-3 h-3" /> {featured.duration}
            </span>
          </div>
        </div>

        {/* Carousel dots */}
        {videos.length > 1 && (
          <div className="absolute bottom-3 right-4 md:right-8 flex items-center gap-1.5">
            {videos.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: i === activeIdx ? GOLD_LIGHT : `${GOLD}40`,
                  transform: i === activeIdx ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ===== SERIES CARD (poster art, click → episode picker) =====
const SeriesCard: React.FC<{
  series: Series;
  onSelect: (series: Series) => void;
}> = ({ series, onSelect }) => {
  return (
    <button
      onClick={() => { playMenuSelect(); onSelect(series); }}
      className="flex-shrink-0 group/card relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:z-10 focus:outline-none"
      style={{
        width: 'clamp(150px, 35vw, 200px)',
        border: `1.5px solid ${GOLD}25`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <ImageWithFallback src={series.thumbnail} alt={series.title} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md" style={{ background: `${GOLD}dd`, border: `2px solid ${GOLD_LIGHT}` }}>
            <Tv className="w-6 h-6" style={{ color: '#2a1f0e' }} />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-xs font-bold leading-tight text-left" style={{ fontFamily: CINZEL, color: GOLD_LIGHT, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {series.title}
          </p>
          <p className="text-[9px] mt-0.5 text-left" style={{ color: `${PARCHMENT}90` }}>
            {series.episodes.length} episodes
          </p>
        </div>
      </div>
    </button>
  );
};

// ===== SERIES ROW (horizontal scroll of series posters) =====
const SeriesRow: React.FC<{
  seriesList: Series[];
  onSelectSeries: (series: Series) => void;
}> = ({ seriesList, onSelectSeries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 20);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', checkScroll);
    return () => { if (el) el.removeEventListener('scroll', checkScroll); };
  }, [seriesList.length]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75, behavior: 'smooth' });
  };

  if (seriesList.length === 0) return null;

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <Tv className="w-4 h-4 flex-shrink-0" style={{ color: '#9b59b6' }} />
        <h3 className="text-sm md:text-base font-bold tracking-wide" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
          Series
        </h3>
        <p className="text-[10px] md:text-xs" style={{ color: `${PARCHMENT}60` }}>
          {seriesList.length} series available
        </p>
      </div>

      <div className="relative group">
        {showLeft && (
          <button onClick={() => scroll('left')} className="absolute left-0 top-0 bottom-0 z-20 w-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to right, rgba(12,8,20,0.95), transparent)' }}>
            <ChevronLeft className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
          </button>
        )}
        {showRight && (
          <button onClick={() => scroll('right')} className="absolute right-0 top-0 bottom-0 z-20 w-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to left, rgba(12,8,20,0.95), transparent)' }}>
            <ChevronRight className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
          </button>
        )}

        <div ref={scrollRef} className="flex gap-3 md:gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {seriesList.map(s => (
            <SeriesCard key={s.id} series={s} onSelect={onSelectSeries} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ===== EPISODE PICKER SCREEN =====
const EpisodePicker: React.FC<{
  series: Series;
  isPaid: boolean;
  onPlay: (video: Video) => void;
  onBack: () => void;
}> = ({ series, isPaid, onPlay, onBack }) => {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Back button */}
      <button onClick={() => { playMenuSelect(); onBack(); }} className="flex items-center gap-2 text-sm font-bold transition-all hover:brightness-125" style={{ color: GOLD_LIGHT, fontFamily: CINZEL }}>
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </button>

      {/* Series banner */}
      <div className="relative rounded-2xl overflow-hidden" style={{ border: `2px solid ${GOLD}30` }}>
        <div className="relative aspect-[21/9] md:aspect-[3/1]">
          <ImageWithFallback src={series.thumbnail} alt={series.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,8,4,0.95) 0%, rgba(12,8,4,0.3) 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <h2 className="text-lg md:text-2xl font-bold" style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}>{series.title}</h2>
            <p className="text-xs md:text-sm mt-1" style={{ color: `${PARCHMENT}90` }}>{series.description}</p>
            <p className="text-[10px] mt-2" style={{ color: `${GOLD}90` }}>{series.episodes.length} episodes</p>
          </div>
        </div>
      </div>

      {/* Episode grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {series.episodes
          .sort((a, b) => (a.episode || 0) - (b.episode || 0))
          .map((ep) => {
            const locked = ep.isPremium && !isPaid;
            return (
              <button
                key={ep.id}
                onClick={() => { playMenuSelect(); onPlay(ep); }}
                className="relative rounded-xl overflow-hidden group transition-all hover:scale-[1.03] active:scale-[0.98] focus:outline-none text-left"
                style={{ border: `1.5px solid ${GOLD}20`, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
              >
                <div className="relative aspect-video overflow-hidden">
                  <ImageWithFallback src={ep.thumbnail} alt={ep.title} className={`w-full h-full object-cover transition-transform group-hover:scale-110 ${locked ? 'brightness-50' : ''}`} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: locked ? 'rgba(0,0,0,0.6)' : `${GOLD}dd` }}>
                      {locked ? <Lock className="w-4 h-4 text-white/70" /> : <Play className="w-4 h-4 ml-0.5" style={{ color: '#2a1f0e' }} />}
                    </div>
                  </div>
                  {ep.episode && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${GOLD}cc`, color: '#fff' }}>
                      {ep.episode}
                    </div>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>
                    {ep.duration}
                  </div>
                </div>
                <div className="px-2.5 py-2" style={{ background: 'rgba(20,14,8,0.95)' }}>
                  <p className="text-[10px] md:text-xs font-bold truncate" style={{ fontFamily: CINZEL, color: locked ? `${PARCHMENT}60` : `${PARCHMENT}d0` }}>
                    {ep.episode ? `Ep ${ep.episode}: ` : ''}{ep.title}
                  </p>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
};

// ===== FULLSCREEN VIDEO PLAYER =====
const VideoPlayerModal: React.FC<{
  video: Video | null;
  onClose: () => void;
  isPaid: boolean;
  onUpgrade: () => void;
  allVideos: Video[];
  onPlayNext: (video: Video) => void;
}> = ({ video, onClose, isPaid, onUpgrade, allVideos, onPlayNext }) => {
  const { t } = useLanguage();
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // FIX 2: Swipe-to-close state
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwipingRef = useRef(false);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    if (!video) return;
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [video, resetHideTimer]);

  // Native browser fullscreen — eliminates address bar like the YouTube app
  useEffect(() => {
    if (!video) return;
    const el = modalRef.current as any;
    const reqFs = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.mozRequestFullScreen || el?.msRequestFullscreen;
    if (reqFs) reqFs.call(el).catch(() => {});
    return () => {
      const doc = document as any;
      const exitFs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (exitFs && (doc.fullscreenElement || doc.webkitFullscreenElement)) exitFs.call(doc).catch(() => {});
    };
  }, [!!video]);

  const handleClose = useCallback(() => {
    const doc = document as any;
    const exitFs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
    if (exitFs && (doc.fullscreenElement || doc.webkitFullscreenElement)) exitFs.call(doc).catch(() => {});
    playMenuSelect();
    onClose();
  }, [onClose]);

  // FIX 4: Android back button / browser back — push dummy history state
  useEffect(() => {
    if (!video) return;
    const state = { videoPlayerOpen: true };
    window.history.pushState(state, '');
    const onPopState = () => {
      handleClose();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [!!video, handleClose]);

  useEffect(() => {
    if (!video) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [video, handleClose]);

  // Reset loading state whenever the video changes
  useEffect(() => {
    setIsPlayerReady(false);
  }, [video?.id]);

  // FIX 2: Swipe-down-to-close handlers (on the outer modal, not the iframe)
  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  }, []);

  const handleSwipeTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only allow downward swipe
    if (dy > 10) {
      isSwipingRef.current = true;
      setSwipeOffset(Math.min(dy, 200));
    }
  }, []);

  const handleSwipeTouchEnd = useCallback(() => {
    if (swipeOffset > 80) {
      // Threshold reached → close
      handleClose();
    }
    setSwipeOffset(0);
    touchStartY.current = null;
    isSwipingRef.current = false;
  }, [swipeOffset, handleClose]);

  if (!video) return null;
  const locked = video.isPremium && !isPaid;
  const hasDyntube = !!video.dyntubeKey;

  // Swipe visual feedback: translate + opacity
  const swipeTransform = swipeOffset > 0 ? {
    transform: `translateY(${swipeOffset}px) scale(${1 - swipeOffset * 0.001})`,
    opacity: 1 - swipeOffset / 300,
    transition: 'none' as const,
  } : {
    transform: 'translateY(0) scale(1)',
    opacity: 1,
    transition: 'all 0.3s ease' as const,
  };

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[9999]"
      style={{ background: '#000', width: '100vw', height: '100dvh' }}
      onMouseMove={resetHideTimer}
      onTouchStart={handleSwipeTouchStart}
      onTouchMove={handleSwipeTouchMove}
      onTouchEnd={handleSwipeTouchEnd}
    >
      <div style={{ width: '100%', height: '100%', position: 'relative', ...swipeTransform }}>

        {/* FIX 3: Close button — always has a ghost hint, expands when controls visible.
            NEVER sets pointerEvents to 'none' — always tappable even when faded. */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-50 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          style={{
            width: showControls ? 48 : 36,
            height: showControls ? 48 : 36,
            borderRadius: '50%',
            background: showControls ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
            border: showControls ? '1.5px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            opacity: showControls ? 1 : 0.45,
            pointerEvents: 'auto',
          }}
          aria-label="Close video"
        >
          <X className="text-white/90" style={{ width: showControls ? 22 : 16, height: showControls ? 22 : 16, transition: 'all 0.3s ease' }} />
        </button>

        {/* FIX 2: Swipe-down hint — grab bar + chevron + text label in landscape */}
        <div
          className="absolute top-0 left-0 right-0 z-40 flex flex-col items-center pt-1.5 transition-opacity duration-500"
          style={{ opacity: showControls ? 0.7 : 0.25, pointerEvents: 'none' }}
        >
          <div className="w-10 h-1 rounded-full bg-white/40 mb-0.5" />
          <ChevronDown className="w-4 h-4 text-white/30" />
          {showControls && (
            <span
              className="hidden landscape:block text-[10px] mt-0.5 tracking-wide"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Swipe down to close
            </span>
          )}
        </div>

        {/* FIX 1: Tap-to-reveal overlay — sits ABOVE iframe (z-30), BELOW close button (z-50).
            When controls are hidden, this intercepts taps so the iframe doesn't swallow them.
            When controls are visible, it disappears so user can interact with the video player controls. */}
        {!showControls && !locked && hasDyntube && (
          <div
            className="absolute inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              resetHideTimer();
            }}
            style={{ background: 'transparent', cursor: 'pointer' }}
          />
        )}

        {locked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center px-8" style={{ background: 'linear-gradient(135deg, #1a120a 0%, #0d0a06 100%)' }}>
            <ImageWithFallback src={video.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-md" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `${GOLD}12`, border: `2px solid ${GOLD}35` }}>
                <Lock className="w-8 h-8" style={{ color: GOLD }} />
              </div>
              <h3 className="text-xl md:text-2xl font-bold" style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}>
                {t('video.premiumContent') || 'Premium Content'}
              </h3>
              <p className="text-sm md:text-base max-w-md" style={{ color: `${PARCHMENT}90` }}>
                Upgrade to unlock <span style={{ color: GOLD_LIGHT }}>{video.title}</span> and all premium content.
              </p>
              <button
                onClick={() => { playMenuSelect(); onUpgrade(); onClose(); }}
                className="mt-2 px-8 py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
                style={{ fontFamily: CINZEL, background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`, color: '#2a1f0e', border: `2px solid ${GOLD_LIGHT}` }}
              >
                <Crown className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Upgrade Now
              </button>
            </div>
          </div>
        ) : hasDyntube ? (
          /* ── DynTube iframe embed ─────────────────────────────────────────
             Self-contained & sandboxed: no SDK, no Shadow DOM, no theater
             overlay escaping to <body>, Chromecast/AirPlay work natively.
             Portrait: fills full width, centered vertically.
             Landscape: fills full height, centered horizontally.
          ── */
          <div className="absolute inset-0" style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Spinner until iframe fires onLoad */}
            {!isPlayerReady && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none" style={{ background: '#000' }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: GOLD }} />
                <p className="text-sm mt-3" style={{ color: `${PARCHMENT}80` }}>Loading video...</p>
              </div>
            )}

            {/* 16:9 box — largest that fits the viewport */}
            <div style={{ width: 'min(100vw, calc(100dvh * 16 / 9))', aspectRatio: '16 / 9', position: 'relative', flexShrink: 0 }}>
              <iframe
                key={video.dyntubeKey}
                src={`https://videos.dyntube.com/iframes/${video.dyntubeKey}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                onLoad={() => setIsPlayerReady(true)}
                title={video.title}
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <ImageWithFallback src={video.thumbnail} alt={video.title} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse" style={{ background: `${GOLD}20`, border: `3px solid ${GOLD}` }}>
                <Play className="w-10 h-10 ml-1" style={{ color: GOLD_LIGHT }} />
              </div>
              <p className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>{video.title}</p>
              <p className="text-sm" style={{ color: `${PARCHMENT}80` }}>Coming Soon</p>
            </div>
          </div>
        )}

        {!locked && (
          <div className="absolute bottom-0 left-0 right-0 z-40 px-5 py-4 flex items-center gap-3 transition-all duration-500" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)', opacity: showControls ? 1 : 0, pointerEvents: 'none' }}>
            <span className="text-sm font-bold truncate" style={{ fontFamily: CINZEL, color: 'rgba(255,255,255,0.9)' }}>{video.title}</span>
            {video.episode && <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>· Episode {video.episode}</span>}
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// ===== FILTER BOTTOM SHEET =====
const FilterSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  langOptions: { id: string; label: string }[];
  catOptions: { id: string; label: string; color: string }[];
  selectedLangs: Set<string>;
  selectedCats: Set<string>;
  onToggleLang: (id: string) => void;
  onToggleCat: (id: string) => void;
  onClear: () => void;
  onApply: () => void;
  hasFilters: boolean;
}> = ({ open, onClose, langOptions, catOptions, selectedLangs, selectedCats, onToggleLang, onToggleCat, onClear, onApply, hasFilters }) => {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl px-5 pt-4 pb-8 space-y-5"
        style={{
          background: 'linear-gradient(160deg, #1a1108 0%, #0d0a06 100%)',
          border: `1.5px solid ${GOLD}30`,
          borderBottom: 'none',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full mx-auto" style={{ background: `${GOLD}40` }} />

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" style={{ color: GOLD }} />
            <span className="text-sm font-bold tracking-wider uppercase" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
              Filters
            </span>
            {hasFilters && (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                style={{ background: `${GOLD}25`, color: GOLD_LIGHT, border: `1px solid ${GOLD}40` }}
              >
                {selectedLangs.size + selectedCats.size} active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${GOLD}20` }}
          >
            <X className="w-4 h-4" style={{ color: `${PARCHMENT}80` }} />
          </button>
        </div>

        {/* Language section */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" style={{ color: `${PARCHMENT}60` }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${PARCHMENT}60` }}>Language</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {langOptions.map(opt => {
              const active = selectedLangs.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => onToggleLang(opt.id)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: active ? `${GOLD}30` : 'rgba(255,255,255,0.04)',
                    color: active ? GOLD_LIGHT : `${PARCHMENT}60`,
                    border: `1.5px solid ${active ? `${GOLD}70` : `${PARCHMENT}18`}`,
                    boxShadow: active ? `0 0 12px ${GOLD}25` : 'none',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category section */}
        {catOptions.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: `${PARCHMENT}60` }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${PARCHMENT}60` }}>Category</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {catOptions.map(opt => {
                const active = selectedCats.has(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => onToggleCat(opt.id)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all"
                    style={{
                      background: active ? `${opt.color}25` : 'rgba(255,255,255,0.04)',
                      color: active ? opt.color : `${PARCHMENT}60`,
                      border: `1.5px solid ${active ? `${opt.color}70` : `${PARCHMENT}18`}`,
                      boxShadow: active ? `0 0 12px ${opt.color}20` : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: `${GOLD}15` }} />

        {/* Action buttons */}
        <div className="flex gap-3">
          {hasFilters && (
            <button
              onClick={onClear}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:brightness-125"
              style={{
                fontFamily: CINZEL,
                background: 'rgba(255,255,255,0.05)',
                color: `${PARCHMENT}80`,
                border: `1.5px solid ${PARCHMENT}20`,
              }}
            >
              Clear All
            </button>
          )}
          <button
            onClick={onApply}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
            style={{
              fontFamily: CINZEL,
              background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
              color: '#2a1f0e',
              border: `2px solid ${GOLD_LIGHT}`,
              boxShadow: `0 3px 0 #a67c2e`,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== LOADING SKELETONS =====
const LoadingSkeletons = () => (
  <div className="space-y-8">
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ border: `2px solid ${GOLD}15` }}>
      <div className="aspect-[21/9] md:aspect-[3/1]" style={{ background: `${GOLD}08` }} />
    </div>
    {[0, 1, 2].map(row => (
      <div key={row} className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: `${GOLD}20` }} />
          <div className="h-4 rounded animate-pulse" style={{ width: 140, background: `${GOLD}15` }} />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map(card => (
            <div key={card} className="flex-shrink-0 rounded-xl overflow-hidden animate-pulse" style={{ width: 'clamp(200px, 42vw, 260px)', border: `1.5px solid ${GOLD}10` }}>
              <div className="aspect-video" style={{ background: `${GOLD}08` }} />
              <div className="px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(20,14,8,0.5)' }}>
                <div className="h-3 rounded" style={{ width: '75%', background: `${GOLD}12` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ===== MAIN VIDEO LIBRARY COMPONENT =====
interface VideoLibraryProps {
  parentData?: any;
  onShowUpgrade?: () => void;
  onVideoWatched?: () => void;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({ parentData, onShowUpgrade, onVideoWatched }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [watchHistory, setWatchHistory] = useState<string[]>([]);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [videoCategories, setVideoCategories] = useState<{ id: string; label: string }[]>([]);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Multi-select filters: OR within group, AND across groups
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const LANG_OPTIONS = [
    { id: 'en', label: 'EN' },
    { id: 'ms', label: 'BM' },
    { id: 'zh', label: '中文' },
  ];

  const FALLBACK_COLORS: Record<string, string> = {
    english: '#7cc643', numbers: '#4a90e2', bahasa: '#e74c3c',
    mandarin: '#f39c12', science: '#9b59b6', music: '#e67e22',
    sleep: '#5b6abf', movie: '#c0392b',
  };
  const FALLBACK_LABELS: Record<string, string> = {
    english: 'English', numbers: 'Numbers', bahasa: 'Bahasa Malaysia',
    mandarin: 'Mandarin', science: 'Science', music: 'Music',
    sleep: 'Sleep', movie: 'Films',
  };

  const toggleLang = (id: string) => {
    playMenuSelect();
    setSelectedLangs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleCat = (id: string) => {
    playMenuSelect();
    setSelectedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const clearFilters = () => { playMenuSelect(); setSelectedLangs(new Set()); setSelectedCats(new Set()); };
  const hasFilters = selectedLangs.size > 0 || selectedCats.size > 0;

  // AND across groups, OR within group
  const applyFilters = (videos: Video[]) =>
    videos.filter(v => {
      const langOk = selectedLangs.size === 0 || selectedLangs.has(v.language || '');
      const catOk  = selectedCats.size  === 0 || selectedCats.has(v.category  || '');
      return langOk && catOk;
    });

  const isPaid = parentData?.subscription_status === 'active';

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [videosResult, history] = await Promise.all([
        fetchVideos(),
        fetchWatchHistory(),
      ]);

      const backendVideos = (videosResult.videos || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        subtitle: v.subtitle || '',
        thumbnail: v.thumbnail_url || '',
        duration: v.duration || '0:00',
        episode: v.episode || null,
        isPremium: v.is_premium || false,
        dyntubeKey: v.dyntube_key || '',
        isNew: v.created_at ? (Date.now() - new Date(v.created_at).getTime()) < 30 * 86400000 : false,
        isFeatured: v.is_featured || false,
        seriesId: v.series_id || null,
        category: v.category || '',
        language: v.language || '',
        createdAt: v.created_at || '',
      }));

      const backendSeries = (videosResult.series || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description || '',
        thumbnail: s.thumbnail || '',
        category: s.category || '',
        episodes: backendVideos.filter((v: Video) => v.seriesId === s.id)
          .sort((a: Video, b: Video) => (a.episode || 0) - (b.episode || 0)),
      }));

      // Load dynamic categories
      const cats = (videosResult.categories || []).map((c: any) => ({ id: c.id, label: c.label }));
      setVideoCategories(cats);

      // Use backend data if available, otherwise demo
      setAllVideos(backendVideos.length > 0 ? backendVideos : DEMO_VIDEOS);
      setAllSeries(backendSeries.length > 0 ? backendSeries : DEMO_SERIES);
      setWatchHistory(history.map((h: any) => h.videoId));
    } catch (err) {
      console.error('[VideoLibrary] Load error:', err);
      setAllVideos(DEMO_VIDEOS);
      setAllSeries(DEMO_SERIES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute sections
  const watchedSet = useMemo(() => new Set(watchHistory), [watchHistory]);
  const featuredVideos = allVideos.filter(v => v.isFeatured);
  const newReleases = allVideos
    .filter(v => v.isNew && !v.seriesId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const watchAgain = watchHistory
    .map(id => allVideos.find(v => v.id === id))
    .filter(Boolean) as Video[];
  const films = allVideos.filter(v => !v.seriesId && v.category === 'movie');
  const standaloneByCategory = allVideos.filter(v => !v.seriesId && v.category !== 'movie');

  // Group standalone (non-series, non-movie) by category for extra rows
  const categoryGroups = standaloneByCategory.reduce<Record<string, Video[]>>((acc, v) => {
    const cat = v.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  // All unique categories from actual video data (union with backend labels)
  const allCatOptions = [...new Set(allVideos.map(v => v.category).filter(Boolean))].map(id => {
    const dynCat = videoCategories.find(c => c.id === id);
    return {
      id,
      label: dynCat?.label || FALLBACK_LABELS[id] || id,
      color: FALLBACK_COLORS[id] || GOLD,
    };
  });

  const videoWatchedRef = useRef(false);
  const handlePlay = (video: Video) => {
    if (video.isPremium && !isPaid) {
      onShowUpgrade?.();
      return;
    }
    setPlayingVideo(video);
    // Immediately add to watch history so NEW badge disappears
    if (!watchHistory.includes(video.id)) {
      setWatchHistory(prev => [video.id, ...prev]);
    }
    // Fire onVideoWatched once per session
    if (!videoWatchedRef.current && onVideoWatched) {
      videoWatchedRef.current = true;
      onVideoWatched();
    }
  };

  // If a series is selected, show episode picker
  if (selectedSeries) {
    return (
      <div className="space-y-4 md:space-y-6">
        <EpisodePicker
          series={selectedSeries}
          isPaid={isPaid}
          onPlay={handlePlay}
          onBack={() => setSelectedSeries(null)}
        />
        <VideoPlayerModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
          isPaid={isPaid}
          onUpgrade={onShowUpgrade}
          allVideos={allVideos}
          onPlayNext={(v) => setPlayingVideo(v)}
        />
        <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {isLoading ? <LoadingSkeletons /> : (
        <>
          {/* Featured Hero Carousel — always at very top, unfiltered */}
          {featuredVideos.length > 0 && (
            <FeaturedCarousel videos={featuredVideos} onPlay={handlePlay} watchedIds={watchedSet} />
          )}

          {/* New Releases — no badge */}
          {applyFilters(newReleases).length > 0 && (
            <ScrollRow
              title="New Releases"
              subtitle="Fresh content just added"
              color="#2ecc71"
              items={applyFilters(newReleases)}
              isPaid={isPaid}
              onPlay={handlePlay}
              watchedIds={watchedSet}
            />
          )}

          {/* Watch Again */}
          {applyFilters(watchAgain).length > 0 && (
            <ScrollRow
              title="Watch Again"
              subtitle="Continue where you left off"
              color="#3498db"
              items={applyFilters(watchAgain)}
              isPaid={isPaid}
              onPlay={handlePlay}
              watchedIds={watchedSet}
            />
          )}

          {/* Series — respect category filter */}
          {(() => {
            const filteredSeries = selectedCats.size === 0
              ? allSeries
              : allSeries.filter(s => selectedCats.has(s.category));
            return filteredSeries.length > 0 ? (
              <SeriesRow seriesList={filteredSeries} onSelectSeries={setSelectedSeries} />
            ) : null;
          })()}

          {/* Films */}
          {applyFilters(films).length > 0 && (
            <ScrollRow
              title="Films"
              subtitle="Full-length animated adventures"
              color="#c0392b"
              badge={`${applyFilters(films).length} films`}
              items={applyFilters(films)}
              isPaid={isPaid}
              onPlay={handlePlay}
              watchedIds={watchedSet}
            />
          )}

          {/* Category rows */}
          {Object.entries(categoryGroups).map(([cat, videos]) => {
            const catOption = allCatOptions.find(c => c.id === cat);
            const catName  = catOption?.label || FALLBACK_LABELS[cat] || cat;
            const catColor = catOption?.color || FALLBACK_COLORS[cat] || GOLD;
            const filtered = applyFilters(videos);
            if (filtered.length === 0) return null;
            return (
              <ScrollRow
                key={cat}
                title={catName}
                color={catColor}
                items={filtered}
                isPaid={isPaid}
                onPlay={handlePlay}
                watchedIds={watchedSet}
              />
            );
          })}

          {/* Bottom upsell */}
          {!isPaid && (
            <div className="relative overflow-hidden rounded-2xl px-5 py-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(30,22,12,0.92) 0%, rgba(20,16,10,0.95) 100%)', border: `2px solid ${GOLD}30` }}>
              <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at center, ${GOLD}40 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <Crown className="w-8 h-8 mx-auto mb-2" style={{ color: GOLD }} />
                <h3 className="text-base font-bold mb-1" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>Unlock All Adventures</h3>
                <p className="text-xs mb-4 max-w-sm mx-auto" style={{ color: `${PARCHMENT}90` }}>
                  Upgrade to Premium for unlimited access to all {allVideos.length} episodes, new content every week, and ad-free viewing.
                </p>
                <button
                  onClick={() => { playMenuSelect(); onShowUpgrade(); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
                  style={{ fontFamily: CINZEL, background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`, color: '#2a1f0e', border: `2px solid ${GOLD_LIGHT}`, boxShadow: `0 3px 0 #a67c2e, 0 0 20px ${GOLD}20` }}
                >
                  <Crown className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Go Premium
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Filter FAB — fixed top-right corner via portal */}
      {!isLoading && createPortal(
        <button
          onClick={() => { playMenuSelect(); setShowFilterSheet(true); }}
          className="fixed z-[9980] flex items-center gap-1.5 px-3 py-2 rounded-full transition-all hover:brightness-110 active:scale-95"
          style={{
            top: '1rem',
            right: '1rem',
            background: hasFilters
              ? `linear-gradient(135deg, ${GOLD} 0%, #f0d078 100%)`
              : 'rgba(14,10,5,0.88)',
            border: `1.5px solid ${hasFilters ? GOLD_LIGHT : `${GOLD}45`}`,
            boxShadow: hasFilters
              ? `0 2px 18px ${GOLD}55, 0 3px 0 #a67c2e`
              : `0 2px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
            backdropFilter: 'blur(12px)',
            color: hasFilters ? '#2a1f0e' : GOLD_LIGHT,
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: CINZEL }}>
            {hasFilters ? `Filters (${selectedLangs.size + selectedCats.size})` : 'Filter'}
          </span>
        </button>,
        document.body
      )}

      {/* Filter Bottom Sheet */}
      <FilterSheet
        open={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        langOptions={LANG_OPTIONS}
        catOptions={allCatOptions}
        selectedLangs={selectedLangs}
        selectedCats={selectedCats}
        onToggleLang={toggleLang}
        onToggleCat={toggleCat}
        onClear={clearFilters}
        onApply={() => { playMenuSelect(); setShowFilterSheet(false); }}
        hasFilters={hasFilters}
      />

      {/* Player Modal */}
      <VideoPlayerModal
        video={playingVideo}
        onClose={() => setPlayingVideo(null)}
        isPaid={isPaid}
        onUpgrade={onShowUpgrade}
        allVideos={allVideos}
        onPlayNext={(v) => setPlayingVideo(v)}
      />

      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};