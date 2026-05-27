import "server-only";

import { buildBusinessTimeContext, type BusinessTimeContext } from "../timing/time-context";
import { computeAttentionVariationV2 } from "./attention-variation-v2";
import { inferHumanizedDigitalFatigue } from "./humanized-digital-fatigue";
import { computeConversationPacingV4, type ConversationPacingV4 } from "./conversation-pacing-v4";
import { computeConversationBreathingV4Ms } from "./conversation-breathing-v4";
import { pickDailyLifeSimulationCue, type DailyLifeCueFr } from "./daily-life-simulation";
import { detectImplicitSocialSituationV2, type ImplicitSocialSituation } from "./social-awareness-v2";
import { buildConversationalEmotionalMemorySnapshot, type ConversationalEmotionalMemorySnapshot } from "./emotional-memory";
import { inferResponseInstinct, type ResponseInstinctSnapshot } from "./response-instinct";
import { auditRealismV5, repairRealismV5 } from "./realism-score-v5";
import { runAntiBotStructureV4Pass } from "./anti-bot-structure-v4";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { RealismV2Lang } from "../realism-score-v2";

export type SocialExistenceSnapshot = {
  timeCtx: BusinessTimeContext;
  emotional: ConversationalEmotionalMemorySnapshot;
  socialSituation: ImplicitSocialSituation;
  instinct: ResponseInstinctSnapshot;
  attention: ReturnType<typeof computeAttentionVariationV2>;
  fatigue: ReturnType<typeof inferHumanizedDigitalFatigue>;
  pacing: ConversationPacingV4;
  breathingExtraMs: number;
  dailyCue: DailyLifeCueFr | null;
};

/**
 * Présence sociale continue — signaux pour prompt + timing (sans audit texte vide).
 */
export function buildSocialExistenceSnapshot(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
  microSeed: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  lang: RealismV2Lang;
  replyCharCount: number;
}): SocialExistenceSnapshot {
  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
  });
  const turns = Math.max(0, args.conversationState?.stats?.turn_count ?? 0);
  const fatigue = inferHumanizedDigitalFatigue(timeCtx);
  const attention = computeAttentionVariationV2({ microSeed: args.microSeed, turnCount: turns });
  const emotional = buildConversationalEmotionalMemorySnapshot({ message: args.message, conversationState: args.conversationState });
  const socialSituation = detectImplicitSocialSituationV2(args.message);
  const instinct = inferResponseInstinct({
    userMessage: args.message,
    turnCount: turns,
    relationalRepair: socialSituation !== "none",
  });
  const pacing = computeConversationPacingV4({
    microSeed: args.microSeed,
    userMessage: args.message,
    replyCharCount: args.replyCharCount,
    lateFactor01: fatigue.lateFactor01,
    preferShorter: fatigue.preferShorter,
  });
  const breathingExtraMs = computeConversationBreathingV4Ms({
    microSeed: args.microSeed,
    userMessage: args.message,
    replyLen: args.replyCharCount,
    lateFactor01: fatigue.lateFactor01,
  });
  const dailyCue = pickDailyLifeSimulationCue({ microSeed: args.microSeed, turnCount: turns, lang: args.lang });

  return {
    timeCtx,
    emotional,
    socialSituation,
    instinct,
    attention,
    fatigue,
    pacing,
    breathingExtraMs,
    dailyCue,
  };
}

/** Post-traitement texte L16. */
export function runSocialExistenceTextPasses(text: string, lang: RealismV2Lang): {
  text: string;
  realismAudit: ReturnType<typeof auditRealismV5>;
} {
  let t = repairRealismV5(text, lang);
  t = runAntiBotStructureV4Pass(t, lang);
  return { text: t.trim(), realismAudit: auditRealismV5(t) };
}
