/**
 * MusicToggle — Floating RPG-styled music toggle button.
 *
 * Uses the centralized music-service.ts (single audio element).
 * Shows Volume2 when playing, VolumeX when muted.
 * Gold coin-shaped button matching the Foxy Adventure RPG aesthetic.
 */
import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  isMusicPlaying,
  toggleMusic,
  subscribe as subscribeMusicState,
} from '../utils/music-service';

interface MusicToggleProps {
  className?: string;
}

const GOLD = '#d4a44a';

export const MusicToggle: React.FC<MusicToggleProps> = ({ className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(isMusicPlaying());

  // Subscribe to music-service state so the icon stays in sync
  useEffect(() => {
    return subscribeMusicState((playing) => {
      setIsPlaying(playing);
    });
  }, []);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleMusic();
      }}
      className={`
        relative
        w-11 h-11
        rounded-full
        flex items-center justify-center
        transition-all duration-200
        active:scale-90
        hover:scale-110
        ${isPlaying ? 'animate-pulse' : ''}
        ${className}
      `}
      style={{
        background: isPlaying
          ? `linear-gradient(135deg, #ffd43b 0%, ${GOLD} 50%, #b8860b 100%)`
          : 'rgba(42,31,14,0.85)',
        border: `2px solid ${isPlaying ? '#ffeaa7' : `${GOLD}50`}`,
        boxShadow: isPlaying
          ? `0 4px 14px rgba(212,160,23,0.45), inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.35)`
          : `0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,184,138,0.1)`,
      }}
      aria-label={isPlaying ? 'Mute music' : 'Play music'}
    >
      {isPlaying ? (
        <Volume2 className="w-5 h-5 text-white drop-shadow-sm" />
      ) : (
        <VolumeX className="w-5 h-5" style={{ color: `${GOLD}90` }} />
      )}

      {/* Glossy highlight */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.35) 0%, transparent 50%)',
          height: '50%',
          borderRadius: '9999px',
        }}
      />

      {/* Pulse ring when playing */}
      {isPlaying && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            border: `2px solid ${GOLD}30`,
            animationDuration: '2s',
          }}
        />
      )}
    </button>
  );
};
