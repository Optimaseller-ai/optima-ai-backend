/**
 * État UI du chat prospect — soft delete visible uniquement.
 * La mémoire IA (conversation_state, embeddings, DB) reste intacte.
 */

export type ArchivedChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
};

export type ConversationUiState = {
  cleared_by_user: boolean;
  cleared_at: number | null;
  clear_count: number;
};

export type SessionWithUiState = {
  messages?: ArchivedChatMessage[];
  ui_hidden_messages?: ArchivedChatMessage[];
  ui_messages_cleared_at?: number;
  conversation_ui_state?: ConversationUiState;
  conversation_state?: Record<string, unknown> & {
    conversationUi?: ConversationUiState;
  };
};

export function getConversationUiState(session: SessionWithUiState | null | undefined): ConversationUiState {
  const top = session?.conversation_ui_state;
  const nested = session?.conversation_state?.conversationUi;
  const clearedAt = top?.cleared_at ?? nested?.cleared_at ?? session?.ui_messages_cleared_at ?? null;
  const cleared =
    top?.cleared_by_user === true ||
    nested?.cleared_by_user === true ||
    (typeof session?.ui_messages_cleared_at === "number" && session.ui_messages_cleared_at > 0);
  return {
    cleared_by_user: cleared,
    cleared_at: clearedAt,
    clear_count: top?.clear_count ?? nested?.clear_count ?? (cleared ? 1 : 0),
  };
}

export function isConversationUiCleared(session: SessionWithUiState | null | undefined): boolean {
  return getConversationUiState(session).cleared_by_user;
}

/** Messages actuellement affichés dans le fil React → archive UI (user + assistant). */
export function archiveMessagesFromUi(
  ui: Array<{ role: string; content?: string; ts?: string; id?: string; typing?: boolean }>,
): ArchivedChatMessage[] {
  return ui
    .filter((m) => !m.typing && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      id: typeof m.id === "string" ? m.id : undefined,
      role: m.role as "user" | "assistant",
      content: String(m.content ?? ""),
      ts: String(m.ts ?? new Date().toISOString()),
    }))
    .filter((m) => m.content.trim().length > 0 || m.role === "user");
}

/** Archive les messages visibles et marque la session comme effacée côté UI. */
export function applyConversationUiClear<T extends SessionWithUiState>(
  session: T,
  opts?: { uiMessages?: ArchivedChatMessage[] },
): T {
  const prev = getConversationUiState(session);
  const visible = [...(session.messages ?? []), ...(opts?.uiMessages ?? [])];
  const archived = [...(session.ui_hidden_messages ?? []), ...visible].slice(-MAX_ARCHIVE);

  const conversationUi: ConversationUiState = {
    cleared_by_user: true,
    cleared_at: Date.now(),
    clear_count: prev.clear_count + 1,
  };

  return {
    ...session,
    messages: [],
    ui_hidden_messages: archived,
    ui_messages_cleared_at: conversationUi.cleared_at ?? Date.now(),
    conversation_ui_state: conversationUi,
    conversation_state: {
      ...(session.conversation_state ?? {}),
      conversationUi,
    },
  };
}

const MAX_ARCHIVE = 200;

/** Patch conversation_state envoyé à l'API — inclut le flag UI sans effacer la mémoire. */
export function patchConversationStateForApi(
  state: Record<string, unknown> | undefined,
  session: SessionWithUiState | null | undefined,
): Record<string, unknown> {
  const ui = getConversationUiState(session);
  return {
    ...(state ?? {}),
    conversationUi: ui,
  };
}
