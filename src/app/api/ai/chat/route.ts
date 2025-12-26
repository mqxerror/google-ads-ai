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
            await streamAnthropicResponse(apiKey, systemPrompt, messages, controller, encoder);
          } else {
            await simulateResponse(messages, campaigns, controller, encoder);
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

  if (lastMessage.includes('optimize') || lastMessage.includes('improve')) {
    response = `Here are quick optimization actions:\n\n`;
    if (campaigns) {
      const wasteful = campaigns.filter(c => c.status === 'ENABLED' && c.spend > 50 && c.conversions === 0);
      if (wasteful.length > 0) {
        response += `**Pause these low performers:**\n`;
        wasteful.forEach(c => {
          response += `- ${c.name} ($${c.spend.toFixed(0)} spent, 0 conversions)\n`;
        });
      }
      const topPerformers = campaigns.filter(c => c.conversions > 0).sort((a, b) => b.conversions - a.conversions);
      if (topPerformers.length > 0) {
        response += `\n**Scale these winners:**\n`;
        topPerformers.slice(0, 3).forEach(c => {
          response += `- ${c.name} (${c.conversions} conversions)\n`;
        });
      }
    }
    if (response === `Here are quick optimization actions:\n\n`) {
      response = `I'll analyze your campaigns for optimization opportunities. Upload your Google Ads account to get started.`;
    }
  } else if (lastMessage.includes('pause')) {
    response = `I can help you pause campaigns. Which campaign would you like to pause?`;
  } else if (lastMessage.includes('create')) {
    response = `Let's create a new campaign! What type of campaign do you need?\n\n• Search\n• Performance Max\n• Display\n• Shopping`;
  } else {
    response = `I'm your AI Google Ads assistant. I can help you:\n\n• **Optimize** - Find improvement opportunities\n• **Analyze** - Review performance metrics\n• **Create** - Set up new campaigns\n• **Manage** - Pause/enable campaigns\n\nWhat would you like to do?`;
  }

  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: word })}\n\n`));
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
