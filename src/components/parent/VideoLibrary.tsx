import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, ChevronLeft, ChevronRight, X, Lock, Crown, Clock, Sparkles, Star } from 'lucide-react';
import { FantasyTitle, GoldOrnament } from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { fetchVideos } from '../../utils/parent-api';

// ===== THEME CONSTANTS =====
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CINZEL = "'Cinzel Decorative', serif";

// ===== DATA TYPES =====
interface Video {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  duration: string;
  episode?: number | null;
  isPremium: boolean;
  youtubeUrl?: string;
  isNew?: boolean;
  isFeatured?: boolean;
}

interface VideoCategory {
  id: string;
  name: string;
  color: string;
  description: string;
  videos: Video[];
}

// ===== CATEGORY CONFIG (RPG names matching quest setup) =====
const CATEGORY_CONFIG: Record<string, { name: string; color: string; description: string }> = {
  english:  { name: 'English Knight',    color: '#7cc643', description: 'Language & literacy adventures with Foxy the Knight' },
  numbers:  { name: 'Numbers Sorcerer',  color: '#4a90e2', description: 'Counting, shapes & number magic with the Sorcerer' },
  bahasa:   { name: 'Malay Fighter',     color: '#e74c3c', description: 'Bahasa Malaysia melalui cerita dan lagu pejuang' },
  mandarin: { name: 'Chinese General',   color: '#f39c12', description: '\u8DDF\u72D0\u72F8\u5C06\u519B\u4E00\u8D77\u5B66\u4E60\u4E2D\u6587' },
  science:  { name: 'Science Ranger',    color: '#9b59b6', description: 'Nature, discovery & STEM exploration with the Ranger' },
  music:    { name: 'Music Bard',        color: '#f39c12', description: 'Sing, dance & learn with the enchanted Bard' },
  sleep:    { name: 'Dream Guardian',    color: '#5b6abf', description: 'Calming bedtime tales & lullabies to drift off peacefully' },
  movie:    { name: 'Epic Cinema',       color: '#c0392b', description: 'Full-length animated adventures & feature films for young heroes' },
};

// Category display order
const CATEGORY_ORDER = ['english', 'numbers', 'bahasa', 'mandarin', 'science', 'music', 'sleep', 'movie'];

