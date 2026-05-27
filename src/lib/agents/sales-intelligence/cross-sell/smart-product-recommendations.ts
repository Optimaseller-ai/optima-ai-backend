import "server-only";

export type RecommendationAngle = "newer_generation" | "better_battery" | "budget_pick" | "premium_pick" | "compatible_accessory";

export type RecommendationHint = {
  angle: RecommendationAngle;
  promptLineFr: string;
  promptLineEn: string;
  promptLineEs: string;
};

/** Indices catalogue-agnostiques pour suggérer cross-sell / variantes avec naturel. */
export function deriveSmartProductRecommendations(message: string): RecommendationHint[] {
  const m = String(message ?? "").toLowerCase();
  const hints: RecommendationHint[] = [];

  if (/\b(autonom|battery|mah|charger|hours|heures|journ[eé]e)\b/i.test(m)) {
    hints.push({
      angle: "better_battery",
      promptLineFr: "Si l’autonomie compte, proposer brièvement la réf avec meilleure endurance (sans catalogue inventé).",
      promptLineEn: "If autonomy matters, naturally mention which ref tends to hold charge better — only if credible from catalogue.",
      promptLineEs: "Si importa la autonomía, sugerir con naturalidad una ref con mejor batería (sin inventar).",
    });
  }

  if (/\b(neuf|r[eé]cent|derni[eè]re\s+version|mod[eè]le\s+plus\s+r[eé]cent|latest)\b/i.test(m)) {
    hints.push({
      angle: "newer_generation",
      promptLineFr: "Moment utile pour : « nous avons aussi une version plus récente » — une phrase seule.",
      promptLineEn: 'Moment for: "We also have a newer version" — single short line.',
      promptLineEs: 'Momento para: « también tenemos versión más reciente ».',
    });
  }

  if (/\b(budget|(pas\s+trop\s+)|entr[eé]e\s+de\s+gamme|ratio|cheap|moins\s+cher)\b/i.test(m)) {
    hints.push({
      angle: "budget_pick",
      promptLineFr: "Proposer avec douceur l’alternative budget vs premium en une ligne chacune.",
      promptLineEn: "Gently propose a budget-oriented option vs premium — one line each, no stacking.",
      promptLineEs: "Proponer con suavidad entrada de gama vs versión mejor — línea cada una.",
    });
  }

  if (/\b(pro|max|premium|haut\s+de\s+gamme|full\s+option)\b/i.test(m)) {
    hints.push({
      angle: "premium_pick",
      promptLineFr: "Mettre une premium line crédible (confort/autonomie) — sans superlatifs IA.",
      promptLineEn: "Credibly frame premium (comfort/longevity), no hype stacking.",
      promptLineEs: "Enmarcar la premium con valor concreto, sin hype.",
    });
  }

  if (/\b(coque|protection|adaptateur|charger|charging\s*cable|cable|cordon|strap|bracelet|etui|case)\b/i.test(m)) {
    hints.push({
      angle: "compatible_accessory",
      promptLineFr: "Accessory : « compatible avec votre modèle » en une courte phrase utile.",
      promptLineEn: "Accessory: single helpful compatibility line.",
      promptLineEs: "Accesorio: una frase de compatibilidad útil.",
    });
  }

  return hints.slice(0, 2);
}
