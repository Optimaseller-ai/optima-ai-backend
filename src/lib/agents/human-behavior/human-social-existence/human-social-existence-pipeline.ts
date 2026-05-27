import "server-only";

import {
  buildSocialExistenceSnapshot,
  runSocialExistenceTextPasses,
  type SocialExistenceSnapshot,
} from "./social-existence";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { RealismV2Lang } from "../realism-score-v2";

export type HumanSocialExistencePipelineMeta = {
  snapshot: SocialExistenceSnapshot;
  realismScore: number;
  realismFlags: string[];
};

/**
 * Level 16 — existence sociale : post-traitement + métadonnées rythme.
 */
export function runHumanSocialExistencePipeline(args: {
  text: string;
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  microSeed?: string;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  lang: RealismV2Lang;
}): { text: string; meta: HumanSocialExistencePipelineMeta } {
  const seed = args.microSeed ?? args.lastUserMessage;
  const text0 = String(args.text ?? "").trim();
  const snapshot = buildSocialExistenceSnapshot({
    message: args.lastUserMessage,
    conversationState: args.conversationState,
    microSeed: seed,
    businessIanaTimezone: args.businessIanaTimezone,
    city: args.city,
    country: args.country,
    lang: args.lang,
    replyCharCount: text0.length,
  });

  const pass = runSocialExistenceTextPasses(text0, args.lang);
  let text = pass.text;
  if (snapshot.fatigue.preferShorter && text.length > 340) {
    const parts = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) text = parts.slice(0, 2).join(" ").trim();
  }

  return {
    text: text.trim(),
    meta: {
      snapshot,
      realismScore: pass.realismAudit.score,
      realismFlags: pass.realismAudit.flags,
    },
  };
}
