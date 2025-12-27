'use client';

import { useKeywordFactoryStore } from '../store/useKeywordFactoryStore';

const TARGET_LOCATIONS = [
  { code: 'US', name: '🇺🇸 United States', geoCode: '2840' },
  { code: 'GB', name: '🇬🇧 United Kingdom', geoCode: '2826' },
  { code: 'CA', name: '🇨🇦 Canada', geoCode: '2124' },
  { code: 'AU', name: '🇦🇺 Australia', geoCode: '2036' },
  { code: 'DE', name: '🇩🇪 Germany', geoCode: '2276' },
  { code: 'FR', name: '🇫🇷 France', geoCode: '2250' },
  { code: 'ES', name: '🇪🇸 Spain', geoCode: '2724' },
  { code: 'IT', name: '🇮🇹 Italy', geoCode: '2380' },
  { code: 'PT', name: '🇵🇹 Portugal', geoCode: '2620' },
];

export default function SeedInputPanel() {
  const {
    seedInput,
    setSeedInput,
    generating,
    generateKeywords,
    options,
    updateOptions,
    ui,
    setExpandedSection,
  } = useKeywordFactoryStore();

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-text mb-4">Seed Keywords</h2>
      <div className="space-y-4">
        <div>
          <textarea
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="Enter your seed keywords&#10;e.g., running shoes&#10;athletic footwear&#10;sports sneakers"
            rows={5}
            className="w-full px-4 py-3 bg-surface2 rounded-xl text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          <p className="text-xs text-text3 mt-1">Separate with commas or new lines (max 20)</p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Options</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.generateVariations}
              onChange={(e) => updateOptions({ generateVariations: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-text2">Generate variations</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.generateSynonyms}
              onChange={(e) => updateOptions({ generateSynonyms: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-text2">Generate synonyms</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeNegatives}
              onChange={(e) => updateOptions({ includeNegatives: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-text2">Suggest negatives</span>
          </label>
        </div>

        {/* Collapsible Enrichment Section */}
        <div className="pt-4 border-t border-divider">
          <button
            onClick={() =>
              setExpandedSection(ui.expandedSection === 'enrichment' ? null : 'enrichment')
            }
            className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-0 bg-surface2 rounded-lg hover:bg-surface3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">Keyword Enrichment</span>
                  <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded">
                    NEW
                  </span>
                </div>
                <p className="text-xs text-text3">Get real search volume, CPC, and competition data</p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-text3 transition-transform flex-shrink-0 ${
                ui.expandedSection === 'enrichment' ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {ui.expandedSection === 'enrichment' && (
            <div className="mt-3 p-4 space-y-4 border-l-2 border-accent/30">
              {/* Location Targeting */}
              <div className="p-3 bg-accent/5 rounded-lg border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📍</span>
                  <label className="text-sm font-medium text-text">Target Location</label>
                  <div className="group relative">
                    <svg
                      className="w-4 h-4 text-text3 cursor-help"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                      Metrics vary drastically by location. Example: &quot;golden visa&quot; has 10K/mo in US vs
                      500/mo in Portugal
                    </div>
                  </div>
                </div>
                <select
                  value={options.targetLocation}
                  onChange={(e) => updateOptions({ targetLocation: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-divider focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  {TARGET_LOCATIONS.map((loc) => (
                    <option key={loc.code} value={loc.code}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">Enable Enrichment</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.enrichWithMetrics}
                    onChange={(e) => updateOptions({ enrichWithMetrics: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface3 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>

              {/* Rest of enrichment options (only when enabled) */}
              {options.enrichWithMetrics && (
                <div className="space-y-3 pt-3 border-t border-divider">
                  {/* Data Sources */}
                  <div>
                    <p className="text-xs font-medium text-text mb-2">Data Sources</p>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.metricsProviders.includes('google_ads')}
                          onChange={(e) => {
                            const providers = e.target.checked
                              ? [...options.metricsProviders, 'google_ads']
                              : options.metricsProviders.filter((p) => p !== 'google_ads');
                            updateOptions({ metricsProviders: providers as any });
                          }}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className="text-xs text-text2">Google Ads (Free)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.metricsProviders.includes('moz')}
                          onChange={(e) => {
                            const providers = e.target.checked
                              ? [...options.metricsProviders, 'moz']
                              : options.metricsProviders.filter((p) => p !== 'moz');
                            updateOptions({ metricsProviders: providers as any });
                          }}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className="text-xs text-text2">Moz (1 credit/kw)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.metricsProviders.includes('dataforseo')}
                          onChange={(e) => {
                            const providers = e.target.checked
                              ? [...options.metricsProviders, 'dataforseo']
                              : options.metricsProviders.filter((p) => p !== 'dataforseo');
                            updateOptions({ metricsProviders: providers as any });
                          }}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className="text-xs text-text2">DataForSEO ($0.002/kw)</span>
                      </label>
                    </div>
                  </div>

                  {/* Max Keywords Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-text">Max Keywords</label>
                      <span className="text-xs text-accent font-medium">
                        {options.maxKeywordsToEnrich}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={options.maxKeywordsToEnrich}
                      onChange={(e) =>
                        updateOptions({ maxKeywordsToEnrich: parseInt(e.target.value) })
                      }
                      className="w-full h-2 bg-surface3 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <p className="text-xs text-text3 mt-1">Limit enrichment to top keywords</p>
                  </div>

                  {/* Min Volume Filter */}
                  <div>
                    <label className="text-xs font-medium text-text block mb-1">
                      Min Search Volume
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={options.minSearchVolume}
                      onChange={(e) =>
                        updateOptions({ minSearchVolume: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-surface2 rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="e.g., 100"
                    />
                    <p className="text-xs text-text3 mt-1">Filter keywords below this volume</p>
                  </div>

                  {/* Sort Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.sortByMetrics}
                      onChange={(e) => updateOptions({ sortByMetrics: e.target.checked })}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className="text-xs text-text2">Sort by opportunity score</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={generateKeywords}
          disabled={generating || !seedInput.trim()}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Generate Keywords
            </>
          )}
        </button>
      </div>
    </div>
  );
}
