'use client';

import { useCampaignsStore } from '@/stores/campaigns-store';
import { Campaign } from '@/types/campaign';
import CampaignTable from './CampaignTable';
import AdGroupsTable from './AdGroupsTable';
import KeywordsTable from './KeywordsTable';

interface DrilldownContainerProps {
  onScoreClick?: (campaign: Campaign) => void;
}

export default function DrilldownContainer({ onScoreClick }: DrilldownContainerProps) {
  const drilldownLevel = useCampaignsStore((state) => state.drilldownLevel);

  switch (drilldownLevel) {
    case 'adGroups':
      return <AdGroupsTable />;
    case 'keywords':
      return <KeywordsTable />;
    default:
      return <CampaignTable onScoreClick={onScoreClick} />;
  }
}
