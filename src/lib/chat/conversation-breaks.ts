import type { PresenceUiLang } from "@/lib/agents/human-behavior/presence-engine";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type ConversationBreakBeat = { text: string; pauseAfterMs: number };

/**
 * Cassures de flux « humaines » (hésitation puis reformulation) — rares.
 */
export function shouldInjectConversationBreak(input: { userMessage: string; rushed: boolean }): boolean {
  if (input.rushed) return false;
  const m = String(input.userMessage ?? "").trim();
  if (m.length < 28 || m.length > 400) return false;
  const h = seedHash(m + "brk");
  return h % 100 < 11;
}

export function getConversationBreakScript(lang: PresenceUiLang, seed: string): ConversationBreakBeat[] {
  const h = seedHash(seed + "cb");
  const p1 = 620 + (h % 900);
  if (lang === "en") {
    return [
      { text: "Hmm…", pauseAfterMs: p1 },
      { text: "I see what you mean.", pauseAfterMs: 0 },
    ];
  }
  if (lang === "es") {
    return [
      { text: "Mmm…", pauseAfterMs: p1 },
      { text: "Sí, le entiendo.", pauseAfterMs: 0 },
    ];
  }
  return [
    { text: "Hmm…", pauseAfterMs: p1 },
    { text: "Je vois ce que vous voulez dire.", pauseAfterMs: 0 },
  ];
}
