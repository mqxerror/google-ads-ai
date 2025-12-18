// Natural Language Campaign Creator
import { LLMService, LLMConfig } from './index';

export interface CampaignCreationRequest {
  userPrompt: string;
  accountId?: string;
  existingCampaigns?: Array<{ name: string; type: string }>;
}

export interface GeneratedCampaign {
  name: string;
  type: 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'PERFORMANCE_MAX' | 'VIDEO' | 'DEMAND_GEN';
  status: 'ENABLED' | 'PAUSED';
  dailyBudget: number;
  biddingStrategy: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MANUAL_CPC';
  targetCpa?: number;
  targetRoas?: number;
  adGroups: GeneratedAdGroup[];
  targeting?: {
    locations?: string[];
    languages?: string[];
    audiences?: string[];
    demographics?: {
      ageRanges?: string[];
      genders?: string[];
    };
  };
  schedule?: {
    startDate?: string;
    endDate?: string;
    dayParting?: Array<{
      day: string;
      startHour: number;
      endHour: number;
    }>;
  };
}

export interface GeneratedAdGroup {
  name: string;
  keywords: Array<{
    text: string;
    matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  }>;
  negativeKeywords?: string[];
  ads: GeneratedAd[];
}

export interface GeneratedAd {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  path1?: string;
  path2?: string;
}

export interface CampaignCreationResult {
  success: boolean;
  campaign?: GeneratedCampaign;
  explanation: string;
  warnings?: string[];
  suggestions?: string[];
  estimatedPerformance?: {
    dailyClicks: string;
    dailyConversions: string;
    estimatedCpa: string;
  };
}

const CAMPAIGN_CREATOR_PROMPT = `You are an expert Google Ads campaign creator. Based on the user's description, create a complete campaign structure.

Guidelines:
1. Create compelling, benefit-focused ad copy
2. Use a mix of keyword match types for optimal coverage
3. Include negative keywords to prevent waste
4. Structure ad groups thematically (single theme ad groups)
5. Set realistic budget recommendations based on industry
6. Choose bidding strategy based on stated goals

For Search campaigns, include:
- 3-5 ad groups with related keywords
- 15+ keywords per ad group (mix of match types)
- 3+ responsive search ads per ad group
- Negative keywords list

Respond with valid JSON only:
{
  "success": true,
  "campaign": {
    "name": "Campaign name",
    "type": "SEARCH|DISPLAY|SHOPPING|PERFORMANCE_MAX|VIDEO|DEMAND_GEN",
    "status": "PAUSED",
    "dailyBudget": number,
    "biddingStrategy": "MAXIMIZE_CONVERSIONS|MAXIMIZE_CLICKS|TARGET_CPA|TARGET_ROAS|MANUAL_CPC",
    "targetCpa": number (optional),
    "targetRoas": number (optional),
    "adGroups": [
      {
        "name": "Ad Group Name",
        "keywords": [
          {"text": "keyword", "matchType": "EXACT|PHRASE|BROAD"}
        ],
        "negativeKeywords": ["negative term"],
        "ads": [
          {
            "headlines": ["Headline 1 (max 30 chars)", "Headline 2", "...up to 15"],
            "descriptions": ["Description 1 (max 90 chars)", "Description 2", "...up to 4"],
            "finalUrl": "https://example.com/landing-page",
            "path1": "path1",
            "path2": "path2"
          }
        ]
      }
    ],
    "targeting": {
      "locations": ["United States"],
      "languages": ["English"]
    }
  },
  "explanation": "Brief explanation of campaign strategy",
  "warnings": ["Any concerns or recommendations"],
  "suggestions": ["Additional optimization ideas"],
  "estimatedPerformance": {
    "dailyClicks": "50-100",
    "dailyConversions": "2-5",
    "estimatedCpa": "$25-50"
  }
}`;

export async function createCampaignFromPrompt(
  request: CampaignCreationRequest,
  config?: Partial<LLMConfig>
): Promise<CampaignCreationResult> {
  const service = new LLMService(config);

  const contextInfo = request.existingCampaigns
    ? `\n\nExisting campaigns in account:\n${request.existingCampaigns.map(c => `- ${c.name} (${c.type})`).join('\n')}`
    : '';

  const response = await service.complete({
    messages: [
      { role: 'system', content: CAMPAIGN_CREATOR_PROMPT },
      {
        role: 'user',
        content: `Create a Google Ads campaign based on this description:

"${request.userPrompt}"
${contextInfo}

Generate a complete campaign structure with ad groups, keywords, and ads.`,
      },
    ],
    temperature: 0.7,
    maxTokens: 4096,
  });

  try {
    const result: CampaignCreationResult = JSON.parse(response.content);

    // Validate the generated campaign
    if (result.campaign) {
      result.warnings = result.warnings || [];

      // Check headline lengths
      result.campaign.adGroups.forEach(ag => {
        ag.ads.forEach(ad => {
          ad.headlines = ad.headlines.map(h => {
            if (h.length > 30) {
              result.warnings!.push(`Headline "${h.slice(0, 20)}..." truncated to 30 chars`);
              return h.slice(0, 30);
            }
            return h;
          });
          ad.descriptions = ad.descriptions.map(d => {
            if (d.length > 90) {
              result.warnings!.push(`Description truncated to 90 chars`);
              return d.slice(0, 90);
            }
            return d;
          });
        });
      });

      // Ensure minimum requirements
      if (result.campaign.adGroups.length === 0) {
        result.success = false;
        result.explanation = 'Failed to generate ad groups. Please provide more details.';
      }
    }

    return result;
  } catch {
    console.error('Failed to parse campaign creation response:', response.content);
    return {
      success: false,
      explanation: 'Failed to generate campaign. Please try rephrasing your request.',
      warnings: ['AI response could not be parsed'],
    };
  }
}

