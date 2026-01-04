'use client';

import { formatDisplayUrl } from '@/lib/ad-copy-utils';

interface AdPreviewProps {
  headlines: string[];
  descriptions: string[];
  finalUrl?: string;
  path1?: string;
  path2?: string;
}

export default function AdPreview({ headlines, descriptions, finalUrl = 'example.com', path1, path2 }: AdPreviewProps) {
  // Filter to only non-empty headlines/descriptions
  const filledHeadlines = headlines.filter((h) => h.trim());
  const filledDescriptions = descriptions.filter((d) => d.trim());

  // Take first 3 headlines for preview (Google shows 2-3 typically)
  const previewHeadlines = filledHeadlines.slice(0, 3);
  const previewDescription = filledDescriptions[0] || '';

  // Format display URL
  const displayUrl = formatDisplayUrl(finalUrl, path1, path2);

  // Remove DKI tokens for preview display (show fallback)
  const cleanText = (text: string) => {
    return text.replace(/\{KeyWord:([^}]+)\}/gi, '$1');
  };

  if (previewHeadlines.length === 0) {
    return (
      <div className="bg-surface2 border border-divider rounded-lg p-4">
        <h4 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Ad Preview
        </h4>
        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Add headlines to see preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface2 border border-divider rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text flex items-center gap-2">
          <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Ad Preview
        </h4>
        <span className="text-xs text-text3">Google shows different headline combinations</span>
      </div>

      {/* Google SERP Style Preview */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        {/* Sponsored label */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">Sponsored</span>
        </div>

        {/* Display URL */}
        <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
          <span className="truncate">{displayUrl}</span>
          <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Headlines */}
        <div className="text-blue-700 text-lg font-medium leading-snug mb-1.5 cursor-pointer hover:underline">
          {previewHeadlines.map((h) => cleanText(h)).join(' | ')}
        </div>

        {/* Description */}
        {previewDescription && (
          <div className="text-sm text-gray-700 leading-relaxed">{cleanText(previewDescription)}</div>
        )}
      </div>

      {/* Info text */}
      <p className="text-xs text-text3 mt-2">
        Google will automatically test different combinations of your {filledHeadlines.length} headlines and{' '}
        {filledDescriptions.length} descriptions
      </p>
    </div>
  );
}
