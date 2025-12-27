import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface AdGroup {
  id: string;
  name: string;
  keywords: Array<{ keyword: string; metrics?: any }>;
}

interface GenerateAdsRequest {
  adGroups: AdGroup[];
  campaignType: string;
  goal: string;
  landingPageUrl?: string;
}

interface GeneratedAd {
  adGroupId: string;
  headlines: string[];
  descriptions: string[];
}

async function generateAdCopyForGroup(
  adGroup: AdGroup,
  campaignType: string,
  goal: string,
  landingPageUrl?: string
): Promise<GeneratedAd> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const keywords = adGroup.keywords.map((kw) => kw.keyword).join(', ');

  const systemPrompt = `You are an expert Google Ads copywriter. Generate compelling ad copy that follows Google Ads policies and best practices.

STRICT REQUIREMENTS:
- Headlines: Maximum 30 characters each
- Descriptions: Maximum 90 characters each
- Return EXACTLY 8 headlines and 3 descriptions
- Include keywords naturally
- Use action-oriented language
- Include numbers and special offers when possible
- Avoid prohibited content (excessive capitalization, gimmicky punctuation)

Return ONLY a JSON object in this exact format:
{
  "headlines": ["headline1", "headline2", ...],
  "descriptions": ["description1", "description2", ...]
}`;

  const userPrompt = `Generate Google Ads copy for this ad group:

Ad Group Name: ${adGroup.name}
Keywords: ${keywords}
Campaign Type: ${campaignType}
Campaign Goal: ${goal}
${landingPageUrl ? `Landing Page: ${landingPageUrl}` : ''}

Generate 8 headlines (max 30 chars each) and 3 descriptions (max 90 chars each) that are relevant to these keywords and compelling for the target audience.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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

  // Validate and truncate if necessary
  const headlines = (parsedContent.headlines || [])
    .slice(0, 8)
    .map((h: string) => h.substring(0, 30));

  const descriptions = (parsedContent.descriptions || [])
    .slice(0, 3)
    .map((d: string) => d.substring(0, 90));

  // Ensure we have minimum required
  while (headlines.length < 3) {
    headlines.push(`Get Started with ${adGroup.name}`.substring(0, 30));
  }
  while (descriptions.length < 2) {
    descriptions.push(`Discover the best ${adGroup.name.toLowerCase()} solutions for your needs.`.substring(0, 90));
  }

  return {
    adGroupId: adGroup.id,
    headlines,
    descriptions,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAdsRequest = await request.json();

    const { adGroups, campaignType, goal, landingPageUrl } = body;

    if (!adGroups || adGroups.length === 0) {
      return NextResponse.json({ error: 'No ad groups provided' }, { status: 400 });
    }

    console.log(`[Generate Ads API] Generating ad copy for ${adGroups.length} ad groups...`);

    // Generate ads for each ad group
    const ads: GeneratedAd[] = [];

    for (const adGroup of adGroups) {
      try {
        const ad = await generateAdCopyForGroup(adGroup, campaignType, goal, landingPageUrl);
        ads.push(ad);
        console.log(`[Generate Ads API] Generated ad for group: ${adGroup.name}`);
      } catch (error) {
        console.error(`[Generate Ads API] Failed to generate ad for group ${adGroup.name}:`, error);
        // Add fallback ad copy
        ads.push({
          adGroupId: adGroup.id,
          headlines: [
            `Get ${adGroup.name}`,
            `Best ${adGroup.name}`,
            `${adGroup.name} Solutions`,
            `Expert ${adGroup.name}`,
            `Top ${adGroup.name} Services`,
            `Quality ${adGroup.name}`,
            `Premium ${adGroup.name}`,
            `Trusted ${adGroup.name}`,
          ].map((h) => h.substring(0, 30)),
          descriptions: [
            `Discover high-quality ${adGroup.name.toLowerCase()} solutions. Get started today!`,
            `Expert ${adGroup.name.toLowerCase()} services tailored to your needs. Contact us now!`,
            `Find the perfect ${adGroup.name.toLowerCase()} solution for your business.`,
          ].map((d) => d.substring(0, 90)),
        });
      }

      // Rate limiting: wait 500ms between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
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
