import { NextRequest } from 'next/server';
import { DEFAULT_MODELS, ANTHROPIC_CONFIG } from '@/lib/ai-config';
import { logAICall, logError } from '@/lib/log-store';

interface CampaignData {
  id: string;
  name: string;
  status: string;
  type?: string;
  spend: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas?: number;
  clicks?: number;
  impressions?: number;
}

// Simplified AI chat endpoint with streaming
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, campaigns } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      campaigns?: CampaignData[];
    };

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const systemPrompt = buildSystemPrompt(campaigns);

    const startTime = Date.now();
    logAICall('Chat request started', {
      model: DEFAULT_MODELS.INSIGHT_HUB_CHAT,
      messageCount: messages.length,
      campaignCount: campaigns?.length || 0,
      hasApiKey: !!apiKey,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (apiKey) {
            try {
              await streamAnthropicResponse(apiKey, systemPrompt, messages, controller, encoder);
              logAICall('Chat completed (Anthropic)', {
                model: DEFAULT_MODELS.INSIGHT_HUB_CHAT,
                source: 'anthropic',
              }, startTime);
            } catch (error) {
              // If Anthropic fails, fall back to simulation
              console.warn('[Chat] Anthropic API failed, using simulation:', error);
              logError('ai', 'Anthropic API failed, falling back to simulation', error);
              await simulateResponse(messages, campaigns, controller, encoder);
              logAICall('Chat completed (simulation fallback)', {
                source: 'simulation',
                reason: 'anthropic_failed',
              }, startTime);
            }
          } else {
            await simulateResponse(messages, campaigns, controller, encoder);
            logAICall('Chat completed (simulation)', {
              source: 'simulation',
              reason: 'no_api_key',
            }, startTime);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Streaming failed';
          console.error('[Chat] Error:', errorMessage);
          logError('ai', 'Chat streaming error', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: 'Chat failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function buildSystemPrompt(campaigns?: CampaignData[]) {
  let prompt = `You are an expert Google Ads analyst and optimization specialist working in the Insight Hub. You have direct access to the user's real Google Ads campaign data.

## Your Role
- Analyze campaign performance using ACTUAL data provided below
- Identify optimization opportunities and wasted spend
- Provide specific, actionable recommendations
- Answer questions about campaign metrics accurately
- Be conversational but data-driven

## Response Guidelines
- Use the REAL campaign data below - never make up numbers
- Be concise but thorough
- Use bullet points and formatting for clarity
- When discussing specific campaigns, reference them by name
- Suggest specific actions (pause, increase budget, add negatives)
- If asked about data you don't have, say so honestly`;

  if (campaigns && campaigns.length > 0) {
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConv = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED');
    const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED');
    const avgCPA = totalConv > 0 ? totalSpend / totalConv : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    prompt += `

## REAL CAMPAIGN DATA (${campaigns.length} campaigns)

### Summary Metrics
- **Total Spend:** $${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- **Total Conversions:** ${totalConv.toLocaleString()}
- **Total Clicks:** ${totalClicks.toLocaleString()}
- **Total Impressions:** ${totalImpressions.toLocaleString()}
- **Average CPA:** $${avgCPA.toFixed(2)}
- **Average CTR:** ${avgCTR.toFixed(2)}%
- **Active Campaigns:** ${enabledCampaigns.length}
- **Paused Campaigns:** ${pausedCampaigns.length}

### Individual Campaign Data
`;

    // Sort by spend descending for analysis
    const sortedCampaigns = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0));

    sortedCampaigns.forEach((c, i) => {
      const status = c.status === 'ENABLED' ? '🟢' : '🔴';
      const cpaDisplay = c.conversions > 0 ? `$${(c.spend / c.conversions).toFixed(2)}` : 'N/A (no conversions)';
      const roasDisplay = c.roas ? `${c.roas.toFixed(2)}x` : 'N/A';

      prompt += `
${i + 1}. **${c.name}** ${status} ${c.status}
   - Type: ${c.type || 'Unknown'}
   - Spend: $${(c.spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Conversions: ${c.conversions || 0}
   - CPA: ${cpaDisplay}
   - Clicks: ${c.clicks?.toLocaleString() || 'N/A'}
   - Impressions: ${c.impressions?.toLocaleString() || 'N/A'}
   - CTR: ${c.ctr?.toFixed(2) || 0}%
   - ROAS: ${roasDisplay}
`;
    });

    // Add insights based on data
    prompt += `
### Quick Insights
`;

    // Find high spend, low conversion campaigns
    const wastingCampaigns = campaigns.filter(c => c.spend > 100 && c.conversions === 0);
    if (wastingCampaigns.length > 0) {
      prompt += `- ⚠️ ${wastingCampaigns.length} campaign(s) have spend but NO conversions: ${wastingCampaigns.map(c => c.name).join(', ')}\n`;
    }

    // Find high CPA campaigns
    const highCPACampaigns = campaigns.filter(c => c.conversions > 0 && (c.spend / c.conversions) > avgCPA * 2);
    if (highCPACampaigns.length > 0) {
      prompt += `- 📈 ${highCPACampaigns.length} campaign(s) have CPA 2x above average: ${highCPACampaigns.map(c => c.name).join(', ')}\n`;
    }

    // Find top performers
    const topPerformers = campaigns
      .filter(c => c.conversions > 0)
      .sort((a, b) => (a.spend / a.conversions) - (b.spend / b.conversions))
      .slice(0, 3);
    if (topPerformers.length > 0) {
      prompt += `- 🏆 Top performers by CPA: ${topPerformers.map(c => `${c.name} ($${(c.spend / c.conversions).toFixed(2)})`).join(', ')}\n`;
    }

  } else {
    prompt += `

## NO CAMPAIGN DATA AVAILABLE
The user either has no campaigns or their Google Ads account is not connected.
Guide them to connect their account or create their first campaign.`;
  }

  return prompt;
}

async function streamAnthropicResponse(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const response = await fetch(ANTHROPIC_CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_CONFIG.version,
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.INSIGHT_HUB_CHAT,
      max_tokens: ANTHROPIC_CONFIG.defaultMaxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Chat] Anthropic API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: parsed.delta.text })}\n\n`)
            );
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

async function simulateResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  campaigns: CampaignData[] | undefined,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

  let response = '';

  // If we have real campaigns, provide data-driven responses
  if (campaigns && campaigns.length > 0) {
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const noConversions = campaigns.filter(c => c.conversions === 0 && c.spend > 0);
    const lowConvHighSpend = campaigns.filter(c => c.spend > 100 && c.conversions < 5);
    const topPerformers = campaigns.filter(c => c.conversions > 0).sort((a, b) => (a.spend / a.conversions) - (b.spend / b.conversions));

    if (lastMessage.includes('spend') && lastMessage.includes('low') && (lastMessage.includes('conversion') || lastMessage.includes('conv'))) {
      response = `## Campaigns with High Spend & Low Conversions\n\n`;
      if (lowConvHighSpend.length > 0) {
        response += `Found **${lowConvHighSpend.length} campaigns** that need attention:\n\n`;
        lowConvHighSpend.slice(0, 5).forEach((c, i) => {
          const cpa = c.conversions > 0 ? `$${(c.spend / c.conversions).toFixed(2)}` : '∞ (no conversions)';
          response += `${i + 1}. **${c.name}**\n   - Spend: $${c.spend.toLocaleString()}\n   - Conversions: ${c.conversions}\n   - CPA: ${cpa}\n\n`;
        });
        response += `**Recommendation:** Consider pausing or optimizing these campaigns to reduce wasted spend.`;
      } else {
        response += `Great news! None of your campaigns have high spend with low conversions.`;
      }
    } else if (lastMessage.includes('wast') || (lastMessage.includes('keyword') && lastMessage.includes('budget'))) {
      const wastedAmount = noConversions.reduce((sum, c) => sum + c.spend, 0);
      response = `## Wasted Spend Analysis\n\n`;
      if (noConversions.length > 0) {
        response += `⚠️ **${noConversions.length} campaigns** have spend but NO conversions:\n\n`;
        noConversions.forEach((c, i) => {
          response += `${i + 1}. **${c.name}**: $${c.spend.toLocaleString()} spent\n`;
        });
        response += `\n**Total Potential Waste:** $${wastedAmount.toLocaleString()}\n\n`;
        response += `**Recommendations:**\n- Review search terms reports\n- Add negative keywords\n- Consider pausing non-performers`;
      } else {
        response += `✅ All campaigns with spend have conversions. No immediate waste detected.`;
      }
    } else if (lastMessage.includes('best') || lastMessage.includes('top') || lastMessage.includes('performer')) {
      response = `## Top Performing Campaigns\n\n`;
      if (topPerformers.length > 0) {
        response += `Ranked by lowest CPA (most efficient):\n\n`;
        topPerformers.slice(0, 5).forEach((c, i) => {
          response += `${i + 1}. **${c.name}**\n   - CPA: $${(c.spend / c.conversions).toFixed(2)}\n   - Conversions: ${c.conversions}\n   - Spend: $${c.spend.toLocaleString()}\n\n`;
        });
        response += `**Recommendation:** Consider increasing budget on top performers.`;
      } else {
        response += `No campaigns with conversions yet.`;
      }
    } else if (lastMessage.includes('cpa') || lastMessage.includes('cost per')) {
      response = `## CPA Analysis\n\n**Average CPA:** $${avgCPA.toFixed(2)}\n\n`;
      const withConversions = campaigns.filter(c => c.conversions > 0);
      if (withConversions.length > 0) {
        response += `**By Campaign:**\n`;
        withConversions.sort((a, b) => (a.spend / a.conversions) - (b.spend / b.conversions)).forEach(c => {
          const cpa = c.spend / c.conversions;
          const indicator = cpa < avgCPA ? '✅' : cpa > avgCPA * 1.5 ? '⚠️' : '➖';
          response += `${indicator} ${c.name}: $${cpa.toFixed(2)} (${c.conversions} conv)\n`;
        });
      }
    } else if (lastMessage.includes('summary') || lastMessage.includes('overview')) {
      response = `## Campaign Performance Summary\n\n`;
      response += `- 📊 ${campaigns.length} campaigns (${campaigns.filter(c => c.status === 'ENABLED').length} active)\n`;
      response += `- 💰 $${totalSpend.toLocaleString()} total spend\n`;
      response += `- 🎯 ${totalConversions} conversions\n`;
      response += `- 📈 $${avgCPA.toFixed(2)} average CPA\n`;
      if (topPerformers.length > 0) {
        response += `\n🏆 **Top Performer:** ${topPerformers[0].name}`;
      }
    } else if (lastMessage.includes('hello') || lastMessage.includes('hi')) {
      response = `Hello! 👋 I have access to your **${campaigns.length} campaigns** ($${totalSpend.toLocaleString()} spend).\n\n**Try asking:**\n- "Show me campaigns with high spend but low conversions"\n- "What's my best performing campaign?"\n- "Give me a summary"`;
    } else {
      response = `Based on your **${campaigns.length} campaigns**:\n\n- Total Spend: $${totalSpend.toLocaleString()}\n- Conversions: ${totalConversions}\n- Avg CPA: $${avgCPA.toFixed(2)}\n\n*Ask about specific campaigns, CPA, wasted spend, or top performers!*`;
    }
  } else {
    response = `I don't see any campaign data loaded.\n\nPlease check that your Google Ads account is connected and try again.`;
  }

  // Stream response word by word
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: word })}\n\n`));
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}
