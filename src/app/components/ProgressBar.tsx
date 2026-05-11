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
        <span
          className="text-sm font-bold tracking-wider uppercase"
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            color: '#c8b88a',
            textShadow: '0 0 8px rgba(200,184,138,0.3), 0 2px 4px rgba(0,0,0,0.6)',
          }}
        >
          Quest {current} of {total}
        </span>
      </div>

      <div
        className="relative h-5 rounded-full overflow-hidden"
        style={{
          background: 'rgba(42,31,14,0.6)',
          border: '2px solid rgba(212,164,74,0.35)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
        }}
      >
        {/* Progress fill — golden gradient */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #a67c2e 0%, #d4a44a 40%, #f0d078 60%, #d4a44a 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 0 10px rgba(212,164,74,0.4)',
            borderRight: progress > 3 ? '2px solid #ffeaa7' : 'none',
          }}
        />

        {/* Foxy icon at the end of progress */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: `calc(${Math.max(progress, 3)}% - 14px)` }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)',
              border: '2px solid #d4a44a',
              boxShadow: '0 0 10px rgba(212,164,74,0.5)',
            }}
          >
            <span className="text-sm">🦊</span>
          </div>
        </div>
      </div>
    </div>
  );
};