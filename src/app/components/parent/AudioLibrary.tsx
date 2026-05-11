import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
  Heart, Clock, X, ChevronDown, Music, Crown, Lock, List, Loader2, Star,
} from 'lucide-react';
import { FantasyTitle, GoldOrnament } from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { useLanguage } from '../LanguageContext';
import { toast } from 'sonner@2.0.3';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { fetchPublicAudioTracks } from '../../utils/api';


// ===== THEME =====
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CINZEL = "'Cinzel Decorative', serif";
const CHERRY = "'Cherry Bomb One', cursive";

// ===== TYPES =====
interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: string; // "3:24"
  durationSec: number;
  category: string;
  isPremium: boolean;
  isFeatured?: boolean;
  audioUrl?: string; // R2 URL — empty for demo
}

interface AudioCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// ===== DEMO DATA =====
const DEMO_CATEGORIES: AudioCategory[] = [
  { id: 'lullabies', name: 'Lullabies', icon: '🌙', color: '#5b6abf' },
  { id: 'nursery', name: 'Nursery Rhymes', icon: '🎶', color: '#7cc643' },
  { id: 'nasheeds', name: 'Nasheeds', icon: '🕌', color: '#2ecc71' },
  { id: 'chinese', name: 'Chinese Songs', icon: '🏮', color: '#e74c3c' },
  { id: 'nature', name: 'Nature Sounds', icon: '🌿', color: '#1abc9c' },
  { id: 'learning', name: 'Learning Songs', icon: '📚', color: '#f39c12' },
];

