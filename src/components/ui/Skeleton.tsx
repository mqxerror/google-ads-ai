'use client';

import React from 'react';

export interface SkeletonProps {
  /**
   * Width of the skeleton element
   */
  width?: string | number;
  /**
   * Height of the skeleton element
   */
  height?: string | number;
  /**
   * Border radius - can be predefined or custom
   */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /**
   * Animation type
   */
  animation?: 'pulse' | 'wave' | 'none';
  /**
   * Custom class name
   */
  className?: string;
}

/**
 * Reusable Skeleton component for loading states
 * Supports pulse and shimmer (wave) animations
 */
export function Skeleton({
  width,
  height = '1rem',
  variant = 'text',
  animation = 'pulse',
  className = '',
}: SkeletonProps) {
  // Determine border radius based on variant
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  // Animation classes
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]',
    none: '',
  };

  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`
        bg-gray-200
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={{
        width: widthStyle,
        height: heightStyle,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton variant for text lines
 */
export function SkeletonText({
  lines = 1,
  className = '',
  animation = 'pulse',
}: {
  lines?: number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '80%' : '100%'}
          height="0.875rem"
          variant="text"
          animation={animation}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton variant for avatar/circular elements
 */
export function SkeletonAvatar({
  size = 40,
  className = '',
  animation = 'pulse',
}: {
  size?: number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      variant="circular"
      animation={animation}
      className={className}
    />
  );
}

/**
 * Skeleton variant for buttons
 */
export function SkeletonButton({
  width = 100,
  height = 36,
  className = '',
  animation = 'pulse',
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      variant="rounded"
      animation={animation}
      className={className}
    />
  );
}

/**
 * Skeleton variant for cards
 */
export function SkeletonCard({
  className = '',
  animation = 'pulse',
}: {
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex items-start gap-4">
        <SkeletonAvatar size={48} animation={animation} />
        <div className="flex-1 space-y-3">
          <Skeleton width="60%" height="1.25rem" animation={animation} />
          <SkeletonText lines={2} animation={animation} />
          <div className="flex gap-2 pt-2">
            <SkeletonButton width={80} height={32} animation={animation} />
            <SkeletonButton width={80} height={32} animation={animation} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton variant for table rows
 */
export function SkeletonTableRow({
  columns = 5,
  className = '',
  animation = 'pulse',
}: {
  columns?: number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton
            width={i === 0 ? '60%' : i === 1 ? '40%' : '80%'}
            height="1rem"
            animation={animation}
          />
        </td>
      ))}
    </tr>
  );
}
