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

      window.speechSynthesis.cancel();
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
        flex items-center justify-center
        transition-all duration-200
        active:scale-95
        ${isPlaying ? 'animate-pulse' : ''}
      `}
      style={{
        background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)',
        border: '3px solid #ffeaa7',
        boxShadow: isPlaying
          ? '0 0 20px rgba(212,164,74,0.6), inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.3)'
          : '0 4px 12px rgba(212,164,74,0.3), inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.3)',
      }}
    >
      <Volume2 className={`w-7 h-7 text-[#2a1f0e] ${isPlaying ? 'animate-pulse' : ''}`} />

      {/* Glossy overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent rounded-full"
        style={{ height: '50%' }}
      />

      {/* Pulsating gold waves when playing */}
      {isPlaying && (
        <>
          <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'rgba(212,164,74,0.4)' }} />
          <div className="absolute inset-0 rounded-full animate-ping opacity-15"
            style={{ background: 'rgba(212,164,74,0.3)', animationDelay: '0.2s' }} />
        </>
      )}
    </button>
  );
};
