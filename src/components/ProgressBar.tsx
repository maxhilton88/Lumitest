import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const progress = (current / total) * 100;

  return (
    <div className="w-full px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
          Question {current} of {total}
        </span>
      </div>
      
      <div className="relative h-5 bg-white/40 rounded-full overflow-hidden backdrop-blur-sm border-2 border-white/60">
        {/* Progress fill */}
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ffd43b] to-[#ffe066] transition-all duration-500 ease-out border-r-4 border-[#d4a017]"
          style={{ width: `${progress}%` }}
        />
        
        {/* Foxy icon at the end of progress */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: `calc(${progress}% - 14px)` }}
        >
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg border-2 border-[#ffd43b]">
            <span className="text-sm">🦊</span>
          </div>
        </div>
      </div>
    </div>
  );
};