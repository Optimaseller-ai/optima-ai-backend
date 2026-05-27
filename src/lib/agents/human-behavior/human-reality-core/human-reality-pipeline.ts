import "server-only";

import { buildRealityCoreSnapshot, type RealityCoreSnapshot } from "./reality-core";
import { runFinalHumanFilter } from "./final-human-filter";
import { computeMessageRhythmV3, type MessageRhythmV3 } from "./message-rhythm-v3";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

function applyResponseDensityControl(text: string, snapshot: RealityCoreSnapshot): string {
  if (snapshot.density !== "sparse") return text;
  const parts = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return text;
  return parts.slice(0, 2).join(" ").trim();
}

export type HumanRealityCorePipelineMeta = {
  snapshot: RealityCoreSnapshot;
  rhythm: MessageRhythmV3;
};

/**
 * Niveau 15 — noyau « réalité humaine » : densité, filtre final, rythme message.
 */
export function runHumanRealityCorePipeline(args: {
  text: string;
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  microSeed?: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  lang: "fr" | "en" | "es";
  extraPhraseBlacklist?: string[];
}): { text: string; meta: HumanRealityCorePipelineMeta } {
  const snapshot = buildRealityCoreSnapshot({
    message: args.lastUserMessage,
    conversationState: args.conversationState,
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
  });

  let text = String(args.text ?? "").trim();
  text = applyResponseDensityControl(text, snapshot);
  text = runFinalHumanFilter(text, args.lang, args.extraPhraseBlacklist);

  const rhythm = computeMessageRhythmV3({
    microSeed: args.microSeed ?? args.lastUserMessage,
    atmosphere: snapshot.atmosphere,
    social: snapshot.social,
    advanced: snapshot.advanced,
    replyCharCount: text.length,
  });

  return {
    text: text.trim(),
    meta: { snapshot, rhythm },
  };
}
