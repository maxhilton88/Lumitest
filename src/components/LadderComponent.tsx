import React from 'react';

interface LadderComponentProps {
  score: number; // 0-100
  nationalAverage?: number; // 0-100
}

export const LadderComponent: React.FC<LadderComponentProps> = ({ 
  score, 
  nationalAverage = 60 
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h3 className="text-3xl font-black text-center mb-8 text-white drop-shadow-lg">
        Your Progress Ladder
      </h3>
      
      <div className="relative h-96 bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-2xl border-4 border-white">
        {/* Ladder rungs */}
        <div className="absolute inset-x-6 top-0 h-full flex flex-col justify-between py-8">
          {/* Advanced */}
          <div className="relative">
            <div className="h-16 bg-gradient-to-r from-[#7cc643] to-[#9ed963] rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
              <span className="text-white font-black text-lg drop-shadow-md">🌟 Advanced</span>
            </div>
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#6d4c41]" style={{ height: '120%' }} />
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#6d4c41]" style={{ height: '120%' }} />
          </div>
          
          {/* Ready for School */}
          <div className="relative">
            <div className="h-16 bg-gradient-to-r from-[#ffd43b] to-[#ffe066] rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
              <span className="text-[#5d4037] font-black text-lg drop-shadow-md">📚 Ready</span>
            </div>
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#6d4c41]" style={{ height: '120%' }} />
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#6d4c41]" style={{ height: '120%' }} />
          </div>
          
          {/* Developing */}
          <div className="relative">
            <div className="h-16 bg-gradient-to-r from-[#4dabf7] to-[#74c0fc] rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
              <span className="text-white font-black text-lg drop-shadow-md">🌱 Developing</span>
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
            <div className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-[#7cc643] animate-bounce">
              <span className="text-4xl">👦</span>
            </div>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <div className="bg-[#3d7c54] text-white px-3 py-1 rounded-full font-black text-sm shadow-lg">
                {score}%
              </div>
            </div>
          </div>
        </div>
        
        {/* National Average indicator */}
        <div 
          className="absolute right-0 transition-all duration-1000 ease-out"
          style={{ 
            bottom: `${nationalAverage}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-[#6d4c41]" />
            <div className="bg-[#6d4c41] text-white px-2 py-1 rounded text-xs font-black whitespace-nowrap">
              Avg: {nationalAverage}%
            </div>
          </div>
        </div>
      </div>
      
      {/* Score comparison */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 text-center border-4 border-[#7cc643]">
          <div className="text-3xl font-black text-[#3d7c54]">{score}%</div>
          <div className="text-sm text-[#2d5f3f] font-bold">Your Score</div>
        </div>
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 text-center border-4 border-[#6d4c41]">
          <div className="text-3xl font-black text-[#5d4037]">{nationalAverage}%</div>
          <div className="text-sm text-[#5d4037] font-bold">National Avg</div>
        </div>
      </div>
    </div>
  );
};