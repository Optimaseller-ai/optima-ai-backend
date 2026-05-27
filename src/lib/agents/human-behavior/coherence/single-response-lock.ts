import type { LockedLanguage } from "./language-lock";
import type { ResponsePrimaryIntent } from "./response-intent";
import { dedupeGreetingFragments, dedupeSentences, splitIntoSentences } from "./duplicate-detector";

const LOCATION_CONTENT =
  /\b(situé|situe|situer|situés|located|ubicad|adresse|douala|yaound|akwa|bonanjo|quartier|cameroon|cameroun|nous\s+sommes|we\s+are\s+located|we'?re\s+in|à\s+[A-ZÀ-Ö])/i;

const PRICE_CONTENT = /\b(prix|fcfa|cfa|€|cost|price|precio|combien)\b/i;
const DELIVERY_CONTENT = /\b(livraison|livrer|delivery|shipping|délai|delai)\b/i;

function sentenceMatchesIntent(sentence: string, intent: ResponsePrimaryIntent): boolean {
  const t = String(sentence ?? "").trim();
  if (!t) return false;
  switch (intent) {
    case "location":
      return LOCATION_CONTENT.test(t);
    case "price":
      return PRICE_CONTENT.test(t);
    case "delivery":
      return DELIVERY_CONTENT.test(t);
    case "wellbeing":
      return /\b(ça\s+va|ca\s+va|bien|merci|thanks|gracias|doing\s+well|all\s+good)\b/i.test(t);
    case "greeting":
      return /\b(bonjour|bonsoir|salut|hello|hi|welcome|bienvenue)\b/i.test(t);
    case "thanks":
      return /\b(merci|thanks|gracias|de\s+rien|you'?re\s+welcome)\b/i.test(t);
    default:
      return true;
  }
}

/**
 * Garde uniquement les phrases alignées sur l'intention principale (+ politesse courte optionnelle).
 */
export function lockReplyToPrimaryIntent(args: {
  text: string;
  intent: ResponsePrimaryIntent;
  lockedLang: LockedLanguage;
  greetingAlreadyDone: boolean;
  city?: string;
}): string {
  let sentences = splitIntoSentences(args.text);
  sentences = dedupeGreetingFragments(sentences, args.greetingAlreadyDone);
  sentences = dedupeSentences(sentences);

  if (args.intent === "location" || args.intent === "price" || args.intent === "delivery" || args.intent === "thanks") {
    const focused = sentences.filter((s) => sentenceMatchesIntent(s, args.intent));
    if (focused.length) sentences = focused;
    else if (args.intent === "location" && args.city?.trim()) {
      const city = args.city.trim();
      if (args.lockedLang === "en") sentences = [`We're in ${city}.`];
      else if (args.lockedLang === "es") sentences = [`Estamos en ${city}.`];
      else sentences = [`Nous sommes à ${city} Monsieur.`];
    }
  }

  if (args.intent === "location" || args.intent === "wellbeing" || args.intent === "thanks") {
    sentences = sentences.slice(0, 1);
  } else if (args.intent === "greeting") {
    sentences = sentences.slice(0, 2);
  } else {
    sentences = sentences.slice(0, 3);
  }

  return sentences.join(" ").trim();
}
