import { NextRequest, NextResponse } from 'next/server';
import { smartTruncate } from '@/lib/ad-copy-utils';
import { HEADLINE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/types/ad-generation';
import { auth } from '@/lib/auth';
import { getAnthropicModel } from '@/app/api/settings/api-keys/route';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Default model if user preference not found
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

interface AdGroup {
  id: string;
  name: string;
  keywords: Array<{ keyword: string; metrics?: any }>;
}

interface AdGenerationContext {
  companyName: string;
  productOffering: string;
  keyStatistics: string[];
  keyBenefits: string[];
  targetKeywords: string[];
  language: string;
}

interface GenerateAdsRequest {
  adGroups: AdGroup[];
  campaignType: string;
  goal: string;
  landingPageUrl?: string;
  context?: AdGenerationContext;
}

interface GeneratedAd {
  adGroupId: string;
  headlines: string[];
  descriptions: string[];
  suggestedPaths?: {
    path1: string;
    path2: string;
  };
}

async function generateAdCopyForGroup(
  adGroup: AdGroup,
  campaignType: string,
  goal: string,
  landingPageUrl?: string,
  context?: AdGenerationContext,
  model: string = DEFAULT_ANTHROPIC_MODEL
): Promise<GeneratedAd> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const keywords = context?.targetKeywords?.length
    ? context.targetKeywords.join(', ')
    : adGroup.keywords.map((kw) => kw.keyword).join(', ');

  // Build enhanced system prompt
  const systemPrompt = `You are an expert Google Ads copywriter specializing in high-converting Responsive Search Ads (RSA). Generate compelling ad copy that follows Google Ads policies and best practices.

CRITICAL CHARACTER LIMITS - DO NOT EXCEED:
- Headlines: MAXIMUM 30 characters each (count every character including spaces). Generate EXACTLY 15 headlines.
- Descriptions: MAXIMUM 90 characters each. Generate EXACTLY 4 descriptions.
- NEVER create a headline that would need to be cut off. Every headline MUST be complete and make sense on its own.
- If a phrase would exceed 30 chars, rewrite it to be shorter. Do NOT just cut it off mid-word.

EXAMPLES OF GOOD VS BAD HEADLINES:
❌ BAD (31 chars, would be cut): "Golden Visa Portugal - Get Starte" (cut off mid-word)
✅ GOOD (28 chars): "Golden Visa Portugal - Start"
✅ GOOD (25 chars): "Get Your Golden Visa Now"
✅ GOOD (22 chars): "€500K Golden Visa Deal"

FORMATTING REQUIREMENTS:
- Use Title Case for headlines (capitalize first letter of each major word)
- Include at least 2 headlines with Dynamic Keyword Insertion using format: {KeyWord:Fallback}
- Include power words (Free, Best, Top, Expert, Trusted, Premium, etc.) in at least 3 headlines
- Include numbers, percentages, or statistics when possible
- Include at least one headline with special characters (?, !, $)
- Include calls-to-action in descriptions
- Avoid prohibited content (excessive capitalization, gimmicky punctuation, multiple !! or ??)
- Make each headline and description unique - NO duplicates

DYNAMIC KEYWORD INSERTION (DKI):
- Format: {KeyWord:Fallback} where Fallback is shown if the search term is too long
- The fallback text MUST fit within the character limit
- When counting chars for DKI, count the FALLBACK text, not the whole token
- Example: "Best {KeyWord:Deals} Today" = 21 chars (counts "Best Deals Today")

Return ONLY a JSON object in this exact format:
{
  "headlines": ["headline1", "headline2", ... 15 total],
  "descriptions": ["description1", "description2", "description3", "description4"],
  "suggestedPaths": {
    "path1": "keyword-based-path",
    "path2": "action-or-offer"
  }
}`;

  // Build enhanced user prompt with context
  let userPrompt = `Generate Google Ads copy for:

Ad Group: ${adGroup.name}
Keywords: ${keywords}
Campaign Type: ${campaignType}
Campaign Goal: ${goal}
${landingPageUrl ? `Landing Page: ${landingPageUrl}` : ''}`;

  // Add context if provided
  if (context) {
    userPrompt += `

BUSINESS CONTEXT:
- Company Name: ${context.companyName}
- Product/Service: ${context.productOffering}`;

    if (context.keyStatistics?.length) {
      userPrompt += `
- Key Statistics: ${context.keyStatistics.join(', ')}`;
    }

    if (context.keyBenefits?.length) {
      userPrompt += `
- Key Benefits: ${context.keyBenefits.join(', ')}`;
    }

    userPrompt += `
- Language: ${context.language || 'English'}`;
  }

  userPrompt += `

Generate 15 unique headlines (max 30 chars each) and 4 unique descriptions (max 90 chars each) that:
1. Incorporate the business context naturally
2. Include at least 2 DKI headlines using {KeyWord:Fallback} format
3. Use power words and action-oriented language
4. Include numbers/statistics from the provided data
5. Have clear calls-to-action
6. Suggest relevant URL path segments

Make sure to include "${context?.companyName || adGroup.name}" naturally in some headlines.`;

  console.log(`[Generate Ads API] Using model: ${model}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 3000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Generate Ads API] Anthropic error:', errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Parse JSON response
  let parsedContent;
  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedContent = JSON.parse(jsonMatch[0]);
    } else {
      parsedContent = JSON.parse(content);
    }
  } catch (error) {
    console.error('[Generate Ads API] Failed to parse Claude response:', content);
    throw new Error('Invalid response from Claude AI');
  }

  // Validate and apply smart truncation - respects word boundaries
  const headlines = (parsedContent.headlines || [])
    .slice(0, 15)
    .map((h: string) => {
      const result = smartTruncate(h, HEADLINE_MAX_LENGTH);
      if (result.wasTruncated) {
        console.log(`[Generate Ads API] Smart truncated headline: "${h}" -> "${result.text}"`);
      }
      return result.text;
    });

  const descriptions = (parsedContent.descriptions || [])
    .slice(0, 4)
    .map((d: string) => {
      const result = smartTruncate(d, DESCRIPTION_MAX_LENGTH);
      if (result.wasTruncated) {
        console.log(`[Generate Ads API] Smart truncated description: "${d}" -> "${result.text}"`);
      }
      return result.text;
    });

  // Ensure we have minimum required
  const companyOrGroup = context?.companyName || adGroup.name;
  while (headlines.length < 3) {
    headlines.push(smartTruncate(`Get Started with ${companyOrGroup}`, HEADLINE_MAX_LENGTH).text);
  }
  while (descriptions.length < 2) {
    descriptions.push(smartTruncate(`Discover the best ${companyOrGroup.toLowerCase()} solutions for your needs.`, DESCRIPTION_MAX_LENGTH).text);
  }

  // Extract suggested paths
  const suggestedPaths = parsedContent.suggestedPaths || {
    path1: keywords.split(',')[0]?.trim().substring(0, 15).replace(/\s+/g, '-') || '',
    path2: 'get-started',
  };

  return {
    adGroupId: adGroup.id,
    headlines,
    descriptions,
    suggestedPaths: {
      path1: suggestedPaths.path1?.substring(0, 15) || '',
      path2: suggestedPaths.path2?.substring(0, 15) || '',
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAdsRequest = await request.json();

    const { adGroups, campaignType, goal, landingPageUrl, context } = body;

    if (!adGroups || adGroups.length === 0) {
      return NextResponse.json({ error: 'No ad groups provided' }, { status: 400 });
    }

    // Get user's preferred Anthropic model
    let model = DEFAULT_ANTHROPIC_MODEL;
    try {
      const session = await auth();
      if (session?.user?.email) {
        model = await getAnthropicModel(session.user.email);
      }
    } catch (err) {
      console.log('[Generate Ads API] Could not get user model preference, using default');
    }

    console.log(`[Generate Ads API] Generating ad copy for ${adGroups.length} ad groups...`);
    console.log(`[Generate Ads API] Model preference: ${model}`);
    if (context) {
      console.log(`[Generate Ads API] Using enhanced context: ${context.companyName}`);
    }

    // Generate ads for each ad group
    const ads: GeneratedAd[] = [];

    for (const adGroup of adGroups) {
      try {
        const ad = await generateAdCopyForGroup(adGroup, campaignType, goal, landingPageUrl, context, model);
        ads.push(ad);
        console.log(`[Generate Ads API] Generated ad for group: ${adGroup.name} (${ad.headlines.length} headlines, ${ad.descriptions.length} descriptions)`);
      } catch (error) {
        console.error(`[Generate Ads API] Failed to generate ad for group ${adGroup.name}:`, error);
        // Add fallback ad copy with 15 headlines
        const companyOrGroup = context?.companyName || adGroup.name;
        ads.push({
          adGroupId: adGroup.id,
          headlines: [
            `Get ${companyOrGroup}`,
            `Best ${companyOrGroup}`,
            `${companyOrGroup} Solutions`,
            `Expert ${companyOrGroup}`,
            `Top ${companyOrGroup} Services`,
            `Quality ${companyOrGroup}`,
            `Premium ${companyOrGroup}`,
            `Trusted ${companyOrGroup}`,
            `{KeyWord:${companyOrGroup}}`,
            `Try ${companyOrGroup} Today`,
            `Start with ${companyOrGroup}`,
            `${companyOrGroup} Experts`,
            `Official ${companyOrGroup}`,
            `${companyOrGroup} for You`,
            `${companyOrGroup} Now`,
          ].map((h) => smartTruncate(h, HEADLINE_MAX_LENGTH).text),
          descriptions: [
            `Discover high-quality ${companyOrGroup.toLowerCase()} solutions. Get started today!`,
            `Expert ${companyOrGroup.toLowerCase()} services tailored to your needs. Contact us now!`,
            `Find the perfect ${companyOrGroup.toLowerCase()} solution for your business.`,
            `Trusted by thousands. Try ${companyOrGroup.toLowerCase()} risk-free today!`,
          ].map((d) => smartTruncate(d, DESCRIPTION_MAX_LENGTH).text),
          suggestedPaths: {
            path1: companyOrGroup.substring(0, 15).replace(/\s+/g, '-').toLowerCase(),
            path2: 'get-started',
          },
        });
      }

      // Rate limiting: wait 500ms between requests
      if (adGroups.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[Generate Ads API] Successfully generated ${ads.length} ad groups`);

    return NextResponse.json({
      ads,
      count: ads.length,
    });
  } catch (error) {
    console.error('[Generate Ads API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate ad copy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
