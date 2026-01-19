import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]',
    none: ''
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'circular' ? width : undefined)
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton patterns
export const TableRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-6 py-4"><Skeleton width="80%" height={16} /></td>
      <td className="px-6 py-4"><Skeleton width="70%" height={16} /></td>
      <td className="px-6 py-4"><Skeleton width="60%" height={16} /></td>
      <td className="px-6 py-4"><Skeleton width="50%" height={16} /></td>
      <td className="px-6 py-4"><Skeleton width="40%" height={16} /></td>
      <td className="px-6 py-4">
        <div className="flex gap-2">
          <Skeleton width={80} height={32} />
          <Skeleton width={80} height={32} />
        </div>
      </td>
    </tr>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <Skeleton width="40%" height={24} className="mb-4" />
      <Skeleton width="100%" height={16} className="mb-2" />
      <Skeleton width="90%" height={16} className="mb-2" />
      <Skeleton width="80%" height={16} className="mb-4" />
      <div className="flex gap-2">
        <Skeleton width={100} height={36} />
        <Skeleton width={100} height={36} />
      </div>
    </div>
  );
};

export const ListItemSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton width="60%" height={20} className="mb-2" />
        <Skeleton width="40%" height={16} />
      </div>
      <Skeleton width={80} height={32} />
    </div>
  );
};

export const QuestionBankSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton width="30%" height={20} />
            <Skeleton width={60} height={24} />
          </div>
          <Skeleton width="100%" height={16} className="mb-2" />
          <Skeleton width="80%" height={16} className="mb-3" />
          <div className="flex gap-2">
            <Skeleton width={80} height={32} />
            <Skeleton width={80} height={32} />
            <Skeleton width={80} height={32} />
          </div>
        </div>
      ))}
    </div>
  );
};
