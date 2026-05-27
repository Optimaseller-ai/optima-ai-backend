/**
 * OpenRouter client — exécution LLM sur Railway (hors Vercel serverless).
 */

import { loadEnv } from "../../config/env.js";

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

export type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_CHAT_TIMEOUT_MS = 25_000;
const DEFAULT_EMBED_TIMEOUT_MS = 20_000;

export class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "OpenRouterRequestError";
  }
}

function parseRetryAfterMs(resp: Response): number | undefined {
  const h = resp.headers.get("retry-after");
  if (!h) return undefined;
  const sec = Number(h);
  if (!Number.isFinite(sec)) return undefined;
  return Math.min(Math.max(0, Math.round(sec * 1000)), 120_000);
}

export async function openRouterChat(args: {
  model?: string;
  messages: OpenRouterMessage[];
  timeoutMs?: number;
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}): Promise<string> {
  const env = loadEnv();
  if (!env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("Missing OPENROUTER_API_KEY on AI backend");
  }

  const model = args.model ?? "openai/gpt-4o-mini";
  const timeoutMs = args.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
  const maxTokens = args.maxTokens ?? 1200;
  const temperature = args.temperature ?? 0.85;
  const topP = args.topP ?? 0.9;
  const presencePenalty = args.presencePenalty ?? 0.4;
  const frequencyPenalty = args.frequencyPenalty ?? 0.3;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = env.OPENROUTER_SITE_URL;
  if (env.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = env.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = args.signal
    ? AbortSignal.any([controller.signal, args.signal])
    : controller.signal;

  const started = Date.now();

  try {
    const resp = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature,
        top_p: topP,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        max_tokens: maxTokens,
      }),
      signal,
    });

    const json = (await resp.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (resp.status === 429) {
      throw new OpenRouterRequestError(
        json?.error?.message ?? `OpenRouter rate limited (${resp.status})`,
        429,
        parseRetryAfterMs(resp),
      );
    }
    if (!resp.ok) {
      throw new OpenRouterRequestError(
        json?.error?.message ?? `OpenRouter error (${resp.status})`,
        resp.status,
      );
    }

    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new OpenRouterRequestError("OpenRouter: empty response", 502);
    }

    console.log("[OPTIMA_AI_BACKEND] openrouter_chat_ok", {
      model,
      durationMs: Date.now() - started,
      messageCount: args.messages.length,
    });

    return content.trim();
  } catch (e) {
    if (e instanceof OpenRouterRequestError) throw e;
    if (controller.signal.aborted) {
      throw new OpenRouterRequestError("OpenRouter request timeout", 408);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function openRouterEmbed(args: {
  model?: string;
  input: string;
  timeoutMs?: number;
}): Promise<number[]> {
  const env = loadEnv();
  if (!env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("Missing OPENROUTER_API_KEY on AI backend");
  }
  const model = args.model ?? env.OPENROUTER_EMBEDDING_MODEL;
  const timeoutMs = args.timeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = env.OPENROUTER_SITE_URL;
  if (env.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = env.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: args.input }),
      signal: controller.signal,
    });

    const json = (await resp.json().catch(() => ({}))) as {
      error?: { message?: string };
      data?: Array<{ embedding?: number[] }>;
    };

    if (!resp.ok) {
      throw new OpenRouterRequestError(
        json?.error?.message ?? `OpenRouter embed error (${resp.status})`,
        resp.status,
      );
    }

    const vec = json?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length < 10) {
      throw new OpenRouterRequestError("Invalid embedding response", 502);
    }
    return vec;
  } finally {
    clearTimeout(timer);
  }
}
