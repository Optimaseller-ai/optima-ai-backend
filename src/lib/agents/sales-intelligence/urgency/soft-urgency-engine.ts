import "server-only";

import type { SalesTemperature } from "../sales-scoring/sales-temperature";

export type SoftUrgencyLevel = "none" | "ambient" | "stock_natural";

export type SoftUrgencySnapshot = {
  level: SoftUrgencyLevel;
  rationale: string;
  /** Une consigne courte ; interdit rareté fausse / pression brute. */
  guardrails: string[];
};

/**
 * Urgence crédible seulement (rotation stock, mouvement actuel du modèle).
 * Jamais countdown inventé ou « il ne reste qu’un exemplaire » si non vrai.
 */
export function inferSoftUrgency(args: {
  temperature: SalesTemperature;
  buyingScore: number;
  shortReplyStreakRisk?: boolean;
  recentStrongPush?: boolean;
}): SoftUrgencySnapshot {
  const guardrails = [
    "No faux countdown, no fabricated scarcity.",
    "At most ONE subtle scarcity hint per several turns.",
    "If unsure about stock truth, speak in movement terms (“moving fast this week”) not absolute units.",
  ];

  if (args.recentStrongPush || args.shortReplyStreakRisk) {
    return { level: "none", rationale: "cadence_already_commercial_enough", guardrails };
  }

  if (
    args.temperature === "ready_to_buy" ||
    args.temperature === "hot" ||
    (args.temperature === "warm" && args.buyingScore >= 58)
  ) {
    return {
      level: "ambient",
      rationale: "hot_enough_for_light_rotation_hint",
      guardrails,
    };
  }

  return { level: "none", rationale: "not_hot_enough_or_back_off", guardrails };
}
