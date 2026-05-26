import { getRedis, redisKey } from "./client.js";

const memorySessions = new Map<string, Record<string, unknown>>();

const SESSION_TTL_SEC = 86_400;

export async function patchSessionState(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const key = redisKey("session", sessionId);
  const r = getRedis();

  if (r) {
    const existing = (await r.get<Record<string, unknown>>(key)) ?? {};
    await r.set(key, { ...existing, ...patch, updatedAt: Date.now() }, { ex: SESSION_TTL_SEC });
    return;
  }

  const existing = memorySessions.get(sessionId) ?? {};
  memorySessions.set(sessionId, { ...existing, ...patch, updatedAt: Date.now() });
}

export async function getSessionState(sessionId: string): Promise<Record<string, unknown> | null> {
  const key = redisKey("session", sessionId);
  const r = getRedis();
  if (r) return (await r.get<Record<string, unknown>>(key)) ?? null;
  return memorySessions.get(sessionId) ?? null;
}
