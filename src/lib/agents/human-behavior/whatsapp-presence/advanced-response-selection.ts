import "server-only";

import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import { computeResponseWeight } from "@/lib/agents/human-behavior/response-weight-system";
import { resolveDigitalEnergy } from "./digital-energy";
import { detectWhatsAppSocialTension } from "./social-tension";
import type { BusinessDaySlot } from "@/lib/agents/human-behavior/timing/time-context";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type ResponseSelectionProfile = {
  emotion: ReturnType<typeof detectProspectEmotion>;
  weightTier: "light" | "medium" | "heavy";
  tension: ReturnType<typeof detectWhatsAppSocialTension>;
  energyScore: number;
  maxBubbles: 1 | 2 | 3;
  preferShort: boolean;
  allowStaging: boolean;
};

export function analyzeResponseSelection(args: {
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  daySlot: BusinessDaySlot;
  hourLocal: number;
}): ResponseSelectionProfile {
  const msg = String(args.lastUserMessage ?? "");
  const emotion = detectProspectEmotion(msg);
  const weight = computeResponseWeight(msg);
  const tension = detectWhatsAppSocialTension(msg);
  const energy = resolveDigitalEnergy(args.daySlot, args.hourLocal);
  const fatigue = Math.max(0, Math.min(1, args.conversationState?.stats?.fatigue ?? 0));

  let maxBubbles: 1 | 2 | 3 = 2;
  let preferShort = false;
  let allowStaging = true;

  if (tension !== "none" || emotion === "anger" || emotion === "frustration") {
    maxBubbles = 1;
    preferShort = true;
    allowStaging = false;
  } else if (weight.tier === "heavy") {
    maxBubbles = 3;
  } else if (weight.tier === "light") {
    maxBubbles = 1;
    preferShort = true;
  }

  if (fatigue > 0.65) {
    preferShort = true;
    maxBubbles = 1;
  }

  if (energy.level === "low_end_of_day") {
    preferShort = true;
    maxBubbles = Math.min(maxBubbles, 2) as 1 | 2;
  }

  return {
    emotion,
    weightTier: weight.tier,
    tension,
    energyScore: energy.score,
    maxBubbles,
    preferShort,
    allowStaging,
  };
}

export function formatAdvancedResponseSelectionBlock(
  profile: ResponseSelectionProfile,
  lang: "fr" | "en" | "es",
): string {
  const parts: string[] = [];
  if (lang === "en") {
    parts.push("RESPONSE SELECTION (L19): one natural reply for this turn.");
    if (profile.preferShort) parts.push("- Keep it short — mobile human pace.");
    if (profile.tension !== "none") parts.push(`- Social tension: ${profile.tension} — soften tone immediately.`);
    if (profile.maxBubbles === 1) parts.push("- Single bubble only this turn.");
    return parts.join("\n");
  }
  parts.push("SÉLECTION RÉPONSE (L19) : une réponse naturelle pour ce tour.");
  if (profile.preferShort) parts.push("- Rester court — rythme mobile humain.");
  if (profile.tension !== "none") parts.push(`- Tension sociale : ${profile.tension} — adoucir le ton tout de suite.`);
  if (profile.maxBubbles === 1) parts.push("- Une seule bulle ce tour.");
  return parts.join("\n");
}
