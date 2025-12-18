'use client';

import { useState, useEffect, useCallback } from 'react';
import CommandPalette from './CommandPalette/CommandPalette';
import KeyboardShortcuts from './KeyboardShortcuts/KeyboardShortcuts';
import ToastContainer from './Toast/ToastContainer';
import MobileBottomNav from './MobileBottomNav';

interface GlobalUIProps {
  showMobileNav?: boolean;
}

export default function GlobalUI({ showMobileNav = true }: GlobalUIProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + K for command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsCommandPaletteOpen(true);
    }

    // ? for keyboard shortcuts (when not in input)
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
      e.preventDefault();
      setIsKeyboardShortcutsOpen(true);
    }

    // Escape to close modals
    if (e.key === 'Escape') {
      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      } else if (isKeyboardShortcutsOpen) {
        setIsKeyboardShortcutsOpen(false);
      }
    }
  }, [isCommandPaletteOpen, isKeyboardShortcutsOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Listen for custom events
  useEffect(() => {
    const handleOpenCommandPalette = () => setIsCommandPaletteOpen(true);
    const handleToggleKeyboardShortcuts = () => setIsKeyboardShortcutsOpen((prev) => !prev);

    window.addEventListener('open-command-palette', handleOpenCommandPalette);
    window.addEventListener('toggle-keyboard-shortcuts', handleToggleKeyboardShortcuts);

    return () => {
      window.removeEventListener('open-command-palette', handleOpenCommandPalette);
      window.removeEventListener('toggle-keyboard-shortcuts', handleToggleKeyboardShortcuts);
    };
  }, []);

  return (
    <>
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />

      {/* Toast Container */}
      <ToastContainer />

      {/* Mobile Bottom Navigation */}
      {showMobileNav && (
        <MobileBottomNav onMoreClick={() => setIsMobileMenuOpen(true)} />
      )}

      {/* Mobile More Menu */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[61] rounded-t-xl bg-white p-4 md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">More Options</h3>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MobileMenuItem href="/team" icon="team" label="Team" onClick={() => setIsMobileMenuOpen(false)} />
              <MobileMenuItem href="/approvals" icon="approvals" label="Approvals" onClick={() => setIsMobileMenuOpen(false)} />
              <MobileMenuItem href="/activity" icon="activity" label="Activity" onClick={() => setIsMobileMenuOpen(false)} />
              <MobileMenuItem href="/settings" icon="settings" label="Settings" onClick={() => setIsMobileMenuOpen(false)} />
              <MobileMenuItem
                href="#"
                icon="shortcuts"
                label="Shortcuts"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsKeyboardShortcutsOpen(true);
                }}
              />
              <MobileMenuItem
                href="#"
                icon="search"
                label="Search"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsCommandPaletteOpen(true);
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MobileMenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  const iconElement = {
    team: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    approvals: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activity: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    settings: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    shortcuts: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    search: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  }[icon];

  const handleClick = (e: React.MouseEvent) => {
    if (href === '#') {
      e.preventDefault();
    }
    onClick?.();
  };

  if (href === '#') {
    return (
      <button
        onClick={handleClick}
        className="flex flex-col items-center justify-center gap-2 rounded-lg bg-gray-50 p-4 text-gray-600 hover:bg-gray-100"
      >
        {iconElement}
        <span className="text-xs font-medium">{label}</span>
      </button>
    );
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="flex flex-col items-center justify-center gap-2 rounded-lg bg-gray-50 p-4 text-gray-600 hover:bg-gray-100"
    >
      {iconElement}
      <span className="text-xs font-medium">{label}</span>
    </a>
  );
}
