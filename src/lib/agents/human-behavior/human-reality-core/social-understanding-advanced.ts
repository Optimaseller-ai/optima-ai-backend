import "server-only";

import { detectProspectEmotion } from "../emotions/emotion-detector";

export type AdvancedSocialSignal = {
  humor: boolean;
  irony: boolean;
  frustration: boolean;
  weariness: boolean;
  distrust: boolean;
  hiddenInterest: boolean;
};

export function inferAdvancedSocialUnderstanding(message: string): AdvancedSocialSignal {
  const m = String(message ?? "").toLowerCase();
  const emotion = detectProspectEmotion(message);

  return {
    humor: /\b(mdrr?|lol|haha|😂|🤣)\b/i.test(m) || /\b(c['']est\s+ça|ben\s+ouais)\s*\.\.\./i.test(m),
    irony: /\b(super\s+merci|génial\s+ça|wow\s+quoi|very\s+funny)\b/i.test(m),
    frustration: emotion === "frustration" || emotion === "anger" || /\b(marre|ras\s+le\s+bol|nul)\b/i.test(m),
    weariness: /\b(lassé|fatigué|plus\s+le\s+temps)\b/i.test(m) || /\b\.\.\.\s*$/i.test(message.trim()),
    distrust: /\b(je\s+doute|pas\s+sûr\s+de\s+vous|arnaque|mensonge)\b/i.test(m),
    hiddenInterest:
      /\b(je\s+regarde\s+juste|sans\s+acheter|pour\s+voir)\b/i.test(m) &&
      /\b(prix|combien|dispo)\b/i.test(m),
  };
}
