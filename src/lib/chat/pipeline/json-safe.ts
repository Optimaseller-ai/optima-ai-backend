import "server-only";

const MAX_DEPTH = 12;
const MAX_KEYS = 80;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * Nettoie une valeur pour JSON / jsonb — pas de circular, pas de undefined, profondeur limitée.
 */
export function sanitizeForJson<T>(value: T, fallback: T, depth = 0): T {
  if (depth > MAX_DEPTH) return fallback;

  if (value === undefined) return fallback;
  if (value === null) return value as T;
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return fallback;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;

  if (value instanceof Date) return value.toISOString() as T;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForJson(item, null, depth + 1)) as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= MAX_KEYS) break;
      if (v === undefined) continue;
      out[k] = sanitizeForJson(v, null, depth + 1);
      count += 1;
    }
    return out as T;
  }

  return value;
}

/** Clone JSON-safe — utilisé avant NextResponse.json et persistance DB. */
export function jsonSafe<T>(value: T, fallback: T): T {
  try {
    const cleaned = sanitizeForJson(value, fallback);
    return JSON.parse(JSON.stringify(cleaned)) as T;
  } catch (err) {
    console.error("[OPTIMA_JSON_SAFE] serialize_failed", err);
    return fallback;
  }
}

export function validateConversationStatePayload(state: unknown): Record<string, unknown> {
  const base = typeof state === "object" && state ? (state as Record<string, unknown>) : {};
  return jsonSafe(base, {});
}

export function validatePipelineDebugPayload(debug: unknown): Record<string, unknown> | null {
  if (!debug || typeof debug !== "object") return null;
  return jsonSafe(debug as Record<string, unknown>, {});
}
