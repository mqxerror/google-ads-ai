'use client';

import React from 'react';

interface DiscoverAdPreviewProps {
  headline: string;
  description?: string;
  businessName: string;
  imageUrl?: string;
  logoUrl?: string;
  callToAction?: string;
  finalUrl: string;
  format?: 'discover' | 'gmail' | 'gmail-expanded';
}

export function DiscoverAdPreview({
  headline,
  description,
  businessName,
  imageUrl,
  logoUrl,
  callToAction = 'Learn More',
  finalUrl,
  format = 'discover',
}: DiscoverAdPreviewProps) {

  // Google Discover feed preview
  if (format === 'discover') {
    return (
      <div className="max-w-[400px] bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
        {/* Google Discover header */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 via-green-500 to-yellow-500 rounded-full flex items-center justify-center">
            <span className="text-white text-lg font-medium">G</span>
          </div>
          <span className="text-gray-600 text-sm">Discover</span>
        </div>

        {/* Ad card */}
        <div className="hover:bg-gray-50 cursor-pointer">
          {/* Image */}
          {imageUrl && (
            <div className="relative aspect-[1.91/1]">
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-white/90 text-gray-600 text-[10px] font-medium rounded shadow-sm">
                  Sponsored
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Logo */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={businessName}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500">{businessName}</span>
                </div>
                <h3 className="text-base font-medium text-gray-900 line-clamp-2 mb-1">
                  {headline}
                </h3>
                {description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
                )}
              </div>
            </div>

            {/* CTA */}
            <button className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 w-full">
              {callToAction}
            </button>
          </div>
        </div>

        {/* Format label */}
        <div className="bg-gray-50 px-4 py-2 text-center border-t border-gray-100">
          <span className="text-xs text-gray-500">Google Discover Ad</span>
        </div>
      </div>
    );
  }

  // Gmail promotional ad (collapsed)
  if (format === 'gmail') {
    return (
      <div className="max-w-[500px] bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        {/* Gmail header */}
        <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-3">
          <div className="w-8 h-8">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
              <path fill="#34A853" d="M24 5.457v.273L12 14.182 0 5.73v-.273C0 3.434 2.309 2.28 3.927 3.493L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
            </svg>
          </div>
          <span className="text-lg font-medium text-gray-700">Promotions</span>
        </div>

        {/* Email row */}
        <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-4 border-green-500">
          {/* Checkbox */}
          <div className="w-5 h-5 border border-gray-300 rounded mr-3" />

          {/* Star */}
          <div className="text-gray-400 mr-3">☆</div>

          {/* Ad badge */}
          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded mr-3">
            Ad
          </span>

          {/* Sender */}
          <div className="flex items-center gap-2 w-40 flex-shrink-0">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={businessName}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <span className="font-medium text-sm text-gray-900 truncate">{businessName}</span>
          </div>

          {/* Subject and preview */}
          <div className="flex-1 min-w-0 mx-4">
            <span className="font-medium text-gray-900 text-sm">{headline}</span>
            {description && (
              <span className="text-gray-600 text-sm"> - {description}</span>
            )}
          </div>

          {/* Time */}
          <span className="text-xs text-gray-500 flex-shrink-0">Ad</span>
        </div>

        {/* Format label */}
        <div className="bg-gray-50 px-4 py-2 text-center border-t border-gray-200">
          <span className="text-xs text-gray-500">Gmail Promotions Ad (Collapsed)</span>
        </div>
      </div>
    );
  }

  // Gmail expanded ad
  return (
    <div className="max-w-[600px] bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {/* Gmail header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-gray-600 hover:bg-gray-100 p-2 rounded-full">
            ←
          </button>
          <span className="text-lg font-medium text-gray-900">{headline}</span>
        </div>
        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
          Ad
        </span>
      </div>

      {/* Email content */}
      <div className="p-6">
        {/* Sender info */}
        <div className="flex items-center gap-3 mb-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={businessName}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <div>
            <div className="font-medium text-gray-900">{businessName}</div>
            <div className="text-sm text-gray-500">Sponsored</div>
          </div>
        </div>

        {/* Image */}
        {imageUrl && (
          <div className="rounded-lg overflow-hidden mb-4">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-auto max-h-[300px] object-cover"
            />
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-gray-700 mb-4">{description}</p>
        )}

        {/* CTA */}
        <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
          {callToAction}
        </button>
      </div>

      {/* Format label */}
      <div className="bg-gray-50 px-4 py-2 text-center border-t border-gray-200">
        <span className="text-xs text-gray-500">Gmail Ad (Expanded)</span>
      </div>
    </div>
  );
}

export default DiscoverAdPreview;
