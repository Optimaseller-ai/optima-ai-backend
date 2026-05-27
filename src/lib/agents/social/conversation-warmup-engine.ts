import type { ConversationSocialWarmup, SocialSignalKind, SocialWarmupPhase } from "./types";

/** Phase warmup — relation humaine avant vente. */
export function advanceConversationWarmup(args: {
  previous?: ConversationSocialWarmup;
  signal: SocialSignalKind;
  turnCount?: number;
}): ConversationSocialWarmup {
  const prev = args.previous;
  const socialTurns = (prev?.socialTurnCount ?? 0) + (args.signal !== "none" ? 1 : 0);
  const turns = args.turnCount ?? 0;

  let phase: SocialWarmupPhase = prev?.phase ?? "opening";
  if (args.signal !== "none") phase = socialTurns >= 2 ? "engaged" : "opening";
  if (turns >= 4 && socialTurns >= 1) phase = "engaged";
  if (turns >= 8) phase = "commercial_ready";

  return {
    phase,
    lastSocialSignal: args.signal !== "none" ? args.signal : prev?.lastSocialSignal,
    socialTurnCount: socialTurns,
    lastUpdatedAt: Date.now(),
  };
}

export function shouldWarmupBeforeSell(warmup: ConversationSocialWarmup): boolean {
  return warmup.phase === "opening" || warmup.phase === "engaged";
}
