import { useState } from 'react';
import { GeneratedKeyword } from '../types';

export interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
}

export function useCampaignActions() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const response = await fetch('/api/google-ads/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const addToCampaign = async (
    campaignId: string,
    keywords: GeneratedKeyword[],
    selectedKeywords: Set<string>
  ): Promise<boolean> => {
    const selected = keywords.filter((k) => selectedKeywords.has(k.keyword));

    try {
      const response = await fetch('/api/google-ads/add-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          keywords: selected.map((k) => ({
            keyword: k.keyword,
            matchType: k.suggestedMatchType,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add keywords to campaign');
      }

      alert(`Successfully added ${selected.length} keywords to campaign`);
      return true;
    } catch (error) {
      console.error('Error adding keywords:', error);
      alert('Failed to add keywords to campaign. Feature coming soon!');
      return false;
    }
  };

  const createCampaign = async (
    keywords: GeneratedKeyword[],
    selectedKeywords: Set<string>
  ): Promise<boolean> => {
    const selected = keywords.filter((k) => selectedKeywords.has(k.keyword));

    try {
      const campaignName = prompt(
        `Create campaign with ${selected.length} keywords. Enter name:`
      );
      if (!campaignName) return false;

      const response = await fetch('/api/google-ads/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          keywords: selected.map((k) => ({
            keyword: k.keyword,
            matchType: k.suggestedMatchType,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      alert(`Successfully created campaign "${campaignName}"`);
      return true;
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign. Feature coming soon!');
      return false;
    }
  };

  return {
    campaigns,
    loadingCampaigns,
    fetchCampaigns,
    addToCampaign,
    createCampaign,
  };
}
