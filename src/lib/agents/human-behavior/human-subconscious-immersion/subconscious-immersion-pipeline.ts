import "server-only";

import { buildSubconsciousImmersionSnapshot, type SubconsciousImmersionSnapshot } from "./subconscious-immersion";
import { computeDigitalHumanRhythm, type DigitalHumanRhythm } from "./digital-human-rhythm";
import { runResponseNaturalizerV5 } from "./response-naturalizer-v5";
import { runAntiAiV5Pass } from "./anti-ai-v5";
import { applyMicroVariationEngine } from "./micro-variation-engine";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { ProspectEmotion } from "../emotions/emotion-detector";
import type { AntiAiV3Lang } from "../anti-ai/anti-ai-v3";

export type HumanSubconsciousImmersionPipelineMeta = {
  snapshot: SubconsciousImmersionSnapshot;
  rhythm: DigitalHumanRhythm;
  antiAiFlags: string[];
};

export function runHumanSubconsciousImmersionPipeline(args: {
  text: string;
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  microSeed?: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  lang: AntiAiV3Lang;
  emotion: ProspectEmotion;
  extraPhraseBlacklist?: string[];
  recentAssistantMessages?: string[];
}): { text: string; meta: HumanSubconsciousImmersionPipelineMeta } {
  const seed = args.microSeed ?? args.lastUserMessage;
  const text0 = String(args.text ?? "").trim();

  const snapshot = buildSubconsciousImmersionSnapshot({
    message: args.lastUserMessage,
    conversationState: args.conversationState,
    microSeed: seed,
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
    emotion: args.emotion,
  });

  const frustrationLike = args.emotion === "frustration" || args.emotion === "anger";
  let text = runResponseNaturalizerV5(text0, args.lang, { shortenIfNegative: frustrationLike });

  const lastLine = args.recentAssistantMessages?.[args.recentAssistantMessages.length - 1];
  const anti = runAntiAiV5Pass(text, args.lang, args.extraPhraseBlacklist, {
    lastAssistantLine: lastLine,
    microSeed: seed,
  });
  text = anti.text;

  text = applyMicroVariationEngine(text, args.lang, seed, args.recentAssistantMessages);

  if (snapshot.density === "ultra_short" && text.length > 300 && !frustrationLike) {
    const parts = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) text = parts.slice(0, 2).join(" ");
  }

  const rhythm = computeDigitalHumanRhythm({
    microSeed: seed,
    density: snapshot.density,
    fatigue01: snapshot.fatigue01,
    emotion: args.emotion,
    replyChars: text.length,
  });

  return {
    text: text.trim(),
    meta: {
      snapshot,
      rhythm,
      antiAiFlags: anti.flags,
    },
  };
}
