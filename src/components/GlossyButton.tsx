import React from 'react';

interface GlossyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  color?: 'white' | 'green' | 'blue' | 'yellow' | 'brown' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const colorStyles = {
  white: 'bg-white text-[#3d7c54] border-4 border-white shadow-[0_6px_0_#d0d0d0]',
  green: 'bg-[#7cc643] text-white border-4 border-[#9ed963] shadow-[0_6px_0_#5a9431]',
  blue: 'bg-[#4dabf7] text-white border-4 border-[#74c0fc] shadow-[0_6px_0_#2b8bd6]',
  yellow: 'bg-[#ffd43b] text-[#5d4037] border-4 border-[#ffe066] shadow-[0_6px_0_#ddb220]',
  brown: 'bg-[#6d4c41] text-white border-4 border-[#8d6e63] shadow-[0_6px_0_#4e342e]',
  gold: 'bg-gradient-to-r from-[#d4a44a] via-[#f0d078] to-[#d4a44a] text-[#2a1f0e] border-4 border-[#ffeaa7] shadow-[0_6px_0_#a67c2e]',
};

const sizeStyles = {
  sm: 'px-6 py-2 text-base',
  md: 'px-10 py-4 text-lg',
  lg: 'px-12 py-5 text-xl'
};

export const GlossyButton: React.FC<GlossyButtonProps> = ({
  children,
  onClick,
  color = 'white',
  size = 'md',
  className = '',
  disabled = false,
  icon
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative
        ${colorStyles[color]}
        ${sizeStyles[size]}
        rounded-full
        font-black
        uppercase
        tracking-wide
        transition-all
        duration-150
        active:translate-y-1
        active:shadow-[0_3px_0_#a0a0a0]
        disabled:opacity-50
        disabled:cursor-not-allowed
        flex items-center justify-center gap-3
        ${className}
      `}
    >
      {icon && <span className="text-2xl">{icon}</span>}
      <span className="relative z-10">
        {children}
      </span>
    </button>
  );
};