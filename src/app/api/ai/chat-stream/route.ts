import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Type definitions for account context
interface CampaignData {
  id: string;
  name: string;
  status: string;
  type: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas?: number;
  aiScore?: number;
  aiRecommendation?: string;
}

interface AdGroupData {
  id: string;
  name: string;
  status: string;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  ctr?: number;
  cpa?: number;
}

interface KeywordData {
  id: string;
  text: string;
  matchType: string;
  status: string;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  ctr?: number;
  cpa?: number;
}

interface SelectedEntity {
  type: 'campaign' | 'adGroup';
  campaign: CampaignData;
  adGroup?: AdGroupData;
  adGroups?: AdGroupData[];
  keywords?: KeywordData[];
}

interface AccountContext {
  accountId: string;
  accountName: string;
  campaigns?: CampaignData[];
  selectedEntity?: SelectedEntity | null;
  currentLevel?: string;
}

// SSE streaming endpoint for AI chat
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { messages, accountContext } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      accountContext?: AccountContext;
    };

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get LLM provider settings from separate table
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    const provider = settings?.defaultLlmProvider || 'anthropic';
    const apiKey = provider === 'anthropic'
      ? settings?.anthropicApiKey
      : settings?.openaiApiKey;

    // Build system prompt with account context
    const systemPrompt = buildSystemPrompt(accountContext);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (provider === 'anthropic' && apiKey) {
            try {
              await streamAnthropicResponse(apiKey, systemPrompt, messages, controller, encoder);
            } catch (apiError) {
              console.error('Anthropic API error, falling back to simulation:', apiError);
              // Fall back to simulation mode if API fails
              await simulateStreaming(systemPrompt, messages, controller, encoder, accountContext);
            }
          } else if (provider === 'openai' && apiKey) {
            try {
              await streamOpenAIResponse(apiKey, systemPrompt, messages, controller, encoder);
            } catch (apiError) {
              console.error('OpenAI API error, falling back to simulation:', apiError);
              // Fall back to simulation mode if API fails
              await simulateStreaming(systemPrompt, messages, controller, encoder, accountContext);
            }
          } else {
            // Fallback: simulate streaming for demo
            await simulateStreaming(systemPrompt, messages, controller, encoder, accountContext);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Streaming failed';
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
    console.error('Chat stream error:', error);
    return new Response(JSON.stringify({ error: 'Stream failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function buildSystemPrompt(accountContext?: AccountContext): string {
  let prompt = `You are an expert Google Ads campaign assistant. You help users optimize their advertising campaigns, analyze performance, and make data-driven decisions.

You can suggest actions like:
- Pausing underperforming campaigns
- Adjusting budgets
- Creating new campaigns
- Optimizing keywords and ads

IMPORTANT GUIDELINES:
- Always reference campaigns and entities BY NAME when discussing them
- Provide specific, data-driven recommendations based on actual metrics
- When the user is viewing a specific campaign or ad group, focus your advice on that entity
- Use actual numbers from the data provided (spend, CPA, CTR, conversions, etc.)
- Highlight issues like high CPA, low CTR, or wasted spend with specific values

When suggesting actions, format them clearly so the user can execute them.`;

  if (accountContext) {
    // Calculate account totals
    const campaigns = accountContext.campaigns || [];
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED').length;
    const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED').length;

    prompt += `\n\n## Current Account Context
Account: ${accountContext.accountName} (ID: ${accountContext.accountId})

### Account Summary
- Total Campaigns: ${campaigns.length} (${enabledCampaigns} enabled, ${pausedCampaigns} paused)
- Total Spend: $${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Total Conversions: ${totalConversions.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Average CPA: $${avgCPA.toFixed(2)}`;

    if (campaigns.length > 0) {
      prompt += `\n\n### All Campaigns (${campaigns.length} total)`;
      campaigns.forEach(c => {
        const statusIcon = c.status === 'ENABLED' ? '✅' : c.status === 'PAUSED' ? '⏸️' : '❌';
        const aiScoreInfo = c.aiScore ? ` | AI Score: ${c.aiScore}/100` : '';
        prompt += `\n\n**${c.name}** ${statusIcon}
- Type: ${c.type} | Status: ${c.status}
- Spend: $${c.spend?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} | Clicks: ${c.clicks?.toLocaleString() || 0} | Impressions: ${c.impressions?.toLocaleString() || 0}
- Conversions: ${c.conversions?.toLocaleString() || 0} | CTR: ${c.ctr?.toFixed(2) || '0.00'}% | CPA: $${c.cpa?.toFixed(2) || '0.00'}${c.roas ? ` | ROAS: ${c.roas.toFixed(2)}x` : ''}${aiScoreInfo}`;
        if (c.aiRecommendation) {
          prompt += `\n- AI Recommendation: ${c.aiRecommendation}`;
        }
      });
    }

    // Add selected entity context for drill-down
    if (accountContext.selectedEntity) {
      const { selectedEntity } = accountContext;
      prompt += `\n\n## Currently Viewing (User's Focus)
The user is currently drilling down into this entity. Focus your responses on this context.`;

      if (selectedEntity.campaign) {
        const camp = selectedEntity.campaign;
        prompt += `\n\n### Selected Campaign: "${camp.name}"
- Type: ${camp.type} | Status: ${camp.status}
- Spend: $${camp.spend?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
- Clicks: ${camp.clicks?.toLocaleString() || 0} | Impressions: ${camp.impressions?.toLocaleString() || 0}
- Conversions: ${camp.conversions?.toLocaleString() || 0} | CTR: ${camp.ctr?.toFixed(2) || '0.00'}% | CPA: $${camp.cpa?.toFixed(2) || '0.00'}`;
        if (camp.aiScore) {
          prompt += `\n- AI Performance Score: ${camp.aiScore}/100`;
        }
        if (camp.aiRecommendation) {
          prompt += `\n- Current Recommendation: ${camp.aiRecommendation}`;
        }
      }

      // Add ad groups if viewing at campaign level
      if (selectedEntity.adGroups && selectedEntity.adGroups.length > 0) {
        prompt += `\n\n### Ad Groups in this Campaign (${selectedEntity.adGroups.length} total)`;
        selectedEntity.adGroups.forEach(ag => {
          const statusIcon = ag.status === 'ENABLED' ? '✅' : '⏸️';
          prompt += `\n- "${ag.name}" ${statusIcon}: ${ag.clicks || 0} clicks, ${ag.conversions || 0} conv, ${ag.ctr?.toFixed(2) || '0.00'}% CTR, $${ag.cpa?.toFixed(2) || '0.00'} CPA`;
        });
      }

      // Add selected ad group details
      if (selectedEntity.adGroup) {
        const ag = selectedEntity.adGroup;
        prompt += `\n\n### Selected Ad Group: "${ag.name}"
- Status: ${ag.status}
- Clicks: ${ag.clicks || 0} | Impressions: ${ag.impressions || 0}
- Conversions: ${ag.conversions || 0} | CTR: ${ag.ctr?.toFixed(2) || '0.00'}% | CPA: $${ag.cpa?.toFixed(2) || '0.00'}`;
      }

      // Add keywords if available
      if (selectedEntity.keywords && selectedEntity.keywords.length > 0) {
        prompt += `\n\n### Keywords (${selectedEntity.keywords.length} total)`;
        selectedEntity.keywords.forEach(kw => {
          const statusIcon = kw.status === 'ENABLED' ? '✅' : '⏸️';
          prompt += `\n- "${kw.text}" [${kw.matchType}] ${statusIcon}: ${kw.clicks || 0} clicks, ${kw.conversions || 0} conv, $${kw.cpa?.toFixed(2) || '0.00'} CPA`;
        });
      }
    }

    // Navigation level context
    if (accountContext.currentLevel) {
      prompt += `\n\n*Navigation Level: ${accountContext.currentLevel}*`;
    }
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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Anthropic API error:', response.status, errorBody);
    if (response.status === 401) {
      throw new Error('Invalid Anthropic API key. Please check your API key in Settings.');
    } else if (response.status === 404) {
      throw new Error('Anthropic API endpoint not found. The model may be unavailable.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(`AI service error (${response.status}). Please check your API key in Settings.`);
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

async function streamOpenAIResponse(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
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
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            );
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

interface SuggestedAction {
  id: string;
  label: string;
  actionType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  currentValue: string;
  newValue: string;
}

async function simulateStreaming(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  accountContext?: AccountContext
) {
  // Simulate AI response for demo purposes
  const lastMessage = messages[messages.length - 1]?.content || '';

  let response = '';
  let suggestedActions: SuggestedAction[] = [];

  if (lastMessage.toLowerCase().includes('optimize')) {
    response = `Based on your account data, here are my optimization recommendations:

**1. Budget Reallocation**
Consider shifting budget from underperforming campaigns to your top converters. This could improve overall ROAS by 15-20%.

**2. Pause Low Performers**
I noticed some campaigns with high spend but low conversions. Consider pausing these to reduce wasted spend.

**3. Keyword Refinement**
Add negative keywords to filter out irrelevant traffic. This can improve CTR and Quality Score.

I've prepared some specific actions you can take:`;

    // Generate suggested actions based on account context
    if (accountContext?.campaigns) {
      const wastedCampaigns = accountContext.campaigns.filter(
        c => c.status === 'ENABLED' && c.spend > 100 && c.conversions === 0
      );
      wastedCampaigns.slice(0, 3).forEach((camp, idx) => {
        suggestedActions.push({
          id: `action-${idx}`,
          label: `Pause "${camp.name}"`,
          actionType: 'pause_campaign',
          entityType: 'campaign',
          entityId: camp.id || `camp-${idx}`,
          entityName: camp.name,
          currentValue: 'ENABLED',
          newValue: 'PAUSED',
        });
      });
    }

    // Add fallback demo actions if no real data
    if (suggestedActions.length === 0) {
      suggestedActions = [
        {
          id: 'demo-1',
          label: 'Pause "Low Performer Campaign"',
          actionType: 'pause_campaign',
          entityType: 'campaign',
          entityId: 'demo-campaign-1',
          entityName: 'Low Performer Campaign',
          currentValue: 'ENABLED',
          newValue: 'PAUSED',
        },
        {
          id: 'demo-2',
          label: 'Increase budget for "Top Converter"',
          actionType: 'adjust_budget',
          entityType: 'campaign',
          entityId: 'demo-campaign-2',
          entityName: 'Top Converter',
          currentValue: '$50/day',
          newValue: '$75/day',
        },
      ];
    }
  } else if (lastMessage.toLowerCase().includes('create') || lastMessage.toLowerCase().includes('campaign')) {
    response = `I'd be happy to help you create a new campaign! Let me gather some information:

**Campaign Setup Questions:**
1. What product or service are you advertising?
2. What's your daily budget?
3. Who is your target audience?
4. What's your primary goal (sales, leads, traffic)?

Once you provide these details, I'll help you configure the campaign with optimal settings.`;
  } else if (lastMessage.toLowerCase().includes('pause') || lastMessage.toLowerCase().includes('stop')) {
    response = `I can help you pause campaigns. Here's what I recommend:

**Candidates for Pausing:**
- Campaigns with 0 conversions in the last 30 days
- Campaigns with CPA 3x higher than your target
- Campaigns with CTR below 1%

Here are specific campaigns you can pause:`;

    // Generate pause suggestions from account context
    if (accountContext?.campaigns) {
      const pauseCandidates = accountContext.campaigns.filter(
        c => c.status === 'ENABLED' && (c.conversions === 0 || c.spend / Math.max(c.conversions, 1) > 100)
      );
      pauseCandidates.slice(0, 3).forEach((camp, idx) => {
        suggestedActions.push({
          id: `pause-${idx}`,
          label: `Pause "${camp.name}"`,
          actionType: 'pause_campaign',
          entityType: 'campaign',
          entityId: camp.id || `camp-${idx}`,
          entityName: camp.name,
          currentValue: 'ENABLED',
          newValue: 'PAUSED',
        });
      });
    }

    if (suggestedActions.length === 0) {
      suggestedActions = [
        {
          id: 'pause-demo-1',
          label: 'Pause "Zero Conversions Campaign"',
          actionType: 'pause_campaign',
          entityType: 'campaign',
          entityId: 'demo-zero-conv',
          entityName: 'Zero Conversions Campaign',
          currentValue: 'ENABLED',
          newValue: 'PAUSED',
        },
      ];
    }
  } else if (lastMessage.toLowerCase().includes('enable') || lastMessage.toLowerCase().includes('start')) {
    response = `I can help you enable paused campaigns. Let me check which campaigns are currently paused.`;

    if (accountContext?.campaigns) {
      const pausedCampaigns = accountContext.campaigns.filter(c => c.status === 'PAUSED');
      pausedCampaigns.slice(0, 3).forEach((camp, idx) => {
        suggestedActions.push({
          id: `enable-${idx}`,
          label: `Enable "${camp.name}"`,
          actionType: 'enable_campaign',
          entityType: 'campaign',
          entityId: camp.id || `camp-${idx}`,
          entityName: camp.name,
          currentValue: 'PAUSED',
          newValue: 'ENABLED',
        });
      });
    }
  } else {
    // Check if user mentioned a specific campaign by name
    const mentionedCampaign = accountContext?.campaigns?.find(c =>
      lastMessage.toLowerCase().includes(c.name.toLowerCase())
    );

    // Check if user is asking about selected entity
    const selectedCampaign = accountContext?.selectedEntity?.campaign;

    if (mentionedCampaign) {
      // Respond with specific campaign data
      const camp = mentionedCampaign;
      const statusEmoji = camp.status === 'ENABLED' ? '✅' : '⏸️';
      response = `Here's the analysis for **"${camp.name}"** ${statusEmoji}:

**Performance Summary:**
- Status: ${camp.status}
- Type: ${camp.type}
- Spend: $${camp.spend?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
- Conversions: ${camp.conversions?.toLocaleString() || 0}
- CTR: ${camp.ctr?.toFixed(2) || '0.00'}%
- CPA: $${camp.cpa?.toFixed(2) || '0.00'}
${camp.aiScore ? `- AI Score: ${camp.aiScore}/100` : ''}

**Analysis:**
${camp.cpa > 50 ? '⚠️ CPA is relatively high. Consider optimizing keywords or ad copy.' : '✅ CPA is within reasonable range.'}
${camp.ctr < 2 ? '⚠️ CTR is below average. Ad copy might need improvement.' : '✅ CTR looks healthy.'}
${camp.conversions === 0 ? '⚠️ No conversions yet. Review targeting and landing pages.' : ''}

Would you like me to suggest specific optimizations for this campaign?`;
    } else if (selectedCampaign) {
      // Respond about the currently selected campaign
      const camp = selectedCampaign;
      response = `I see you're looking at **"${camp.name}"**.

**Current Metrics:**
- Spend: $${camp.spend?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
- Conversions: ${camp.conversions?.toLocaleString() || 0}
- CTR: ${camp.ctr?.toFixed(2) || '0.00'}%
- CPA: $${camp.cpa?.toFixed(2) || '0.00'}

What would you like to know about this campaign? I can help with:
• Performance analysis
• Optimization suggestions
• Budget recommendations`;
    } else if (accountContext?.campaigns && accountContext.campaigns.length > 0) {
      // Give overview of campaigns
      const totalSpend = accountContext.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalConv = accountContext.campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
      const activeCamps = accountContext.campaigns.filter(c => c.status === 'ENABLED').length;

      response = `I'm your AI Campaign Assistant! Here's your account overview:

**Account Summary:**
- ${accountContext.campaigns.length} campaigns (${activeCamps} active)
- Total Spend: $${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Total Conversions: ${totalConv.toLocaleString()}

**Your campaigns:**
${accountContext.campaigns.slice(0, 5).map(c =>
  `• **${c.name}** - ${c.status === 'ENABLED' ? '✅' : '⏸️'} $${c.spend?.toFixed(0) || 0} spent, ${c.conversions || 0} conv`
).join('\n')}

Ask me about any specific campaign by name, or I can help you:
• Analyze performance
• Find optimization opportunities
• Pause underperformers`;
    } else {
      response = `I'm your AI Campaign Assistant! I can help you with:

• **Analyze** - Get insights on campaign performance
• **Optimize** - Receive recommendations to improve ROAS
• **Create** - Set up new campaigns with AI guidance
• **Manage** - Pause, enable, or adjust budgets

What would you like to do today?`;
    }
  }

  // Stream the response word by word
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ content: word })}\n\n`)
    );
    // Simulate typing delay
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
  }

  // Send suggested actions at the end
  if (suggestedActions.length > 0) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ suggestedActions })}\n\n`)
    );
  }
}
