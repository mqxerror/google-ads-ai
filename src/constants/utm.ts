/**
 * UTM Parameter Constants & Templates
 * Used for tracking campaign URLs across all campaign types
 */

// ============================================================================
// UTM TEMPLATES
// ============================================================================

export interface UtmTemplate {
  id: string;
  label: string;
  icon: string;
  params: {
    source: string;
    medium: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}

export const UTM_TEMPLATES: UtmTemplate[] = [
  {
    id: 'google-ads',
    label: 'Google Ads',
    icon: '🔍',
    params: {
      source: 'google',
      medium: 'cpc',
      campaign: '{campaign_name}',
      content: '{ad_group}',
      term: '{keyword}',
    },
  },
  {
    id: 'google-pmax',
    label: 'Performance Max',
    icon: '🚀',
    params: {
      source: 'google',
      medium: 'pmax',
      campaign: '{campaign_name}',
    },
  },
  {
    id: 'google-display',
    label: 'Google Display',
    icon: '🖼️',
    params: {
      source: 'google',
      medium: 'display',
      campaign: '{campaign_name}',
      content: '{placement}',
    },
  },
  {
    id: 'google-video',
    label: 'YouTube / Video',
    icon: '🎬',
    params: {
      source: 'youtube',
      medium: 'video',
      campaign: '{campaign_name}',
    },
  },
  {
    id: 'facebook',
    label: 'Facebook / Meta',
    icon: '📘',
    params: {
      source: 'facebook',
      medium: 'paid',
      campaign: '{campaign_name}',
      content: '{{ad.name}}',
    },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    params: {
      source: 'linkedin',
      medium: 'paid',
      campaign: '{campaign_name}',
    },
  },
  {
    id: 'email',
    label: 'Email Campaign',
    icon: '📧',
    params: {
      source: 'newsletter',
      medium: 'email',
      campaign: '{campaign_name}',
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: '⚙️',
    params: {
      source: '',
      medium: '',
      campaign: '',
    },
  },
];

// ============================================================================
// UTM UTILITIES
// ============================================================================

/**
 * Convert a string to URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Build UTM parameters object
 */
export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

/**
 * Generate full URL with UTM parameters
 */
export function generateUtmUrl(baseUrl: string, params: UtmParams): string {
  if (!baseUrl) return '';

  // Ensure URL has protocol
  let url = baseUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Build query string
  const utmParams = new URLSearchParams();

  if (params.source) utmParams.set('utm_source', params.source);
  if (params.medium) utmParams.set('utm_medium', params.medium);
  if (params.campaign) utmParams.set('utm_campaign', params.campaign);
  if (params.content) utmParams.set('utm_content', params.content);
  if (params.term) utmParams.set('utm_term', params.term);

  const queryString = utmParams.toString();
  if (!queryString) return url;

  // Append or merge with existing query string
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${queryString}`;
}

/**
 * Parse UTM parameters from a URL
 */
export function parseUtmFromUrl(url: string): UtmParams {
  try {
    const urlObj = new URL(url);
    return {
      source: urlObj.searchParams.get('utm_source') || undefined,
      medium: urlObj.searchParams.get('utm_medium') || undefined,
      campaign: urlObj.searchParams.get('utm_campaign') || undefined,
      content: urlObj.searchParams.get('utm_content') || undefined,
      term: urlObj.searchParams.get('utm_term') || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Apply a template with campaign name substitution
 */
export function applyUtmTemplate(
  template: UtmTemplate,
  campaignName: string,
  adGroupName?: string
): UtmParams {
  const sluggedCampaign = slugify(campaignName);
  const sluggedAdGroup = adGroupName ? slugify(adGroupName) : '';

  return {
    source: template.params.source,
    medium: template.params.medium,
    campaign: template.params.campaign?.replace('{campaign_name}', sluggedCampaign),
    content: template.params.content?.replace('{ad_group}', sluggedAdGroup),
    term: template.params.term,
  };
}
