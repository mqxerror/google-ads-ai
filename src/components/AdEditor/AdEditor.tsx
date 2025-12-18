'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useDrillDown } from '@/contexts/DrillDownContext';

interface AdEditorProps {
  isOpen: boolean;
  onClose: () => void;
  adGroupId?: string;
  existingAd?: ResponsiveSearchAd | null;
}

interface ResponsiveSearchAd {
  id?: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
  path1?: string;
  path2?: string;
  status: 'ENABLED' | 'PAUSED';
}

const MAX_HEADLINES = 15;
const MIN_HEADLINES = 3;
const MAX_DESCRIPTIONS = 4;
const MIN_DESCRIPTIONS = 2;
const HEADLINE_MAX_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 90;

export default function AdEditor({ isOpen, onClose, adGroupId, existingAd }: AdEditorProps) {
  const { currentAccount } = useAccount();
  const { selectedCampaign, selectedAdGroup } = useDrillDown();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [headlines, setHeadlines] = useState<string[]>(['', '', '']);
  const [descriptions, setDescriptions] = useState<string[]>(['', '']);
  const [finalUrl, setFinalUrl] = useState('');
  const [path1, setPath1] = useState('');
  const [path2, setPath2] = useState('');
  const [status, setStatus] = useState<'ENABLED' | 'PAUSED'>('ENABLED');

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (existingAd) {
        setHeadlines(existingAd.headlines.length >= MIN_HEADLINES
          ? existingAd.headlines
          : [...existingAd.headlines, ...Array(MIN_HEADLINES - existingAd.headlines.length).fill('')]);
        setDescriptions(existingAd.descriptions.length >= MIN_DESCRIPTIONS
          ? existingAd.descriptions
          : [...existingAd.descriptions, ...Array(MIN_DESCRIPTIONS - existingAd.descriptions.length).fill('')]);
        setFinalUrl(existingAd.finalUrls[0] || '');
        setPath1(existingAd.path1 || '');
        setPath2(existingAd.path2 || '');
        setStatus(existingAd.status);
      } else {
        setHeadlines(['', '', '']);
        setDescriptions(['', '']);
        setFinalUrl('');
        setPath1('');
        setPath2('');
        setStatus('ENABLED');
      }
      setError(null);
    }
  }, [isOpen, existingAd]);

  const addHeadline = () => {
    if (headlines.length < MAX_HEADLINES) {
      setHeadlines([...headlines, '']);
    }
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > MIN_HEADLINES) {
      setHeadlines(headlines.filter((_, i) => i !== index));
    }
  };

  const updateHeadline = (index: number, value: string) => {
    const newHeadlines = [...headlines];
    newHeadlines[index] = value.slice(0, HEADLINE_MAX_LENGTH);
    setHeadlines(newHeadlines);
  };

  const addDescription = () => {
    if (descriptions.length < MAX_DESCRIPTIONS) {
      setDescriptions([...descriptions, '']);
    }
  };

  const removeDescription = (index: number) => {
    if (descriptions.length > MIN_DESCRIPTIONS) {
      setDescriptions(descriptions.filter((_, i) => i !== index));
    }
  };

  const updateDescription = (index: number, value: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value.slice(0, DESCRIPTION_MAX_LENGTH);
    setDescriptions(newDescriptions);
  };

  const validateForm = (): string | null => {
    const filledHeadlines = headlines.filter(h => h.trim().length > 0);
    const filledDescriptions = descriptions.filter(d => d.trim().length > 0);

    if (filledHeadlines.length < MIN_HEADLINES) {
      return `At least ${MIN_HEADLINES} headlines are required`;
    }
    if (filledDescriptions.length < MIN_DESCRIPTIONS) {
      return `At least ${MIN_DESCRIPTIONS} descriptions are required`;
    }
    if (!finalUrl.trim()) {
      return 'Final URL is required';
    }
    try {
      new URL(finalUrl);
    } catch {
      return 'Please enter a valid URL';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!currentAccount || !selectedCampaign) {
      setError('No account or campaign selected');
      return;
    }

    const targetAdGroupId = adGroupId || selectedAdGroup?.id;
    if (!targetAdGroupId) {
      setError('No ad group selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const adData = {
        headlines: headlines.filter(h => h.trim().length > 0),
        descriptions: descriptions.filter(d => d.trim().length > 0),
        finalUrls: [finalUrl.trim()],
        path1: path1.trim() || undefined,
        path2: path2.trim() || undefined,
        status,
      };

      const response = await fetch('/api/google-ads/ads', {
        method: existingAd?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          campaignId: selectedCampaign.id,
          adGroupId: targetAdGroupId,
          adId: existingAd?.id,
          ad: adData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save ad');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ad');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filledHeadlines = headlines.filter(h => h.trim().length > 0).length;
  const filledDescriptions = descriptions.filter(d => d.trim().length > 0).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-50 flex items-start justify-center overflow-y-auto py-8 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl">
        <div className="relative w-full overflow-hidden rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {existingAd ? 'Edit Ad' : 'Create Responsive Search Ad'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedAdGroup?.name || 'Ad Group'} • {selectedCampaign?.name || 'Campaign'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Headlines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Headlines ({filledHeadlines}/{MAX_HEADLINES})
                  </label>
                  <span className="text-xs text-gray-500">Min {MIN_HEADLINES} required</span>
                </div>
                <div className="space-y-2">
                  {headlines.map((headline, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={headline}
                          onChange={(e) => updateHeadline(index, e.target.value)}
                          placeholder={`Headline ${index + 1}`}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          maxLength={HEADLINE_MAX_LENGTH}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {headline.length}/{HEADLINE_MAX_LENGTH}
                        </span>
                      </div>
                      {headlines.length > MIN_HEADLINES && (
                        <button
                          onClick={() => removeHeadline(index)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {headlines.length < MAX_HEADLINES && (
                  <button
                    onClick={addHeadline}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add headline
                  </button>
                )}
              </div>

              {/* Descriptions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Descriptions ({filledDescriptions}/{MAX_DESCRIPTIONS})
                  </label>
                  <span className="text-xs text-gray-500">Min {MIN_DESCRIPTIONS} required</span>
                </div>
                <div className="space-y-2">
                  {descriptions.map((description, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="relative flex-1">
                        <textarea
                          value={description}
                          onChange={(e) => updateDescription(index, e.target.value)}
                          placeholder={`Description ${index + 1}`}
                          rows={2}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                          maxLength={DESCRIPTION_MAX_LENGTH}
                        />
                        <span className="absolute right-3 bottom-2 text-xs text-gray-400">
                          {description.length}/{DESCRIPTION_MAX_LENGTH}
                        </span>
                      </div>
                      {descriptions.length > MIN_DESCRIPTIONS && (
                        <button
                          onClick={() => removeDescription(index)}
                          className="mt-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {descriptions.length < MAX_DESCRIPTIONS && (
                  <button
                    onClick={addDescription}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add description
                  </button>
                )}
              </div>

              {/* Final URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Final URL
                </label>
                <input
                  type="url"
                  value={finalUrl}
                  onChange={(e) => setFinalUrl(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Display Paths */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Path (optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">example.com /</span>
                  <input
                    type="text"
                    value={path1}
                    onChange={(e) => setPath1(e.target.value.slice(0, 15))}
                    placeholder="path1"
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    maxLength={15}
                  />
                  <span className="text-sm text-gray-500">/</span>
                  <input
                    type="text"
                    value={path2}
                    onChange={(e) => setPath2(e.target.value.slice(0, 15))}
                    placeholder="path2"
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    maxLength={15}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ENABLED' | 'PAUSED')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ENABLED">Enabled</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>

              {/* Preview */}
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Ad Preview</h3>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Ad • {finalUrl ? new URL(finalUrl).hostname : 'example.com'}</div>
                  <div className="text-blue-600 text-lg font-medium hover:underline cursor-pointer">
                    {headlines.filter(h => h.trim()).slice(0, 3).join(' | ') || 'Your headlines here'}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    {finalUrl ? new URL(finalUrl).hostname : 'example.com'}
                    {path1 && `/${path1}`}
                    {path2 && `/${path2}`}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {descriptions.filter(d => d.trim()).slice(0, 2).join(' ') || 'Your descriptions here'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : existingAd ? 'Save Changes' : 'Create Ad'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
