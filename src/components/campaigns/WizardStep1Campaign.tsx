'use client';

import { useState, useEffect } from 'react';
import { GeneratedKeyword } from '@/app/keyword-factory/types';
import Link from 'next/link';

interface WizardStep1Props {
  data: any;
  onUpdate: (updates: any) => void;
  preSelectedKeywords?: GeneratedKeyword[];
}

const CAMPAIGN_TYPES = [
  { value: 'SEARCH', label: 'Search', icon: '🔍', description: 'Text ads on Google Search' },
  { value: 'PERFORMANCE_MAX', label: 'Performance Max', icon: '🚀', description: 'AI-optimized across all Google' },
  { value: 'SHOPPING', label: 'Shopping', icon: '🛍️', description: 'Product listings on Google' },
];

const GOALS = [
  { value: 'LEADS', label: 'Leads', icon: '📧', description: 'Get contact information' },
  { value: 'SALES', label: 'Sales', icon: '💳', description: 'Drive online purchases' },
  { value: 'TRAFFIC', label: 'Traffic', icon: '👥', description: 'Increase website visits' },
];

const LOCATIONS = [
  { value: '2840', label: 'United States' },
  { value: '2124', label: 'Canada' },
  { value: '2826', label: 'United Kingdom' },
  { value: '2036', label: 'Australia' },
  { value: '21137', label: 'All countries' },
];

interface SavedKeywordList {
  id: string;
  name: string;
  keywords: string[];
  createdAt: string;
}

interface DatabaseKeywordList {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  keyword_count: number;
  created_at: string;
  updated_at: string;
}

// UTM Parameter Templates
const UTM_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard Tracking',
    description: 'Basic campaign tracking',
    params: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: '{campaign_name}',
    },
  },
  {
    id: 'advanced',
    name: 'Advanced Tracking',
    description: 'Includes keyword & ad group',
    params: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: '{campaign_name}',
      utm_content: '{adgroup}',
      utm_term: '{keyword}',
    },
  },
  {
    id: 'dynamic',
    name: 'Dynamic (Google ValueTrack)',
    description: 'Uses Google Ads auto-tagging',
    params: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: '{campaignid}',
      utm_content: '{adgroupid}',
      utm_term: '{keyword}',
      utm_matchtype: '{matchtype}',
    },
  },
];

