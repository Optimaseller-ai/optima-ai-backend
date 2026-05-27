import "server-only";

import type { ConversationProfile } from "@/lib/agents/memory/conversation-state";
import { detectProspectEmotion } from "../emotions/emotion-detector";

export type ConversationEnergy = "low" | "steady" | "warm" | "alert";

export type ConversationEnergySnapshot = {
  energy: ConversationEnergy;
  cues: string[];
};

export function inferConversationEnergy(args: {
  lastUserMessage: string;
  hourLocal: number;
  fatigue01?: number;
  conversationProfile?: ConversationProfile;
}): ConversationEnergySnapshot {
  const cues: string[] = [];
  const msg = String(args.lastUserMessage ?? "");
  const emotion = detectProspectEmotion(msg);
  const fatigue = Math.max(0, Math.min(1, args.fatigue01 ?? 0));
  const hour = args.hourLocal;
  const tone = args.conversationProfile?.tone ?? "neutral";

  if (fatigue > 0.45) {
    cues.push("fil un peu fatigué");
  }
  if (hour >= 22 || hour < 7) {
    cues.push("créneau tardif / nuit");
  }
  if (emotion === "anger" || emotion === "frustration") {
    cues.push("émotion tendue");
  }
  if (/\b(mdrr?|lol|😂)\b/i.test(msg)) {
    cues.push("prospect détendu");
  }

  let energy: ConversationEnergy = "steady";

  if (emotion === "anger" || emotion === "frustration" || tone === "aggressive") {
    energy = "alert";
  } else if (/\b(mdrr?|lol|😂|super|génial)\b/i.test(msg) || tone === "warm") {
    energy = "warm";
  } else if (fatigue > 0.55 || hour >= 23 || hour < 6) {
    energy = "low";
  }

  return { energy, cues };
}

export function formatConversationEnergyPromptBlock(snap: ConversationEnergySnapshot, lang: "fr" | "en" | "es"): string {
  const cueLine = snap.cues.length ? snap.cues.join(" · ") : "rythme neutre";

  if (lang === "en") {
    return [
      "LEVEL 14 — CONVERSATION ENERGY:",
      `- Energy band: **${snap.energy}** (${cueLine}).`,
      "- Match length and warmth to this band — low = shorter lines; alert = calm, not chatty.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "NIVEL 14 — ENERGÍA CONVERSACIONAL:",
      `- Banda: **${snap.energy}** (${cueLine}).`,
    ].join("\n");
  }
  return [
    "NIVEAU 14 — ÉNERGIE CONVERSATIONNELLE :",
    `- Bande **${snap.energy}** (${cueLine}).`,
    "- Énergie basse : phrases plus courtes ; alerte : calme, sans sur-réagir.",
  ].join("\n");
}
