/**
 * Fluctuation d’attention humaine — pas d’attention parfaite constante (délais / longueur).
 */

import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type AttentionFluctuationMode = "snappy" | "normal" | "reflective" | "brief";

export function inferAttentionFluctuationMode(userMessage: string, seed: string): AttentionFluctuationMode {
  const m = String(userMessage ?? "").trim();
  const h = seedHash(seed + "attn");
  const temp = inferConversationEmotionalTemperature(m);
  if (temp === "prêt_achat" || m.length < 12) {
    if (h % 100 < 28) return "snappy";
  }
  if (temp === "frustré" || temp === "irrité" || temp === "hésitant") {
    if (h % 100 < 22) return "reflective";
  }
  if (m.length > 140 || temp === "froid") {
    if (h % 100 < 18) return "brief";
  }
  return "normal";
}

/** Multiplicateur sur thinkDelay (client). */
export function attentionFluctuationThinkMultiplier(mode: AttentionFluctuationMode): number {
  switch (mode) {
    case "snappy":
      return 0.88;
    case "reflective":
      return 1.1;
    case "brief":
      return 0.94;
    default:
      return 1;
  }
}
