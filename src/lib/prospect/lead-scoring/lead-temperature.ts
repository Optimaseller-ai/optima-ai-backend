import type { LeadTemperature, SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

export type LeadScoringSignals = {
  turnCount?: number;
  priceQuestions?: number;
  deliveryQuestions?: number;
  productViews?: number;
  returnVisits?: number;
  buyingIntentScore?: number;
  lastUserMessage?: string;
};

const SOCIAL_ONLY_MSG =
  /^(bonjour|bonsoir|salut|coucou|cc|bjr|bsr|hello|hi|hey|hola|buenos|ça\s+va|ca\s+va|merci|thanks|bonne\s+nuit|bonne\s+soirée|a\s*\+)[\s!.?👋🙂]*$/i;

export function scoreLeadTemperature(signals: LeadScoringSignals): LeadTemperature {
  const msg = String(signals.lastUserMessage ?? "").trim().toLowerCase();
  if (SOCIAL_ONLY_MSG.test(msg) && !/\b(prix|commander|acheter|stock|livraison|devis)\b/i.test(msg)) {
    return "cold";
  }

  let score = signals.buyingIntentScore ?? 20;
  const turnBump = /\b(prix|commander|acheter|stock|livraison|devis|modèle|modele)\b/i.test(msg)
    ? (signals.turnCount ?? 0) * 4
    : 0;
  score += turnBump;
  score += (signals.priceQuestions ?? 0) * 12;
  score += (signals.deliveryQuestions ?? 0) * 10;
  score += (signals.productViews ?? 0) * 6;
  score += (signals.returnVisits ?? 0) * 8;

  if (/\b(je\s+prends|je\s+commande|je\s+valide|acheter|commander)\b/i.test(msg)) score += 35;
  if (/\b(prix|combien|budget|dispo|livraison)\b/i.test(msg)) score += 15;

  if (score >= 75) return "ready_to_buy";
  if (score >= 48) return "hot";
  if (score >= 28) return "warm";
  return "cold";
}

export function evolveLeadTemperature(
  profile: SmartProspectProfile,
  signals: LeadScoringSignals,
): LeadTemperature {
  const next = scoreLeadTemperature({
    ...signals,
    buyingIntentScore: profile.interestLevel === "hot" ? 55 : profile.interestLevel === "warm" ? 35 : 20,
  });
  const order: LeadTemperature[] = ["cold", "warm", "hot", "ready_to_buy"];
  const cur = order.indexOf(profile.leadTemperature);
  const n = order.indexOf(next);
  return order[Math.max(cur, n)] ?? next;
}
