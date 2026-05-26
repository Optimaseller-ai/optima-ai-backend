/**
 * Memory engine — phase 2+.
 * Supabase = archives long terme ; Redis = session chaude.
 */

export type ConversationMemorySlice = {
  facts: string[];
  objections: string[];
  preferences: string[];
  lastTopics: string[];
};

export async function loadMemorySlice(_sessionId: string): Promise<ConversationMemorySlice> {
  return { facts: [], objections: [], preferences: [], lastTopics: [] };
}
