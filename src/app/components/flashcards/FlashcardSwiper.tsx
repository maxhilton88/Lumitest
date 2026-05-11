/**
 * FlashcardSwiper — Tinder-style stacked swipeable flashcard experience.
 *
 * Features:
 * - Stacked card deck (next cards visibly peeking behind current)
 * - Tall image fills most of the card / screen
 * - 3 balanced language audio buttons (EN / BM / ZH)
 * - Play Video pill at top-right corner
 * - Swipe left/right with Tinder-style fly-off animation
 * - Minimal UI — no header bar, full focus on cards
 * - Completion celebration
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, Play, X, ChevronLeft, ChevronRight, RotateCcw, Trophy, Image as ImageIcon, Loader2, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { fetchFlashcards } from '../../utils/api';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface FlashCard {
  id: string;
  category_id: string;
  word_en: string;
  word_bm: string;
  word_zh: string;
  image_url?: string | null;
  video_url?: string | null;
  audio_en_url?: string | null;
  audio_bm_url?: string | null;
  audio_zh_url?: string | null;
}

interface Props {
  categoryIds: string[];
  categoryName: string;
  onBack: () => void;
  onComplete?: () => void;
}

// ── Language button with flag ────────────────────────────
function LangAudioButton({
  lang,
  audioUrl,
  word,
  isPlaying,
  onPlay,
}: {
  lang: 'en' | 'bm' | 'zh';
  audioUrl?: string | null;
  word: string;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const flags: Record<string, string> = { en: '🇬🇧', bm: '🇲🇾', zh: '🇨🇳' };
  const colors: Record<string, string> = { en: '#4a9eff', bm: '#ff6b6b', zh: '#ffd93d' };
  const labels: Record<string, string> = { en: 'EN', bm: 'BM', zh: '中文' };

  return (
    <button
      onClick={onPlay}
      disabled={!audioUrl && !word}
      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-30"
      style={{
        background: isPlaying ? `${colors[lang]}20` : 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${isPlaying ? colors[lang] : 'rgba(255,255,255,0.1)'}`,
        boxShadow: isPlaying ? `0 0 16px ${colors[lang]}25` : 'none',
      }}
    >
      <span className="text-lg">{flags[lang]}</span>
      <div className="flex flex-col items-start gap-0 min-w-0">
        <span className="text-[11px] font-bold text-white truncate max-w-[70px] leading-tight">{word}</span>
        <div className="flex items-center gap-1">
          <Volume2 size={10} style={{ color: isPlaying ? colors[lang] : '#666' }} />
          <span className="text-[9px] uppercase tracking-wider" style={{ color: isPlaying ? colors[lang] : '#555' }}>
            {labels[lang]}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Video overlay player ─────────────────────────────────
function VideoOverlay({
  videoUrl,
  onClose,
}: {
  videoUrl: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X size={24} />
      </button>
      <video
        ref={videoRef}
        src={videoUrl}
        className="max-w-[90vw] max-h-[80vh] rounded-2xl"
        controls
        playsInline
        autoPlay
        onClick={(e) => e.stopPropagation()}
        onEnded={onClose}
      />
    </motion.div>
  );
}

// ── Stack offset constants ───────────────────────────────
const STACK_Y_STEP = 22;     // px each card peeks below
const STACK_SCALE_STEP = 0.07; // each card is 7% smaller
const STACK_OPACITY_STEP = 0.3;

// ── Main Swiper Component ────────────────────────────────
export function FlashcardSwiper({ categoryIds, categoryName, onBack, onComplete }: Props) {
  const { language } = useLanguage();
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playingLang, setPlayingLang] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [direction, setDirection] = useState(0); // -1 = prev, 0 = init, 1 = next
  const [completed, setCompleted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Touch/swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const allCards: FlashCard[] = [];
        for (const categoryId of categoryIds) {
          const categoryCards = await fetchFlashcards(categoryId);
          allCards.push(...categoryCards);
        }
        if (categoryIds.length > 1) {
          for (let i = allCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
          }
        }
        setCards(allCards);
      } catch (err) {
        console.error('Failed to load flashcards:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [categoryIds]);

  const currentCard = cards[currentIndex];

  const playAudio = useCallback((lang: 'en' | 'bm' | 'zh') => {
    if (!currentCard) return;
    const urlMap = { en: currentCard.audio_en_url, bm: currentCard.audio_bm_url, zh: currentCard.audio_zh_url };
    const url = urlMap[lang];

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (url) {
      setPlayingLang(lang);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {
        fallbackTTS(lang);
      });
      audio.onended = () => setPlayingLang(null);
      audio.onerror = () => {
        fallbackTTS(lang);
      };
    } else {
      fallbackTTS(lang);
    }
  }, [currentCard]);

  const fallbackTTS = useCallback((lang: 'en' | 'bm' | 'zh') => {
    if (!currentCard || !('speechSynthesis' in window)) return;
    setPlayingLang(lang);
    window.speechSynthesis.cancel();

    const wordMap = { en: currentCard.word_en, bm: currentCard.word_bm, zh: currentCard.word_zh };
    const langMap = { en: 'en-US', bm: 'ms-MY', zh: 'zh-CN' };

    const utterance = new SpeechSynthesisUtterance(wordMap[lang]);
    utterance.lang = langMap[lang];
    utterance.rate = 0.8;
    utterance.onend = () => setPlayingLang(null);
    utterance.onerror = () => setPlayingLang(null);
    window.speechSynthesis.speak(utterance);
  }, [currentCard]);

  const goNext = useCallback(() => {
    if (currentIndex >= cards.length - 1) {
      setCompleted(true);
      if (onComplete) onComplete();
      return;
    }
    setDirection(1);
    setCurrentIndex(prev => prev + 1);
    setDragX(0);
  }, [currentIndex, cards.length, onComplete]);

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setDirection(-1);
    setCurrentIndex(prev => prev - 1);
    setDragX(0);
  }, [currentIndex]);

  const restart = () => {
    setCurrentIndex(0);
    setCompleted(false);
    setDirection(0);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    setDragX(dx);
  };

  const handleTouchEnd = () => {
    if (Math.abs(dragX) > 80) {
      if (dragX > 0) goPrev();
      else goNext();
    }
    setDragX(0);
    setTouchStart(null);
    setIsDragging(false);
  };

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: '#0c0818' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: '#0c0818' }}>
        <ImageIcon size={48} className="mx-auto mb-4 opacity-30 text-gray-400" />
        <p className="text-gray-400">No cards in this category yet</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ color: GOLD }}>
          <ArrowLeft size={16} className="inline mr-1" /> Back
        </button>
      </div>
    );
  }

  // ── Completion screen ──────────────────────────────────
  if (completed) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: '#0c0818' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10 }}
        >
          <Trophy size={80} style={{ color: GOLD }} />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold mt-6 text-center"
          style={{ color: GOLD_LIGHT }}
        >
          {language === 'zh' ? '太棒了！全部完成！' : language === 'ms' ? 'Hebat! Semua selesai!' : 'Amazing! All done!'}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-400 mt-2 text-center"
        >
          {language === 'zh'
            ? `你学了 ${cards.length} 个 ${categoryName} 词汇`
            : language === 'ms'
            ? `Anda telah belajar ${cards.length} perkataan ${categoryName}`
            : `You learned ${cards.length} ${categoryName} words`}
        </motion.p>

        <div className="flex gap-3 mt-8">
          <button onClick={restart} className="px-6 py-3 rounded-xl font-bold flex items-center gap-2"
            style={{ background: GOLD, color: '#1a0a2e' }}>
            <RotateCcw size={18} /> {language === 'zh' ? '再来一次' : language === 'ms' ? 'Ulang Semula' : 'Play Again'}
          </button>
          <button onClick={onBack} className="px-6 py-3 rounded-xl font-medium flex items-center gap-2 text-gray-300 hover:bg-white/10">
            <ArrowLeft size={18} /> {language === 'zh' ? '返回' : language === 'ms' ? 'Kembali' : 'Back'}
          </button>
        </div>
      </div>
    );
  }

  // ── Build visible stack: current + up to 2 behind ──────
  const stackIndices: number[] = [];
  for (let i = 0; i <= 2; i++) {
    const idx = currentIndex + i;
    if (idx < cards.length) stackIndices.push(idx);
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col select-none overflow-hidden"
      style={{ background: '#0c0818' }}
    >
      {/* Minimal floating back button — top-left */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-50 p-2.5 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <ArrowLeft size={20} className="text-gray-400" />
      </button>

      {/* Dot progress — top center, minimal */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1">
        {cards.length <= 20 ? (
          cards.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentIndex ? 16 : 5,
                height: 5,
                background: i === currentIndex
                  ? GOLD
                  : i < currentIndex
                  ? `${GOLD}60`
                  : 'rgba(255,255,255,0.15)',
                boxShadow: i === currentIndex ? `0 0 8px ${GOLD}60` : 'none',
              }}
            />
          ))
        ) : (
          <span className="text-[11px] font-medium" style={{ color: `${PARCHMENT}80` }}>
            {currentIndex + 1} / {cards.length}
          </span>
        )}
      </div>

      {/* ── Card Stack Area — fills available screen ── */}
      <div
        className="flex-1 flex items-center justify-center w-full px-5 pt-14 pb-2 min-h-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card container — relative, sized to fill most of available space */}
        <div
          className="relative w-full"
          style={{
            maxWidth: 380,
            /* Reserve space for the stack peeking below: tallest card + stack offset */
            height: '100%',
            maxHeight: 'calc(100%)',
          }}
        >
          {/* ── Background stack cards (offset 1 and 2) ── */}
          {stackIndices.map((idx) => {
            const offset = idx - currentIndex;
            if (offset === 0) return null; // Active card rendered separately

            return (
              <motion.div
                key={`stack-${cards[idx].id}`}
                animate={{
                  y: offset * STACK_Y_STEP,
                  scale: 1 - offset * STACK_SCALE_STEP,
                  opacity: 1 - offset * STACK_OPACITY_STEP,
                }}
                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                className="absolute inset-x-0 top-0 bottom-0 rounded-3xl overflow-hidden pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(40,25,70,0.9), rgba(20,10,40,0.95))',
                  border: `1.5px solid ${GOLD}20`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  zIndex: 10 - offset,
                  transformOrigin: 'top center',
                }}
              >
                {/* Faded preview image — fills most of card */}
                <div className="w-full flex-1" style={{ height: '70%' }}>
                  {cards[idx].image_url ? (
                    <img src={cards[idx].image_url} alt="" className="w-full h-full object-cover opacity-30" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <ImageIcon size={48} className="text-gray-700" />
                    </div>
                  )}
                </div>
                {/* Faded placeholder content */}
                <div className="px-5 pt-3 pb-4">
                  <div className="h-5 w-2/3 rounded-md mx-auto" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 h-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    <div className="flex-1 h-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    <div className="flex-1 h-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* ── Active card (top of stack) — Tinder fly-off animation ── */}
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentCard.id}
              custom={direction}
              /* Enter: rise up from stack position (where offset-1 card sits) */
              initial={{
                y: STACK_Y_STEP,
                scale: 1 - STACK_SCALE_STEP,
                opacity: 0.7,
                x: 0,
                rotate: 0,
              }}
              /* Resting: front of stack */
              animate={{
                x: isDragging ? dragX : 0,
                y: 0,
                opacity: 1,
                rotate: isDragging ? dragX * 0.05 : 0,
                scale: 1,
              }}
              /* Exit: fly off screen in swipe direction */
              exit={{
                x: direction >= 0 ? -400 : 400,
                opacity: 0,
                rotate: direction >= 0 ? -12 : 12,
                scale: 0.9,
                transition: { duration: 0.3, ease: 'easeIn' },
              }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute inset-x-0 top-0 bottom-0 rounded-3xl overflow-hidden flex flex-col"
              style={{
                background: 'linear-gradient(180deg, rgba(40,25,70,0.95), rgba(20,10,40,0.98))',
                border: `2px solid ${GOLD}35`,
                boxShadow: `0 12px 50px rgba(0,0,0,0.6), 0 0 30px ${GOLD}08`,
                zIndex: 20,
                transformOrigin: 'center center',
              }}
            >
              {/* Image area — takes up most of the card */}
              <div className="relative flex-1 min-h-0 overflow-hidden">
                {currentCard.image_url ? (
                  <img
                    src={currentCard.image_url}
                    alt={currentCard.word_en}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <ImageIcon size={64} className="text-gray-600" />
                  </div>
                )}

                {/* Play Video pill — top-right corner */}
                {currentCard.video_url && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowVideo(true); }}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full transition-all duration-200 hover:brightness-125 active:scale-95"
                    style={{
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(8px)',
                      border: `1.5px solid ${GOLD}50`,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    }}
                  >
                    <Video size={14} style={{ color: GOLD }} />
                    <span className="text-[11px] font-bold" style={{ color: GOLD_LIGHT }}>
                      {language === 'zh' ? '播放视频' : language === 'ms' ? 'Main Video' : 'Play Video'}
                    </span>
                  </button>
                )}

                {/* Swipe hint arrows during drag */}
                {dragX < -30 && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <ChevronRight size={40} className="text-white/50 animate-pulse" />
                  </div>
                )}
                {dragX > 30 && (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <ChevronLeft size={40} className="text-white/50 animate-pulse" />
                  </div>
                )}

                {/* Bottom gradient fade into content area */}
                <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(20,10,40,0.98), transparent)' }}
                />
              </div>

              {/* Word display — compact */}
              <div className="px-5 pt-3 pb-1 text-center shrink-0">
                <h1 className="text-2xl font-black text-white leading-tight">
                  {language === 'zh' ? currentCard.word_zh : language === 'ms' ? currentCard.word_bm : currentCard.word_en}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {language !== 'en' && currentCard.word_en}
                  {language !== 'zh' && language !== 'en' && ` · ${currentCard.word_zh}`}
                  {language === 'en' && `${currentCard.word_bm} · ${currentCard.word_zh}`}
                </p>
              </div>

              {/* Language audio buttons — balanced equal-width */}
              <div className="flex gap-2 px-4 pb-4 pt-2 shrink-0">
                <LangAudioButton
                  lang="en"
                  audioUrl={currentCard.audio_en_url}
                  word={currentCard.word_en}
                  isPlaying={playingLang === 'en'}
                  onPlay={() => playAudio('en')}
                />
                <LangAudioButton
                  lang="bm"
                  audioUrl={currentCard.audio_bm_url}
                  word={currentCard.word_bm}
                  isPlaying={playingLang === 'bm'}
                  onPlay={() => playAudio('bm')}
                />
                <LangAudioButton
                  lang="zh"
                  audioUrl={currentCard.audio_zh_url}
                  word={currentCard.word_zh}
                  isPlaying={playingLang === 'zh'}
                  onPlay={() => playAudio('zh')}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom nav — compact, out of the card area */}
      <div className="flex items-center justify-center gap-6 pb-6 pt-2 shrink-0">
        <button
          onClick={goPrev}
          disabled={currentIndex <= 0}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <ChevronLeft size={22} className="text-white" />
        </button>

        <p className="text-[11px] tracking-wide" style={{ color: `${PARCHMENT}50` }}>
          {language === 'zh' ? '左右滑动' : language === 'ms' ? 'Leret kiri/kanan' : 'Swipe to browse'}
        </p>

        <button
          onClick={goNext}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
          style={{
            background: currentIndex >= cards.length - 1 ? `${GOLD}30` : `${GOLD}20`,
            border: `1.5px solid ${GOLD}50`,
          }}
        >
          {currentIndex >= cards.length - 1 ? (
            <Trophy size={18} style={{ color: GOLD }} />
          ) : (
            <ChevronRight size={22} style={{ color: GOLD }} />
          )}
        </button>
      </div>

      {/* Video overlay */}
      <AnimatePresence>
        {showVideo && currentCard?.video_url && (
          <VideoOverlay
            videoUrl={currentCard.video_url}
            onClose={() => setShowVideo(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}