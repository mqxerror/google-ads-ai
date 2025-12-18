/**
 * Centralized Keyboard Shortcut Manager
 *
 * Handles platform detection and provides utilities for displaying
 * and managing keyboard shortcuts across the application.
 */

export type Platform = 'mac' | 'windows' | 'linux';

// Detect the current platform
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'mac'; // SSR default

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac';
  }
  if (platform.includes('win') || userAgent.includes('win')) {
    return 'windows';
  }
  return 'linux';
}

// Key symbol mappings per platform
const keySymbols: Record<Platform, Record<string, string>> = {
  mac: {
    cmd: '⌘',
    ctrl: '⌃',
    alt: '⌥',
    shift: '⇧',
    enter: '↵',
    backspace: '⌫',
    delete: '⌦',
    escape: 'Esc',
    tab: '⇥',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    space: '␣',
  },
  windows: {
    cmd: 'Ctrl',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    enter: 'Enter',
    backspace: 'Backspace',
    delete: 'Delete',
    escape: 'Esc',
    tab: 'Tab',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    space: 'Space',
  },
  linux: {
    cmd: 'Ctrl',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    enter: 'Enter',
    backspace: 'Backspace',
    delete: 'Delete',
    escape: 'Esc',
    tab: 'Tab',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    space: 'Space',
  },
};

/**
 * Format a keyboard shortcut for display
 * @param keys Array of key identifiers (e.g., ['cmd', 'shift', 'z'])
 * @param platform Optional platform override
 * @returns Formatted shortcut string (e.g., "⌘⇧Z" on Mac, "Ctrl+Shift+Z" on Windows)
 */
export function formatShortcut(keys: string[], platform?: Platform): string {
  const p = platform || detectPlatform();
  const symbols = keySymbols[p];
  const separator = p === 'mac' ? '' : '+';

  return keys
    .map(key => {
      const lower = key.toLowerCase();
      return symbols[lower] || key.toUpperCase();
    })
    .join(separator);
}

/**
 * Check if the modifier key matches the platform's primary modifier
 * (Cmd on Mac, Ctrl on Windows/Linux)
 */
export function isPrimaryModifier(event: KeyboardEvent): boolean {
  const platform = detectPlatform();
  return platform === 'mac' ? event.metaKey : event.ctrlKey;
}

// Shortcut definition interface
export interface ShortcutDefinition {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action: () => void;
  enabled?: boolean;
  // Conditions
  requiresInput?: boolean; // Only trigger when in an input field
  excludeInput?: boolean;  // Don't trigger when in an input field (default: true)
}

// Shortcut registry
const shortcutRegistry: Map<string, ShortcutDefinition> = new Map();

/**
 * Register a keyboard shortcut
 */
export function registerShortcut(shortcut: ShortcutDefinition): () => void {
  shortcutRegistry.set(shortcut.id, {
    ...shortcut,
    excludeInput: shortcut.excludeInput ?? true,
  });

  // Return unregister function
  return () => {
    shortcutRegistry.delete(shortcut.id);
  };
}

/**
 * Unregister a keyboard shortcut
 */
export function unregisterShortcut(id: string): void {
  shortcutRegistry.delete(id);
}

/**
 * Get all registered shortcuts
 */
export function getRegisteredShortcuts(): ShortcutDefinition[] {
  return Array.from(shortcutRegistry.values());
}

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const shortcuts = getRegisteredShortcuts();
  const grouped: Record<string, ShortcutDefinition[]> = {};

  shortcuts.forEach(shortcut => {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  });

  return grouped;
}

/**
 * Convert KeyboardEvent to a key combination string
 */
function eventToKeyCombo(event: KeyboardEvent): string {
  const keys: string[] = [];

  if (event.metaKey) keys.push('cmd');
  if (event.ctrlKey && detectPlatform() !== 'mac') keys.push('ctrl');
  if (event.altKey) keys.push('alt');
  if (event.shiftKey) keys.push('shift');

  // Add the actual key (normalized)
  const key = event.key.toLowerCase();
  if (!['meta', 'control', 'alt', 'shift'].includes(key)) {
    keys.push(key);
  }

  return keys.join('+');
}

/**
 * Convert shortcut definition keys to a comparable string
 */
function shortcutToKeyCombo(keys: string[]): string {
  const platform = detectPlatform();
  return keys
    .map(k => {
      const lower = k.toLowerCase();
      // Normalize cmd/ctrl based on platform
      if (lower === 'cmd' && platform !== 'mac') return 'ctrl';
      if (lower === 'ctrl' && platform === 'mac') return 'cmd';
      return lower;
    })
    .sort()
    .join('+');
}

/**
 * Check if an element is an input field
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toUpperCase();
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    (element as HTMLElement).isContentEditable
  );
}

/**
 * Global keyboard event handler
 */
function handleGlobalKeyDown(event: KeyboardEvent): void {
  const eventCombo = eventToKeyCombo(event);
  const isInput = isInputElement(document.activeElement);

  for (const shortcut of shortcutRegistry.values()) {
    if (shortcut.enabled === false) continue;

    // Check input conditions
    if (shortcut.excludeInput && isInput) continue;
    if (shortcut.requiresInput && !isInput) continue;

    const shortcutCombo = shortcutToKeyCombo(shortcut.keys);

    // Sort eventCombo keys for comparison
    const sortedEventCombo = eventCombo.split('+').sort().join('+');

    if (sortedEventCombo === shortcutCombo) {
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
      return;
    }
  }
}

// Track if listener is attached
let listenerAttached = false;

/**
 * Initialize the global keyboard shortcut listener
 * Call this once in your app's root component
 */
export function initKeyboardShortcuts(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (!listenerAttached) {
    window.addEventListener('keydown', handleGlobalKeyDown);
    listenerAttached = true;
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleGlobalKeyDown);
    listenerAttached = false;
  };
}

// Pre-defined shortcuts for the application
export const APP_SHORTCUTS = {
  COMMAND_PALETTE: { keys: ['cmd', 'k'], description: 'Open command palette' },
  KEYBOARD_SHORTCUTS: { keys: ['?'], description: 'Show keyboard shortcuts' },
  UNDO: { keys: ['cmd', 'z'], description: 'Undo' },
  REDO: { keys: ['cmd', 'shift', 'z'], description: 'Redo' },
  SAVE: { keys: ['cmd', 's'], description: 'Save changes' },
  SEARCH: { keys: ['/'], description: 'Focus search' },
  ESCAPE: { keys: ['escape'], description: 'Close dialog / deselect' },

  // Navigation
  GO_DASHBOARD: { keys: ['g', 'd'], description: 'Go to Dashboard' },
  GO_CAMPAIGNS: { keys: ['g', 'c'], description: 'Go to Campaigns' },
  GO_REPORTS: { keys: ['g', 'r'], description: 'Go to Reports' },
  GO_AUTOMATION: { keys: ['g', 'a'], description: 'Go to Automation' },
  GO_TEAM: { keys: ['g', 't'], description: 'Go to Team' },
  GO_APPROVALS: { keys: ['g', 'p'], description: 'Go to Approvals' },
  GO_SETTINGS: { keys: ['g', 's'], description: 'Go to Settings' },

  // Actions
  NEW_CAMPAIGN: { keys: ['n', 'c'], description: 'New Campaign' },
  NEW_RULE: { keys: ['n', 'r'], description: 'New Rule' },
  TOGGLE_FILTERS: { keys: ['f'], description: 'Toggle filters panel' },
  SELECT_ALL: { keys: ['cmd', 'a'], description: 'Select all' },
} as const;
