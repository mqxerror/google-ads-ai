'use client';

import { WidgetType } from '@/contexts/DashboardContext';
import MetricCardsWidget from './MetricCardsWidget';
import SpendTrendWidget from './SpendTrendWidget';
import ConversionsTrendWidget from './ConversionsTrendWidget';
import CampaignDistributionWidget from './CampaignDistributionWidget';
import TopCampaignsWidget from './TopCampaignsWidget';
import CTRTrendWidget from './CTRTrendWidget';
import CPAComparisonWidget from './CPAComparisonWidget';

export const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType> = {
  'metric-cards': MetricCardsWidget,
  'spend-trend': SpendTrendWidget,
  'conversions-trend': ConversionsTrendWidget,
  'campaign-distribution': CampaignDistributionWidget,
  'top-campaigns': TopCampaignsWidget,
  'ctr-trend': CTRTrendWidget,
  'cpa-comparison': CPAComparisonWidget,
};

export {
  MetricCardsWidget,
  SpendTrendWidget,
  ConversionsTrendWidget,
  CampaignDistributionWidget,
  TopCampaignsWidget,
  CTRTrendWidget,
  CPAComparisonWidget,
};
