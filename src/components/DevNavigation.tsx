import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type UserType = 'child' | 'kindergarten' | 'superadmin';

interface DevNavigationProps {
  currentUserType: UserType;
  onSwitchUserType: (userType: UserType) => void;
}

export const DevNavigation: React.FC<DevNavigationProps> = ({
  currentUserType,
  onSwitchUserType
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const userTypes = [
    { type: 'child' as UserType, label: 'Child/Parent', icon: '👦', color: 'from-[#7cc643] to-[#3d7c54]' },
    { type: 'kindergarten' as UserType, label: 'Kindergarten', icon: '🏫', color: 'from-[#ffd43b] to-[#d4a017]' },
    { type: 'superadmin' as UserType, label: 'Super Admin', icon: '👨‍💼', color: 'from-[#6d4c41] to-[#5d4037]' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu Panel */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border-4 border-white mb-2 animate-in slide-in-from-bottom-4 duration-300">
          <div className="space-y-2 min-w-[200px]">
            <div className="text-xs font-black text-[#2d5f3f] uppercase tracking-wide mb-3 px-2">
              Dev Mode - Switch User
            </div>
            {userTypes.map((user) => (
              <button
                key={user.type}
                onClick={() => {
                  onSwitchUserType(user.type);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-2xl font-bold transition-all
                  ${currentUserType === user.type
                    ? `bg-gradient-to-r ${user.color} text-white shadow-lg scale-105`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                <span className="text-2xl">{user.icon}</span>
                <span className="text-sm">{user.label}</span>
                {currentUserType === user.type && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-16 h-16 rounded-full 
          bg-gradient-to-br from-[#6d4c41] to-[#5d4037]
          text-white
          shadow-[0_6px_0_#4e342e,0_0_20px_rgba(109,76,65,0.5)]
          hover:shadow-[0_4px_0_#4e342e,0_0_30px_rgba(109,76,65,0.7)]
          active:translate-y-1
          active:shadow-[0_3px_0_#4e342e]
          transition-all duration-150
          flex items-center justify-center
          border-4 border-[#8d6e63]
          group
        `}
      >
        {isOpen ? (
          <X className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
        ) : (
          <Menu className="w-7 h-7 group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Label */}
      {!isOpen && (
        <div className="absolute -top-2 right-0 bg-[#5d4037] text-white text-xs font-black px-2 py-1 rounded-full whitespace-nowrap">
          DEV MODE
        </div>
      )}
    </div>
  );
};
