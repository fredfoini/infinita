export type NarrativeProviderId = 'groq' | 'gemini' | 'openai';

export type NarrativeRequest = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

export type NarrativeUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type NarrativeResult<T> = { data: T; usage?: NarrativeUsage };

export interface NarrativeProvider {
  readonly id: NarrativeProviderId;
  readonly model: string;
  isConfigured(): boolean;
  generateJson<T>(request: NarrativeRequest, signal: AbortSignal): Promise<NarrativeResult<T>>;
}

export class NarrativeProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: NarrativeProviderId,
    public readonly status?: number,
    public readonly code?: string,
  ) { super(message); }
}

type ChatPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

function parseJson<T>(value: string, provider: NarrativeProviderId) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  let candidate = cleaned;
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < cleaned.length; index += 1) {
      const character = cleaned[index];
      if (escaped) { escaped = false; continue; }
      if (character === '\\' && inString) { escaped = true; continue; }
      if (character === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (character === '{') depth += 1;
      if (character === '}') depth -= 1;
      if (depth === 0) { candidate = cleaned.slice(start, index + 1); break; }
    }
  }
  try { return JSON.parse(candidate) as T; }
  catch { throw new NarrativeProviderError('O provedor retornou JSON inválido.', provider, undefined, 'invalid_json'); }
}

async function providerFailure(response: Response, provider: NarrativeProviderId) {
  const body = (await response.text()).slice(0, 500);
  let code = `http_${response.status}`;
  if (response.status === 429 || /quota|rate.?limit/i.test(body)) code = 'quota_or_rate_limit';
  else if (response.status >= 500) code = 'provider_unavailable';
  else if (response.status === 401 || response.status === 403) code = 'authentication';
  return new NarrativeProviderError(`${provider} ${response.status}: ${body}`, provider, response.status, code);
}

abstract class OpenAICompatibleProvider implements NarrativeProvider {
  abstract readonly id: 'groq' | 'openai';
  abstract readonly model: string;
  protected abstract readonly apiKey: string;
  protected abstract readonly endpoint: string;
  isConfigured() { return Boolean(this.apiKey && this.model); }

  async generateJson<T>(request: NarrativeRequest, signal: AbortSignal): Promise<NarrativeResult<T>> {
    const response = await fetch(this.endpoint, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }],
        response_format: { type: 'json_object' },
        temperature: request.temperature ?? .8,
        max_tokens: request.maxTokens ?? 900,
      }),
    });
    if (!response.ok) throw await providerFailure(response, this.id);
    const payload = await response.json() as ChatPayload;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new NarrativeProviderError('O provedor retornou uma resposta vazia.', this.id, undefined, 'empty_response');
    return {
      data: parseJson<T>(content, this.id),
      usage: { inputTokens: payload.usage?.prompt_tokens, outputTokens: payload.usage?.completion_tokens, totalTokens: payload.usage?.total_tokens },
    };
  }
}

export class GroqProvider extends OpenAICompatibleProvider {
  readonly id = 'groq' as const;
  readonly model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  protected readonly apiKey = process.env.GROQ_API_KEY || '';
  protected readonly endpoint = 'https://api.groq.com/openai/v1/chat/completions';
}

export class GeminiProvider implements NarrativeProvider {
  readonly id = 'gemini' as const;
  readonly model = process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-3.5-flash';
  private readonly apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  isConfigured() { return Boolean(this.apiKey && this.model); }

  async generateJson<T>(request: NarrativeRequest, signal: AbortSignal): Promise<NarrativeResult<T>> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST', signal,
      headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: request.temperature ?? .8, maxOutputTokens: request.maxTokens ?? 900 },
      }),
    });
    if (!response.ok) throw await providerFailure(response, this.id);
    const payload = await response.json() as GeminiPayload;
    const content = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    if (!content) throw new NarrativeProviderError('O provedor retornou uma resposta vazia.', this.id, undefined, 'empty_response');
    return {
      data: parseJson<T>(content, this.id),
      usage: { inputTokens: payload.usageMetadata?.promptTokenCount, outputTokens: payload.usageMetadata?.candidatesTokenCount, totalTokens: payload.usageMetadata?.totalTokenCount },
    };
  }
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly id = 'openai' as const;
  readonly model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  protected readonly apiKey = process.env.OPENAI_API_KEY || '';
  protected readonly endpoint = 'https://api.openai.com/v1/chat/completions';
}
