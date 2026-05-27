import "server-only";

export type ConversationFatigueSnapshot = {
  fatigueScore01: number;
  shortenReplies: boolean;
  fewerQuestions: boolean;
  moreDirectTone: boolean;
};

/** À partir du compteur de tours persisté (+ fatigue comportementale). */
export function assessConversationFatigue(args: {
  turnCount?: number;
  behavioralFatigue01?: number;
}): ConversationFatigueSnapshot {
  const turns = Math.max(0, args.turnCount ?? 0);
  const f = Math.max(0, Math.min(1, args.behavioralFatigue01 ?? 0));

  let fatigueScore01 = f;
  if (turns > 12) fatigueScore01 = Math.min(1, fatigueScore01 + 0.12);
  if (turns > 22) fatigueScore01 = Math.min(1, fatigueScore01 + 0.12);
  if (turns > 34) fatigueScore01 = Math.min(1, fatigueScore01 + 0.1);

  return {
    fatigueScore01,
    shortenReplies: fatigueScore01 > 0.45 || turns > 16,
    fewerQuestions: fatigueScore01 > 0.35 || turns > 12,
    moreDirectTone: fatigueScore01 > 0.42 || turns > 18,
  };
}
