import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { inferRelationshipFamiliarity } from "../relationship-progression";

export type RelationalRhythm = "fast" | "steady" | "slow";

export type SocialStateMemorySnapshot = {
  familiarity: ReturnType<typeof inferRelationshipFamiliarity>;
  familiarityScore01: number;
  trustHint: "low" | "medium" | "high";
  prospectMoodLabel: string;
  rhythm: RelationalRhythm;
  relationStyle: "formal" | "mixed" | "warm_informal";
};

function rhythmFromTurnsAndFatigue(turns: number, fatigue01: number): RelationalRhythm {
  if (fatigue01 > 0.5) return "slow";
  if (turns > 8) return "steady";
  if (turns < 3) return "fast";
  return "steady";
}

export function inferSocialStateMemory(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
}): SocialStateMemorySnapshot {
  const state = args.conversationState;
  const turns = Math.max(0, state?.stats?.turn_count ?? 0);
  const fatigue = Math.max(0, Math.min(1, state?.stats?.fatigue ?? 0));
  const familiarity = inferRelationshipFamiliarity(turns);
  const familiarityScore01 =
    familiarity === "familiar" ? 0.85 : familiarity === "warming" ? 0.5 : 0.2;

  const intent = state?.conversationProfile?.buyingIntent ?? 30;
  const tone = state?.conversationProfile?.tone ?? "neutral";
  const emotional = state?.prospectEmotionalMemory?.kind;

  let trustHint: SocialStateMemorySnapshot["trustHint"] = "medium";
  if (emotional === "angry" || emotional === "frustrated" || tone === "aggressive") trustHint = "low";
  if ((tone === "loyal" || tone === "warm") && intent > 55) trustHint = "high";

  const style = state?.conversationProfile?.preferredLanguageStyle ?? "neutral";
  const relationStyle: SocialStateMemorySnapshot["relationStyle"] =
    style === "warm" ? "warm_informal" : style === "formal" ? "formal" : "mixed";

  let prospectMoodLabel: string = tone;
  if (/\b(mdrr?|lol)\b/i.test(args.message)) prospectMoodLabel = `${tone}_playful`;
  if (/\b(trop\s+long|lassé|marre)\b/i.test(args.message)) prospectMoodLabel = "weary";

  return {
    familiarity,
    familiarityScore01,
    trustHint,
    prospectMoodLabel,
    rhythm: rhythmFromTurnsAndFatigue(turns, fatigue),
    relationStyle,
  };
}
