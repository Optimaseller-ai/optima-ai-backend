import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CachedAgentRow = {
  id: string;
  user_id: string;
  is_active: boolean;
  name: string;
  slug: string;
  persona_key: string | null;
};

type CacheEntry = {
  agent: CachedAgentRow;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getCachedAgent(agentId: string): CachedAgentRow | null {
  const hit = cache.get(String(agentId ?? "").trim());
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.agent;
}

export function setCachedAgent(agent: CachedAgentRow): void {
  if (!agent?.id) return;
  cache.set(agent.id, { agent, expiresAt: Date.now() + TTL_MS });
}

export async function fetchAgentWithRetry(
  admin: SupabaseClient,
  agentId: string,
  opts?: { retries?: number; delayMs?: number },
): Promise<{ agent: CachedAgentRow | null; fromCache: boolean; error?: string }> {
  const id = String(agentId ?? "").trim();
  if (!id) return { agent: null, fromCache: false, error: "missing_agent_id" };

  const cached = getCachedAgent(id);
  if (cached?.is_active) return { agent: cached, fromCache: true };

  const retries = opts?.retries ?? 3;
  const delayMs = opts?.delayMs ?? 220;
  let lastErr: string | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data, error } = await admin
        .from("agents")
        .select("id,user_id,is_active,name,slug,persona_key")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        lastErr = String((error as { message?: string })?.message ?? error);
        if (cached) return { agent: cached, fromCache: true, error: lastErr };
        await sleep(delayMs * (attempt + 1));
        continue;
      }

      const row = data as CachedAgentRow | null;
      if (row?.id && row.is_active) {
        setCachedAgent(row);
        return { agent: row, fromCache: false };
      }

      if (cached) return { agent: cached, fromCache: true, error: "agent_inactive_use_cache" };
      return { agent: null, fromCache: false, error: row?.id ? "agent_inactive" : "agent_not_found" };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (cached) return { agent: cached, fromCache: true, error: lastErr };
      await sleep(delayMs * (attempt + 1));
    }
  }

  const stale = getCachedAgent(id);
  if (stale) return { agent: stale, fromCache: true, error: lastErr };
  return { agent: null, fromCache: false, error: lastErr ?? "agent_lookup_failed" };
}
