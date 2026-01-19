import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface VoiceButtonProps {
  text: string;
  language: 'en' | 'ms' | 'zh';
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ text, language }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      setIsPlaying(true);
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Map languages to speech synthesis voices
      const languageMap = {
        en: 'en-US',
        ms: 'ms-MY',
        zh: 'zh-CN'
      };
      
      utterance.lang = languageMap[language];
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <button
      onClick={handleSpeak}
      className={`
        relative
        w-14 h-14
        rounded-full
        bg-gradient-to-b from-[#c084fc] via-[#a855f7] to-[#9333ea]
        shadow-[0_6px_16px_rgba(168,85,247,0.4)]
        flex items-center justify-center
        transition-all duration-200
        active:scale-95
        ${isPlaying ? 'animate-pulse' : ''}
      `}
      style={{
        boxShadow: '0 6px 16px rgba(168,85,247,0.4), inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.4)'
      }}
    >
      <Volume2 className={`w-7 h-7 text-white ${isPlaying ? 'animate-pulse' : ''}`} />
      
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-transparent rounded-full" 
           style={{ height: '50%' }} />
      
      {/* Pulsating waves when playing */}
      {isPlaying && (
        <>
          <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-30" />
          <div className="absolute inset-0 rounded-full bg-purple-300 animate-ping opacity-20" 
               style={{ animationDelay: '0.2s' }} />
        </>
      )}
    </button>
  );
};
