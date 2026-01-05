'use client';

import React, { useState } from 'react';

interface YouTubeAdPreviewProps {
  headline: string;
  description?: string;
  businessName: string;
  videoThumbnail?: string;
  youtubeVideoId?: string;
  companionBannerUrl?: string;
  callToAction?: string;
  finalUrl: string;
  format?: 'in-stream' | 'discovery' | 'bumper' | 'shorts';
}

export function YouTubeAdPreview({
  headline,
  description,
  businessName,
  videoThumbnail,
  youtubeVideoId,
  companionBannerUrl,
  callToAction = 'Learn More',
  finalUrl,
  format = 'in-stream',
}: YouTubeAdPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const thumbnail = videoThumbnail ||
    (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : null);

  // In-stream skippable ad
  if (format === 'in-stream') {
    return (
      <div className="max-w-[560px] bg-black rounded-lg overflow-hidden">
        {/* Video Player */}
        <div className="relative aspect-video bg-gray-900">
          {thumbnail && (
            <img
              src={thumbnail}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
            >
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>

          {/* Ad UI overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {/* Progress bar */}
            <div className="h-1 bg-white/30 rounded-full mb-3">
              <div className="h-full w-1/4 bg-yellow-400 rounded-full" />
            </div>

            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-yellow-400 text-xs mb-1">Ad · 0:15</div>
                <p className="text-white text-sm font-medium truncate">{headline}</p>
                <p className="text-white/70 text-xs truncate">{businessName}</p>
              </div>

              {/* Skip button */}
              <div className="flex flex-col items-end gap-2 ml-4">
                <button className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-gray-200">
                  {callToAction}
                </button>
                <button className="text-white/80 text-xs hover:text-white">
                  Skip Ads →
                </button>
              </div>
            </div>
          </div>

          {/* Info icon */}
          <div className="absolute top-3 right-3">
            <div className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white text-xs">
              ⓘ
            </div>
          </div>
        </div>

        {/* Companion banner (optional) */}
        {companionBannerUrl && (
          <div className="bg-gray-100 p-2">
            <img
              src={companionBannerUrl}
              alt="Companion banner"
              className="w-full h-auto max-h-[60px] object-contain"
            />
          </div>
        )}

        {/* Format label */}
        <div className="bg-gray-900 px-4 py-2 text-center">
          <span className="text-xs text-gray-400">In-stream Skippable Ad</span>
        </div>
      </div>
    );
  }

  // Discovery / In-feed ad
  if (format === 'discovery') {
    return (
      <div className="max-w-[400px] bg-white rounded-lg overflow-hidden border border-gray-200">
        {/* YouTube header mockup */}
        <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
          </div>
          <span className="text-lg font-medium text-gray-800">YouTube</span>
        </div>

        {/* Ad content */}
        <div className="p-3 flex gap-3 hover:bg-gray-50 cursor-pointer">
          {/* Thumbnail */}
          <div className="relative w-40 h-24 bg-gray-200 rounded overflow-hidden flex-shrink-0">
            {thumbnail && (
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
              0:30
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="px-1 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-medium rounded">
                Ad
              </span>
            </div>
            <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
              {headline}
            </h4>
            <p className="text-xs text-gray-600">{businessName}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{description}</p>
            )}
          </div>
        </div>

        {/* Format label */}
        <div className="bg-gray-50 px-4 py-2 text-center border-t border-gray-200">
          <span className="text-xs text-gray-500">Video Discovery Ad</span>
        </div>
      </div>
    );
  }

  // Shorts ad
  if (format === 'shorts') {
    return (
      <div className="w-[220px] bg-black rounded-2xl overflow-hidden shadow-xl">
        {/* Phone frame */}
        <div className="relative aspect-[9/16] bg-gray-900">
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover"
            />
          )}

          {/* Shorts UI overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            {/* Right side actions */}
            <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
              <div className="text-white text-center">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-1">
                  👍
                </div>
                <span className="text-xs">12K</span>
              </div>
              <div className="text-white text-center">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-1">
                  👎
                </div>
                <span className="text-xs">0</span>
              </div>
              <div className="text-white text-center">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-1">
                  💬
                </div>
                <span className="text-xs">234</span>
              </div>
            </div>

            {/* Bottom info */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 bg-yellow-400 text-black text-[10px] font-bold rounded">
                  Ad
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gray-300 rounded-full" />
                <span className="text-white text-sm font-medium">{businessName}</span>
              </div>
              <p className="text-white text-sm line-clamp-2">{headline}</p>

              {/* CTA */}
              <button className="mt-3 w-full py-2 bg-white text-black text-sm font-medium rounded-full">
                {callToAction}
              </button>
            </div>
          </div>

          {/* Shorts logo */}
          <div className="absolute top-3 left-3 flex items-center gap-1">
            <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">▶</span>
            </div>
            <span className="text-white text-sm font-medium">Shorts</span>
          </div>
        </div>

        {/* Format label */}
        <div className="bg-gray-900 px-4 py-2 text-center">
          <span className="text-xs text-gray-400">YouTube Shorts Ad</span>
        </div>
      </div>
    );
  }

  // Bumper ad (6 seconds non-skippable)
  return (
    <div className="max-w-[480px] bg-black rounded-lg overflow-hidden">
      <div className="relative aspect-video bg-gray-900">
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        )}

        {/* Bumper UI */}
        <div className="absolute inset-0 flex items-end p-4">
          <div className="flex-1">
            <div className="text-yellow-400 text-xs mb-1">Ad · 0:06 (Non-skippable)</div>
            <p className="text-white text-sm font-medium truncate">{headline}</p>
          </div>
          <button className="px-4 py-2 bg-white text-black text-sm font-medium rounded">
            {callToAction}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 px-4 py-2 text-center">
        <span className="text-xs text-gray-400">6-second Bumper Ad</span>
      </div>
    </div>
  );
}

export default YouTubeAdPreview;