// ===== DEMO VIDEO DATA (shown when backend has no videos) =====
const DEMO_VIDEOS: Record<string, Video[]> = {
  english: [
    { id: 'en1', title: 'The Magic Alphabet', thumbnail: 'https://images.unsplash.com/photo-1769072385024-c962e061c523?w=480&h=270&fit=crop', duration: '4:32', episode: 1, isPremium: false, isNew: true },
    { id: 'en2', title: "Foxy's Phonics Quest", thumbnail: 'https://images.unsplash.com/photo-1655664333751-e01783bb8bf3?w=480&h=270&fit=crop', duration: '5:15', episode: 2, isPremium: false },
    { id: 'en3', title: 'Vowel Valley Adventure', thumbnail: 'https://images.unsplash.com/photo-1769072385024-c962e061c523?w=480&h=270&fit=crop&q=60', duration: '4:48', episode: 3, isPremium: false },
    { id: 'en4', title: 'Consonant Castle', thumbnail: 'https://images.unsplash.com/photo-1655664333751-e01783bb8bf3?w=480&h=270&fit=crop&q=60', duration: '6:02', episode: 4, isPremium: true },
    { id: 'en5', title: 'Sight Words Spell', thumbnail: 'https://images.unsplash.com/photo-1769072385024-c962e061c523?w=480&h=270&fit=crop&q=50', duration: '5:30', episode: 5, isPremium: true },
  ],
  numbers: [
    { id: 'nu1', title: 'Counting Coconuts', thumbnail: 'https://images.unsplash.com/photo-1740062446976-94a8837e0dde?w=480&h=270&fit=crop', duration: '3:45', episode: 1, isPremium: false, isNew: true },
    { id: 'nu2', title: 'Treasure Map Shapes', thumbnail: 'https://images.unsplash.com/photo-1646237023864-8f1daf930976?w=480&h=270&fit=crop', duration: '4:20', episode: 2, isPremium: false },
    { id: 'nu3', title: 'Pattern Pirates', thumbnail: 'https://images.unsplash.com/photo-1740062446976-94a8837e0dde?w=480&h=270&fit=crop&q=60', duration: '5:00', episode: 3, isPremium: false },
    { id: 'nu4', title: 'Addition Adventure', thumbnail: 'https://images.unsplash.com/photo-1646237023864-8f1daf930976?w=480&h=270&fit=crop&q=60', duration: '5:35', episode: 4, isPremium: true },
  ],
  bahasa: [
    { id: 'bm1', title: 'Huruf Ajaib A-Z', thumbnail: 'https://images.unsplash.com/photo-1541802802036-1d572ba70147?w=480&h=270&fit=crop', duration: '4:10', episode: 1, isPremium: false },
    { id: 'bm2', title: 'Warna di Rimba', thumbnail: 'https://images.unsplash.com/photo-1541802802036-1d572ba70147?w=480&h=270&fit=crop&q=70', duration: '3:55', episode: 2, isPremium: false },
    { id: 'bm3', title: 'Haiwan & Bunyi', thumbnail: 'https://images.unsplash.com/photo-1541802802036-1d572ba70147?w=480&h=270&fit=crop&q=60', duration: '5:20', episode: 3, isPremium: false },
    { id: 'bm4', title: 'Suku Kata Sihir', thumbnail: 'https://images.unsplash.com/photo-1541802802036-1d572ba70147?w=480&h=270&fit=crop&q=50', duration: '4:40', episode: 4, isPremium: true },
  ],
  mandarin: [
    { id: 'zh1', title: '\u8BA4\u8BC6\u6C49\u5B57\u7B2C\u4E00\u8BFE', thumbnail: 'https://images.unsplash.com/photo-1583389409210-0234eee7cdce?w=480&h=270&fit=crop', duration: '4:00', episode: 1, isPremium: false },
    { id: 'zh2', title: '\u6570\u5B57\u5C71\u8C37\u5192\u9669', thumbnail: 'https://images.unsplash.com/photo-1764954467652-973970e442a0?w=480&h=270&fit=crop', duration: '3:50', episode: 2, isPremium: false },
    { id: 'zh3', title: '\u989C\u8272\u548C\u5F62\u72B6', thumbnail: 'https://images.unsplash.com/photo-1583389409210-0234eee7cdce?w=480&h=270&fit=crop&q=60', duration: '5:10', episode: 3, isPremium: true },
  ],
  science: [
    { id: 'sc1', title: 'Rainforest Secrets', thumbnail: 'https://images.unsplash.com/photo-1768724812437-38697ca55095?w=480&h=270&fit=crop', duration: '5:45', episode: 1, isPremium: false, isNew: true },
    { id: 'sc2', title: "Foxy's Bug Lab", thumbnail: 'https://images.unsplash.com/photo-1571763613035-cb45f652a118?w=480&h=270&fit=crop', duration: '4:30', episode: 2, isPremium: false },
    { id: 'sc3', title: 'Water Cycle Quest', thumbnail: 'https://images.unsplash.com/photo-1768724812437-38697ca55095?w=480&h=270&fit=crop&q=60', duration: '6:00', episode: 3, isPremium: true },
  ],
  music: [
    { id: 'mu1', title: 'ABC Sing-Along', thumbnail: 'https://images.unsplash.com/photo-1758874961449-37e171a41223?w=480&h=270&fit=crop', duration: '3:00', isPremium: false, isNew: true },
    { id: 'mu2', title: 'Counting Dance Party', thumbnail: 'https://images.unsplash.com/photo-1758874961449-37e171a41223?w=480&h=270&fit=crop&q=70', duration: '3:25', isPremium: false },
    { id: 'mu3', title: "Foxy's Morning Song", thumbnail: 'https://images.unsplash.com/photo-1758874961449-37e171a41223?w=480&h=270&fit=crop&q=60', duration: '2:50', isPremium: false },
    { id: 'mu4', title: 'Bahasa Rhythm', thumbnail: 'https://images.unsplash.com/photo-1758874961449-37e171a41223?w=480&h=270&fit=crop&q=50', duration: '3:15', isPremium: true },
  ],
  sleep: [
    { id: 'sl1', title: "Foxy's Starlight Lullaby", thumbnail: 'https://images.unsplash.com/photo-1611848093771-1b12fe43b0bc?w=480&h=270&fit=crop', duration: '12:00', isPremium: false },
    { id: 'sl2', title: 'The Sleepy Forest', thumbnail: 'https://images.unsplash.com/photo-1662368355359-830b331349ef?w=480&h=270&fit=crop', duration: '15:00', isPremium: false },
    { id: 'sl3', title: 'Moonlit River Journey', thumbnail: 'https://images.unsplash.com/photo-1611848093771-1b12fe43b0bc?w=480&h=270&fit=crop&q=60', duration: '20:00', isPremium: true },
    { id: 'sl4', title: 'Whispered Wishes', thumbnail: 'https://images.unsplash.com/photo-1662368355359-830b331349ef?w=480&h=270&fit=crop&q=60', duration: '18:00', isPremium: true },
  ],
  movie: [
    { id: 'mv1', title: "Foxy's Great Adventure", subtitle: 'A journey across enchanted lands', thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&h=270&fit=crop', duration: '1:05:00', isPremium: false, isNew: true },
    { id: 'mv2', title: 'The Secret of Crystal Cave', subtitle: 'Discover the hidden crystals of power', thumbnail: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=480&h=270&fit=crop', duration: '52:30', isPremium: true },
    { id: 'mv3', title: 'Knights of the Rainbow', subtitle: 'A colorful quest to save the kingdom', thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&h=270&fit=crop&q=60', duration: '1:12:00', isPremium: true },
  ],
};

// Helper: extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Helper: auto-generate YouTube thumbnail from URL
function getYouTubeThumbnail(url: string): string {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

// ===== SCROLL ROW COMPONENT =====
const ScrollRow: React.FC<{
  category: VideoCategory;
  isPaid: boolean;
  onPlay: (video: Video, category: VideoCategory) => void;
}> = ({ category, isPaid, onPlay }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 20);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', checkScroll);
    return () => { if (el) el.removeEventListener('scroll', checkScroll); };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="mb-6 md:mb-8">
      {/* Category Header — no emoji icons */}
      <div className="flex items-center gap-2.5 mb-3 px-1">
        {/* Color accent dot */}
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: category.color, boxShadow: `0 0 8px ${category.color}50` }} />
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm md:text-base font-bold tracking-wide"
            style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}
          >
            {category.name}
          </h3>
          <p className="text-[10px] md:text-xs mt-0.5" style={{ color: `${PARCHMENT}80` }}>
            {category.description}
          </p>
        </div>
        <div
          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ color: category.color, border: `1px solid ${category.color}40`, background: `${category.color}10` }}
        >
          {category.videos.length} episodes
        </div>
      </div>

      {/* Scrollable Row */}
      <div className="relative group">
        {showLeftArrow && (
          <button
            onClick={() => { playMenuSelect(); scroll('left'); }}
            className="absolute left-0 top-0 bottom-0 z-20 w-10 md:w-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(to right, rgba(12,8,20,0.95), transparent)' }}
          >
            <ChevronLeft className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
          </button>
        )}

        {showRightArrow && (
          <button
            onClick={() => { playMenuSelect(); scroll('right'); }}
            className="absolute right-0 top-0 bottom-0 z-20 w-10 md:w-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(to left, rgba(12,8,20,0.95), transparent)' }}
          >
            <ChevronRight className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {category.videos.map((video) => {
            const locked = video.isPremium && !isPaid;
            return (
              <button
                key={video.id}
                onClick={() => { playMenuSelect(); onPlay(video, category); }}
                className="flex-shrink-0 group/card relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:z-10 focus:outline-none"
                style={{
                  width: 'clamp(200px, 42vw, 260px)',
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                <div className="relative aspect-video overflow-hidden">
                  <ImageWithFallback
                    src={video.thumbnail}
                    alt={video.title}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110 ${locked ? 'brightness-50' : ''}`}
                  />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md"
                      style={{
                        background: locked ? 'rgba(0,0,0,0.6)' : `${GOLD}dd`,
                        border: `2px solid ${locked ? '#ffffff30' : GOLD_LIGHT}`,
                        boxShadow: locked ? 'none' : `0 0 20px ${GOLD}40`,
                      }}
                    >
                      {locked ? <Lock className="w-5 h-5 text-white/70" /> : <Play className="w-5 h-5 ml-0.5" style={{ color: '#2a1f0e' }} />}
                    </div>
                  </div>

                  <div
                    className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"
                    style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', backdropFilter: 'blur(4px)' }}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {video.duration}
                  </div>

                  {video.episode && (
                    <div
                      className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: `${category.color}cc`,
                        color: '#fff',
                        border: `1.5px solid ${category.color}`,
                        boxShadow: `0 0 8px ${category.color}40`,
                      }}
                    >
                      {video.episode}
                    </div>
                  )}

                  {video.isNew && !locked && (
                    <div
                      className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5"
                      style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      New
                    </div>
                  )}

                  {locked && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: GOLD_LIGHT }}>
                      <Crown className="w-2.5 h-2.5" />
                      Premium
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${category.color}, transparent)` }} />
                </div>

                <div
                  className="px-3 py-2.5"
                  style={{ background: 'linear-gradient(135deg, rgba(20,14,8,0.98), rgba(30,22,12,0.95))' }}
                >
                  <p
                    className="text-[11px] md:text-xs font-bold leading-tight truncate text-left"
                    style={{ color: locked ? `${PARCHMENT}60` : `${PARCHMENT}d0`, fontFamily: CINZEL }}
                  >
                    {video.title}
                  </p>
                  {video.subtitle && (
                    <p
                      className="text-[9px] md:text-[10px] leading-tight truncate text-left mt-0.5"
                      style={{ color: locked ? `${PARCHMENT}40` : `${PARCHMENT}70` }}
                    >
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

// ===== FULLSCREEN VIDEO PLAYER (rendered via portal for clean overlay) =====
const VideoPlayerModal: React.FC<{
  video: Video | null;
  category: VideoCategory | null;
  onClose: () => void;
  isPaid: boolean;
  onUpgrade: () => void;
}> = ({ video, category, onClose, isPaid, onUpgrade }) => {
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide close button after 3s of no mouse movement (only for playing video)
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!video) return;
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [video, resetHideTimer]);

  // Escape key to close
  useEffect(() => {
    if (!video) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { playMenuSelect(); onClose(); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [video, onClose]);

  if (!video) return null;
  const locked = video.isPremium && !isPaid;
  const ytId = video.youtubeUrl ? extractYouTubeId(video.youtubeUrl) : null;

  // YouTube params: minimal UI, no related vids, no annotations, privacy-enhanced
  const ytParams = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    controls: '1',
    playsinline: '1',
    fs: '1',
    cc_load_policy: '0',
    showinfo: '0',
    color: 'white',
  }).toString();

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: '#000' }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Close button — auto-hides */}
      <button
        onClick={() => { playMenuSelect(); onClose(); }}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: `1px solid rgba(255,255,255,0.15)`,
          backdropFilter: 'blur(8px)',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
        }}
      >
        <X className="w-5 h-5 text-white/80" />
      </button>

      {locked ? (
        /* ── Premium gate ── */
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center px-8"
          style={{ background: 'linear-gradient(135deg, #1a120a 0%, #0d0a06 100%)' }}
        >
          {/* Blurred thumbnail behind */}
          <ImageWithFallback
            src={video.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-15 blur-md"
          />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: `${GOLD}12`, border: `2px solid ${GOLD}35` }}
            >
              <Lock className="w-8 h-8" style={{ color: GOLD }} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
              Premium Content
            </h3>
            <p className="text-sm md:text-base max-w-md" style={{ color: `${PARCHMENT}90` }}>
              Upgrade to unlock <span style={{ color: GOLD_LIGHT }}>{video.title}</span> and all premium adventures.
            </p>
            <button
              onClick={() => { playMenuSelect(); onUpgrade(); onClose(); }}
              className="mt-2 px-8 py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
              style={{
                fontFamily: CINZEL,
                background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 3px 0 #a67c2e, 0 0 20px ${GOLD}30`,
              }}
            >
              <Crown className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Upgrade Now
            </button>
          </div>
        </div>
      ) : ytId ? (
        /* ── Fullscreen YouTube embed ── */
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}?${ytParams}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          style={{ border: 'none' }}
        />
      ) : (
        /* ── No YouTube URL — "coming soon" placeholder ── */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <ImageWithFallback
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
          />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse"
              style={{ background: `${GOLD}20`, border: `3px solid ${GOLD}`, boxShadow: `0 0 40px ${GOLD}25` }}
            >
              <Play className="w-10 h-10 ml-1" style={{ color: GOLD_LIGHT }} />
            </div>
            <p className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
              {video.title}
            </p>
            <p className="text-sm" style={{ color: `${PARCHMENT}80` }}>
              Coming soon — Foxy is still filming!
            </p>
          </div>
        </div>
      )}

      {/* Minimal bottom info bar — only visible on hover, fades with controls */}
      {!locked && (
        <div
          className="absolute bottom-0 left-0 right-0 z-40 px-5 py-3 flex items-center gap-3 transition-all duration-500"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
            opacity: showControls ? 1 : 0,
            pointerEvents: 'none',
          }}
        >
          {category && (
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: category.color }} />
          )}
          <span className="text-xs font-bold truncate" style={{ fontFamily: CINZEL, color: 'rgba(255,255,255,0.8)' }}>
            {video.title}
          </span>
          {video.subtitle && (
            <span className="text-[10px] truncate hidden md:inline" style={{ color: 'rgba(255,255,255,0.5)' }}>
              — {video.subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

// ===== HERO SECTION =====
const HeroBanner: React.FC<{
  categories: VideoCategory[];
  onPlay: (video: Video, category: VideoCategory) => void;
}> = ({ categories, onPlay }) => {
  // Priority: 1) is_featured from admin, 2) isNew demo flag, 3) first video overall
  const featured = categories.flatMap(c => c.videos.filter(v => v.isFeatured).map(v => ({ video: v, category: c })))[0]
    || categories.flatMap(c => c.videos.filter(v => v.isNew).map(v => ({ video: v, category: c })))[0]
    || (categories[0]?.videos[0] ? { video: categories[0].videos[0], category: categories[0] } : null);

  if (!featured) return null;

  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 md:mb-8" style={{ border: `2px solid ${GOLD}30` }}>
      <div className="relative aspect-[21/9] md:aspect-[3/1]">
        <ImageWithFallback
          src={featured.video.thumbnail}
          alt={featured.video.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(12,8,4,0.95) 0%, rgba(12,8,4,0.6) 40%, rgba(12,8,4,0.2) 70%, rgba(12,8,4,0.5) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,8,4,0.95) 0%, transparent 50%)' }} />

        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: featured.category.color }} />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest" style={{ color: featured.category.color }}>
              {featured.category.name}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={{ background: GOLD, color: '#2a1f0e' }}>
              Featured
            </span>
          </div>

          <h2
            className="text-lg md:text-3xl font-bold leading-tight mb-1 md:mb-2 max-w-md"
            style={{ fontFamily: CINZEL, color: GOLD_LIGHT, textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
          >
            {featured.video.title}
          </h2>

          <p className="text-xs md:text-sm mb-3 md:mb-4 max-w-sm" style={{ color: `${PARCHMENT}90` }}>
            {featured.video.subtitle || featured.category.description}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { playMenuSelect(); onPlay(featured.video, featured.category); }}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
              style={{
                fontFamily: CINZEL,
                background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 3px 0 #a67c2e, 0 0 20px ${GOLD}20`,
              }}
            >
              <Play className="w-4 h-4" />
              Watch Now
            </button>

            <span className="text-[10px] md:text-xs flex items-center gap-1" style={{ color: `${PARCHMENT}70` }}>
              <Clock className="w-3 h-3" /> {featured.video.duration}
              {featured.video.episode && <> &middot; Episode {featured.video.episode}</>}
            </span>
          </div>
        </div>

        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ boxShadow: `inset 0 0 30px rgba(0,0,0,0.3), 0 0 20px ${GOLD}08` }}
        />
      </div>
    </div>
  );
};

