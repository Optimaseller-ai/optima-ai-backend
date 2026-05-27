import "server-only";

import type { SellerLanguage } from "@/lib/agents/seller-language";

export function formatFollowupIntelligencePromptBlock(lang: SellerLanguage): string {
  if (lang === "en") {
    return [
      "SMART FOLLOW-UP (silent prospect):",
      "After a natural delay, one gentle check-in — e.g. “Still looking for a model?” / “I can suggest something else too.”",
      "Never stack multiple pings; never guilt-trip.",
    ].join("\n");
  }
  if (lang === "es") {
    return "SEGUIMIENTO INTELIGENTE: una relance suave si calla — sin presión.";
  }
  return [
    "RELANCE INTELLIGENTE (prospect silencieux) :",
    "Après délai naturel, une relance douce — ex. « Vous cherchez toujours un modèle ? », « Je peux aussi vous proposer autre chose. »",
    "Jamais plusieurs relances d’affilée ni culpabilisation.",
  ].join("\n");
}

export function pickSilentProspectFollowup(lang: SellerLanguage, seed: string): string {
  const fr = [
    "Vous cherchez toujours un modèle ?",
    "Je peux aussi vous proposer autre chose si vous voulez.",
    "Dites-moi si vous voulez qu’on reprenne.",
  ];
  const en = [
    "Still looking for a model?",
    "I can suggest something else too if you want.",
    "Let me know if you want to pick this back up.",
  ];
  const list = lang === "en" ? en : lang === "es" ? fr : fr;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % list.length;
  return list[h] ?? list[0]!;
}
