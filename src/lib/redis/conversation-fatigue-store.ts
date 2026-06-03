import { redisGet, redisKey, redisSet } from "@/lib/redis/redis-client";
import type { ConversationFatigueState } from "@/lib/chat/humanization/conversation-fatigue-engine";

const TTL_SEC = 7 * 24 * 60 * 60; // 7 days

function key(sessionId: string): string {
  return redisKey("conversation_fatigue", sessionId);
}

export async function loadConversationFatigueState(sessionId: string): Promise<ConversationFatigueState | null> {
  return redisGet<ConversationFatigueState>(key(sessionId));
}

export async function saveConversationFatigueState(sessionId: string, state: ConversationFatigueState): Promise<void> {
  await redisSet(key(sessionId), state, TTL_SEC);
}
