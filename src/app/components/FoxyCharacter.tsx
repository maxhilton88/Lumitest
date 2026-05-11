import React from 'react';

interface FoxyCharacterProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  position?: 'left' | 'right';
}

export const FoxyCharacter: React.FC<FoxyCharacterProps> = ({
  size = 'md',
  message,
  position = 'left'
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  };

  return (
    <>
      {/* Speech bubble */}
      {message && (
        <div className="relative max-w-xs">
          {/* Bubble tail */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 
                         border-l-8 border-r-8 border-b-8 
                         border-l-transparent border-r-transparent border-b-orange-300" />
        </div>
      )}
    </>
  );
};