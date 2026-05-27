import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type AttentionShiftMode = "shorter" | "slower" | "reformulate_hint" | "pause_bump" | "steady";

export function inferAttentionShiftMode(userMessage: string, seed: string): AttentionShiftMode {
  const h = seedHash(seed + "attsh");
  const m = String(userMessage ?? "").trim();
  const temp = inferConversationEmotionalTemperature(m);
  if (temp === "frustré" || temp === "irrité") {
    if (h % 100 < 25) return "shorter";
    if (h % 100 < 40) return "slower";
  }
  if (m.length > 100 && h % 100 < 12) return "pause_bump";
  if (h % 100 < 8) return "reformulate_hint";
  if (h % 100 < 14) return "shorter";
  return "steady";
}

export function attentionShiftThinkMultiplier(mode: AttentionShiftMode): number {
  switch (mode) {
    case "shorter":
      return 0.9;
    case "slower":
      return 1.12;
    case "pause_bump":
      return 1.18;
    case "reformulate_hint":
      return 1.05;
    default:
      return 1;
  }
}
