import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type SocialMemoryV4Snapshot = {
  mannerHint: string;
  energyLabel: "subdued" | "neutral" | "upbeat";
  humorCarry: boolean;
  distrustCarry: boolean;
  rhythmLabel: "snappy" | "steady" | "patient";
  relationLabel: "fresh" | "warming" | "familiar";
};

export function buildSocialMemoryV4Snapshot(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
}): SocialMemoryV4Snapshot {
  const st = args.conversationState;
  const tone = st?.conversationProfile?.tone ?? "neutral";
  const turns = Math.max(0, st?.stats?.turn_count ?? 0);
  const habits = Array.isArray(st?.socialConversationHabits) ? st!.socialConversationHabits! : [];
  const trust = typeof st?.salesSignalsMemory?.trustLevel01 === "number" ? st!.salesSignalsMemory!.trustLevel01! : 0.55;

  const m = args.message.toLowerCase();
  const humorCarry = habits.includes("jokes") || /\b(mdrr?|lol)\b/i.test(m);
  const distrustCarry =
    (Array.isArray(st?.salesSignalsMemory?.objectionKinds) ? st!.salesSignalsMemory!.objectionKinds! : []).includes("trust");

  let energyLabel: SocialMemoryV4Snapshot["energyLabel"] = "neutral";
  if (tone === "rushed" || tone === "ready_to_buy") energyLabel = "upbeat";
  if (tone === "cold" || tone === "hesitant") energyLabel = "subdued";

  let rhythmLabel: SocialMemoryV4Snapshot["rhythmLabel"] = "steady";
  if (tone === "rushed") rhythmLabel = "snappy";
  if (tone === "hesitant" || distrustCarry) rhythmLabel = "patient";

  const relationLabel: SocialMemoryV4Snapshot["relationLabel"] =
    turns >= 12 ? "familiar" : turns >= 4 ? "warming" : "fresh";

  const mannerHint =
    humorCarry && distrustCarry
      ? "Mélange léger humour / méfiance — rester sobre."
      : humorCarry
        ? "Prospect taquin — une réplique courte possible."
        : distrustCarry
          ? "Méfiance latente — phrases simples, gestes concrets."
          : "Manège relationnel normal.";

  return {
    mannerHint,
    energyLabel,
    humorCarry,
    distrustCarry,
    rhythmLabel,
    relationLabel,
  };
}
