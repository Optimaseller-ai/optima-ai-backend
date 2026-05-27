import "server-only";

import { buildBusinessTimeContext } from "../timing/time-context";
import { inferDigitalAtmosphere } from "./digital-human-atmosphere";
import { buildSocialMemoryV4Snapshot, type SocialMemoryV4Snapshot } from "./social-memory-v4";
import { buildEmotionalContinuityV2, type EmotionalContinuityV2 } from "./emotional-continuity-v2";
import { inferSocialInstinct, type SocialInstinctSnapshot } from "./social-instinct";
import { inferResponseDensityV2, type ResponseDensityV2 } from "./response-density-v2";
import type { ProspectEmotion } from "../emotions/emotion-detector";
import type { DigitalAtmosphereSnapshot } from "../human-reality-core/digital-atmosphere";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type SubconsciousImmersionSnapshot = {
  atmosphere: DigitalAtmosphereSnapshot;
  socialMemory: SocialMemoryV4Snapshot;
  emotionalContinuity: EmotionalContinuityV2;
  instinct: SocialInstinctSnapshot;
  density: ResponseDensityV2;
  fatigue01: number;
  socialFatigueRealism: boolean;
};

/**
 * Niveau 17 — illusion sociale stable : ambiance + mémoire relationnelle + instinct + densité.
 */
export function buildSubconsciousImmersionSnapshot(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
  microSeed: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  emotion: ProspectEmotion;
}): SubconsciousImmersionSnapshot {
  const fatigue01 = Math.max(0, Math.min(1, args.conversationState?.stats?.fatigue ?? 0));
  const turns = Math.max(0, args.conversationState?.stats?.turn_count ?? 0);

  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
  });
  const atmosphere = inferDigitalAtmosphere(timeCtx, fatigue01);
  const socialMemory = buildSocialMemoryV4Snapshot({ message: args.message, conversationState: args.conversationState });
  const tone = args.conversationState?.conversationProfile?.tone ?? "neutral";
  const emotionalContinuity = buildEmotionalContinuityV2({ prospectTone: tone });
  const instinct = inferSocialInstinct({
    userMessage: args.message,
    emotion: args.emotion,
    turnCount: turns,
  });
  const density = inferResponseDensityV2({
    userMessage: args.message,
    fatigue01,
    turnCount: turns,
    atmosphereBias: atmosphere.replyBias,
    microSeed: args.microSeed,
  });

  const socialFatigueRealism = fatigue01 > 0.48 || turns > 24;

  return {
    atmosphere,
    socialMemory,
    emotionalContinuity,
    instinct,
    density,
    fatigue01,
    socialFatigueRealism,
  };
}
