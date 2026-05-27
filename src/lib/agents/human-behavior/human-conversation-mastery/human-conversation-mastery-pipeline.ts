import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

import { inferConversationPrioritySnapshot } from "./conversation-priority-engine";
import { inferConversationEnergy } from "./conversation-energy";
import { applyMinimalHumanResponse } from "./minimal-response-engine";
import { stripAntiRepetitionV2 } from "./anti-repetition-v2";
import { capTrailingQuestions } from "./natural-endings";
import { applyHumanShortReplyPass } from "../human-short-reply-engine";
import { computeMicroDelayBehavior } from "./micro-delay-behavior";
import { buildBusinessTimeContext } from "../timing/time-context";

export type HumanConversationMasteryMeta = {
  mode: ReturnType<typeof inferConversationPrioritySnapshot>["mode"];
  energy: ReturnType<typeof inferConversationEnergy>["energy"];
  microDelay: ReturnType<typeof computeMicroDelayBehavior>;
  humanShortnessScore?: number;
  shortReplyMode?: string;
};

/**
 * Pipeline post-modèle niveau 14 — directness, anti-répétition, fins naturelles.
 */
export function runHumanConversationMasteryPipeline(args: {
  text: string;
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  recentAssistantMessages?: string[];
  microSeed?: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
}): { text: string; meta: HumanConversationMasteryMeta } {
  const fatigue = Math.max(0, Math.min(1, args.conversationState?.stats?.fatigue ?? 0));
  const priority = inferConversationPrioritySnapshot({
    lastUserMessage: args.lastUserMessage,
    fatigue01: fatigue,
  });

  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
  });

  const energy = inferConversationEnergy({
    lastUserMessage: args.lastUserMessage,
    hourLocal: timeCtx.hour,
    fatigue01: fatigue,
    conversationProfile: args.conversationState?.conversationProfile,
  });

  let text = String(args.text ?? "").trim();

  text = stripAntiRepetitionV2({
    reply: text,
    recentAssistantMessages: args.recentAssistantMessages,
    microSeed: args.microSeed,
  });

  text = applyMinimalHumanResponse({
    text,
    lastUserMessage: args.lastUserMessage,
    mode: priority.mode,
    microSeed: args.microSeed,
  });

  text = capTrailingQuestions(text, args.lastUserMessage, args.microSeed);

  const shortPass = applyHumanShortReplyPass({
    text,
    lastUserMessage: args.lastUserMessage,
    turnCount: args.conversationState?.stats?.turn_count,
    frustrationLevel01: args.conversationState?.prospectEmotionalState?.frustrationLevel,
    microSeed: args.microSeed,
    lang:
      args.conversationState?.language === "en"
        ? "en"
        : args.conversationState?.language === "es"
          ? "es"
          : "fr",
  });
  text = shortPass.text;

  const microDelay = computeMicroDelayBehavior({
    conversationMode: priority.mode,
    energy: energy.energy,
    replyCharCount: text.length,
    microSeed: args.microSeed,
  });

  return {
    text: text.trim(),
    meta: {
      mode: priority.mode,
      energy: energy.energy,
      microDelay,
      humanShortnessScore: shortPass.shortnessScore,
      shortReplyMode: shortPass.mode,
    },
  };
}