// ===== CATEGORY FILTER PILLS =====
const CategoryFilter: React.FC<{
  categories: VideoCategory[];
  activeFilter: string | null;
  onFilter: (id: string | null) => void;
}> = ({ categories, activeFilter, onFilter }) => {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 mb-4 md:mb-6 scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <button
        onClick={() => { playMenuSelect(); onFilter(null); }}
        className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all"
        style={{
          fontFamily: CINZEL,
          background: !activeFilter ? `${GOLD}25` : 'rgba(26,18,9,0.5)',
          color: !activeFilter ? GOLD_LIGHT : `${PARCHMENT}80`,
          border: `1.5px solid ${!activeFilter ? `${GOLD}60` : `${GOLD}20`}`,
        }}
      >
        <Star className="w-3 h-3 inline mr-1 -mt-0.5" />
        All
      </button>

      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => { playMenuSelect(); onFilter(activeFilter === cat.id ? null : cat.id); }}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider transition-all whitespace-nowrap"
          style={{
            background: activeFilter === cat.id ? `${cat.color}25` : 'rgba(26,18,9,0.5)',
            color: activeFilter === cat.id ? cat.color : `${PARCHMENT}80`,
            border: `1.5px solid ${activeFilter === cat.id ? `${cat.color}60` : `${GOLD}20`}`,
          }}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

