'use client';

import { useState, useEffect } from 'react';
import { Platform, detectPlatform, formatShortcut } from '@/lib/keyboard-shortcuts';

/**
 * Hook to detect and use the current platform
 * Returns platform info and utilities for displaying platform-specific content
 */
export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>('mac');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setPlatform(detectPlatform());
  }, []);

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
