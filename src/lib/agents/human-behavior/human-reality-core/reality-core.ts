import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { buildBusinessTimeContext } from "../timing/time-context";
import { inferSocialStateMemory, type SocialStateMemorySnapshot } from "./social-state-memory";
import { inferDigitalAtmosphere, type DigitalAtmosphereSnapshot } from "./digital-atmosphere";
import { inferAdvancedSocialUnderstanding, type AdvancedSocialSignal } from "./social-understanding-advanced";
import { detectResponsePrimaryIntent } from "../coherence/response-intent";

export type RealityCoreSnapshot = {
  social: SocialStateMemorySnapshot;
  atmosphere: DigitalAtmosphereSnapshot;
  advanced: AdvancedSocialSignal;
  density: "sparse" | "normal" | "dense";
};

function inferDensity(lastUserMessage: string): RealityCoreSnapshot["density"] {
  const intent = detectResponsePrimaryIntent(lastUserMessage);
  const len = lastUserMessage.trim().length;
  if ((intent === "location" || intent === "thanks" || intent === "greeting") && len < 100) return "sparse";
  if (len > 220) return "dense";
  return "normal";
}

export function buildRealityCoreSnapshot(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
}): RealityCoreSnapshot {
  const fatigue = Math.max(0, Math.min(1, args.conversationState?.stats?.fatigue ?? 0));
  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
  });

  return {
    social: inferSocialStateMemory({ message: args.message, conversationState: args.conversationState }),
    atmosphere: inferDigitalAtmosphere(timeCtx, fatigue),
    advanced: inferAdvancedSocialUnderstanding(args.message),
    density: inferDensity(args.message),
  };
}