// ===== MAIN VIDEO MODE COMPONENT =====
interface VideoLibraryProps {
  parentData?: any;
  onShowUpgrade: () => void;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  parentData,
  onShowUpgrade,
}) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [playingCategory, setPlayingCategory] = useState<VideoCategory | null>(null);
  const [backendVideos, setBackendVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isPaid = parentData?.subscription_status === 'active';

  // Fetch real videos from backend
  const loadBackendVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      const vids = await fetchVideos();
      setBackendVideos(vids || []);
    } catch (err) {
      console.error('[VideoMode] Failed to load backend videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendVideos();
  }, [loadBackendVideos]);

  // Build categories: backend videos take priority, demo fills in as fallback
  // Only fall back to demo data AFTER loading completes — prevents demo flash
  const categories: VideoCategory[] = CATEGORY_ORDER
    .map((catId) => {
      const config = CATEGORY_CONFIG[catId];
      if (!config) return null;

      // Backend videos for this category
      const realVideos: Video[] = backendVideos
        .filter((v: any) => v.category === catId)
        .map((v: any) => ({
          id: v.id,
          title: v.title,
          subtitle: v.subtitle || '',
          thumbnail: v.thumbnail_url || (v.youtube_url ? getYouTubeThumbnail(v.youtube_url) : ''),
          duration: v.duration || '0:00',
          episode: v.episode || null,
          isPremium: v.is_premium || false,
          youtubeUrl: v.youtube_url || '',
          isNew: false,
          isFeatured: v.is_featured || false,
        }));

      // While loading, show empty array (skeletons will display).
      // After loaded, use real videos if any exist; otherwise fall back to demo.
      const videos = isLoading ? [] : (realVideos.length > 0 ? realVideos : (DEMO_VIDEOS[catId] || []));

      // Skip categories with no videos while loading (skeleton rows shown separately)
      if (videos.length === 0 && !isLoading) return null;

      return {
        id: catId,
        name: config.name,
        color: config.color,
        description: config.description,
        videos,
      } as VideoCategory;
    })
    .filter(Boolean) as VideoCategory[];

  const filteredCategories = activeFilter
    ? categories.filter((c) => c.id === activeFilter)
    : categories;

  const totalVideos = categories.reduce((sum, c) => sum + c.videos.length, 0);
  const freeVideos = categories.reduce((sum, c) => sum + c.videos.filter(v => !v.isPremium).length, 0);

  const handlePlay = (video: Video, category: VideoCategory) => {
    setPlayingVideo(video);
    setPlayingCategory(category);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">Video Mode</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          {isLoading ? 'Loading...' : (
            <>
              {totalVideos} enchanted episodes across {categories.length} realms
              {!isPaid && (
                <span className="ml-2 text-[11px]" style={{ color: `${GOLD}90` }}>
                  &middot; {freeVideos} free
                </span>
              )}
            </>
          )}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Hero Banner */}
      {!isLoading && <HeroBanner categories={categories} onPlay={handlePlay} />}

      {/* Category Filter Pills */}
      {!isLoading && (
        <CategoryFilter
          categories={categories}
          activeFilter={activeFilter}
          onFilter={setActiveFilter}
        />
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-8">
          {/* Skeleton hero */}
          <div className="rounded-2xl overflow-hidden animate-pulse" style={{ border: `2px solid ${GOLD}15` }}>
            <div className="aspect-[21/9] md:aspect-[3/1]" style={{ background: `${GOLD}08` }} />
          </div>
          {/* Skeleton pill row */}
          <div className="flex gap-2">
            {[80, 110, 95, 120, 100, 85, 115, 90].map((w, i) => (
              <div
                key={i}
                className="h-7 rounded-full animate-pulse flex-shrink-0"
                style={{ width: w, background: `${GOLD}10`, border: `1px solid ${GOLD}10` }}
              />
            ))}
          </div>
          {/* Skeleton category rows */}
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: `${GOLD}20` }} />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 rounded animate-pulse" style={{ width: 140, background: `${GOLD}15` }} />
                  <div className="h-2.5 rounded animate-pulse" style={{ width: 220, background: `${GOLD}08` }} />
                </div>
              </div>
              <div className="flex gap-3 md:gap-4 overflow-hidden">
                {[0, 1, 2, 3].map((card) => (
                  <div
                    key={card}
                    className="flex-shrink-0 rounded-xl overflow-hidden animate-pulse"
                    style={{ width: 'clamp(200px, 42vw, 260px)', border: `1.5px solid ${GOLD}10` }}
                  >
                    <div className="aspect-video" style={{ background: `${GOLD}08` }} />
                    <div className="px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(20,14,8,0.5)' }}>
                      <div className="h-3 rounded" style={{ width: '75%', background: `${GOLD}12` }} />
                      <div className="h-2 rounded" style={{ width: '50%', background: `${GOLD}08` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Rows */}
      {filteredCategories.map((category) => (
        <ScrollRow
          key={category.id}
          category={category}
          isPaid={isPaid}
          onPlay={handlePlay}
        />
      ))}

      {/* Bottom upsell for free users */}
      {!isPaid && (
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(30,22,12,0.92) 0%, rgba(20,16,10,0.95) 100%)',
            border: `2px solid ${GOLD}30`,
          }}
        >
          <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at center, ${GOLD}40 0%, transparent 70%)` }} />
          <div className="relative z-10">
            <Crown className="w-8 h-8 mx-auto mb-2" style={{ color: GOLD }} />
            <h3 className="text-base font-bold mb-1" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
              Unlock All Adventures
            </h3>
            <p className="text-xs mb-4 max-w-sm mx-auto" style={{ color: `${PARCHMENT}90` }}>
              Upgrade to Premium for unlimited access to all {totalVideos} episodes, new content every week, and ad-free viewing.
            </p>
            <button
              onClick={() => { playMenuSelect(); onShowUpgrade(); }}
              className="px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
              style={{
                fontFamily: CINZEL,
                background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 3px 0 #a67c2e, 0 0 20px ${GOLD}20`,
              }}
            >
              <Crown className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Go Premium
            </button>
          </div>
        </div>
      )}

      {/* Player Modal */}
      <VideoPlayerModal
        video={playingVideo}
        category={playingCategory}
        onClose={() => { setPlayingVideo(null); setPlayingCategory(null); }}
        isPaid={isPaid}
        onUpgrade={onShowUpgrade}
      />

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};