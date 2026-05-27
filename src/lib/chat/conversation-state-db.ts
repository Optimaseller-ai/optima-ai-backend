import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PostgREST PGRST204 quand une colonne référencée n’existe pas dans le cache schéma Supabase.
 */
export function isPostgrestUnknownColumnError(err: unknown): boolean {
  return (err as { code?: string } | null | undefined)?.code === "PGRST204";
}

/** Ex. Could not find the 'last_ai_message_at' column of 'conversations' in the schema cache */
export function parsePostgrestUnknownColumnName(err: unknown): string | null {
  const msg = String((err as { message?: string } | null | undefined)?.message ?? "");
  const m = msg.match(/Could not find the '([^']+)' column/i);
  return m?.[1] ?? null;
}

/**
 * @deprecated Utiliser {@link isPostgrestUnknownColumnError} + {@link parsePostgrestUnknownColumnName}.
 * Conservé pour les appels existants (select conversation_state).
 */
export function isMissingConversationStateColumn(err: unknown): boolean {
  const col = parsePostgrestUnknownColumnName(err);
  return isPostgrestUnknownColumnError(err) && col === "conversation_state";
}

/** Champs analytics / méta : retirables si la migration n’est pas encore appliquée (ne jamais retirer messages / agent_id / session_id). */
const CONVERSATIONS_OPTIONAL_WRITE_FIELDS = new Set<string>([
  "conversation_state",
  "status",
  "last_message_at",
  "last_user_message_at",
  "last_ai_message_at",
  "last_message_preview",
  "relance_count",
  "next_relance_at",
  "updated_at",
]);

function omitKey<T extends Record<string, unknown>>(row: T, key: string): T {
  const { [key]: _, ...rest } = row;
  return rest as T;
}

/**
 * Insert `conversations` en retirant une à une les colonnes optionnelles absentes (PGRST204),
 * pour ne jamais faire échouer le chat côté prospect.
 */
export async function conversationsInsertWithOptionalColumnFallback(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ data: { id: string } | null; error: unknown }> {
  let payload: Record<string, unknown> = { ...row };
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const { data, error } = await admin.from("conversations").insert(payload as any).select("id").maybeSingle();
      if (!error) {
        return { data: (data as { id: string } | null) ?? null, error: null };
      }
      const col = parsePostgrestUnknownColumnName(error);
      if (isPostgrestUnknownColumnError(error) && col && CONVERSATIONS_OPTIONAL_WRITE_FIELDS.has(col) && col in payload) {
        console.warn("[CHAT_METADATA_UPDATE_FAILED] conversations insert retry without column:", col, (error as { message?: string }).message);
        payload = omitKey(payload, col);
        continue;
      }
      console.error("[CONVERSATIONS_INSERT_FAILED]", error);
      return { data: null, error };
    } catch (err) {
      console.error("[CONVERSATIONS_INSERT_FAILED] unexpected throw", err);
      return { data: null, error: err };
    }
  }
  console.error("[CONVERSATIONS_INSERT_FAILED] max retries");
  return { data: null, error: new Error("conversations insert: max retries") };
}

/**
 * Update `conversations` avec la même stratégie de repli sur colonnes optionnelles.
 */
export async function conversationsUpdateWithOptionalColumnFallback(
  admin: SupabaseClient,
  conversationId: string,
  patch: Record<string, unknown>,
): Promise<{ error: unknown }> {
  let payload: Record<string, unknown> = { ...patch };
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const { error } = await admin.from("conversations").update(payload as any).eq("id", conversationId);
      if (!error) return { error: null };
      const col = parsePostgrestUnknownColumnName(error);
      if (isPostgrestUnknownColumnError(error) && col && CONVERSATIONS_OPTIONAL_WRITE_FIELDS.has(col) && col in payload) {
        console.warn("[CHAT_METADATA_UPDATE_FAILED] conversations update retry without column:", col, (error as { message?: string }).message);
        payload = omitKey(payload, col);
        continue;
      }
      console.error("[CONVERSATIONS_UPDATE_FAILED]", error);
      return { error };
    } catch (err) {
      console.error("[CONVERSATIONS_UPDATE_FAILED] unexpected throw", err);
      return { error: err };
    }
  }
  console.error("[CONVERSATIONS_UPDATE_FAILED] max retries");
  return { error: new Error("conversations update: max retries") };
}
