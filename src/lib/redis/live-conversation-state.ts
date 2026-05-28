import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { redisGet, redisSet, redisKey } from "./redis-client";

const LIVE_TTL_SEC = 7 * 24 * 60 * 60;

export type LiveConversationState = {
  typingState?: { active: boolean; requestId?: string; updatedAt?: number };
  readState?: { lastReadAt?: number; seen?: boolean };
  emotionalState?: SellerBehaviorConversationState["prospectEmotionalState"];
  lastActivityAt: number;
  humanizationTiming?: {
    totalMs?: number;
    responseMode?: string;
  };
};

export async function loadLiveConversationState(sessionId: string): Promise<LiveConversationState | null> {
  return redisGet<LiveConversationState>(redisKey("live_state", sessionId));
}

export async function saveLiveConversationState(sessionId: string, state: LiveConversationState): Promise<void> {
  await redisSet(redisKey("live_state", sessionId), state, LIVE_TTL_SEC);
}

