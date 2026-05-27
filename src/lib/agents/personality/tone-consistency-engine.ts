import type { AgentStablePersonality, ConversationPersonalityState, ToneStyle } from "./conversation-personality-state";

export type ToneConsistencyCheck = {
  /** 0–1 */
  consistencyScore: number;
  violations: string[];
  guardRulesFr: string[];
  guardRulesEn: string[];
};

const ROBOT_MARKERS = [
  /\b(comment puis-je vous aider|how may i assist|n'hésitez pas)\b/i,
  /\b(voici une liste|voici les points|en résumé|pour résumer)\b/i,
  /\b(je suis ravi|je suis ravie|enchanté)\b/i,
];

const TONE_SHIFTS: Record<ToneStyle, RegExp[]> = {
  elegant: [/\b(mec|frérot|mdr\s+lol)\b/i, /\b(yeah\s+bro)\b/i],
  warm: [/\b(veuillez agréer|conformément à)\b/i],
  direct: [/\b(veuillez noter que|il convient de)\b/i],
  professional: [/\b(lol|mdr|😂)\b/i],
  conversational: [/\b(veuillez agréer|monsieur le client)\b/i],
};

/** Empêche sauts de ton, contradictions et alternance robot/humain. */
export function checkToneConsistency(args: {
  stable: AgentStablePersonality;
  state: ConversationPersonalityState;
  draftReply?: string;
  recentAssistantMessages?: string[];
}): ToneConsistencyCheck {
  const violations: string[] = [];
  const recent = [...(args.recentAssistantMessages ?? []), args.draftReply ?? ""].filter(Boolean);

  for (const line of recent.slice(-3)) {
    for (const re of ROBOT_MARKERS) {
      if (re.test(line)) violations.push("robot_marker");
    }
    for (const re of TONE_SHIFTS[args.stable.toneStyle] ?? []) {
      if (re.test(line)) violations.push(`tone_shift_${args.stable.toneStyle}`);
    }
  }

  // Répétition même ouverture
  const openings = recent
    .map((l) => l.split(/[.!?]/)[0]?.trim().slice(0, 24).toLowerCase())
    .filter(Boolean);
  const dup = openings.length >= 2 && openings[openings.length - 1] === openings[openings.length - 2];
  if (dup) violations.push("repeated_opening");

  let score = args.state.consistencyScore ?? 0.75;
  score = Math.max(0.2, score - violations.length * 0.08);
  if (violations.length === 0) score = Math.min(0.98, score + 0.04);

  const guardRulesFr = [
    `Personnalité stable : ${args.stable.displayName} — ${args.stable.toneStyle}, chaleur ${args.stable.warmthLevel}, pression vente ${args.stable.salesPressure}.`,
    "Interdit : changer brusquement de ton entre deux messages.",
    "Interdit : alterner corporate froid et slang — rester la même personne.",
    violations.includes("repeated_opening") ? "Varier l’ouverture — ne pas recommencer pareil." : "",
    violations.includes("robot_marker") ? "Retirer formulations type assistant / ChatGPT." : "",
  ].filter(Boolean);

  const guardRulesEn = [
    `Stable personality: ${args.stable.displayName} — ${args.stable.toneStyle}, warmth ${args.stable.warmthLevel}.`,
    "No abrupt tone swings between messages.",
    "No cold corporate ↔ slang alternation.",
  ];

  return {
    consistencyScore: Math.round(score * 100) / 100,
    violations: [...new Set(violations)],
    guardRulesFr,
    guardRulesEn,
  };
}
