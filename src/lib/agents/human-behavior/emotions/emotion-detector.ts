import "server-only";

/**
 * États émotionnels prospect pour adapter ton, longueur et délais.
 * (Distinct du ton « vendeur » dans seller-prompts.)
 */
export type ProspectEmotion =
  | "frustration"
  | "anger"
  | "hesitation"
  | "curiosity"
  | "impatience"
  | "enthusiasm"
  | "confusion"
  | "satisfaction"
  | "purchase_interest"
  | "neutral";

const FRUSTRATION =
  /(marre|ras\s*le\s*bol|nul|arnaque|scam|mensonge|honte|inadmissible|inacceptable|réclamation|réclamer|plainte|déçu|décue|déçus|déçues|déception|tu\s+m['’']as\s+déçu|vous\s+m['’']avez\s+déçu|pas\s+content|furious|angry|upset|ne\s+souhaite\s+rien\s+commander|rien\s+commander|je\s+ne\s+commande\s+pas|trop\s+d['’']?erreurs|vous\s+faites\s+d['’']?erreurs|tu\s+fais\s+d['’']?erreurs|vous\s+vous\s+trompez|tu\s+te\s+trompes)/i;
const CONFUSION =
  /(je\s+comprends\s+pas|je\s+n['’']?ai\s+pas\s+compris|c['’']?est\s+pas\s+clair|pas\s+clair|expliquez|i\s+don['’']?t\s+get\s+it|confus|confused)/i;
const SATISFACTION = /(merci\s+beaucoup|merci\s+bcp|super\s+merci|parfait\s+merci|thanks\s+so\s+much|great\s+thanks)/i;
const PURCHASE_INTEREST = /(je\s+prends|je\s+commande|je\s+veux\s+l['’']?acheter|je\s+r[eè]gle|i['’']?ll\s+take\s+it|i\s+want\s+to\s+buy|purchase|order\s+now)/i;
const ANGER = /(connard|conne|merde|putain|fdp|crève|tue|😠|😡|🤬)/i;
const HESITATION = /(hésit|peut-être|pas\s+sûr|pas\s+sure|je\s+sais\s+pas|sais\s+pas|doute|réfléch|euh+|hmm+|🤔|😕)/i;
const CURIOSITY = /(c['’]est\s+quoi|explique|pourquoi|comment\s+ça|intéressant|curieux|curieuse|what\s+is|how\s+does)/i;
const IMPATIENCE = /(\b(vite|urgent|asap|maintenant|tout\s+de\s+suite|déjà|depuis|attends|attendez)\b|!!+|⏱|⌛)/i;
const ENTHUSIASM = /(super|génial|géniale|top|parfait|excellent|hâte|impatient|impatiente|yes|yeah|🔥|🎉|😍)/i;

/**
 * Détection heuristique rapide (sans modèle). Dernières correspondances prioritaires.
 */
export function detectProspectEmotion(message: string): ProspectEmotion {
  const msg = String(message ?? "").trim();
  if (!msg) return "neutral";

  if (ANGER.test(msg)) return "anger";
  if (FRUSTRATION.test(msg)) return "frustration";
  if (IMPATIENCE.test(msg)) return "impatience";
  if (CONFUSION.test(msg)) return "confusion";
  if (PURCHASE_INTEREST.test(msg)) return "purchase_interest";
  if (SATISFACTION.test(msg)) return "satisfaction";
  if (HESITATION.test(msg)) return "hesitation";
  if (CURIOSITY.test(msg)) return "curiosity";
  if (ENTHUSIASM.test(msg)) return "enthusiasm";

  return "neutral";
}

/** Multiplicateur de délai « humain » (1 = normal). */
export function emotionDelayFactor(emotion: ProspectEmotion): number {
  switch (emotion) {
    case "anger":
    case "frustration":
      /** Pauses plus longues = réflexion humaine face à la friction (niveau 2). */
      return 1.3;
    case "impatience":
      return 0.78;
    case "purchase_interest":
      return 0.92;
    case "hesitation":
    case "confusion":
      return 1.15;
    case "curiosity":
      return 1.05;
    case "enthusiasm":
    case "satisfaction":
      return 1.0;
    default:
      return 1.0;
  }
}