// Refine an existing campaign based on feedback
export async function refineCampaign(
  campaign: GeneratedCampaign,
  feedback: string,
  config?: Partial<LLMConfig>
): Promise<CampaignCreationResult> {
  const service = new LLMService(config);

  const response = await service.complete({
    messages: [
      { role: 'system', content: CAMPAIGN_CREATOR_PROMPT },
      {
        role: 'user',
        content: `Here's an existing campaign structure:

${JSON.stringify(campaign, null, 2)}

User feedback: "${feedback}"

Please refine the campaign based on this feedback and return the updated structure.`,
      },
    ],
    temperature: 0.5,
    maxTokens: 4096,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return {
      success: false,
      explanation: 'Failed to refine campaign. Please try again.',
    };
  }
}

// Generate ad copy variations
export async function generateAdVariations(
  productOrService: string,
  landingPageUrl: string,
  existingAds?: GeneratedAd[],
  count: number = 3,
  config?: Partial<LLMConfig>
): Promise<GeneratedAd[]> {
  const service = new LLMService(config);

  const existingContext = existingAds
    ? `\n\nExisting ads to differentiate from:\n${JSON.stringify(existingAds, null, 2)}`
    : '';

  const response = await service.complete({
    messages: [
      {
        role: 'system',
        content: `You are an expert Google Ads copywriter. Create compelling responsive search ads.

Rules:
- Headlines: max 30 characters each, provide 10-15 variations
- Descriptions: max 90 characters each, provide 3-4 variations
- Include calls-to-action
- Highlight unique value propositions
- Use power words that drive clicks
- Don't repeat the same message

Respond with JSON array only.`,
      },
      {
        role: 'user',
        content: `Create ${count} different responsive search ads for:

Product/Service: ${productOrService}
Landing Page: ${landingPageUrl}
${existingContext}

Return as JSON array:
[{"headlines": [...], "descriptions": [...], "finalUrl": "${landingPageUrl}", "path1": "...", "path2": "..."}]`,
      },
    ],
    temperature: 0.8, // Higher creativity for ad copy
    maxTokens: 2048,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Generate keyword ideas
export async function generateKeywordIdeas(
  topic: string,
  existingKeywords?: string[],
  count: number = 50,
  config?: Partial<LLMConfig>
): Promise<Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD'; intent: string }>> {
  const service = new LLMService(config);

  const existingContext = existingKeywords?.length
    ? `\n\nExisting keywords (generate different ones):\n${existingKeywords.join(', ')}`
    : '';

  const response = await service.complete({
    messages: [
      {
        role: 'system',
        content: `You are a Google Ads keyword research expert. Generate relevant, high-intent keywords.

Include a mix of:
- Exact match for high-intent terms
- Phrase match for moderate intent
- Broad match for discovery

Categorize by search intent:
- transactional: Ready to buy/convert
- commercial: Researching with intent
- informational: Learning/researching
- navigational: Looking for specific brand/site

Respond with JSON array only.`,
      },
      {
        role: 'user',
        content: `Generate ${count} keyword ideas for: "${topic}"
${existingContext}

Return as JSON array:
[{"text": "keyword", "matchType": "EXACT|PHRASE|BROAD", "intent": "transactional|commercial|informational|navigational"}]`,
      },
    ],
    temperature: 0.7,
    maxTokens: 2048,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}

// Chat-based campaign assistant
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function campaignAssistantChat(
  messages: ChatMessage[],
  campaignContext?: GeneratedCampaign,
  config?: Partial<LLMConfig>
): Promise<{ response: string; updatedCampaign?: GeneratedCampaign; action?: string }> {
  const service = new LLMService(config);

  const systemPrompt = `You are a helpful Google Ads campaign assistant. Help users create and optimize campaigns through natural conversation.

You can:
1. Answer questions about Google Ads best practices
2. Help create campaigns from descriptions
3. Suggest optimizations for existing campaigns
4. Generate ad copy and keywords
5. Explain campaign settings and strategies

${campaignContext ? `\nCurrent campaign being worked on:\n${JSON.stringify(campaignContext, null, 2)}` : ''}

If your response includes campaign changes, include them in your response as:
[CAMPAIGN_UPDATE]
{json of updated campaign}
[/CAMPAIGN_UPDATE]

If you recommend an action, include:
[ACTION]: action_name (e.g., "create_campaign", "add_keywords", "pause_campaign")

Otherwise, just respond naturally with helpful information.`;

  const response = await service.complete({
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    temperature: 0.7,
    maxTokens: 2048,
  });

  // Parse response for campaign updates and actions
  let responseText = response.content;
  let updatedCampaign: GeneratedCampaign | undefined;
  let action: string | undefined;

  // Extract campaign update if present
  const campaignMatch = responseText.match(/\[CAMPAIGN_UPDATE\]([\s\S]*?)\[\/CAMPAIGN_UPDATE\]/);
  if (campaignMatch) {
    try {
      updatedCampaign = JSON.parse(campaignMatch[1].trim());
      responseText = responseText.replace(campaignMatch[0], '').trim();
    } catch {
      // Ignore parse errors
    }
  }

  // Extract action if present
  const actionMatch = responseText.match(/\[ACTION\]:\s*(\w+)/);
  if (actionMatch) {
    action = actionMatch[1];
    responseText = responseText.replace(actionMatch[0], '').trim();
  }

  return {
    response: responseText,
    updatedCampaign,
    action,
  };
}
