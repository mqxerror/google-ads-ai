'use client';

import { useState } from 'react';
import { Platform, detectPlatform, formatShortcut } from '@/lib/keyboard-shortcuts';

/**
 * Safely detect platform (SSR-compatible)
 */
function getInitialPlatform(): Platform {
  if (typeof window === 'undefined') return 'mac';
  return detectPlatform();
}

/**
 * Hook to detect and use the current platform
 * Returns platform info and utilities for displaying platform-specific content
 */
export function usePlatform() {
  // Initialize with detected platform (using initializer function)
  const [platform] = useState<Platform>(getInitialPlatform);
  const isClient = typeof window !== 'undefined';

  const isMac = platform === 'mac';
  const isWindows = platform === 'windows';
  const isLinux = platform === 'linux';

  // Get the primary modifier key name
  const primaryModifier = isMac ? '⌘' : 'Ctrl';

  // Format a shortcut for the current platform
  const format = (keys: string[]) => formatShortcut(keys, platform);

  return {
    platform,
    isClient,
    isMac,
    isWindows,
    isLinux,
    primaryModifier,
    formatShortcut: format,
  };
}

export default usePlatform;
