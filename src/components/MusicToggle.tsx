import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface MusicToggleProps {
  className?: string;
}

// Global audio element to persist across component re-renders/remounts
let globalAudio: HTMLAudioElement | null = null;
let globalIsPlaying = false;

const MUSIC_URL = 'https://zrtbjefoaennvtlcneal.supabase.co/storage/v1/object/public/music/Quest%20of%20the%20Little%20Stars.mp3';

export const MusicToggle: React.FC<MusicToggleProps> = ({ className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);

  // Initialize audio element once globally
  useEffect(() => {
    if (!globalAudio) {
      const audio = new Audio(MUSIC_URL);
      audio.loop = true;
      audio.volume = 0.25; // Low volume for background music
      audio.preload = 'metadata';
      globalAudio = audio;

      // Sync state if audio ends unexpectedly
      audio.addEventListener('pause', () => {
        if (!audio.loop) {
          globalIsPlaying = false;
        }
      });
    }

    // Sync local state with global state on mount
    setIsPlaying(globalIsPlaying);
  }, []);

  const toggleMusic = async () => {
    if (!globalAudio) return;

    if (isPlaying) {
      globalAudio.pause();
      globalIsPlaying = false;
      setIsPlaying(false);
    } else {
      try {
        await globalAudio.play();
        globalIsPlaying = true;
        setIsPlaying(true);
      } catch (err) {
        console.warn('Music playback failed (user interaction may be required):', err);
      }
    }
  };

  return (
    <button
      onClick={toggleMusic}
      className={`
        relative
        w-12 h-12 md:w-14 md:h-14
        rounded-full
        bg-gradient-to-b from-[#ffd43b] via-[#d4a017] to-[#b8860b]
        shadow-[0_6px_16px_rgba(212,160,23,0.4)]
        flex items-center justify-center
        transition-all duration-200
        active:scale-95
        hover:scale-110
        ${isPlaying ? 'animate-pulse' : ''}
        ${className}
      `}
      style={{
        boxShadow: '0 6px 16px rgba(212,160,23,0.4), inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.4)'
      }}
    >
      {isPlaying ? (
        <Volume2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
      ) : (
        <VolumeX className="w-6 h-6 md:w-7 md:h-7 text-white" />
      )}
      
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-transparent rounded-full" 
           style={{ height: '50%' }} />
      
      {/* Sound waves when playing */}
      {isPlaying && (
        <div className="absolute inset-0 rounded-full border-2 border-yellow-400/40 animate-pulse" />
      )}
    </button>
  );
};