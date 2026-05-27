import type { DominantEmotion, EmotionalTrustBand } from "./types";

/** Calcule la confiance prospect (0–1) à partir du message et du contexte. */
export function computeTrustLevel(args: {
  message: string;
  dominantEmotion: DominantEmotion;
  previousTrust01?: number;
  salesSignalsTrust01?: number;
  securityQuestionCount?: number;
}): { trust01: number; band: EmotionalTrustBand; rationale: string } {
  let trust = typeof args.previousTrust01 === "number" ? args.previousTrust01 : 0.52;
  const m = String(args.message ?? "").toLowerCase();

  // Questions sécurité / méfiance → baisse
  if (/\b(arnaque|garantie|preuve|avis|vrai|faux|confiance|sécuris|securis|remboursement)\b/i.test(m)) {
    trust -= 0.14;
  }
  if ((args.securityQuestionCount ?? 0) >= 2) trust -= 0.1;

  if (args.dominantEmotion === "scam_fear" || args.dominantEmotion === "frustration" || args.dominantEmotion === "mild_anger") {
    trust -= 0.18;
  }

  // Demande livraison / paiement = confiance opérationnelle
  if (/\b(livraison|livrer|adresse|paiement|payer|lien|orange money|mtn|wave|commander)\b/i.test(m)) {
    trust += 0.12;
  }

  if (args.dominantEmotion === "confidence" || args.dominantEmotion === "enthusiasm" || args.dominantEmotion === "satisfaction") {
    trust += 0.1;
  }

  if (typeof args.salesSignalsTrust01 === "number") {
    trust = trust * 0.65 + args.salesSignalsTrust01 * 0.35;
  }

  trust = Math.max(0.08, Math.min(0.96, trust));

  const band: EmotionalTrustBand = trust < 0.38 ? "low" : trust > 0.68 ? "high" : "medium";
  const rationale =
    band === "low"
      ? "Méfiance ou friction — rassurer avant de pousser."
      : band === "high"
        ? "Confiance opérationnelle — peut avancer sur livraison / commande."
        : "Confiance modérée — construire la relation.";

  return { trust01: trust, band, rationale };
}

export function countSecurityQuestions(message: string, previousCount = 0): number {
  const m = String(message ?? "").toLowerCase();
  const bump = /\b(arnaque|garantie|preuve|avis|confiance|remboursement|sécuris|securis)\b/i.test(m) ? 1 : 0;
  return Math.min(6, previousCount + bump);
}
