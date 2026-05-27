import "server-only";

/** Minimum shared secret length for Vercel → Railway auth. */
export const BACKEND_SECRET_MIN_LENGTH = 16;

export type OpenRouterProxyMode = "railway" | "local";

export type OpenRouterProxyConfig = {
  mode: OpenRouterProxyMode;
  backendEnabled: boolean;
  /** When true, `/api/chat/send` delegates `generateAIReply` to `POST /v1/chat/reply` on Railway. */
  railwayFullOrchestratorEnabled: boolean;
  backendUrl: string | null;
  hasBackendUrl: boolean;
  hasBackendSecret: boolean;
  secretLength: number;
  hasLocalOpenRouterKey: boolean;
  /** Human-readable blockers when railway mode is not active. */
  disableReasons: string[];
};

function readBackendUrl(): string | null {
  const raw = process.env.OPTIMA_AI_BACKEND_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function readBackendSecret(): string | null {
  const raw = process.env.OPTIMA_AI_BACKEND_SECRET?.trim();
  if (!raw) return null;
  return raw;
}

function readForceLocal(): boolean {
  const v = process.env.OPTIMA_AI_BACKEND_FORCE_LOCAL?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function readRailwayFullOrchestratorDisabled(): boolean {
  const v = process.env.OPTIMA_RAILWAY_FULL_ORCHESTRATOR?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "no";
}

/** Single source of truth for OpenRouter proxy routing (Vercel → Railway). */
export function resolveOpenRouterProxyConfig(): OpenRouterProxyConfig {
  const backendUrl = readBackendUrl();
  const backendSecret = readBackendSecret();
  const secretLength = backendSecret?.length ?? 0;
  const hasBackendUrl = Boolean(backendUrl);
  const hasBackendSecret = secretLength >= BACKEND_SECRET_MIN_LENGTH;
  const hasLocalOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const forceLocal = readForceLocal();

  const disableReasons: string[] = [];
  if (!hasBackendUrl) disableReasons.push("missing_OPTIMA_AI_BACKEND_URL");
  if (hasBackendUrl && !backendSecret) disableReasons.push("missing_OPTIMA_AI_BACKEND_SECRET");
  if (hasBackendUrl && backendSecret && secretLength < BACKEND_SECRET_MIN_LENGTH) {
    disableReasons.push(`OPTIMA_AI_BACKEND_SECRET_too_short(min_${BACKEND_SECRET_MIN_LENGTH})`);
  }
  if (forceLocal) disableReasons.push("OPTIMA_AI_BACKEND_FORCE_LOCAL");

  const backendEnabled = hasBackendUrl && hasBackendSecret && !forceLocal;
  const mode: OpenRouterProxyMode = backendEnabled ? "railway" : "local";
  const railwayFullOrchestratorEnabled = backendEnabled && !readRailwayFullOrchestratorDisabled();

  return {
    mode,
    backendEnabled,
    railwayFullOrchestratorEnabled,
    backendUrl: backendEnabled ? backendUrl : null,
    hasBackendUrl,
    hasBackendSecret,
    secretLength,
    hasLocalOpenRouterKey,
    disableReasons,
  };
}

let proxyConfigLogged = false;

/** Logs proxy decision once per serverless instance (safe for production audit). */
export function logOpenRouterProxyConfigOnce(): OpenRouterProxyConfig {
  const cfg = resolveOpenRouterProxyConfig();

  if (proxyConfigLogged) return cfg;
  proxyConfigLogged = true;

  const urlHost = cfg.backendUrl
    ? (() => {
        try {
          return new URL(cfg.backendUrl).host;
        } catch {
          return "invalid_url";
        }
      })()
    : null;

  console.log("[OPTIMA_PROXY] backend_enabled", {
    enabled: cfg.backendEnabled,
    railwayFullOrchestrator: cfg.railwayFullOrchestratorEnabled,
    hasBackendUrl: cfg.hasBackendUrl,
    hasBackendSecret: cfg.hasBackendSecret,
    secretLength: cfg.secretLength,
    hasLocalOpenRouterKey: cfg.hasLocalOpenRouterKey,
    vercelEnv: process.env.VERCEL_ENV ?? "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
  });

  if (cfg.backendEnabled) {
    console.log("[OPTIMA_PROXY] using_railway_backend", {
      host: urlHost,
      paths: ["/v1/llm/chat", "/v1/llm/embed", "/v1/chat/reply"],
    });
  } else {
    console.warn("[OPTIMA_PROXY] fallback_local_openrouter", {
      reasons: cfg.disableReasons,
      hint:
        "Set OPTIMA_AI_BACKEND_URL + OPTIMA_AI_BACKEND_SECRET (min 16 chars) on Vercel Production to route OpenRouter via Railway.",
    });
  }

  return cfg;
}

export function isOpenRouterDelegatedToBackend(): boolean {
  return resolveOpenRouterProxyConfig().backendEnabled;
}

export function isRailwayFullOrchestratorEnabled(): boolean {
  return resolveOpenRouterProxyConfig().railwayFullOrchestratorEnabled;
}
