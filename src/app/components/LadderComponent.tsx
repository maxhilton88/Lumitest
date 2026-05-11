import React from 'react';

interface LadderComponentProps {
  score: number; // 0-100
  nationalAverage?: number; // 0-100
}

const gold = '#d4a44a';
const goldLight = '#ffeaa7';
const darkBg = 'rgba(30,22,12,0.92)';

export const LadderComponent: React.FC<LadderComponentProps> = ({
  score,
  nationalAverage = 60
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h3
        className="text-2xl md:text-3xl font-bold text-center mb-8"
        style={{
          fontFamily: "'Cinzel Decorative', serif",
          background: 'linear-gradient(180deg, #ffeaa7 0%, #d4a44a 40%, #c6872e 70%, #ffeaa7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 10px rgba(212,164,74,0.4)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
        }}
      >
        Your Progress Ladder
      </h3>

      <div
        className="relative h-96 rounded-2xl p-6"
        style={{
          background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
          border: `2px solid ${gold}44`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Ladder rungs */}
        <div className="absolute inset-x-6 top-0 h-full flex flex-col justify-between py-8">
          {/* Advanced */}
          <div className="relative">
            <div
              className="h-16 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7cc643 0%, #9ed963 100%)',
                border: '3px solid #9ed96388',
                boxShadow: '0 0 15px rgba(124,198,67,0.3)',
              }}
            >
              <span className="text-white font-black text-lg drop-shadow-md">Advanced</span>
            </div>
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-full" style={{ height: '120%', background: `${gold}44` }} />
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-full" style={{ height: '120%', background: `${gold}44` }} />
          </div>

          {/* Ready for School */}
          <div className="relative">
            <div
              className="h-16 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${gold} 0%, #f0d078 100%)`,
                border: `3px solid ${goldLight}88`,
                boxShadow: `0 0 15px ${gold}33`,
              }}
            >
              <span className="text-[#2a1f0e] font-black text-lg">Ready</span>
            </div>
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-full" style={{ height: '120%', background: `${gold}44` }} />
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-full" style={{ height: '120%', background: `${gold}44` }} />
          </div>

          {/* Developing */}
          <div className="relative">
            <div
              className="h-16 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #4dabf7 0%, #74c0fc 100%)',
                border: '3px solid #74c0fc88',
                boxShadow: '0 0 15px rgba(77,171,247,0.3)',
              }}
            >
              <span className="text-white font-black text-lg drop-shadow-md">Developing</span>
            </div>
          </div>
        </div>

        {/* Child avatar */}
        <div
          className="absolute transition-all duration-1000 ease-out"
          style={{
            bottom: `${score}%`,
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        >
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center animate-bounce"
              style={{
                background: `linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)`,
                border: `4px solid ${gold}`,
                boxShadow: `0 0 20px ${gold}55, 0 8px 24px rgba(0,0,0,0.4)`,
              }}
            >
              <span className="text-4xl">👦</span>
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <div
                className="px-3 py-1 rounded-full font-black text-sm"
                style={{
                  background: `linear-gradient(135deg, ${gold}, #f0d078)`,
                  color: '#2a1f0e',
                  border: `2px solid ${goldLight}`,
                  boxShadow: `0 0 10px ${gold}44`,
                }}
              >
                {score}%
              </div>
            </div>
          </div>
        </div>

        {/* National Average indicator */}
        <div
          className="absolute right-0 transition-all duration-1000 ease-out"
          style={{ bottom: `${nationalAverage}%` }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-0 h-0"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: `8px solid ${gold}88`,
              }}
            />
            <div
              className="px-2 py-1 rounded text-xs font-black whitespace-nowrap"
              style={{
                background: `${gold}dd`,
                color: '#2a1f0e',
                boxShadow: `0 0 8px ${gold}33`,
              }}
            >
              Avg: {nationalAverage}%
            </div>
          </div>
        </div>
      </div>

      {/* Score comparison */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: darkBg,
            border: '2px solid #7cc64366',
            boxShadow: '0 0 12px rgba(124,198,67,0.15)',
          }}
        >
          <div className="text-3xl font-black" style={{ color: '#7cc643' }}>{score}%</div>
          <div className="text-sm font-bold" style={{ color: '#c8b88a' }}>Your Score</div>
        </div>
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: darkBg,
            border: `2px solid ${gold}44`,
            boxShadow: `0 0 12px ${gold}15`,
          }}
        >
          <div className="text-3xl font-black" style={{ color: gold }}>{nationalAverage}%</div>
          <div className="text-sm font-bold" style={{ color: '#c8b88a' }}>National Avg</div>
        </div>
      </div>
    </div>
  );
};