import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface MusicToggleProps {
  className?: string;
}

// Global state to ensure only one music instance plays across all components
let globalAudioContext: AudioContext | null = null;
let globalGainNode: GainNode | null = null;
let globalIsPlaying = false;
let globalMelodyTimeout: NodeJS.Timeout | null = null;
let globalBassTimeout: NodeJS.Timeout | null = null;

export const MusicToggle: React.FC<MusicToggleProps> = ({ className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  // Initialize audio context once globally
  useEffect(() => {
    if (!globalAudioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = 0.15; // Low volume for background music
      
      globalAudioContext = ctx;
      globalGainNode = gain;
    }

    // Cleanup on unmount
    return () => {
      // Don't close the global context - other instances might be using it
    };
  }, []);

  const clearAllLoops = () => {
    // Clear all setTimeout loops
    if (globalMelodyTimeout) {
      clearTimeout(globalMelodyTimeout);
      globalMelodyTimeout = null;
    }
    if (globalBassTimeout) {
      clearTimeout(globalBassTimeout);
      globalBassTimeout = null;
    }
  };

  const stopAllOscillators = () => {
    oscillatorsRef.current.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    oscillatorsRef.current = [];
  };

  const playBackgroundMusic = () => {
    if (!globalAudioContext || !globalGainNode) return;

    // Clear any existing loops first
    clearAllLoops();
    stopAllOscillators();

    // Create a simple, cheerful melody loop
    const melody = [
      { freq: 523.25, duration: 0.5 }, // C5
      { freq: 587.33, duration: 0.5 }, // D5
      { freq: 659.25, duration: 0.5 }, // E5
      { freq: 523.25, duration: 0.5 }, // C5
      { freq: 659.25, duration: 0.5 }, // E5
      { freq: 523.25, duration: 0.5 }, // C5
      { freq: 587.33, duration: 1.0 }, // D5
    ];

    const bass = [
      { freq: 130.81, duration: 2.0 }, // C3
      { freq: 146.83, duration: 2.0 }, // D3
    ];

    // Play melody in loop
    const playMelodyLoop = () => {
      if (!globalIsPlaying) return; // Stop if music was turned off
      
      let time = globalAudioContext!.currentTime;
      
      melody.forEach((note) => {
        const osc = globalAudioContext!.createOscillator();
        const noteGain = globalAudioContext!.createGain();
        
        osc.connect(noteGain);
        noteGain.connect(globalGainNode!);
        
        osc.frequency.value = note.freq;
        osc.type = 'sine';
        
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(0.3, time + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.01, time + note.duration);
        
        osc.start(time);
        osc.stop(time + note.duration);
        
        oscillatorsRef.current.push(osc);
        time += note.duration;
      });

      // Loop the melody only if still playing
      if (globalIsPlaying) {
        globalMelodyTimeout = setTimeout(playMelodyLoop, 3500);
      }
    };

    // Play bass in loop
    const playBassLoop = () => {
      if (!globalIsPlaying) return; // Stop if music was turned off
      
      let time = globalAudioContext!.currentTime;
      
      bass.forEach((note) => {
        const osc = globalAudioContext!.createOscillator();
        const noteGain = globalAudioContext!.createGain();
        
        osc.connect(noteGain);
        noteGain.connect(globalGainNode!);
        
        osc.frequency.value = note.freq;
        osc.type = 'triangle';
        
        noteGain.gain.setValueAtTime(0.2, time);
        noteGain.gain.exponentialRampToValueAtTime(0.01, time + note.duration);
        
        osc.start(time);
        osc.stop(time + note.duration);
        
        oscillatorsRef.current.push(osc);
        time += note.duration;
      });

      // Loop the bass only if still playing
      if (globalIsPlaying) {
        globalBassTimeout = setTimeout(playBassLoop, 4000);
      }
    };

    playMelodyLoop();
    playBassLoop();
  };

  const stopBackgroundMusic = () => {
    globalIsPlaying = false;
    
    // Clear all setTimeout loops
    clearAllLoops();
    
    // Stop all oscillators
    stopAllOscillators();
  };

  const toggleMusic = () => {
    if (isPlaying) {
      stopBackgroundMusic();
      setIsPlaying(false);
      globalIsPlaying = false;
    } else {
      globalIsPlaying = true;
      setIsPlaying(true);
      playBackgroundMusic();
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
        <>
          <div className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-30" />
          <div className="absolute inset-0 rounded-full bg-yellow-300 animate-ping opacity-20" 
               style={{ animationDelay: '0.3s' }} />
        </>
      )}
    </button>
  );
};
