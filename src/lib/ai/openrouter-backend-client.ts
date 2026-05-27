import "server-only";

import type { OpenRouterMessage } from "./openrouter";
import {
  logOpenRouterProxyConfigOnce,
  resolveOpenRouterProxyConfig,
} from "./openrouter-proxy-config";

export async function postOptimaAiBackend<T>(path: string, body: unknown): Promise<T> {
  const cfg = logOpenRouterProxyConfigOnce();
  if (!cfg.backendEnabled || !cfg.backendUrl) {
    throw new Error(
      `OpenRouter Railway proxy not configured (${cfg.disableReasons.join(", ") || "unknown"})`,
    );
  }

  const secret = process.env.OPTIMA_AI_BACKEND_SECRET?.trim();
  if (!secret) {
    throw new Error("OPTIMA_AI_BACKEND_SECRET missing at request time");
  }

  const url = `${cfg.backendUrl}${path}`;
  const started = Date.now();
  const bodyJson = JSON.stringify(body);

  console.log("[OPTIMA_PROXY] railway_request_start", {
    path,
    bodyBytes: bodyJson.length,
    host: (() => {
      try {
        return new URL(cfg.backendUrl!).host;
      } catch {
        return cfg.backendUrl;
      }
    })(),
  });

  if (path === "/v1/chat/reply") {
    console.log("[OPTIMA_PROXY] outgoing_body_json", bodyJson.length > 24_000 ? `${bodyJson.slice(0, 24_000)}…` : bodyJson);
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: bodyJson,
    });
  } catch (err) {
    console.error("[OPTIMA_PROXY] railway_request_network_error", {
      path,
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const json = (await resp.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
    issues?: unknown;
    missing?: unknown;
    invalid_type?: unknown;
    details?: unknown;
  };

  if (!resp.ok) {
    const details = json?.details as { fieldErrors?: Record<string, unknown> } | undefined;
    const legacyMessagesErr = details?.fieldErrors?.messages;
    console.error("[OPTIMA_PROXY] railway_request_http_error", {
      path,
      status: resp.status,
      durationMs: Date.now() - started,
      error: json?.error ?? json?.message,
      issues: json?.issues,
      missing: json?.missing,
      invalid_type: json?.invalid_type,
      details: json?.details,
      legacy_messages_field_errors: legacyMessagesErr,
      hint:
        Array.isArray(legacyMessagesErr) || legacyMessagesErr != null
          ? "Railway is likely running an OLD build that required body.messages — redeploy optima-ai-backend with startCommand: node dist/index.js"
          : undefined,
    });
    const detailMsg =
      Array.isArray(legacyMessagesErr) && legacyMessagesErr.length
        ? ` (${legacyMessagesErr.map(String).join("; ")})`
        : "";
    const msg =
      typeof json?.message === "string"
        ? json.message + detailMsg
        : typeof json?.error === "string"
          ? json.error + detailMsg
          : `Backend HTTP ${resp.status}${detailMsg}`;
    const err = new Error(msg) as Error & { status?: number; validationIssues?: unknown };
    err.status = resp.status;
    err.validationIssues = json?.issues ?? json?.details;
    throw err;
  }

  console.log("[OPTIMA_PROXY] railway_request_ok", {
    path,
    status: resp.status,
    durationMs: Date.now() - started,
  });

  return json;
}

/** Appel OpenRouter via Railway — remplace l'appel direct serverless. */
export async function openRouterChatViaBackend(args: {
  model?: string;
  messages: OpenRouterMessage[];
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<string> {
  const data = await postOptimaAiBackend<{ ok: boolean; content: string }>("/v1/llm/chat", {
    model: args.model,
    messages: args.messages,
    max_tokens: args.maxTokens,
    timeout_ms: args.timeoutMs,
  });

  if (!data?.content?.trim()) {
    throw new Error("Backend returned empty OpenRouter content");
  }

  return data.content.trim();
}

export async function openRouterEmbedViaBackend(args: {
  model?: string;
  input: string;
  timeoutMs?: number;
}): Promise<number[]> {
  const data = await postOptimaAiBackend<{ ok: boolean; embedding: number[] }>("/v1/llm/embed", {
    model: args.model,
    input: args.input,
    timeout_ms: args.timeoutMs,
  });

  if (!Array.isArray(data.embedding) || data.embedding.length < 10) {
    throw new Error("Backend returned invalid embedding");
  }

  return data.embedding;
}
