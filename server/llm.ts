// A minimal chat client for any OpenAI-compatible endpoint. Qwen (QwenCloud) is the default provider;
// Gemini works too through its OpenAI-compatible endpoint. The key is read from the environment only.

export interface LlmConfig {
  provider: 'qwen' | 'gemini';
  baseUrl: string;
  model: string;
  apiKey: string;
}

export type Env = Record<string, string | undefined>;

export function llmConfig(env: Env): LlmConfig | null {
  if (env.AI_DISABLED === '1') return null;
  if (env.QWEN_API_KEY) {
    return {
      provider: 'qwen',
      apiKey: env.QWEN_API_KEY,
      baseUrl: env.LLM_BASE_URL || 'https://maas.qwencloudapi.com/compatible-mode/v1',
      model: env.LLM_MODEL || 'qwen3.8-max',
    };
  }
  if (env.GEMINI_API_KEY) {
    return {
      provider: 'gemini',
      apiKey: env.GEMINI_API_KEY,
      baseUrl: env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: env.LLM_MODEL || 'gemini-3.1-flash-lite',
    };
  }
  return null;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: { type: 'function'; function: { name: string; description: string; parameters: unknown } }[];
  maxTokens?: number;
}

export interface ChatReply {
  content: string | null;
  toolCalls: ToolCall[];
  usage?: { prompt: number; completion: number };
}

/** The shape tests replace with a fake model. */
export type Llm = (req: ChatRequest) => Promise<ChatReply>;

export class LlmError extends Error {}

export function openAiCompatible(cfg: LlmConfig, timeoutMs = 40_000): Llm {
  return async (req) => {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 700,
      temperature: 0.2,
    };
    if (req.tools?.length) {
      body.tools = req.tools;
      body.tool_choice = 'auto';
    }
    // Qwen3 models can skip the long hidden reasoning pass, which keeps answers fast.
    if (cfg.provider === 'qwen') body.enable_thinking = false;

    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new LlmError(e instanceof Error && e.name === 'TimeoutError' ? 'The AI model took too long to answer.' : 'The AI model could not be reached.');
    }
    if (!res.ok) {
      // Never echo the provider's body: it can contain request details.
      throw new LlmError(res.status === 429 ? 'The AI quota is used up for now.' : `The AI model returned an error (${res.status}).`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const msg = json.choices?.[0]?.message;
    if (!msg) throw new LlmError('The AI model returned an empty answer.');
    return {
      content: msg.content ?? null,
      toolCalls: msg.tool_calls ?? [],
      usage: json.usage ? { prompt: json.usage.prompt_tokens ?? 0, completion: json.usage.completion_tokens ?? 0 } : undefined,
    };
  };
}
