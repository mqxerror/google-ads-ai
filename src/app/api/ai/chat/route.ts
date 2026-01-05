import { NextRequest } from 'next/server';

// Simplified AI chat endpoint with streaming
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, campaigns } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      campaigns?: Array<{
        id: string;
        name: string;
        status: string;
        spend: number;
        conversions: number;
        ctr: number;
        cpa: number;
      }>;
    };

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const systemPrompt = buildSystemPrompt(campaigns);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (apiKey) {
            try {
              await streamAnthropicResponse(apiKey, systemPrompt, messages, controller, encoder);
            } catch (error) {
              // If Anthropic fails, fall back to simulation
              console.warn('[Chat] Anthropic API failed, using simulation:', error);
              await simulateResponse(messages, campaigns, controller, encoder);
            }
          } else {
            await simulateResponse(messages, campaigns, controller, encoder);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Streaming failed';
          console.error('[Chat] Error:', errorMessage);
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

function buildSystemPrompt(campaigns?: Array<{ name: string; status: string; spend: number; conversions: number; ctr: number; cpa: number }>) {
  let prompt = `You are an expert Google Ads assistant. Help users optimize campaigns, analyze performance, and take quick actions.

Be concise and actionable. Focus on:
- Identifying optimization opportunities
- Suggesting specific actions (pause, enable, adjust budgets)
- Providing data-driven recommendations`;

  if (campaigns && campaigns.length > 0) {
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalConv = campaigns.reduce((sum, c) => sum + c.conversions, 0);

    prompt += `\n\n## Current Campaigns (${campaigns.length} total)
Total Spend: $${totalSpend.toFixed(2)} | Total Conversions: ${totalConv}

`;
    campaigns.forEach(c => {
      const status = c.status === 'ENABLED' ? '✅' : '⏸️';
      prompt += `${status} **${c.name}**: $${c.spend.toFixed(2)} spend, ${c.conversions} conv, ${c.ctr.toFixed(2)}% CTR, $${c.cpa.toFixed(2)} CPA\n`;
    });
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
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
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
  campaigns: Array<{ name: string; status: string; spend: number; conversions: number }> | undefined,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

  let response = '';

  if (lastMessage.includes('spend') || lastMessage.includes('conversion') || lastMessage.includes('campaign')) {
    response = `Based on your query about campaigns, here's what I found:\n\n**Campaign Performance Overview:**\n\n`;
    if (campaigns && campaigns.length > 0) {
      const highSpend = campaigns.filter(c => c.spend > 100);
      const lowConv = campaigns.filter(c => c.conversions === 0 && c.spend > 0);

      if (highSpend.length > 0) {
        response += `**High Spend Campaigns:**\n`;
        highSpend.slice(0, 3).forEach(c => {
          response += `- ${c.name}: $${c.spend.toFixed(0)} spent, ${c.conversions} conversions\n`;
        });
        response += `\n`;
      }
      if (lowConv.length > 0) {
        response += `**⚠️ Campaigns with spend but no conversions:**\n`;
        lowConv.slice(0, 3).forEach(c => {
          response += `- ${c.name}: $${c.spend.toFixed(0)} wasted\n`;
        });
      }
    } else {
      response += `To see your campaign data, make sure your Google Ads account is connected.\n\n*Tip: Use the Tools menu to access Spend Shield for detailed waste analysis.*`;
    }
  } else if (lastMessage.includes('keyword') || lastMessage.includes('wast')) {
    response = `**Keyword Analysis:**\n\nTo identify wasting keywords, I recommend:\n\n1. **Check Search Terms Report** - Find irrelevant queries\n2. **Add Negative Keywords** - Block wasteful traffic\n3. **Use Spend Shield** - Our AI tool that automatically identifies wasters\n\n*Would you like me to analyze your search terms for potential negative keywords?*`;
  } else if (lastMessage.includes('optimize') || lastMessage.includes('improve')) {
    response = `**Quick Optimization Actions:**\n\n1. **Pause Low Performers** - Campaigns with high spend, low conversions\n2. **Scale Winners** - Increase budget on converting campaigns\n3. **Refine Keywords** - Add negatives to reduce waste\n4. **Improve Ads** - A/B test new headlines\n\n*Which area would you like to focus on?*`;
  } else if (lastMessage.includes('hello') || lastMessage.includes('hi') || lastMessage.includes('hey')) {
    response = `Hello! 👋 I'm your Insight Hub AI assistant.\n\nI can help you with:\n- **Campaign Analysis** - "Show me campaigns with high spend"\n- **Keyword Research** - "What keywords are wasting budget?"\n- **Optimization** - "How can I improve my ROAS?"\n- **Reporting** - "Give me a performance summary"\n\nWhat would you like to explore?`;
  } else {
    response = `I understand you're asking about: "${messages[messages.length - 1]?.content}"\n\nAs your Insight Hub AI, I can help analyze:\n\n• **Google Ads** - Campaigns, keywords, spend\n• **Analytics** - Traffic, conversions, bounce rates\n• **Search Console** - Organic rankings, impressions\n• **Cross-platform insights** - Combined performance view\n\nWhat specific data would you like to explore?`;
  }

  // Stream response word by word
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: word })}\n\n`));
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
