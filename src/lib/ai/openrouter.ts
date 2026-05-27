import "server-only";

import { Agent } from "undici";
import { serverEnv } from "@/lib/server-env";
import { logOpenRouterProxyConfigOnce } from "@/lib/ai/openrouter-proxy-config";
import { openRouterChatViaBackend, openRouterEmbedViaBackend } from "@/lib/ai/openrouter-backend-client";

export {
  isOpenRouterDelegatedToBackend,
  logOpenRouterProxyConfigOnce,
  resolveOpenRouterProxyConfig,
} from "@/lib/ai/openrouter-proxy-config";

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

/** Shared keep-alive pool for OpenRouter (Node runtime only). */
export const openRouterKeepAliveAgent = new Agent({
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 120_000,
});

export type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_CHAT_TIMEOUT_MS = 25_000;
const DEFAULT_EMBED_TIMEOUT_MS = 20_000;

export class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterMs?: number,
    public readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "OpenRouterRequestError";
  }
}

function estimateTokensFromChars(chars: number) {
  return Math.ceil(chars / 4);
}

function promptStats(messages: OpenRouterMessage[]) {
  let chars = 0;
  for (const m of messages) {
    chars += (m.content?.length ?? 0) + (m.role?.length ?? 0);
  }
  return { promptChars: chars, estimatedPromptTokens: estimateTokensFromChars(chars) };
}

function anyAbortSignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  const fail = () => {
    try {
      ctrl.abort();
    } catch {
      /* noop */
    }
  };
  for (const s of signals) {
    if (s.aborted) {
      fail();
      return ctrl.signal;
    }
    s.addEventListener("abort", fail, { once: true });
  }
  return ctrl.signal;
}

function parseRetryAfterMs(resp: Response): number | undefined {
  const h = resp.headers.get("retry-after");
  if (!h) return undefined;
  const sec = Number(h);
  if (!Number.isFinite(sec)) return undefined;
  return Math.min(Math.max(0, Math.round(sec * 1000)), 120_000);
}

function logOpenRouterChatAttempt(args: {
  phase: "request" | "success" | "error";
  model: string;
  durationMs?: number;
  status?: number;
  estimatedPromptTokens?: number;
  promptChars?: number;
  timeoutMs?: number;
  error?: unknown;
  message?: string;
}) {
  const base = {
    model: args.model,
    ...(args.durationMs !== undefined ? { durationMs: args.durationMs } : {}),
    ...(args.status !== undefined ? { httpStatus: args.status } : {}),
    ...(args.estimatedPromptTokens !== undefined ? { estimatedPromptTokens: args.estimatedPromptTokens } : {}),
    ...(args.promptChars !== undefined ? { promptChars: args.promptChars } : {}),
    ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
  };
  if (args.phase === "request") {
    console.log("[OPTIMA_AI_OPENROUTER_CHAT]", args.phase, base);
    return;
  }
  if (args.phase === "success") {
    console.log("[OPTIMA_AI_OPENROUTER_CHAT]", args.phase, base);
    return;
  }
  console.error("[OPTIMA_AI_OPENROUTER_CHAT]", args.phase, {
    ...base,
    errorMessage: args.message ?? (args.error instanceof Error ? args.error.message : String(args.error)),
    ...(args.error instanceof OpenRouterRequestError && args.error.retryAfterMs !== undefined
      ? { retryAfterMs: args.error.retryAfterMs }
      : {}),
  });
}

