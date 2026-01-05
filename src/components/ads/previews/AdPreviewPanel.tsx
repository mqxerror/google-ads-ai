'use client';

import React, { useState } from 'react';
import { SearchAdPreview } from './SearchAdPreview';
import { DisplayAdPreview } from './DisplayAdPreview';
import { YouTubeAdPreview } from './YouTubeAdPreview';
import { DiscoverAdPreview } from './DiscoverAdPreview';

type CampaignType = 'SEARCH' | 'DISPLAY' | 'PMAX' | 'DEMAND_GEN' | 'VIDEO';

interface AdPreviewPanelProps {
  campaignType: CampaignType;
  data: {
    headlines: string[];
    descriptions: string[];
    longHeadline?: string;
    businessName: string;
    finalUrl: string;
    path1?: string;
    path2?: string;
    callToAction?: string;
    images?: { url: string; aspectRatio?: string }[];
    logos?: { url: string }[];
    videos?: { url?: string; youtubeVideoId?: string; thumbnail?: string }[];
    sitelinks?: { title: string; description?: string }[];
    callouts?: string[];
  };
  className?: string;
}

const CAMPAIGN_PREVIEWS: Record<CampaignType, { id: string; label: string; icon: string }[]> = {
  SEARCH: [
    { id: 'search-desktop', label: 'Desktop', icon: '💻' },
    { id: 'search-mobile', label: 'Mobile', icon: '📱' },
  ],
  DISPLAY: [
    { id: 'display-square', label: 'Square', icon: '⬛' },
    { id: 'display-landscape', label: 'Landscape', icon: '▬' },
    { id: 'display-leaderboard', label: 'Leaderboard', icon: '━' },
  ],
  PMAX: [
    { id: 'search-desktop', label: 'Search', icon: '🔍' },
    { id: 'display-square', label: 'Display', icon: '🖼️' },
    { id: 'youtube-discovery', label: 'YouTube', icon: '▶️' },
    { id: 'discover', label: 'Discover', icon: '📰' },
    { id: 'gmail', label: 'Gmail', icon: '✉️' },
  ],
  DEMAND_GEN: [
    { id: 'youtube-discovery', label: 'YouTube', icon: '▶️' },
    { id: 'youtube-shorts', label: 'Shorts', icon: '📱' },
    { id: 'discover', label: 'Discover', icon: '📰' },
    { id: 'gmail', label: 'Gmail', icon: '✉️' },
  ],
  VIDEO: [
    { id: 'youtube-instream', label: 'In-stream', icon: '▶️' },
    { id: 'youtube-discovery', label: 'Discovery', icon: '🔍' },
    { id: 'youtube-shorts', label: 'Shorts', icon: '📱' },
    { id: 'youtube-bumper', label: 'Bumper', icon: '⏱️' },
  ],
};

