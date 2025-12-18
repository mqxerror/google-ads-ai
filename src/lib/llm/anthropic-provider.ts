import {
  ILLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  DEFAULT_MODELS,
} from './types';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider implements ILLMProvider {
  name = 'anthropic' as const;
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = model || DEFAULT_MODELS.anthropic;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured');
    }

    // Extract system message and convert remaining messages
    let systemPrompt = '';
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        system: systemPrompt || undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data: AnthropicResponse = await response.json();

    const content = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return {
      content,
      model: data.model,
      provider: 'anthropic',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: data.stop_reason === 'end_turn' ? 'stop' :
                    data.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  async *streamComplete(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured');
    }

    // Extract system message and convert remaining messages
    let systemPrompt = '';
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        system: systemPrompt || undefined,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

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
          if (data === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield { content: parsed.delta.text, done: false };
            } else if (parsed.type === 'message_stop') {
              yield { content: '', done: true };
              return;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    yield { content: '', done: true };
  }
}