export default function WizardStep1Campaign({ data, onUpdate, preSelectedKeywords = [] }: WizardStep1Props) {
  const [estimatedDailyCost, setEstimatedDailyCost] = useState({ min: 0, max: 0 });
  const [manualKeywords, setManualKeywords] = useState(data.manualKeywordsInput || '');
  const [defaultMatchType, setDefaultMatchType] = useState<'BROAD' | 'PHRASE' | 'EXACT'>(data.defaultMatchType || 'BROAD');
  const [showSavedListsModal, setShowSavedListsModal] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedKeywordList[]>([]);
  const [databaseLists, setDatabaseLists] = useState<DatabaseKeywordList[]>([]);
  const [isLoadingDbLists, setIsLoadingDbLists] = useState(false);
  const [listSource, setListSource] = useState<'database' | 'local'>('database');
  const [showUtmBuilder, setShowUtmBuilder] = useState(false);
  const [selectedUtmTemplate, setSelectedUtmTemplate] = useState<string | null>(null);
  const [customUtmParams, setCustomUtmParams] = useState<Record<string, string>>({});

  // Helper function to slugify campaign name for UTM
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Generate UTM URL from base URL and params
  const generateUtmUrl = (baseUrl: string, template: typeof UTM_TEMPLATES[0] | null) => {
    if (!baseUrl || !template) return baseUrl;

    try {
      const url = new URL(baseUrl);
      const campaignSlug = data.campaignName ? slugify(data.campaignName) : 'campaign';

      Object.entries({ ...template.params, ...customUtmParams }).forEach(([key, value]) => {
        // Replace placeholders with actual values
        let finalValue = value;
        if (value === '{campaign_name}') {
          finalValue = campaignSlug;
        }
        // Keep Google ValueTrack parameters as-is (they get replaced by Google at serve time)
        url.searchParams.set(key, finalValue);
      });

      return url.toString();
    } catch {
      return baseUrl;
    }
  };

  // Apply UTM template to landing page URL
  const applyUtmTemplate = (templateId: string) => {
    const template = UTM_TEMPLATES.find(t => t.id === templateId);
    if (!template || !data.landingPageUrl) return;

    const newUrl = generateUtmUrl(data.landingPageUrl.split('?')[0], template);
    onUpdate({ landingPageUrl: newUrl });
    setSelectedUtmTemplate(templateId);
  };

  // Remove UTM params from URL
  const removeUtmParams = () => {
    if (!data.landingPageUrl) return;
    try {
      const url = new URL(data.landingPageUrl);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_matchtype'].forEach(param => {
        url.searchParams.delete(param);
      });
      onUpdate({ landingPageUrl: url.toString().replace(/\?$/, '') });
      setSelectedUtmTemplate(null);
    } catch {
      // Invalid URL, do nothing
    }
  };

  // Check if URL has UTM params
  const hasUtmParams = () => {
    if (!data.landingPageUrl) return false;
    try {
      const url = new URL(data.landingPageUrl);
      return url.searchParams.has('utm_source') || url.searchParams.has('utm_campaign');
    } catch {
      return false;
    }
  };

  // Load saved keyword lists from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quickads_saved_keyword_lists');
      if (saved) {
        try {
          setSavedLists(JSON.parse(saved));
        } catch (error) {
          console.error('Failed to load saved keyword lists:', error);
        }
      }
    }
  }, []);

  // Fetch database keyword lists when modal opens
  useEffect(() => {
    if (showSavedListsModal && databaseLists.length === 0) {
      setIsLoadingDbLists(true);
      fetch('/api/lists')
        .then(res => res.json())
        .then(data => {
          if (data.lists) {
            setDatabaseLists(data.lists);
          }
        })
        .catch(err => console.error('Failed to fetch database lists:', err))
        .finally(() => setIsLoadingDbLists(false));
    }
  }, [showSavedListsModal]);

  // Load keywords from a database list
  const loadDatabaseKeywordList = async (listId: string) => {
    console.log('[loadDatabaseKeywordList] Loading list:', listId);
    try {
      const res = await fetch(`/api/lists/${listId}`);
      if (!res.ok) {
        console.error('[loadDatabaseKeywordList] API error:', res.status);
        alert('Failed to load list');
        return;
      }
      const data = await res.json();
      console.log('[loadDatabaseKeywordList] API response:', data);

      // API returns { list, keywords } - keywords is a separate array
      if (data.keywords && Array.isArray(data.keywords) && data.keywords.length > 0) {
        const keywordStrings = data.keywords.map((kw: any) => kw.keyword || kw);
        console.log('[loadDatabaseKeywordList] Extracted keywords:', keywordStrings);
        setManualKeywords(keywordStrings.join('\n'));
        setShowSavedListsModal(false);
      } else {
        console.log('[loadDatabaseKeywordList] No keywords in list or empty');
        alert('This list has no keywords');
      }
    } catch (error) {
      console.error('[loadDatabaseKeywordList] Error:', error);
      alert('Failed to load keywords');
    }
  };

  // Parse manual keywords and convert to GeneratedKeyword format
  useEffect(() => {
    if (manualKeywords) {
      const keywordLines = manualKeywords
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      const parsedKeywords: GeneratedKeyword[] = keywordLines.map((kw: string) => ({
        keyword: kw,
        type: 'seed' as const,
        source: 'manual_input',
        suggestedMatchType: defaultMatchType,
        estimatedIntent: 'commercial' as const,
      }));

      onUpdate({
        manualKeywordsInput: manualKeywords,
        manualKeywords: parsedKeywords,
        defaultMatchType: defaultMatchType,
      });
    }
  }, [manualKeywords, defaultMatchType]);

  const loadKeywordList = (list: SavedKeywordList) => {
    setManualKeywords(list.keywords.join('\n'));
    setShowSavedListsModal(false);
  };

  const saveCurrentKeywords = () => {
    if (!manualKeywords || manualKeywords.trim().length === 0) {
      alert('No keywords to save');
      return;
    }

    const listName = prompt('Enter a name for this keyword list:');
    if (!listName) return;

    const keywordLines = manualKeywords
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    const newList: SavedKeywordList = {
      id: Date.now().toString(),
      name: listName,
      keywords: keywordLines,
      createdAt: new Date().toISOString(),
    };

    const updatedLists = [...savedLists, newList];
    setSavedLists(updatedLists);

    if (typeof window !== 'undefined') {
      localStorage.setItem('quickads_saved_keyword_lists', JSON.stringify(updatedLists));
    }

    alert(`Saved "${listName}" with ${keywordLines.length} keywords`);
  };

  const deleteKeywordList = (listId: string) => {
    if (!confirm('Are you sure you want to delete this list?')) return;

    const updatedLists = savedLists.filter(list => list.id !== listId);
    setSavedLists(updatedLists);

    if (typeof window !== 'undefined') {
      localStorage.setItem('quickads_saved_keyword_lists', JSON.stringify(updatedLists));
    }
  };

  // Calculate estimated cost based on keywords CPC
  useEffect(() => {
    if (preSelectedKeywords.length > 0) {
      const avgCpc = preSelectedKeywords.reduce((sum, kw) => sum + (kw.metrics?.cpc || 0), 0) / preSelectedKeywords.length;
      const estimatedClicks = 20; // Assume 20 clicks per day initially
      const min = avgCpc * estimatedClicks * 0.7; // 30% lower
      const max = avgCpc * estimatedClicks * 1.3; // 30% higher
      setEstimatedDailyCost({ min, max });
    } else {
      // Default estimates based on campaign type
      const estimates = {
        SEARCH: { min: 30, max: 60 },
        PERFORMANCE_MAX: { min: 50, max: 100 },
        SHOPPING: { min: 40, max: 80 },
      };
      setEstimatedDailyCost(estimates[data.campaignType as keyof typeof estimates] || { min: 30, max: 60 });
    }
  }, [data.campaignType, preSelectedKeywords]);

  return (
    <div className="space-y-8">
      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          Campaign name <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={data.campaignName || ''}
          onChange={(e) => onUpdate({ campaignName: e.target.value })}
          placeholder="e.g., Portugal Golden Visa - US"
          className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        />
        <p className="mt-1.5 text-xs text-text3">
          Choose a descriptive name that helps you identify this campaign
        </p>
      </div>

      {/* Campaign Type */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">
          Campaign type <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CAMPAIGN_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => onUpdate({ campaignType: type.value })}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                data.campaignType === type.value
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface2 hover:border-accent/50'
              }`}
            >
              <div className="text-2xl mb-2">{type.icon}</div>
              <div className="font-medium text-text text-sm">{type.label}</div>
              <div className="text-xs text-text3 mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">
          Campaign goal <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {GOALS.map((goal) => (
            <button
              key={goal.value}
              onClick={() => onUpdate({ goal: goal.value })}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                data.goal === goal.value
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface2 hover:border-accent/50'
              }`}
            >
              <div className="text-2xl mb-2">{goal.icon}</div>
              <div className="font-medium text-text text-sm">{goal.label}</div>
              <div className="text-xs text-text3 mt-1">{goal.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Location */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Target location <span className="text-danger">*</span>
          </label>
          <select
            value={data.targetLocation || '2840'}
            onChange={(e) => onUpdate({ targetLocation: e.target.value })}
            className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Language
          </label>
          <select
            value={data.language || 'en'}
            onChange={(e) => onUpdate({ language: e.target.value })}
            className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>
      </div>

      {/* Landing Page URL */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-text">
            Landing page URL <span className="text-danger">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowUtmBuilder(!showUtmBuilder)}
            className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
              showUtmBuilder || hasUtmParams()
                ? 'bg-accent/10 text-accent'
                : 'bg-surface2 text-text3 hover:text-accent hover:bg-accent/10'
            }`}
          >
            <span>🔗</span>
            <span>{hasUtmParams() ? 'UTM Added' : 'Add UTM Tracking'}</span>
          </button>
        </div>
        <input
          type="url"
          value={data.landingPageUrl || ''}
          onChange={(e) => {
            onUpdate({ landingPageUrl: e.target.value });
            setSelectedUtmTemplate(null); // Reset template when manually editing
          }}
          placeholder="https://example.com/landing-page"
          className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-mono text-sm"
        />
        <p className="mt-1.5 text-xs text-text3">
          The page users will see after clicking your ad. Must be a valid URL.
        </p>

        {/* UTM Builder Panel */}
        {showUtmBuilder && (
          <div className="mt-3 bg-surface2 border border-divider rounded-lg p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <span className="font-medium text-text text-sm">Smart UTM Builder</span>
              </div>
              {hasUtmParams() && (
                <button
                  type="button"
                  onClick={removeUtmParams}
                  className="text-xs text-danger hover:text-danger/80 transition-colors"
                >
                  Remove UTM
                </button>
              )}
            </div>

            {!data.landingPageUrl ? (
              <p className="text-xs text-text3 italic">Enter a landing page URL first to add UTM parameters</p>
            ) : (
              <>
                {/* Template Selection */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {UTM_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyUtmTemplate(template.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedUtmTemplate === template.id
                          ? 'border-accent bg-accent/10'
                          : 'border-divider bg-surface hover:border-accent/50'
                      }`}
                    >
                      <div className="font-medium text-text text-xs">{template.name}</div>
                      <div className="text-[10px] text-text3 mt-0.5">{template.description}</div>
                    </button>
                  ))}
                </div>

                {/* Current UTM Preview */}
                {hasUtmParams() && (
                  <div className="bg-surface rounded-lg p-3 border border-divider">
                    <div className="text-xs text-text3 mb-2 font-medium">Generated URL Preview:</div>
                    <div className="text-xs text-text font-mono break-all bg-bg p-2 rounded border border-divider">
                      {data.landingPageUrl}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(() => {
                        try {
                          const url = new URL(data.landingPageUrl);
                          return Array.from(url.searchParams.entries())
                            .filter(([key]) => key.startsWith('utm_'))
                            .map(([key, value]) => (
                              <span key={key} className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] rounded-full">
                                {key}={value}
                              </span>
                            ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* Info about ValueTrack */}
                <div className="mt-3 p-2.5 bg-accent/5 rounded-lg border border-accent/20">
                  <p className="text-xs text-text3 flex items-start gap-2">
                    <span>💡</span>
                    <span>
                      <strong className="text-text">Pro tip:</strong> Parameters like <code className="text-accent">{'{keyword}'}</code> and <code className="text-accent">{'{matchtype}'}</code> are Google ValueTrack parameters - they get replaced with actual values when your ad is shown.
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Network Settings */}
      <div className="bg-surface2 rounded-lg border border-divider p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🌐</span>
          <span className="font-medium text-text">Network Settings</span>
        </div>

        <div className="space-y-4">
          {/* Search Partners */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={data.includeSearchPartners || false}
              onChange={(e) => onUpdate({ includeSearchPartners: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-divider text-accent focus:ring-accent"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text text-sm">Include Google Search Partners</span>
                <span className="text-[10px] text-text3 bg-surface px-1.5 py-0.5 rounded">Optional</span>
              </div>
              <p className="text-xs text-text3 mt-0.5">
                Your ads can appear on non-Google sites that partner with Google Search, like AOL and Ask.com
              </p>
            </div>
          </label>

          {/* Display Network */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={data.includeDisplayNetwork || false}
              onChange={(e) => onUpdate({ includeDisplayNetwork: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-divider text-accent focus:ring-accent"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text text-sm">Include Google Display Network</span>
                <span className="text-[10px] text-text3 bg-surface px-1.5 py-0.5 rounded">Optional</span>
              </div>
              <p className="text-xs text-text3 mt-0.5">
                Expand reach by showing ads on millions of websites, apps, and Google-owned properties
              </p>
            </div>
          </label>
        </div>

        <div className="mt-3 p-2.5 bg-warning/10 rounded-lg border border-warning/20">
          <p className="text-xs text-warning flex items-start gap-2">
            <span>💡</span>
            <span>
              <strong>Tip:</strong> For better control and cleaner data, start with Search Network only.
              You can enable these later once your campaign is optimized.
            </span>
          </p>
        </div>
      </div>

      {/* Manual Keywords Input (if not from Keyword Factory) */}
      {preSelectedKeywords.length === 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-text">
              Keywords <span className="text-danger">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSavedListsModal(true)}
                className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/10"
              >
                <span>📋</span>
                <span>Load from saved</span>
              </button>
              <Link
                href="/keyword-factory"
                target="_blank"
                className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
              >
                <span>🏭</span>
                <span>Or use Keyword Factory</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          </div>
          <textarea
            value={manualKeywords}
            onChange={(e) => setManualKeywords(e.target.value)}
            placeholder="Enter your keywords (one per line)&#10;&#10;Example:&#10;portugal golden visa&#10;portugal residency visa&#10;portugal immigration program"
            rows={8}
            className="w-full px-4 py-3 bg-surface2 border border-divider rounded-lg text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none font-mono text-sm"
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-text3">
              Enter one keyword per line or use the Keyword Factory to generate and research keywords first.
            </p>
            {manualKeywords && (
              <button
                type="button"
                onClick={saveCurrentKeywords}
                className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/10"
              >
                <span>💾</span>
                <span>Save list</span>
              </button>
            )}
          </div>

          {/* Match Type Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-text mb-2">
              Keyword Match Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setDefaultMatchType('BROAD')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  defaultMatchType === 'BROAD'
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-divider bg-surface2 text-text3 hover:border-accent/50'
                }`}
              >
                <div className="font-medium text-sm">Broad Match</div>
                <div className="text-xs mt-1 opacity-75">keyword</div>
              </button>
              <button
                type="button"
                onClick={() => setDefaultMatchType('PHRASE')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  defaultMatchType === 'PHRASE'
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-divider bg-surface2 text-text3 hover:border-accent/50'
                }`}
              >
                <div className="font-medium text-sm">Phrase Match</div>
                <div className="text-xs mt-1 opacity-75">"keyword"</div>
              </button>
              <button
                type="button"
                onClick={() => setDefaultMatchType('EXACT')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  defaultMatchType === 'EXACT'
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-divider bg-surface2 text-text3 hover:border-accent/50'
                }`}
              >
                <div className="font-medium text-sm">Exact Match</div>
                <div className="text-xs mt-1 opacity-75">[keyword]</div>
              </button>
            </div>
            <p className="mt-2 text-xs text-text3">
              {defaultMatchType === 'BROAD' && '✨ Reaches the widest audience - shows for related searches'}
              {defaultMatchType === 'PHRASE' && '🎯 Shows when search includes your keyword phrase'}
              {defaultMatchType === 'EXACT' && '🔒 Shows only for exact keyword searches - most control'}
            </p>
          </div>

          {manualKeywords && (
            <div className="mt-3 flex items-center gap-2 text-sm text-text3">
              <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium">
                {manualKeywords.split('\n').filter((k: string) => k.trim()).length} keywords
              </span>
              <span>ready for clustering</span>
            </div>
          )}
        </div>
      )}

      {/* Estimated Cost Preview */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">💰</span>
          <span className="font-medium text-text">Estimated daily cost</span>
        </div>
        <div className="text-2xl font-bold text-text">
          ${estimatedDailyCost.min.toFixed(0)} - ${estimatedDailyCost.max.toFixed(0)}
        </div>
        <p className="text-xs text-text3 mt-2">
          Based on {preSelectedKeywords.length > 0 ? `${preSelectedKeywords.length} selected keywords` : 'typical campaign performance'}.
          Final cost depends on budget settings in Step 4.
        </p>
      </div>

      {/* Keywords Summary (if pre-selected) */}
      {preSelectedKeywords.length > 0 && (
        <div className="bg-surface2 rounded-lg p-4 border border-divider">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="font-medium text-text">Selected keywords</span>
            </div>
            <span className="text-sm text-text3">{preSelectedKeywords.length} keywords</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {preSelectedKeywords.slice(0, 10).map((kw, i) => (
              <span key={i} className="px-2.5 py-1 bg-surface rounded text-xs text-text2 border border-divider">
                {kw.keyword}
              </span>
            ))}
            {preSelectedKeywords.length > 10 && (
              <span className="px-2.5 py-1 text-xs text-text3">
                +{preSelectedKeywords.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Saved Keyword Lists Modal - Portal-like behavior with very high z-index */}
      {showSavedListsModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSavedListsModal(false);
          }}
        >
          <div
            className="bg-surface rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-divider">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-text">Load Keyword List</h3>
                <button
                  onClick={() => setShowSavedListsModal(false)}
                  className="text-text3 hover:text-text transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Tab Switcher */}
              <div className="flex gap-2">
                <button
                  onClick={() => setListSource('database')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    listSource === 'database'
                      ? 'bg-accent text-white'
                      : 'bg-surface2 text-text3 hover:text-text'
                  }`}
                >
                  <span className="mr-1.5">🗄️</span>
                  My Lists ({databaseLists.length})
                </button>
                <button
                  onClick={() => setListSource('local')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    listSource === 'local'
                      ? 'bg-accent text-white'
                      : 'bg-surface2 text-text3 hover:text-text'
                  }`}
                >
                  <span className="mr-1.5">💾</span>
                  Quick Saves ({savedLists.length})
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Database Lists Tab */}
              {listSource === 'database' && (
                <>
                  {isLoadingDbLists ? (
                    <div className="text-center py-12">
                      <div className="animate-spin w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full mx-auto mb-3" />
                      <p className="text-text3">Loading your lists...</p>
                    </div>
                  ) : databaseLists.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">🗄️</div>
                      <p className="text-text3 mb-2">No keyword lists found</p>
                      <p className="text-xs text-text3 mb-4">
                        Create lists in the Lists Center to save and organize keywords
                      </p>
                      <a
                        href="/lists"
                        target="_blank"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover transition-colors"
                      >
                        <span>Go to Lists Center</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {databaseLists.map((list) => (
                        <button
                          type="button"
                          key={list.id}
                          className="w-full text-left bg-surface2 border border-divider rounded-lg p-4 hover:border-accent transition-colors cursor-pointer"
                          onClick={() => loadDatabaseKeywordList(list.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                              style={{ backgroundColor: `${list.color || '#3B82F6'}20` }}
                            >
                              {list.icon || '📁'}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-text mb-1">{list.name}</h4>
                              <p className="text-xs text-text3">
                                {list.keyword_count} keywords · Updated {new Date(list.updated_at).toLocaleDateString()}
                              </p>
                              {list.description && (
                                <p className="text-xs text-text3 mt-1 line-clamp-1">{list.description}</p>
                              )}
                            </div>
                            <div className="text-accent">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Local Storage Lists Tab */}
              {listSource === 'local' && (
                <>
                  {savedLists.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">💾</div>
                      <p className="text-text3 mb-2">No quick saves yet</p>
                      <p className="text-xs text-text3">
                        Enter keywords in the textarea and click "Save list" to save them locally
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedLists.map((list) => (
                        <div
                          key={list.id}
                          className="bg-surface2 border border-divider rounded-lg p-4 hover:border-accent transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <button
                              type="button"
                              className="flex-1 text-left"
                              onClick={() => loadKeywordList(list)}
                            >
                              <h4 className="font-medium text-text mb-1">{list.name}</h4>
                              <p className="text-xs text-text3">
                                {list.keywords.length} keywords · Saved {new Date(list.createdAt).toLocaleDateString()}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteKeywordList(list.id);
                              }}
                              className="text-danger hover:bg-danger/10 p-2 rounded transition-colors"
                              title="Delete list"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => loadKeywordList(list)}
                          >
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {list.keywords.slice(0, 8).map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                                  {kw}
                                </span>
                              ))}
                              {list.keywords.length > 8 && (
                                <span className="px-2 py-0.5 text-xs text-text3">
                                  +{list.keywords.length - 8} more
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-divider bg-surface2/50">
              <button
                onClick={() => setShowSavedListsModal(false)}
                className="w-full px-4 py-2 rounded-lg bg-surface2 text-text hover:bg-surface border border-divider transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
