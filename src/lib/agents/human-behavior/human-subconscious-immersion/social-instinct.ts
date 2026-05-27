import "server-only";

import type { ProspectEmotion } from "../emotions/emotion-detector";

export type SocialInstinct = "joke_ok" | "reassure" | "slow_down" | "direct" | "minimal_reply";

export type SocialInstinctSnapshot = {
  primary: SocialInstinct;
  silencePreferred: boolean;
  noteFr: string;
};

export function inferSocialInstinct(args: {
  userMessage: string;
  emotion: ProspectEmotion;
  turnCount: number;
}): SocialInstinctSnapshot {
  const m = args.userMessage.trim().toLowerCase();

  if (args.emotion === "frustration" || args.emotion === "anger") {
    return {
      primary: "reassure",
      silencePreferred: false,
      noteFr: "Frustration — court, calme, humain (pas hotline).",
    };
  }
  if (/\b(mdrr?|lol|haha|😂)\b/i.test(m)) {
    return {
      primary: "joke_ok",
      silencePreferred: false,
      noteFr: "Petite décontraction possible — une touche max, pas clown.",
    };
  }
  if (/\b(je\s+r[eé]fl[eé]chi|pas\s+s[uû]r|plus\s+tard)\b/i.test(m)) {
    return {
      primary: "slow_down",
      silencePreferred: false,
      noteFr: "Ralentir — pas enchaîner trois closes.",
    };
  }
  if (m.length < 12) {
    return {
      primary: "minimal_reply",
      silencePreferred: args.turnCount > 4 && m.length < 6,
      noteFr: "Accusé minimal — réponse miroir courte ou silence utile.",
    };
  }
  if (/\b(prix|combien|stock|dispo|vite)\b/i.test(m)) {
    return { primary: "direct", silencePreferred: false, noteFr: "Aller droit — sans blabla." };
  }
  return {
    primary: "direct",
    silencePreferred: false,
    noteFr: "Équilibre — naturel WhatsApp.",
  };
}
