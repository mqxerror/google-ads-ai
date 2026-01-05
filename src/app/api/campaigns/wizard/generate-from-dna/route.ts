/**
 * Generate Ad Copy from DNA Report
 *
 * POST /api/campaigns/wizard/generate-from-dna
 *
 * Uses AI to generate proper headlines, long headlines, and descriptions
 * from Brand DNA data for Performance Max and other visual campaigns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateFromDNARequest {
  brandName: string;
  brandPositioning?: string;
  missionVision?: string;
  brandVoice?: string;
  targetMarket?: string;
  uniqueDifferentiators?: string[];
  brandKeywords?: string[];
  brandValues?: Array<{ value: string; description: string }>;
  campaignType: 'PMAX' | 'DISPLAY' | 'DEMAND_GEN';
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GenerateFromDNARequest = await request.json();
    const {
      brandName,
      brandPositioning,
      missionVision,
      brandVoice,
      targetMarket,
      uniqueDifferentiators,
      brandKeywords,
      brandValues,
      campaignType
    } = body;

    if (!brandName) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    console.log(`[Generate from DNA] Generating ad copy for ${brandName}`);

    // Build context from DNA data
    const dnaContext = `
BRAND: ${brandName}

${brandPositioning ? `BRAND POSITIONING: ${brandPositioning}` : ''}

${missionVision ? `MISSION & VISION: ${missionVision}` : ''}

${brandVoice ? `BRAND VOICE: ${brandVoice}` : ''}

${targetMarket ? `TARGET MARKET: ${targetMarket}` : ''}

${uniqueDifferentiators?.length ? `UNIQUE DIFFERENTIATORS:\n${uniqueDifferentiators.map(d => `- ${d}`).join('\n')}` : ''}

${brandKeywords?.length ? `BRAND KEYWORDS: ${brandKeywords.join(', ')}` : ''}

${brandValues?.length ? `BRAND VALUES:\n${brandValues.map(v => `- ${v.value}: ${v.description}`).join('\n')}` : ''}
`.trim();

    const prompt = `You are an expert Google Ads copywriter. Generate ad copy for a ${campaignType === 'PMAX' ? 'Performance Max' : campaignType === 'DISPLAY' ? 'Display' : 'Demand Gen'} campaign based on this brand DNA:

${dnaContext}

Generate the following ad assets. Each must be compelling, action-oriented, and highlight unique value propositions.

REQUIREMENTS:
- Headlines: Write 8 unique, punchy headlines. MUST be 25 characters or less. Keep them SHORT and COMPLETE - never cut off a word.
- Long Headlines: Write 3 longer headlines (max 85 chars). Tell a mini-story or expand on value props. End with complete words.
- Descriptions: Write 4 compelling descriptions (max 85 chars). Expand on benefits, include social proof, or create urgency. End with complete words.

CRITICAL RULES:
- NEVER cut off a word mid-way. Every headline and description must end with a COMPLETE word.
- Headlines must be SHORT (under 25 chars) - use punchy phrases like "Get Your Golden Visa" not long sentences
- NO generic phrases like "Learn More", "Click Here", "Get Started"
- Be specific to the brand - mention real benefits and features
- Vary angles: benefit-focused, urgency-focused, trust-focused, action-focused
- Use power words where appropriate: Free, Save, Exclusive, Proven, Trusted, Expert

GOOD headline examples (short, complete words):
- "Your Path to EU Residency" (22 chars)
- "Expert Visa Guidance" (19 chars)
- "Invest in Portugal Today" (23 chars)

BAD headline examples (too long, words cut off):
- "Join 20,000+ Successful Invest" (word cut off!)
- "Experience Award-Winning Hospi" (word cut off!)

Respond in JSON format:
{
  "headlines": ["headline1", "headline2", ...],
  "longHeadlines": ["long headline 1", "long headline 2", "long headline 3"],
  "descriptions": ["description 1", "description 2", "description 3", "description 4"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Google Ads copywriter. Always respond with valid JSON only, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse JSON response
    let adCopy;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      adCopy = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[Generate from DNA] Failed to parse response:', content);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Smart truncation that preserves complete words
    const smartTruncate = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) return text;

      // Find the last space before the limit
      const truncated = text.slice(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');

      if (lastSpace > maxLength * 0.5) {
        // If we can keep at least half the content, truncate at word boundary
        return truncated.slice(0, lastSpace);
      }

      // Otherwise, just use the truncated version (rare edge case)
      return truncated;
    };

    // Validate and smart-trim to character limits
    const headlines = (adCopy.headlines || [])
      .slice(0, 15)
      .map((h: string) => smartTruncate(h.trim(), 30))
      .filter((h: string) => h.length > 0);

    const longHeadlines = (adCopy.longHeadlines || [])
      .slice(0, 5)
      .map((h: string) => smartTruncate(h.trim(), 90))
      .filter((h: string) => h.length > 0);

    const descriptions = (adCopy.descriptions || [])
      .slice(0, 5)
      .map((d: string) => smartTruncate(d.trim(), 90))
      .filter((d: string) => d.length > 0);

    console.log(`[Generate from DNA] Generated ${headlines.length} headlines, ${longHeadlines.length} long headlines, ${descriptions.length} descriptions`);

    return NextResponse.json({
      success: true,
      headlines,
      longHeadlines,
      descriptions,
      businessName: brandName,
    });

  } catch (error) {
    console.error('[Generate from DNA] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate ad copy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
