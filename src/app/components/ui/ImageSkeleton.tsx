/**
 * ImageSkeleton — shimmer placeholder shown while R2 images load.
 * Renders the same dimensions as the final image so layout doesn't shift.
 */
import React from 'react';

interface Props {
  className?: string;
}

export function ImageSkeleton({ className = '' }: Props) {
  return (
    <div
      className={`bg-gray-100 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
