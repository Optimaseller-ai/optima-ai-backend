import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { createAdminClient } from "@/lib/supabase/admin";

import { attachInsights } from "../analytics/sales-insight-generator";
import { recordLearningTurn } from "./conversation-learning";
import { EMPTY_LEARNING_MEMORY } from "../memory/learning-memory-types";
import { setLearningMemory } from "../memory/learning-memory-store";

type ConvRow = {
  id: string;
  status: string;
  relance_count: number | null;
  last_user_message_at: string | null;
  last_ai_message_at: string | null;
  messages: unknown;
  conversation_state: unknown;
  updated_at: string;
};

function lastMessages(messages: unknown): { user?: string; assistant?: string } {
  const arr = Array.isArray(messages) ? messages : [];
  let user: string | undefined;
  let assistant: string | undefined;
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i] as { role?: string; content?: string };
    if (!assistant && m.role === "assistant" && m.content) assistant = String(m.content);
    if (!user && m.role === "user" && m.content) user = String(m.content);
    if (user && assistant) break;
  }
  return { user, assistant };
}

/** Reconstruit la mémoire depuis les conversations Supabase (batch léger). */
export async function rebuildLearningFromConversations(
  businessId: string,
  limit = 40,
): Promise<void> {
  const admin = createAdminClient();
  const { data: agents } = await admin.from("agents").select("id").eq("user_id", businessId);
  const agentIds = (agents ?? []).map((a) => a.id);
  if (!agentIds.length) {
    setLearningMemory(EMPTY_LEARNING_MEMORY(businessId));
    return;
  }

  const { data: convs } = await admin
    .from("conversations")
    .select(
      "id,status,relance_count,last_user_message_at,last_ai_message_at,messages,conversation_state,updated_at",
    )
    .in("agent_id", agentIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  setLearningMemory(EMPTY_LEARNING_MEMORY(businessId));

  for (const c of (convs ?? []) as ConvRow[]) {
    const { user, assistant } = lastMessages(c.messages);
    if (!user || !assistant) continue;
    const state = (c.conversation_state ?? {}) as SellerBehaviorConversationState;
    const hour = state.salesSignalsMemory?.activeLocalHour;
    let msSince: number | undefined;
    if (c.last_user_message_at && c.last_ai_message_at) {
      msSince = Math.abs(
        new Date(c.last_user_message_at).getTime() - new Date(c.last_ai_message_at).getTime(),
      );
    }

    await recordLearningTurn({
      businessId,
      conversationId: c.id,
      userMessage: user,
      assistantReply: assistant,
      conversationState: state,
      status: c.status,
      relanceCount: c.relance_count ?? 0,
      localHour: typeof hour === "number" ? hour : new Date(c.updated_at).getHours(),
      msSinceLastUserMessage: msSince,
      repliedAfterFollowup:
        Boolean(c.relance_count) &&
        Boolean(c.last_user_message_at) &&
        Boolean(c.last_ai_message_at) &&
        new Date(c.last_user_message_at!).getTime() > new Date(c.last_ai_message_at!).getTime(),
    });
  }
}
