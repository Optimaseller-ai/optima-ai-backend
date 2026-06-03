import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import {
  fromLlmHistory,
  sanitizeConversationHistory,
  toLlmHistory,
  type ConversationTurn,
} from "@/lib/chat/pipeline/conversationHistoryManager";
import { filterImportantHistory, filterImportantMemoryLines } from "./memory-importance-score";
import { ensureFinalConversationHistory } from "@/lib/chat/pipeline/final-history-gate";
import { logStructured } from "@/lib/logging/structured-log";
import { redisDel, redisGet, redisSet, sessionRedisKey } from "./redis-client";

const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

export type ConversationSessionSnapshot = {
  sessionId: string;
  historyTurns: ConversationTurn[];
  compactHistory: Array<{ role: "user" | "assistant"; content: string }>;
  emotionalState?: SellerBehaviorConversationState["prospectEmotionalState"];
  leadTemperature?: string;
  viewedProducts: string[];
  objections: string[];
  lastAgentTone?: string;
  trustScore?: number;
  conversationStage?: string;
  followupState?: Record<string, unknown>;
  timingState?: Record<string, unknown>;
  socialState?: Record<string, unknown>;
  relationshipMemory?: Record<string, unknown>;
  followupMemory?: Record<string, unknown>;
  updatedAt: number;
};

function toSnapshot(args: {
  sessionId: string;
  state: SellerBehaviorConversationState | undefined;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): ConversationSessionSnapshot {
  const state = args.state ?? {};
  const gated = ensureFinalConversationHistory(args.history);
  const turns = sanitizeConversationHistory(fromLlmHistory(gated.history)).history;
  const compact = filterImportantHistory(toLlmHistory(turns), 14);
  return {
    sessionId: args.sessionId,
    historyTurns: turns,
    compactHistory: compact,
    emotionalState: state.prospectEmotionalState,
    leadTemperature: state.automation?.leadTemperature,
    viewedProducts: state.productMemory?.viewedProducts ?? [],
    objections: state.commercialMemory?.objections ?? [],
    lastAgentTone: state.tone_mode,
    trustScore: state.salesSignalsMemory?.trustLevel01,
    conversationStage: state.liveOrchestrator?.conversationStage ?? state.automation?.pipelineStage,
    followupState: state.automation
      ? {
          nextFollowupAt: state.automation.nextFollowupAt,
          lastTrigger: state.automation.lastTrigger,
        }
      : undefined,
    timingState: state.pipelineRuntime
      ? {
          totalMs: state.pipelineRuntime.totalMs,
          responseMode: state.pipelineRuntime.responseMode,
        }
      : undefined,
    socialState: state.socialOnlyMode ?? undefined,
    relationshipMemory: (state as any).relationshipMemory ?? undefined,
    followupMemory: (state as any).followupMemory ?? undefined,
    updatedAt: Date.now(),
  };
}

export function buildHydratedState(args: {
  incoming?: SellerBehaviorConversationState;
  fromRedis?: ConversationSessionSnapshot | null;
}): SellerBehaviorConversationState {
  const incoming = args.incoming ?? {};
  const snap = args.fromRedis;
  if (!snap) return incoming;
  const memory = filterImportantMemoryLines(incoming.memory ?? [], 14);
  return {
    ...incoming,
    memory: memory.length ? memory : incoming.memory,
    prospectEmotionalState: incoming.prospectEmotionalState ?? snap.emotionalState,
    automation: {
      ...(incoming.automation ?? {}),
      leadTemperature: incoming.automation?.leadTemperature ?? snap.leadTemperature,
      pipelineStage: incoming.automation?.pipelineStage ?? snap.conversationStage,
      nextFollowupAt: incoming.automation?.nextFollowupAt ?? (snap.followupState?.nextFollowupAt as string | undefined),
    },
    productMemory: {
      ...(incoming.productMemory ?? { viewedProducts: [] }),
      viewedProducts: Array.from(new Set([...(incoming.productMemory?.viewedProducts ?? []), ...snap.viewedProducts])).slice(0, 24),
    },
    commercialMemory: {
      likedProducts: incoming.commercialMemory?.likedProducts ?? [],
      objections: Array.from(new Set([...(incoming.commercialMemory?.objections ?? []), ...snap.objections])).slice(0, 16),
      preferences: incoming.commercialMemory?.preferences ?? [],
      budgetNotes: incoming.commercialMemory?.budgetNotes,
      lastObjectionSnippet: incoming.commercialMemory?.lastObjectionSnippet,
    },
    salesSignalsMemory: {
      ...(incoming.salesSignalsMemory ?? {}),
      trustLevel01: incoming.salesSignalsMemory?.trustLevel01 ?? snap.trustScore,
    },
  };
}

export async function loadConversationSession(sessionId: string): Promise<ConversationSessionSnapshot | null> {
  const key = sessionRedisKey(sessionId);
  const out = await redisGet<ConversationSessionSnapshot>(key);
  logStructured("[REDIS_SESSION_LOAD]", { key, found: Boolean(out) });
  return out;
}

export function getSessionHistoryAsMessages(snapshot: ConversationSessionSnapshot | null | undefined): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  if (!snapshot) return [];
  if (Array.isArray(snapshot.historyTurns) && snapshot.historyTurns.length) {
    return toLlmHistory(snapshot.historyTurns);
  }
  return Array.isArray(snapshot.compactHistory) ? snapshot.compactHistory : [];
}

/** Purge Redis session history (intro seeds, compactHistory) on UI reset / new session. */
export async function purgeConversationSessionHistory(sessionId: string): Promise<void> {
  const key = sessionRedisKey(sessionId);
  await redisDel(key);
  logStructured("[REDIS_HISTORY_PURGED]", { session_id: sessionId, key });
  logStructured("[SESSION_RESET_CLEAN]", { session_id: sessionId });
}

export async function saveConversationSession(args: {
  sessionId: string;
  state: SellerBehaviorConversationState | undefined;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<void> {
  const key = sessionRedisKey(args.sessionId);
  const snapshot = toSnapshot(args);
  await redisSet(key, snapshot, SESSION_TTL_SEC);
  logStructured("[REDIS_SESSION_SAVE]", {
    key,
    history: snapshot.compactHistory.length,
    viewedProducts: snapshot.viewedProducts.length,
    objections: snapshot.objections.length,
  });
}

