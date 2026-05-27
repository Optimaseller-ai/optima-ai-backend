import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type GenerateAIReplyRailwayMeta = {
  session_id: string;
  request_id: string;
  pipeline_trace_id: string;
};

const AGENT_PERSONALITIES = new Set(["chaleureux", "professionnel", "dynamique"]);
const SALES_STYLES = new Set(["conseiller", "closer", "premium"]);

function pickString(v: unknown, maxLen?: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return maxLen ? s.slice(0, maxLen) : s;
}

function ensureMinLen(id: string, minLen: number, prefix: string): string {
  const s = id.trim();
  if (s.length >= minLen) return s.slice(0, 120);
  return `${prefix}${s}_${Date.now()}`.slice(0, 120);
}

function normalizeHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> | undefined,
): Array<{ role: "user" | "assistant"; content: string }> | undefined {
  if (!Array.isArray(history)) return undefined;
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const turn of history) {
    const role = turn?.role;
    const content = pickString(turn?.content, 4000);
    if ((role !== "user" && role !== "assistant") || !content) continue;
    out.push({ role, content });
  }
  return out.length ? out.slice(-32) : undefined;
}

function normalizeConversationState(
  state: SellerBehaviorConversationState | undefined,
): Record<string, unknown> | undefined {
  if (state == null) return undefined;
  try {
    return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type BuildRailwayChatReplyPayloadInput = {
  railwayMeta: GenerateAIReplyRailwayMeta;
  message: string;
  userId: string;
  agentId?: string;
  agentName?: string;
  agentPersonality?: string;
  salesStyle?: string;
  businessName?: string;
  conversationState?: SellerBehaviorConversationState;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  agentRole?: string;
  agentTone?: string;
  personaKey?: string | null;
  followupAfterHold?: boolean;
};

/** Canonical POST /v1/chat/reply body — must stay aligned with Railway `normalizeIncomingPayload`. */
export function buildRailwayChatReplyPayload(input: BuildRailwayChatReplyPayloadInput): Record<string, unknown> {
  const message = pickString(input.message, 4000);
  if (!message) {
    throw new Error("[OPTIMA_REPLY_PIPELINE] railway_payload_missing_message");
  }

  const userId = pickString(input.userId, 128);
  if (!userId) {
    throw new Error("[OPTIMA_REPLY_PIPELINE] railway_payload_missing_user_id");
  }

  const sessionId = ensureMinLen(pickString(input.railwayMeta.session_id, 200) ?? "", 8, "sess_");
  const requestId = ensureMinLen(pickString(input.railwayMeta.request_id, 120) ?? "", 8, "req_");
  const pipelineTraceId = ensureMinLen(
    pickString(input.railwayMeta.pipeline_trace_id, 320) ?? `pipe_${Date.now()}`,
    4,
    "pipe_",
  );

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    request_id: requestId,
    pipeline_trace_id: pipelineTraceId,
    message,
    user_id: userId,
  };

  const agentId = pickString(input.agentId, 128);
  if (agentId) payload.agent_id = agentId;

  const agentName = pickString(input.agentName, 120);
  if (agentName) payload.agent_name = agentName;

  const businessName = pickString(input.businessName, 200);
  if (businessName) payload.business_name = businessName;

  const agentRole = pickString(input.agentRole, 400);
  if (agentRole) payload.agent_role = agentRole;

  const agentTone = pickString(input.agentTone, 200);
  if (agentTone) payload.agent_tone = agentTone;

  const personality = pickString(input.agentPersonality)?.toLowerCase();
  if (personality && AGENT_PERSONALITIES.has(personality)) {
    payload.agent_personality = personality;
  }

  const salesStyle = pickString(input.salesStyle)?.toLowerCase();
  if (salesStyle && SALES_STYLES.has(salesStyle)) {
    payload.sales_style = salesStyle;
  }

  if (input.personaKey === null) {
    payload.persona_key = null;
  } else {
    const personaKey = pickString(input.personaKey, 120);
    if (personaKey) payload.persona_key = personaKey;
  }

  if (input.followupAfterHold === true) {
    payload.followup_after_hold = true;
  }

  const history = normalizeHistory(input.history);
  if (history) payload.history = history;

  const conversationState = normalizeConversationState(input.conversationState);
  if (conversationState) payload.conversation_state = conversationState;

  return payload;
}

export function describeRailwayPayloadForLog(payload: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(payload);
  const summary: Record<string, unknown> = {
    keys,
    session_id: payload.session_id,
    request_id: payload.request_id,
    pipeline_trace_id: payload.pipeline_trace_id,
    message_len: typeof payload.message === "string" ? payload.message.length : 0,
    user_id: payload.user_id,
    agent_id: payload.agent_id ?? null,
    history_turns: Array.isArray(payload.history) ? payload.history.length : 0,
  };

  if (payload.conversation_state && typeof payload.conversation_state === "object") {
    const st = payload.conversation_state as Record<string, unknown>;
    summary.conversation_state_keys = Object.keys(st).length;
    summary.conversation_state_top_keys = Object.keys(st).slice(0, 20);
  }

  return summary;
}

export function safeJsonStringifyForLog(raw: unknown, maxChars = 24_000): string {
  try {
    const s = JSON.stringify(raw);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}…[truncated ${s.length - maxChars} chars]`;
  } catch (e) {
    return JSON.stringify({ _unserializable: true, error: e instanceof Error ? e.message : String(e) });
  }
}
