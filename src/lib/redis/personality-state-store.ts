import { redisGet, redisKey, redisSet } from "@/lib/redis/redis-client";
import type { PersonalityState } from "@/lib/chat/personality/personality-variation-engine";

const TTL_SEC = 14 * 24 * 60 * 60; // 14 days

function key(sessionId: string): string {
  return redisKey("personality_state", sessionId);
}

export async function loadPersonalityState(sessionId: string): Promise<PersonalityState | null> {
  return redisGet<PersonalityState>(key(sessionId));
}

export async function savePersonalityState(sessionId: string, state: PersonalityState): Promise<void> {
  await redisSet(key(sessionId), state, TTL_SEC);
}

