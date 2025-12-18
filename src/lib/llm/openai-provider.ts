import {
  ILLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMMessage,
  DEFAULT_MODELS,
} from './types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements ILLMProvider {
  name = 'openai' as const;
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model || DEFAULT_MODELS.openai;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const messages: OpenAIMessage[] = request.messages.map((msg: LLMMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data: OpenAIResponse = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      model: data.model,
      provider: 'openai',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: choice.finish_reason || 'stop',
    };
  }

  async *streamComplete(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const messages: OpenAIMessage[] = request.messages.map((msg: LLMMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { content: delta.content, done: false };
            }
            if (parsed.choices?.[0]?.finish_reason) {
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
