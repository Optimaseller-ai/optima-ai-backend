import { getRedis, redisKey } from "./client.js";

const memoryTyping = new Map<string, { active: boolean; requestId: string; updatedAt: number }>();

const TTL_SEC = 120;

export async function setTypingState(
  sessionId: string,
  state: { active: boolean; requestId: string },
): Promise<void> {
  const key = redisKey("typing", sessionId);
  const payload = { ...state, updatedAt: Date.now() };
  const r = getRedis();
  if (r) {
    await r.set(key, JSON.stringify(payload), { ex: TTL_SEC });
    return;
  }
  memoryTyping.set(sessionId, payload);
}

export async function clearTypingState(sessionId: string): Promise<void> {
  const key = redisKey("typing", sessionId);
  const r = getRedis();
  if (r) {
    await r.del(key);
    return;
  }
  memoryTyping.delete(sessionId);
}

export async function getTypingState(sessionId: string) {
  const key = redisKey("typing", sessionId);
  const r = getRedis();
  if (r) {
    const raw = await r.get<string>(key);
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }
  return memoryTyping.get(sessionId) ?? null;
}
