import { getRedis, redisKey } from "./client.js";

const memoryLocks = new Map<string, string>();

const LOCK_TTL_SEC = 90;

/** Empêche deux générations OpenRouter simultanées pour la même session. */
export async function acquireReplyLock(sessionId: string, requestId: string): Promise<boolean> {
  const key = redisKey("reply_lock", sessionId);
  const r = getRedis();

  if (r) {
    const ok = await r.set(key, requestId, { nx: true, ex: LOCK_TTL_SEC });
    return ok === "OK";
  }

  const current = memoryLocks.get(sessionId);
  if (current && current !== requestId) return false;
  memoryLocks.set(sessionId, requestId);
  return true;
}

export async function releaseReplyLock(sessionId: string, requestId: string): Promise<void> {
  const key = redisKey("reply_lock", sessionId);
  const r = getRedis();

  if (r) {
    const current = await r.get<string>(key);
    if (current === requestId) await r.del(key);
    return;
  }

  if (memoryLocks.get(sessionId) === requestId) {
    memoryLocks.delete(sessionId);
  }
}