const DEMO_TRACKS: AudioTrack[] = [
  { id: 'a1', title: 'Twinkle Twinkle Little Star', artist: 'Foxy & Friends', albumArt: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&h=300&fit=crop', duration: '3:12', durationSec: 192, category: 'lullabies', isPremium: false, isFeatured: true },
  { id: 'a2', title: 'Dreamland Lullaby', artist: 'Dream Guardian', albumArt: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&h=300&fit=crop', duration: '4:30', durationSec: 270, category: 'lullabies', isPremium: false },
  { id: 'a3', title: 'Moonlit Forest', artist: 'Enchanted Bard', albumArt: 'https://images.unsplash.com/photo-1475274047050-1d0c55b0033b?w=300&h=300&fit=crop', duration: '5:15', durationSec: 315, category: 'lullabies', isPremium: true },
  { id: 'a4', title: 'Baa Baa Black Sheep', artist: 'Foxy & Friends', albumArt: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=300&h=300&fit=crop', duration: '2:45', durationSec: 165, category: 'nursery', isPremium: false, isFeatured: true },
  { id: 'a5', title: 'Wheels on the Bus', artist: 'Foxy & Friends', albumArt: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300&h=300&fit=crop', duration: '3:05', durationSec: 185, category: 'nursery', isPremium: false },
  { id: 'a6', title: 'Old MacDonald', artist: 'Foxy & Friends', albumArt: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=300&h=300&fit=crop', duration: '3:30', durationSec: 210, category: 'nursery', isPremium: true },
  { id: 'a7', title: 'Tala\' Al-Badru', artist: 'Nour Ensemble', albumArt: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=300&h=300&fit=crop', duration: '4:10', durationSec: 250, category: 'nasheeds', isPremium: false },
  { id: 'a8', title: '\u4E24\u53EA\u8001\u864E', artist: '\u72D0\u72F8\u5C06\u519B', albumArt: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&h=300&fit=crop', duration: '2:20', durationSec: 140, category: 'chinese', isPremium: false },
  { id: 'a9', title: 'Rainforest Rain', artist: 'Nature Ranger', albumArt: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop', duration: '10:00', durationSec: 600, category: 'nature', isPremium: false },
  { id: 'a10', title: 'ABC Alphabet Song', artist: 'English Knight', albumArt: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=300&h=300&fit=crop', duration: '2:50', durationSec: 170, category: 'learning', isPremium: false, isFeatured: true },
];

// ===== HELPER: Format seconds to m:ss =====
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ===== SPINNING VINYL DISK =====
function VinylDisk({ albumArt, isPlaying, size = 240 }: { albumArt: string; isPlaying: boolean; size?: number }) {
  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
    >
      {/* Outer vinyl ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0d0d1a 40%, #1a1a2e 42%, #0d0d1a 44%, #1a1a2e 46%, #0d0d1a 100%)`,
          boxShadow: `0 0 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.4), 0 0 80px ${GOLD}15`,
          animation: isPlaying ? 'vinyl-spin 3s linear infinite' : 'none',
        }}
      />
      {/* Album art circle (center) */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          top: size * 0.18,
          left: size * 0.18,
          width: size * 0.64,
          height: size * 0.64,
          border: `3px solid ${GOLD}40`,
          boxShadow: `0 0 20px rgba(0,0,0,0.5)`,
          animation: isPlaying ? 'vinyl-spin 3s linear infinite' : 'none',
        }}
      >
        <ImageWithFallback
          src={albumArt}
          alt="Album art"
          className="w-full h-full object-cover"
        />
      </div>
      {/* Center hole */}
      <div
        className="absolute rounded-full"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.08,
          height: size * 0.08,
          background: `radial-gradient(circle, ${GOLD}60, #1a1a2e)`,
          border: `2px solid ${GOLD}50`,
          boxShadow: `0 0 8px ${GOLD}30`,
        }}
      />
    </div>
  );
}

// ===== PROPS =====
interface AudioLibraryProps {
  parentData: any;
  onShowUpgrade?: () => void;
  onTrackComplete?: () => void;
}

// ===== COMPONENT =====
export const AudioLibrary: React.FC<AudioLibraryProps> = ({ parentData, onShowUpgrade, onTrackComplete }) => {
  const { t } = useLanguage();
  const isPaid = parentData?.subscription_status === 'active';

  // --- Live data from backend (falls back to demo data on error) ---
  const [liveTracks, setLiveTracks] = useState<AudioTrack[]>([]);
  const [liveCategories, setLiveCategories] = useState<AudioCategory[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  // Load backend data on mount
  useEffect(() => {
    setIsLoadingLibrary(true);
    fetchPublicAudioTracks()
      .then(({ tracks, categories }) => {
        // When backend responds successfully, ALWAYS replace demo data
        // (even if arrays are empty) to avoid slug-ID demo categories
        // clashing with UUID-based backend categories
        if (tracks) {
          const mapped: AudioTrack[] = tracks.map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            albumArt: t.album_art || '',
            duration: t.duration || '0:00',
            durationSec: t.duration_sec || 0,
            category: t.category || '',
            isPremium: t.is_premium || false,
            isFeatured: t.is_featured || false,
            audioUrl: t.audio_url || '',
          }));
          setLiveTracks(mapped.length > 0 ? mapped : DEMO_TRACKS);
        } else {
          setLiveTracks(DEMO_TRACKS);
        }
        if (categories) {
          const mappedCats: AudioCategory[] = categories.map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || '🎵',
            color: c.color || '#d4a44a',
          }));
          // Use backend categories when backend has tracks;
          // fallback to demo categories only when using demo tracks
          if (tracks && tracks.length > 0) {
            setLiveCategories(mappedCats);
          } else {
            setLiveCategories(mappedCats.length > 0 ? mappedCats : DEMO_CATEGORIES);
          }
        } else {
          setLiveCategories(DEMO_CATEGORIES);
        }
      })
      .catch((err) => {
        console.warn('[AUDIO] Failed to fetch backend tracks, using demo data:', err);
        setLiveTracks(DEMO_TRACKS);
        setLiveCategories(DEMO_CATEGORIES);
      })
      .finally(() => {
        setIsLoadingLibrary(false);
      });
  }, []);

  // --- State ---
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Player state
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  // Repeat & shuffle
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [shuffleOn, setShuffleOn] = useState(false);

  // Sleep timer
  const [sleepTimer, setSleepTimer] = useState<number | null>(null); // minutes remaining
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Audio ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDraggingRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // --- Inject CSS keyframes for vinyl spin ---
  useEffect(() => {
    if (document.getElementById('vinyl-spin-css')) return;
    const style = document.createElement('style');
    style.id = 'vinyl-spin-css';
    style.textContent = `@keyframes vinyl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }, []);

  // --- Filtered tracks ---
  const filteredTracks = liveTracks.filter((t) => {
    if (showFavorites) return favorites.has(t.id);
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  // --- Play a track ---
  const playTrack = useCallback((track: AudioTrack, trackList?: AudioTrack[]) => {
    if (track.isPremium && !isPaid) {
      onShowUpgrade?.();
      return;
    }
    playMenuSelect();

    // Set queue from current filtered list if not provided
    const list = trackList || filteredTracks;
    const idx = list.findIndex((t) => t.id === track.id);
    setQueue(list);
    setQueueIndex(idx >= 0 ? idx : 0);
    setCurrentTrack(track);
    setCurrentTime(0);
    setIsPlaying(true);
    setShowFullPlayer(true); // Default to full player when tapping a track card

    // If track has a real audio URL, use the <audio> element for real playback
    if (track.audioUrl && audioRef.current) {
      audioRef.current.src = track.audioUrl;
      audioRef.current.play().catch((err) => {
        console.error('[AUDIO] Playback failed:', err);
      });
    }
    // Otherwise, demo mode simulation runs via the interval below
  }, [filteredTracks, isPaid, onShowUpgrade]);

  // --- Real audio element event handlers ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (currentTrack?.audioUrl) {
        setCurrentTime(Math.floor(audio.currentTime));
      }
    };
    const onEnded = () => {
      if (currentTrack?.audioUrl) {
        handleTrackEnd();
      }
    };
    const onError = (e: Event) => {
      console.error('[AUDIO] Playback error:', e);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentTrack?.id, currentTrack?.audioUrl]);

  // --- Simulate playback progress (demo mode — only when no real audio URL) ---
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (!isPlaying || !currentTrack) return;
    // Skip simulation if using real audio playback
    if (currentTrack.audioUrl) return;

    progressIntervalRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= (currentTrack?.durationSec || 0)) {
          // Track ended → handle next
          handleTrackEnd();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, currentTrack?.id]);

  // --- Track ended logic ---
  const trackCompleteCalledRef = useRef(false);
  const handleTrackEnd = useCallback(() => {
    // Fire onTrackComplete once per session (first track finish)
    if (!trackCompleteCalledRef.current && onTrackComplete) {
      trackCompleteCalledRef.current = true;
      onTrackComplete();
    }

    if (repeatMode === 'one') {
      setCurrentTime(0);
      // Restart the same track in the audio element
      if (audioRef.current && currentTrack?.audioUrl) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    // Next track
    const nextIdx = shuffleOn
      ? Math.floor(Math.random() * queue.length)
      : queueIndex + 1;
    if (nextIdx < queue.length) {
      const nextTrack = queue[nextIdx];
      setQueueIndex(nextIdx);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setIsPlaying(true);
      // Load and play next track's audio
      if (nextTrack.audioUrl && audioRef.current) {
        audioRef.current.src = nextTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    } else if (repeatMode === 'all' && queue.length > 0) {
      const nextTrack = queue[0];
      setQueueIndex(0);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setIsPlaying(true);
      if (nextTrack.audioUrl && audioRef.current) {
        audioRef.current.src = nextTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      onTrackComplete?.();
    }
  }, [repeatMode, shuffleOn, queueIndex, queue, currentTrack, onTrackComplete]);

  // --- Media Session API for lock screen controls ---
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: 'Foxy Music',
      artwork: [{ src: currentTrack.albumArt, sizes: '300x300', type: 'image/jpeg' }],
    });
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', () => skipPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => skipNext());
  }, [currentTrack]);

  // --- Sleep timer countdown ---
  useEffect(() => {
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    if (sleepTimer === null || sleepTimer <= 0) return;

    sleepIntervalRef.current = setInterval(() => {
      setSleepTimer((prev) => {
        if (prev === null) return null;
        const next = prev - (1 / 60); // Decrease by 1 second (stored as minutes)
        if (next <= 0) {
          // Fade out and stop
          setIsPlaying(false);
          toast(t('audio.goodnight') + ' \u{1F319}', { duration: 4000 });
          return null;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, [sleepTimer !== null]);

  // --- Controls ---
  const togglePlay = () => {
    playMenuSelect();
    const newState = !isPlaying;
    setIsPlaying(newState);
    // Sync real audio element
    if (currentTrack?.audioUrl && audioRef.current) {
      if (newState) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  };

  const skipNext = () => {
    playMenuSelect();
    const nextIdx = shuffleOn
      ? Math.floor(Math.random() * queue.length)
      : queueIndex + 1;
    if (nextIdx < queue.length) {
      const nextTrack = queue[nextIdx];
      setQueueIndex(nextIdx);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setIsPlaying(true);
      if (nextTrack.audioUrl && audioRef.current) {
        audioRef.current.src = nextTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    } else if (repeatMode === 'all' && queue.length > 0) {
      const nextTrack = queue[0];
      setQueueIndex(0);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setIsPlaying(true);
      if (nextTrack.audioUrl && audioRef.current) {
        audioRef.current.src = nextTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const skipPrev = () => {
    playMenuSelect();
    if (currentTime > 3) {
      setCurrentTime(0);
      if (currentTrack?.audioUrl && audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return;
    }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      const prevTrack = queue[prevIdx];
      setQueueIndex(prevIdx);
      setCurrentTrack(prevTrack);
      setCurrentTime(0);
      setIsPlaying(true);
      if (prevTrack.audioUrl && audioRef.current) {
        audioRef.current.src = prevTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const cycleRepeat = () => {
    playMenuSelect();
    setRepeatMode((prev) => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  const progressPercent = currentTrack ? (currentTime / currentTrack.durationSec) * 100 : 0;

  // ===== RENDER =====
  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">{t('audio.title')}</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          {t('audio.subtitle')}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Category Pills — Horizontal Scroll */}
      {isLoadingLibrary ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
          <p className="text-sm font-medium" style={{ color: `${PARCHMENT}70`, fontFamily: CINZEL }}>
            Loading music library...
          </p>
        </div>
      ) : (
      <>
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => { setActiveCategory('all'); setShowFavorites(false); }}
          className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-all"
          style={{
            background: activeCategory === 'all' && !showFavorites ? `${GOLD}30` : 'rgba(26,18,9,0.5)',
            color: activeCategory === 'all' && !showFavorites ? GOLD_LIGHT : `${PARCHMENT}80`,
            border: `1.5px solid ${activeCategory === 'all' && !showFavorites ? GOLD : `${GOLD}20`}`,
          }}
        >
          {t('audio.allTracks')}
        </button>
        <button
          onClick={() => { setShowFavorites(true); setActiveCategory('all'); }}
          className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-all flex items-center gap-1.5"
          style={{
            background: showFavorites ? `${GOLD}30` : 'rgba(26,18,9,0.5)',
            color: showFavorites ? GOLD_LIGHT : `${PARCHMENT}80`,
            border: `1.5px solid ${showFavorites ? GOLD : `${GOLD}20`}`,
          }}
        >
          <Heart className="w-3 h-3" fill={showFavorites ? GOLD_LIGHT : 'transparent'} />
          {t('audio.favorites')}
        </button>
        {liveCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setShowFavorites(false); }}
            className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-all"
            style={{
              background: activeCategory === cat.id ? `${cat.color}30` : 'rgba(26,18,9,0.5)',
              color: activeCategory === cat.id ? cat.color : `${PARCHMENT}80`,
              border: `1.5px solid ${activeCategory === cat.id ? cat.color : `${GOLD}20`}`,
            }}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Track Grid */}
      {filteredTracks.length === 0 ? (
        <div className="text-center py-12">
          <Music className="w-12 h-12 mx-auto mb-4" style={{ color: `${GOLD}40` }} />
          <p className="text-sm" style={{ color: `${PARCHMENT}60` }}>
            {showFavorites ? 'No favorites yet — tap the heart on tracks you love!' : t('audio.noTracks')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredTracks.map((track) => {
            const isActive = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className="relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: 'rgba(26,18,9,0.6)',
                  border: `1.5px solid ${isActive ? GOLD : `${GOLD}15`}`,
                  boxShadow: isActive ? `0 0 20px ${GOLD}20` : '0 2px 10px rgba(0,0,0,0.3)',
                }}
                onClick={() => playTrack(track)}
              >
                {/* Album Art */}
                <div className="relative aspect-square overflow-hidden">
                  <ImageWithFallback
                    src={track.albumArt}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isActive && isPlaying ? (
                      <Pause className="w-10 h-10" style={{ color: GOLD_LIGHT }} />
                    ) : (
                      <Play className="w-10 h-10" style={{ color: GOLD_LIGHT }} fill={GOLD_LIGHT} />
                    )}
                  </div>
                  {/* Now playing indicator */}
                  {isActive && isPlaying && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: 'rgba(0,0,0,0.7)' }}>
                      <div className="flex gap-0.5 items-end h-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-[3px] rounded-full"
                            style={{
                              background: GOLD_LIGHT,
                              height: `${40 + Math.random() * 60}%`,
                              animation: `vinyl-spin ${0.4 + i * 0.15}s ease-in-out infinite alternate`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Premium badge */}
                  {track.isPremium && (
                    <div
                      className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.7)', color: GOLD_LIGHT, border: `1px solid ${GOLD}40` }}
                    >
                      <Crown className="w-2.5 h-2.5" />
                      {t('audio.premium')}
                    </div>
                  )}
                  {/* Featured badge */}
                  {track.isFeatured && !track.isPremium && (
                    <div
                      className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#f39c12', border: `1px solid rgba(243,156,18,0.4)` }}
                    >
                      <Star className="w-2.5 h-2.5" fill="#f39c12" />
                      Featured
                    </div>
                  )}
                  {/* Favorite button — always visible when liked, hover-only otherwise */}
                  <button
                    className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${favorites.has(track.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ background: 'rgba(0,0,0,0.6)' }}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
                  >
                    <Heart
                      className="w-3.5 h-3.5"
                      style={{ color: favorites.has(track.id) ? '#ff6b6b' : 'white' }}
                      fill={favorites.has(track.id) ? '#ff6b6b' : 'transparent'}
                    />
                  </button>
                </div>
                {/* Track info */}
                <div className="p-2.5">
                  <p
                    className="text-xs font-bold truncate"
                    style={{ color: isActive ? GOLD_LIGHT : `${PARCHMENT}e0` }}
                  >
                    {track.title}
                  </p>
                  <p className="text-[10px] truncate mt-0.5" style={{ color: `${PARCHMENT}70` }}>
                    {track.artist} &middot; {track.duration}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* ===== MINI PLAYER (bottom bar) ===== */}
      {currentTrack && !showFullPlayer && createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-[60] cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, rgba(26,18,9,0.95) 0%, rgba(12,8,4,0.98) 100%)',
            borderTop: `1.5px solid ${GOLD}30`,
            boxShadow: `0 -4px 20px rgba(0,0,0,0.5)`,
            backdropFilter: 'blur(12px)',
          }}
          onClick={() => setShowFullPlayer(true)}
        >
          {/* Progress bar thin line */}
          <div className="h-[2px] w-full" style={{ background: `${GOLD}15` }}>
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Album art thumbnail */}
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${GOLD}30` }}>
              <ImageWithFallback src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
            </div>
            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: GOLD_LIGHT }}>{currentTrack.title}</p>
              <p className="text-[10px] truncate" style={{ color: `${PARCHMENT}70` }}>{currentTrack.artist}</p>
            </div>
            {/* Play/pause */}
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: `${GOLD}20`, border: `1.5px solid ${GOLD}40` }}
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" style={{ color: GOLD_LIGHT }} />
              ) : (
                <Play className="w-4 h-4 ml-0.5" style={{ color: GOLD_LIGHT }} fill={GOLD_LIGHT} />
              )}
            </button>
            {/* Close */}
            <button
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ color: `${PARCHMENT}60` }}
              onClick={(e) => { e.stopPropagation(); setIsPlaying(false); setCurrentTrack(null); }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Sleep timer badge */}
          {sleepTimer !== null && (
            <div className="absolute top-0 right-4 -translate-y-full mb-1 px-2 py-0.5 rounded-t-md text-[9px] font-bold flex items-center gap-1"
              style={{ background: `rgba(91,106,191,0.9)`, color: GOLD_LIGHT }}
            >
              <Clock className="w-2.5 h-2.5" />
              {Math.ceil(sleepTimer)}m
            </div>
          )}
        </div>,
        document.body
      )}

      {/* ===== FULL PLAYER (overlay) ===== */}
      {currentTrack && showFullPlayer && createPortal(
        <div
          className="fixed inset-0 z-[100] flex flex-col"
          style={{
            background: 'linear-gradient(180deg, #0a0614 0%, #1a0e2e 30%, #0d0d1a 100%)',
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center"
              onClick={() => setShowFullPlayer(false)}
            >
              <ChevronDown className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
            </button>
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: `${PARCHMENT}80`, fontFamily: CINZEL }}
            >
              {t('audio.nowPlaying')}
            </p>
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center"
              onClick={() => setShowQueue(!showQueue)}
            >
              <List className="w-5 h-5" style={{ color: showQueue ? GOLD_LIGHT : `${PARCHMENT}70` }} />
            </button>
          </div>

          {showQueue ? (
            /* ===== Queue view ===== */
            <div className="flex-1 overflow-y-auto px-4 pt-2">
              <p className="text-sm font-bold mb-3" style={{ color: GOLD_LIGHT, fontFamily: CINZEL }}>
                {t('audio.upNext')}
              </p>
              {queue.slice(queueIndex + 1).map((track, i) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 py-2.5 border-b"
                  style={{ borderColor: `${GOLD}10` }}
                  onClick={() => {
                    const newIdx = queueIndex + 1 + i;
                    setQueueIndex(newIdx);
                    setCurrentTrack(queue[newIdx]);
                    setCurrentTime(0);
                    setIsPlaying(true);
                  }}
                >
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                    <ImageWithFallback src={track.albumArt} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: `${PARCHMENT}e0` }}>{track.title}</p>
                    <p className="text-[10px] truncate" style={{ color: `${PARCHMENT}60` }}>{track.artist}</p>
                  </div>
                  <p className="text-[10px]" style={{ color: `${PARCHMENT}50` }}>{track.duration}</p>
                </div>
              ))}
              {queue.slice(queueIndex + 1).length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: `${PARCHMENT}50` }}>
                  No more tracks in queue
                </p>
              )}
            </div>
          ) : (
            /* ===== Player view ===== */
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
              {/* Spinning vinyl */}
              <VinylDisk albumArt={currentTrack.albumArt} isPlaying={isPlaying} size={Math.min(280, window.innerWidth - 80)} />

              {/* Track info */}
              <div className="text-center w-full">
                <h2
                  className="text-lg font-bold truncate"
                  style={{ color: GOLD_LIGHT, fontFamily: CHERRY, textShadow: `0 2px 8px rgba(0,0,0,0.6)` }}
                >
                  {currentTrack.title}
                </h2>
                <p className="text-sm mt-1" style={{ color: `${PARCHMENT}80` }}>
                  {currentTrack.artist}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-sm">
                <div
                  className="w-full h-6 rounded-full cursor-pointer relative flex items-center"
                  style={{ touchAction: 'none' }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const newTime = pct * currentTrack.durationSec;
                    setCurrentTime(newTime);
                    if (currentTrack.audioUrl && audioRef.current) {
                      audioRef.current.currentTime = newTime;
                    }
                  }}
                  onMouseDown={(e) => {
                    isDraggingRef.current = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const newTime = pct * currentTrack.durationSec;
                    setCurrentTime(newTime);

                    const onMouseMove = (ev: MouseEvent) => {
                      if (!isDraggingRef.current) return;
                      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                      setCurrentTime(p * currentTrack.durationSec);
                    };
                    const onMouseUp = () => {
                      isDraggingRef.current = false;
                      if (currentTrack.audioUrl && audioRef.current) {
                        audioRef.current.currentTime = currentTime;
                      }
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                  onTouchStart={(e) => {
                    isDraggingRef.current = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const touch = e.touches[0];
                    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    setCurrentTime(pct * currentTrack.durationSec);
                  }}
                  onTouchMove={(e) => {
                    if (!isDraggingRef.current || !progressBarRef.current) return;
                    const rect = progressBarRef.current.getBoundingClientRect();
                    const touch = e.touches[0];
                    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    setCurrentTime(pct * currentTrack.durationSec);
                  }}
                  onTouchEnd={() => {
                    isDraggingRef.current = false;
                    if (currentTrack.audioUrl && audioRef.current) {
                      audioRef.current.currentTime = currentTime;
                    }
                  }}
                  ref={progressBarRef}
                >
                  {/* Track background */}
                  <div className="w-full h-1.5 rounded-full absolute" style={{ background: `${GOLD}15` }} />
                  {/* Filled portion */}
                  <div
                    className="h-1.5 rounded-full absolute"
                    style={{
                      width: `${progressPercent}%`,
                      background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
                      boxShadow: `0 0 6px ${GOLD}40`,
                    }}
                  />
                  {/* Scrubber dot */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
                    style={{
                      left: `calc(${progressPercent}% - 8px)`,
                      background: GOLD_LIGHT,
                      boxShadow: `0 0 8px ${GOLD}60`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px]" style={{ color: `${PARCHMENT}60` }}>{formatTime(currentTime)}</span>
                  <span className="text-[10px]" style={{ color: `${PARCHMENT}60` }}>{currentTrack.duration}</span>
                </div>
              </div>

              {/* Main controls */}
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => { playMenuSelect(); setShuffleOn(!shuffleOn); }}>
                  <Shuffle
                    className="w-5 h-5"
                    style={{ color: shuffleOn ? GOLD_LIGHT : `${PARCHMENT}50` }}
                  />
                </button>
                <button onClick={skipPrev} className="active:scale-90 transition-transform">
                  <SkipBack className="w-7 h-7" style={{ color: GOLD_LIGHT }} fill={GOLD_LIGHT} />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, #f0d078, ${GOLD})`,
                    boxShadow: `0 4px 0 #a67c2e, 0 0 30px ${GOLD}30`,
                  }}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7" style={{ color: '#2a1f0e' }} />
                  ) : (
                    <Play className="w-7 h-7 ml-1" style={{ color: '#2a1f0e' }} fill="#2a1f0e" />
                  )}
                </button>
                <button onClick={skipNext} className="active:scale-90 transition-transform">
                  <SkipForward className="w-7 h-7" style={{ color: GOLD_LIGHT }} fill={GOLD_LIGHT} />
                </button>
                <button onClick={cycleRepeat}>
                  {repeatMode === 'one' ? (
                    <Repeat1 className="w-5 h-5" style={{ color: GOLD_LIGHT }} />
                  ) : (
                    <Repeat
                      className="w-5 h-5"
                      style={{ color: repeatMode === 'all' ? GOLD_LIGHT : `${PARCHMENT}50` }}
                    />
                  )}
                </button>
              </div>

              {/* Secondary controls */}
              <div className="flex items-center justify-center gap-10">
                <button
                  className="flex flex-col items-center gap-1"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(currentTrack.id); }}
                >
                  <Heart
                    className="w-5 h-5"
                    style={{ color: favorites.has(currentTrack.id) ? '#ff6b6b' : `${PARCHMENT}60` }}
                    fill={favorites.has(currentTrack.id) ? '#ff6b6b' : 'transparent'}
                  />
                  <span className="text-[9px]" style={{ color: favorites.has(currentTrack.id) ? '#ff6b6b' : `${PARCHMENT}50` }}>
                    {favorites.has(currentTrack.id) ? 'Liked' : 'Like'}
                  </span>
                </button>
                <button
                  onClick={() => setShowTimerPicker(!showTimerPicker)}
                  className="relative flex flex-col items-center gap-1"
                >
                  <Clock
                    className="w-5 h-5"
                    style={{ color: sleepTimer !== null ? '#5b6abf' : `${PARCHMENT}60` }}
                  />
                  <span className="text-[9px]" style={{ color: sleepTimer !== null ? '#5b6abf' : `${PARCHMENT}50` }}>
                    {sleepTimer !== null ? `${Math.ceil(sleepTimer)}m left` : 'Set Timer'}
                  </span>
                </button>
              </div>

              {/* Sleep timer picker */}
              {showTimerPicker && (
                <div
                  className="w-full max-w-sm rounded-xl p-4"
                  style={{ background: 'rgba(26,18,9,0.9)', border: `1px solid ${GOLD}30` }}
                >
                  <p className="text-xs font-bold mb-3 text-center" style={{ color: GOLD_LIGHT, fontFamily: CINZEL }}>
                    {t('audio.sleepTimer')}
                  </p>
                  <div className="flex gap-2 justify-center">
                    {[
                      { label: t('audio.timerOff'), value: null },
                      { label: '15', value: 15 },
                      { label: '30', value: 30 },
                      { label: '60', value: 60 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: sleepTimer === opt.value || (sleepTimer === null && opt.value === null) ? `${GOLD}30` : `${GOLD}08`,
                          color: sleepTimer === opt.value || (sleepTimer === null && opt.value === null) ? GOLD_LIGHT : `${PARCHMENT}70`,
                          border: `1px solid ${sleepTimer === opt.value || (sleepTimer === null && opt.value === null) ? GOLD : `${GOLD}15`}`,
                        }}
                        onClick={() => {
                          setSleepTimer(opt.value);
                          setShowTimerPicker(false);
                          if (opt.value) toast(`${t('audio.timerActive')}: ${opt.value} ${t('audio.timerMinutes')}`);
                        }}
                      >
                        {opt.value ? `${opt.label}m` : opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Hidden audio element for real playback (future R2 integration) */}
      <audio ref={audioRef} preload="none" />

      {/* Inject no-scrollbar style */}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};