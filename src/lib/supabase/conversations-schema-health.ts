import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { optimaLog } from "@/lib/logging/optima-logger";

/** Colonnes attendues pour l'UI / relances / analytics (hors cœur messages). */
const CONVERSATIONS_HEALTH_COLUMNS = [
  "last_ai_message_at",
  "last_user_message_at",
  "last_message_preview",
  "updated_at",
  "conversation_state",
  "last_message_at",
  "relance_count",
  "next_relance_at",
] as const;

const SCHEMA_CHECK_TIMEOUT_MS = 8_000;
const SCHEMA_CACHE_TTL_MS = 30 * 60_000;

type SchemaCache = {
  checkedAt: number;
  missing: string[];
};

let schemaCache: SchemaCache | null = null;
let inFlight: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

function isPostgrestUnknownColumnError(error: { code?: string; message?: string }): boolean {
  return (
    error?.code === "42703" ||
    (typeof error?.message === "string" && error.message.includes("does not exist"))
  );
}

function parsePostgrestUnknownColumnName(error: { message?: string }): string | null {
  const m = String(error?.message ?? "").match(/column ["\s]*([a-z_]+)["\s]* does not exist/i);
  return m?.[1] ?? null;
}

/**
 * Au démarrage serveur : un seul check groupé (PostgREST), avec timeout et cache.
 */
export async function logConversationsSchemaHealthOnce(): Promise<void> {
  if (schemaCache && Date.now() - schemaCache.checkedAt < SCHEMA_CACHE_TTL_MS) {
    return;
  }
  if (inFlight) {
    await inFlight;
    return;
  }

  inFlight = runSchemaHealthCheck();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

async function runSchemaHealthCheck(): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) {
    optimaLog.warn("CONVERSATIONS_SCHEMA", "Skip: admin client indisponible (env Supabase).");
    return;
  }

  const selectCols = ["id", ...CONVERSATIONS_HEALTH_COLUMNS].join(",");
  const result = await withTimeout(
    Promise.resolve(admin.from("conversations").select(selectCols).limit(1)),
    SCHEMA_CHECK_TIMEOUT_MS,
  );

  if (!result) {
    optimaLog.warn("CONVERSATIONS_SCHEMA", "Check timeout — serveur Supabase lent ou injoignable.");
    schemaCache = { checkedAt: Date.now(), missing: [] };
    return;
  }

  const { error } = result as { error: { code?: string; message?: string } | null };
  const missing: string[] = [];

  if (error && isPostgrestUnknownColumnError(error)) {
    const parsed = parsePostgrestUnknownColumnName(error);
    if (parsed) missing.push(parsed);
    else {
      for (const col of CONVERSATIONS_HEALTH_COLUMNS) {
        if (String(error.message ?? "").includes(col)) missing.push(col);
      }
    }
  } else if (error) {
    optimaLog.warn("CONVERSATIONS_SCHEMA", { message: error.message, code: error.code });
  }

  schemaCache = { checkedAt: Date.now(), missing };

  if (missing.length) {
    optimaLog.error("CONVERSATIONS_SCHEMA", {
      missing: missing.join(", "),
      hint: "Appliquer supabase/migrations (2026-05-14, 2026-05-06, 2026-05-11).",
    });
  } else if (!error) {
    optimaLog.info("CONVERSATIONS_SCHEMA", "Colonnes critiques présentes (check groupé OK).");
  }
}
