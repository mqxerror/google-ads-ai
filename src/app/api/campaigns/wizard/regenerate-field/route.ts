import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAnthropicModel } from '@/app/api/settings/api-keys/route';
import { smartTruncate } from '@/lib/ad-copy-utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

interface AdGenerationContext {
  companyName: string;
  productOffering: string;
  keyStatistics: string[];
  keyBenefits: string[];
  targetKeywords: string[];
  language: string;
}

interface RegenerateFieldRequest {
  fieldType: 'headline' | 'description';
  fieldIndex: number;
  existingFields: string[];
  context: AdGenerationContext;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegenerateFieldRequest = await request.json();
    const { fieldType, fieldIndex, existingFields, context } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Get user's preferred Anthropic model
    let model = DEFAULT_ANTHROPIC_MODEL;
    try {
      const session = await auth();
      if (session?.user?.email) {
        model = await getAnthropicModel(session.user.email);
      }
    } catch (err) {
      console.log('[Regenerate Field API] Could not get user model preference, using default');
    }

    const isHeadline = fieldType === 'headline';
    const maxLength = isHeadline ? 30 : 90;
    const fieldName = isHeadline ? 'headline' : 'description';

    // Build prompt to generate a single unique field
    const systemPrompt = `You are an expert Google Ads copywriter. Generate a single ${fieldName} that is DIFFERENT from all existing ones provided.

STRICT REQUIREMENTS:
- Maximum ${maxLength} characters
- ${isHeadline ? 'Use Title Case (capitalize first letter of each major word)' : 'Use proper sentence case'}
- ${isHeadline ? 'Consider using Dynamic Keyword Insertion: {KeyWord:Fallback}' : 'Include a clear call-to-action'}
- Include power words when appropriate
- Make it unique and different from existing ${fieldName}s

Return ONLY the ${fieldName} text, nothing else. No quotes, no JSON, just the plain text.`;

    const userPrompt = `Generate a NEW ${fieldName} for:

Company: ${context.companyName}
Product/Service: ${context.productOffering}
Keywords: ${context.targetKeywords.join(', ')}
${context.keyStatistics?.length ? `Statistics: ${context.keyStatistics.join(', ')}` : ''}
${context.keyBenefits?.length ? `Benefits: ${context.keyBenefits.join(', ')}` : ''}

EXISTING ${fieldName.toUpperCase()}S (generate something DIFFERENT):
${existingFields
  .map((f, i) => `${i + 1}. ${f || '(empty)'}`)
  .join('\n')}

Generate a unique ${fieldName} for position ${fieldIndex + 1} that is different from all the above.
${isHeadline ? 'Consider using {KeyWord:Fallback} format for dynamic insertion.' : ''}`;

    console.log(`[Regenerate Field API] Using model: ${model}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 100,
        temperature: 0.8, // Higher temperature for more variety
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
      console.error('[Regenerate Field API] Anthropic error:', errorText);
      return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
    }

    const data = await response.json();
    let newValue = data.content[0].text.trim();

    // Clean up the response - remove quotes if present
    newValue = newValue.replace(/^["']|["']$/g, '').trim();

    // Use smart truncation to ensure it fits within character limit (respects word boundaries)
    if (newValue.length > maxLength) {
      const truncated = smartTruncate(newValue, maxLength);
      if (truncated.wasTruncated) {
        console.log(`[Regenerate Field API] Smart truncated: "${newValue}" -> "${truncated.text}"`);
      }
      newValue = truncated.text;
    }

    console.log(`[Regenerate Field API] Generated new ${fieldType}: "${newValue}"`);

    return NextResponse.json({
      newValue,
      fieldType,
      fieldIndex,
    });
  } catch (error) {
    console.error('[Regenerate Field API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate field', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
