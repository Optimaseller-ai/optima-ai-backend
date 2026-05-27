import type { DominantEmotion } from "./types";

export type EmotionHit = {
  emotion: DominantEmotion;
  weight: number;
  snippet?: string;
};

const PATTERNS: Array<{ emotion: DominantEmotion; re: RegExp; weight: number }> = [
  { emotion: "mild_anger", re: /\b(connard|putain|merde|fdp|inadmissible|scandaleux)\b/i, weight: 0.92 },
  { emotion: "frustration", re: /\b(marre|ras le bol|déçu|decu|déception|nul|plainte|réclamation|pas content|vous faites erreur)\b/i, weight: 0.88 },
  { emotion: "scam_fear", re: /\b(arnaque|scam|arnaquer|je vous connais pas|pourquoi croire|pas confiance|faux|escroc)\b/i, weight: 0.9 },
  { emotion: "purchase_stress", re: /\b(stress|pressé|presse|vite|urgent|dernière minute|peur de rater|stock part)\b/i, weight: 0.75 },
  { emotion: "emotional_urgency", re: /\b(!!+|tout de suite|maintenant|asap|dépêche|depeche|avant ce soir)\b/i, weight: 0.82 },
  { emotion: "impatience", re: /\b(depuis|attends|attendez|toujours pas|encore rien|ça fait longtemps)\b/i, weight: 0.7 },
  { emotion: "confusion", re: /\b(je comprends pas|pas clair|c'est quoi exactement|expliquez|confus)\b/i, weight: 0.78 },
  { emotion: "hesitation", re: /\b(hésit|hesit|peut-être|pas sûr|pas sur|je sais pas|doute|réfléch)\b/i, weight: 0.72 },
  { emotion: "enthusiasm", re: /\b(super|génial|genial|top|parfait|excellent|j'adore|🔥|😍)\b/i, weight: 0.8 },
  { emotion: "excitement", re: /\b(hâte|impatient|yes+|let's go|on y va|je veux ça)\b/i, weight: 0.76 },
  { emotion: "confidence", re: /\b(parfait on valide|je prends|je commande|envoyez le lien|go pour)\b/i, weight: 0.85 },
  { emotion: "satisfaction", re: /\b(merci beaucoup|super merci|parfait merci|thanks so much)\b/i, weight: 0.65 },
];

/** Analyse message prospect — signaux émotionnels multi-couches. */
export function detectEmotionalSignals(message: string): EmotionHit[] {
  const m = String(message ?? "").trim();
  if (!m) return [{ emotion: "neutral", weight: 0.5 }];

  const hits: EmotionHit[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(m)) hits.push({ emotion: p.emotion, weight: p.weight, snippet: m.slice(0, 64) });
  }

  if (!hits.length) hits.push({ emotion: "neutral", weight: 0.45 });
  hits.sort((a, b) => b.weight - a.weight);
  return hits.slice(0, 4);
}

export function pickDominantEmotion(hits: EmotionHit[]): DominantEmotion {
  return hits[0]?.emotion ?? "neutral";
}
