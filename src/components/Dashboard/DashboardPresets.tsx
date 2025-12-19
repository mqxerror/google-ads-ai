'use client';

import { useState, useRef, useEffect } from 'react';
import { useDashboard, DashboardPreset, PRESET_INFO } from '@/contexts/DashboardContext';

export default function DashboardPresets() {
  const { currentPreset, applyPreset } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presets: DashboardPreset[] = ['default', 'executive', 'operator', 'growth', 'qa'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface2)] hover:bg-[var(--surface3)] text-[var(--text)] text-sm font-medium transition-colors"
      >
        <span>{PRESET_INFO[currentPreset].icon}</span>
        <span>{PRESET_INFO[currentPreset].label}</span>
        <svg
          className={`w-4 h-4 text-[var(--text3)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--surface)] shadow-lg border border-[var(--divider)] overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-[var(--divider)]">
            <p className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wide">
              Dashboard Views
            </p>
          </div>
          <div className="py-1">
            {presets.map((preset) => {
              const info = PRESET_INFO[preset];
              const isActive = preset === currentPreset;
              return (
                <button
                  key={preset}
                  onClick={() => {
                    applyPreset(preset);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'hover:bg-[var(--surface2)] text-[var(--text)]'
                  }`}
                >
                  <span className="text-lg">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                      {info.label}
                    </p>
                    <p className="text-xs text-[var(--text3)] truncate">
                      {info.description}
                    </p>
                  </div>
                  {isActive && (
                    <svg className="w-4 h-4 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
