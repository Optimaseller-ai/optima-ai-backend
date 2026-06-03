import { getConversationUiState } from "@/lib/chat/conversation-ui-state";
import { logStructured } from "@/lib/logging/structured-log";
import { purgeConversationSessionHistory } from "@/lib/redis/conversation-session-store";

export function isUiConversationReset(conversationState?: Record<string, unknown> | null): boolean {
  const ui = getConversationUiState({ conversation_state: conversationState ?? undefined });
  return ui.cleared_by_user === true;
}

export function resetIntroBootstrapState(state: Record<string, unknown>): Record<string, unknown> {
  const prevSocial = (state.conversationSocialV2 as Record<string, unknown> | undefined) ?? {};
  return {
    ...state,
    intro_done: false,
    socialOnlyMode: { active: false, reason: "intro_reset" },
    lastSellerIntent: undefined,
    conversationSocialV2: {
      ...prevSocial,
      welcomeDelivered: false,
      conversationAdvanced: false,
      socialThreadActive: false,
    },
    stats: {
      ...((state.stats as Record<string, unknown> | undefined) ?? {}),
      turn_count: 0,
      fatigue: 0,
      last_active_at: Date.now(),
    },
    conversationUi: getConversationUiState({ conversation_state: state }),
  };
}

export function detectFirstTurn(args: {
  turnCount?: number;
  history?: Array<{ role: string; content?: string }>;
  uiReset?: boolean;
}): boolean {
  if (args.uiReset) return true;
  const turnCount = Number(args.turnCount ?? 0);
  const history = Array.isArray(args.history) ? args.history : [];
  const hasAssistant = history.some(
    (m) => m.role === "assistant" && String(m.content ?? "").trim().length > 2,
  );
  return turnCount <= 1 && !hasAssistant;
}

export async function applyIntroSessionResetIfNeeded(args: {
  sessionId: string;
  conversationState?: Record<string, unknown> | null;
}): Promise<{ state: Record<string, unknown>; reset: boolean }> {
  const base = (args.conversationState ?? {}) as Record<string, unknown>;
  if (!isUiConversationReset(base)) {
    return { state: base, reset: false };
  }
  const next = resetIntroBootstrapState(base);
  await purgeConversationSessionHistory(args.sessionId);
  logStructured("[INTRO_RESET]", {
    session_id: args.sessionId,
    reason: "ui_cleared_or_new_conversation",
  });
  return { state: next, reset: true };
}