export async function openRouterChat(args: {
  model?: string;
  messages: OpenRouterMessage[];
  timeoutMs?: number;
  signal?: AbortSignal;
  maxTokens?: number;
  /** Logs enrichis budget (optionnel). */
  promptBudget?: {
    finalPromptTokens: number;
    finalMaxTokens: number;
    remainingBudget: number;
    compressed?: boolean;
  };
}) {
  const proxyCfg = logOpenRouterProxyConfigOnce();

  if (proxyCfg.backendEnabled) {
    console.log("[OPTIMA_PROXY] using_railway_backend", { operation: "chat", messageCount: args.messages.length });
    return openRouterChatViaBackend({
      model: args.model ?? serverEnv.OPENROUTER_MODEL,
      messages: args.messages,
      timeoutMs: args.timeoutMs,
      maxTokens: args.maxTokens,
    });
  }

  console.warn("[OPTIMA_PROXY] fallback_local_openrouter", {
    operation: "chat",
    reasons: proxyCfg.disableReasons,
  });

  if (!serverEnv.OPENROUTER_API_KEY) {
    console.error("[openRouterChat] Missing OPENROUTER_API_KEY");
    throw new Error("Missing OPENROUTER_API_KEY on server.");
  }

  const model = args.model ?? serverEnv.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  const timeoutMs = args.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
  const { promptChars, estimatedPromptTokens } = promptStats(args.messages);

  const maxTokens = args.maxTokens ?? 1200;

  logOpenRouterChatAttempt({
    phase: "request",
    model,
    estimatedPromptTokens: args.promptBudget?.finalPromptTokens ?? estimatedPromptTokens,
    promptChars,
    timeoutMs,
  });

  if (args.promptBudget) {
    console.log("[OPTIMA_PROMPT_BUDGET]", "openrouter_send", {
      finalPromptTokens: args.promptBudget.finalPromptTokens,
      finalMaxTokens: args.promptBudget.finalMaxTokens,
      remainingBudget: args.promptBudget.remainingBudget,
      compressed: args.promptBudget.compressed ?? false,
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    Connection: "keep-alive",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signals: AbortSignal[] = [controller.signal];
  if (args.signal) signals.push(args.signal);
  const combined = anyAbortSignal(signals);

  const started = Date.now();

  try {
    const resp = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: args.messages,
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
      signal: combined,
      dispatcher: openRouterKeepAliveAgent,
    } as RequestInit);

    const durationMs = Date.now() - started;

    const json = (await resp.json().catch(() => ({}))) as any;

    if (resp.status === 429) {
      const retryAfterMs = parseRetryAfterMs(resp);
      const msg =
        typeof json?.error?.message === "string" ? json.error.message : `OpenRouter rate limited (HTTP ${resp.status})`;
      const err = new OpenRouterRequestError(msg, 429, retryAfterMs, JSON.stringify(json?.error ?? {}).slice(0, 400));
      console.error("[OPTIMA_AI_ERROR]", err);
      logOpenRouterChatAttempt({
        phase: "error",
        model,
        durationMs,
        status: 429,
        estimatedPromptTokens,
        promptChars,
        timeoutMs,
        error: err,
        message: err.message,
      });
      throw err;
    }

    if (resp.status >= 500) {
      const msg =
        typeof json?.error?.message === "string" ? json.error.message : `OpenRouter server error (HTTP ${resp.status})`;
      const err = new OpenRouterRequestError(msg, resp.status, undefined, JSON.stringify(json?.error ?? {}).slice(0, 400));
      console.error("[OPTIMA_AI_ERROR]", err);
      logOpenRouterChatAttempt({
        phase: "error",
        model,
        durationMs,
        status: resp.status,
        estimatedPromptTokens,
        promptChars,
        timeoutMs,
        error: err,
        message: err.message,
      });
      throw err;
    }

    if (!resp.ok) {
      const msg = typeof json?.error?.message === "string" ? json.error.message : `OpenRouter error (HTTP ${resp.status})`;
      const err = new OpenRouterRequestError(msg, resp.status, undefined, JSON.stringify(json?.error ?? {}).slice(0, 400));
      console.error("[OPTIMA_AI_ERROR]", err);
      logOpenRouterChatAttempt({
        phase: "error",
        model,
        durationMs,
        status: resp.status,
        estimatedPromptTokens,
        promptChars,
        timeoutMs,
        error: err,
        message: err.message,
      });
      throw err;
    }

    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      const err = new OpenRouterRequestError("OpenRouter: empty response.", 502);
      console.error("[OPTIMA_AI_ERROR]", err);
      logOpenRouterChatAttempt({
        phase: "error",
        model,
        durationMs,
        status: 502,
        estimatedPromptTokens,
        promptChars,
        timeoutMs,
        error: err,
        message: err.message,
      });
      throw err;
    }

    logOpenRouterChatAttempt({
      phase: "success",
      model,
      durationMs,
      status: resp.status,
      estimatedPromptTokens,
      promptChars,
      timeoutMs,
    });

    return content.trim();
  } catch (e) {
    const durationMs = Date.now() - started;
    if (e instanceof OpenRouterRequestError) throw e;

    const aborted =
      (e instanceof Error && e.name === "AbortError") || (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");
    if (aborted || controller.signal.aborted) {
      const err = new OpenRouterRequestError("OpenRouter request aborted (timeout).", 408);
      console.error("[OPTIMA_AI_ERROR]", err);
      logOpenRouterChatAttempt({
        phase: "error",
        model,
        durationMs,
        status: 408,
        estimatedPromptTokens,
        promptChars,
        timeoutMs,
        error: err,
        message: err.message,
      });
      throw err;
    }

    console.error("[OPTIMA_AI_ERROR]", e);
    logOpenRouterChatAttempt({
      phase: "error",
      model,
      durationMs,
      estimatedPromptTokens,
      promptChars,
      timeoutMs,
      error: e,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function openRouterEmbed(args: { model?: string; input: string; timeoutMs?: number }) {
  const proxyCfg = logOpenRouterProxyConfigOnce();

  if (proxyCfg.backendEnabled) {
    console.log("[OPTIMA_PROXY] using_railway_backend", { operation: "embed", inputLength: args.input.length });
    return openRouterEmbedViaBackend({
      model: args.model ?? serverEnv.OPENROUTER_EMBEDDING_MODEL,
      input: args.input,
      timeoutMs: args.timeoutMs,
    });
  }

  console.warn("[OPTIMA_PROXY] fallback_local_openrouter", {
    operation: "embed",
    reasons: proxyCfg.disableReasons,
  });

  if (!serverEnv.OPENROUTER_API_KEY) {
    console.error("[openRouterEmbed] Missing OPENROUTER_API_KEY");
    throw new Error("Missing OPENROUTER_API_KEY on server.");
  }

  const model = args.model ?? serverEnv.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
  const timeoutMs = args.timeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;
  const inputLength = args.input.length;
  const estimatedPromptTokens = estimateTokensFromChars(inputLength);

  console.log("[OPTIMA_AI_OPENROUTER_EMBED]", "request", { model, inputLength, estimatedPromptTokens, timeoutMs });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    Connection: "keep-alive",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const resp = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: args.input }),
      signal: controller.signal,
      dispatcher: openRouterKeepAliveAgent,
    } as RequestInit);

    const durationMs = Date.now() - started;
    const json = (await resp.json().catch(() => ({}))) as any;

    if (!resp.ok) {
      const msg = typeof json?.error?.message === "string" ? json.error.message : `OpenRouter error (HTTP ${resp.status})`;
      const err = new OpenRouterRequestError(msg, resp.status, resp.status === 429 ? parseRetryAfterMs(resp) : undefined);
      console.error("[OPTIMA_AI_ERROR]", err);
      console.error("[OPTIMA_AI_OPENROUTER_EMBED]", "error", {
        model,
        durationMs,
        httpStatus: resp.status,
        inputLength,
        estimatedPromptTokens,
        timeoutMs,
        message: err.message,
      });
      throw err;
    }

    const vec = json?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length < 10) {
      const err = new OpenRouterRequestError("OpenRouter: invalid embedding response.", 502);
      console.error("[OPTIMA_AI_ERROR]", err);
      throw err;
    }

    console.log("[OPTIMA_AI_OPENROUTER_EMBED]", "success", { model, durationMs, embeddingDim: vec.length, inputLength });
    return vec as number[];
  } catch (e) {
    if (e instanceof OpenRouterRequestError) throw e;
    const aborted =
      (e instanceof Error && e.name === "AbortError") || (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");
    if (aborted) {
      const err = new OpenRouterRequestError("OpenRouter embeddings aborted (timeout).", 408);
      console.error("[OPTIMA_AI_ERROR]", err);
      throw err;
    }
    console.error("[OPTIMA_AI_ERROR]", e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