export function AdPreviewPanel({
  campaignType,
  data,
  className = '',
}: AdPreviewPanelProps) {
  const previews = CAMPAIGN_PREVIEWS[campaignType] || [];
  const [activePreview, setActivePreview] = useState(previews[0]?.id || '');

  const landscapeImage = data.images?.find(i => i.aspectRatio === '1.91:1')?.url;
  const squareImage = data.images?.find(i => i.aspectRatio === '1:1')?.url;
  const portraitImage = data.images?.find(i => i.aspectRatio === '4:5')?.url;
  const anyImage = data.images?.[0]?.url;
  const logo = data.logos?.[0]?.url;
  const video = data.videos?.[0];

  const renderPreview = () => {
    switch (activePreview) {
      // Search previews
      case 'search-desktop':
        return (
          <SearchAdPreview
            headlines={data.headlines}
            descriptions={data.descriptions}
            finalUrl={data.finalUrl}
            path1={data.path1}
            path2={data.path2}
            sitelinks={data.sitelinks}
            callouts={data.callouts}
            variant="desktop"
          />
        );

      case 'search-mobile':
        return (
          <SearchAdPreview
            headlines={data.headlines}
            descriptions={data.descriptions}
            finalUrl={data.finalUrl}
            path1={data.path1}
            path2={data.path2}
            sitelinks={data.sitelinks}
            callouts={data.callouts}
            variant="mobile"
          />
        );

      // Display previews
      case 'display-square':
        return (
          <DisplayAdPreview
            headline={data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            imageUrl={squareImage || anyImage}
            logoUrl={logo}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="square"
          />
        );

      case 'display-landscape':
        return (
          <DisplayAdPreview
            headline={data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            imageUrl={landscapeImage || anyImage}
            logoUrl={logo}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="landscape"
          />
        );

      case 'display-leaderboard':
        return (
          <DisplayAdPreview
            headline={data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            imageUrl={landscapeImage || anyImage}
            logoUrl={logo}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="leaderboard"
          />
        );

      // YouTube previews
      case 'youtube-instream':
        return (
          <YouTubeAdPreview
            headline={data.longHeadline || data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            videoThumbnail={video?.thumbnail}
            youtubeVideoId={video?.youtubeVideoId}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="in-stream"
          />
        );

      case 'youtube-discovery':
        return (
          <YouTubeAdPreview
            headline={data.longHeadline || data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            videoThumbnail={video?.thumbnail || landscapeImage || anyImage}
            youtubeVideoId={video?.youtubeVideoId}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="discovery"
          />
        );

      case 'youtube-shorts':
        return (
          <YouTubeAdPreview
            headline={data.longHeadline || data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            videoThumbnail={video?.thumbnail || portraitImage || anyImage}
            youtubeVideoId={video?.youtubeVideoId}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="shorts"
          />
        );

      case 'youtube-bumper':
        return (
          <YouTubeAdPreview
            headline={data.headlines[0] || ''}
            businessName={data.businessName}
            videoThumbnail={video?.thumbnail || landscapeImage || anyImage}
            youtubeVideoId={video?.youtubeVideoId}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="bumper"
          />
        );

      // Discover/Gmail previews
      case 'discover':
        return (
          <DiscoverAdPreview
            headline={data.longHeadline || data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            imageUrl={landscapeImage || squareImage || anyImage}
            logoUrl={logo}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="discover"
          />
        );

      case 'gmail':
        return (
          <DiscoverAdPreview
            headline={data.longHeadline || data.headlines[0] || ''}
            description={data.descriptions[0]}
            businessName={data.businessName}
            imageUrl={landscapeImage || squareImage || anyImage}
            logoUrl={logo}
            callToAction={data.callToAction}
            finalUrl={data.finalUrl}
            format="gmail"
          />
        );

      default:
        return (
          <div className="text-center text-text3 py-8">
            Select a preview format
          </div>
        );
    }
  };

  return (
    <div className={`bg-surface rounded-xl border border-divider overflow-hidden ${className}`}>
      {/* Header with preview tabs */}
      <div className="px-4 py-3 bg-surface2 border-b border-divider">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-text">Ad Preview</h3>
          <span className="text-xs text-text3">
            {campaignType} Campaign
          </span>
        </div>

        {/* Preview format tabs */}
        <div className="flex flex-wrap gap-2">
          {previews.map((preview) => (
            <button
              key={preview.id}
              onClick={() => setActivePreview(preview.id)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                activePreview === preview.id
                  ? 'bg-accent text-white'
                  : 'bg-surface hover:bg-divider text-text3'
              }`}
            >
              <span>{preview.icon}</span>
              <span>{preview.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview content */}
      <div className="p-6 bg-gradient-to-b from-surface2/50 to-surface min-h-[400px] flex items-center justify-center">
        {renderPreview()}
      </div>

      {/* Footer with tips */}
      <div className="px-4 py-3 bg-surface2 border-t border-divider">
        <p className="text-xs text-text3">
          💡 This is a preview. Actual appearance may vary based on placement and device.
        </p>
      </div>
    </div>
  );
}

export default AdPreviewPanel;
