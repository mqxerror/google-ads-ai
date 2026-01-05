'use client';

import React, { useState } from 'react';
import { LOCATIONS, LOCATION_PRESETS, type LocationInfo } from '@/constants/campaign';

interface LocationTargetingProps {
  selected: string[];
  onChange: (locations: string[]) => void;
  mode?: 'chips' | 'dropdown' | 'both';
  maxSelections?: number;
  label?: string;
  className?: string;
}

/**
 * Reusable location targeting selector
 * Use in: Search, PMax, Display, Demand Gen, Video campaigns
 */
export function LocationTargeting({
  selected,
  onChange,
  mode = 'both',
  maxSelections,
  label = 'Target Locations',
  className = '',
}: LocationTargetingProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const toggleLocation = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((l) => l !== code));
    } else {
      if (maxSelections && selected.length >= maxSelections) return;
      onChange([...selected, code]);
    }
  };

  const applyPreset = (presetCodes: string[]) => {
    onChange(presetCodes);
  };

  const filteredLocations = LOCATIONS.filter((loc) =>
    loc.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected location labels
  const selectedLabels = selected
    .map((code) => LOCATIONS.find((l) => l.code === code)?.label)
    .filter(Boolean);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text mb-2">
        {label}
      </label>

      <div className="space-y-3">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset(LOCATION_PRESETS.northAmerica)}
            className="px-3 py-1 text-xs bg-surface2 border border-divider rounded-full hover:border-accent transition-colors"
          >
            North America
          </button>
          <button
            type="button"
            onClick={() => applyPreset(LOCATION_PRESETS.europe)}
            className="px-3 py-1 text-xs bg-surface2 border border-divider rounded-full hover:border-accent transition-colors"
          >
            Europe
          </button>
          <button
            type="button"
            onClick={() => applyPreset(LOCATION_PRESETS.englishSpeaking)}
            className="px-3 py-1 text-xs bg-surface2 border border-divider rounded-full hover:border-accent transition-colors"
          >
            English Speaking
          </button>
          <button
            type="button"
            onClick={() => applyPreset(LOCATION_PRESETS.worldwide)}
            className="px-3 py-1 text-xs bg-surface2 border border-divider rounded-full hover:border-accent transition-colors"
          >
            Worldwide
          </button>
        </div>

        {/* Chips mode - quick toggles for common locations */}
        {(mode === 'chips' || mode === 'both') && (
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.slice(0, 10).map((location) => (
              <button
                key={location.code}
                type="button"
                onClick={() => toggleLocation(location.code)}
                disabled={
                  maxSelections !== undefined &&
                  selected.length >= maxSelections &&
                  !selected.includes(location.code)
                }
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  selected.includes(location.code)
                    ? 'bg-accent text-white'
                    : 'bg-surface2 border border-divider hover:border-accent'
                } disabled:opacity-50`}
              >
                {selected.includes(location.code) && '✓ '}
                {location.label}
              </button>
            ))}
          </div>
        )}

        {/* Dropdown mode - search and select */}
        {(mode === 'dropdown' || mode === 'both') && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations..."
              className="w-full px-4 py-2 bg-surface2 border border-divider rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {searchQuery && (
              <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-surface border border-divider rounded-lg shadow-lg">
                {filteredLocations.map((location) => (
                  <button
                    key={location.code}
                    type="button"
                    onClick={() => {
                      toggleLocation(location.code);
                      setSearchQuery('');
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-surface2 transition-colors ${
                      selected.includes(location.code) ? 'bg-accent/10 text-accent' : ''
                    }`}
                  >
                    {selected.includes(location.code) && '✓ '}
                    {location.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selection summary */}
        <div className="text-xs text-text3">
          {selected.length === 0 ? (
            <span className="text-warning">No locations selected</span>
          ) : (
            <span>
              {selected.length} location{selected.length !== 1 ? 's' : ''} selected
              {selectedLabels.length <= 3 && `: ${selectedLabels.join(', ')}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default LocationTargeting;
