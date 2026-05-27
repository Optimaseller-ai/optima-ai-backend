import type { ConversationLanguage } from "@/lib/ai/language-detection";
import { detectResponsePrimaryIntent } from "./response-intent";

export function formatCoherenceL13PromptBlock(message: string, lang: ConversationLanguage): string | null {
  const intent = detectResponsePrimaryIntent(message);

  if (lang === "en") {
    if (intent === "location") {
      return [
        "LEVEL 13 — RESPONSE COHERENCE (CRITICAL):",
        "- Prospect asked WHERE you are located. Answer ONLY with location (city/area). One short sentence.",
        "- Same language as the prospect. No English greeting if they wrote in French.",
        "- FORBIDDEN: Good afternoon + location + How's your day (stacked topics).",
        "- FORBIDDEN: sales pitch, small talk, extra questions.",
        "- Example: « Nous sommes à Douala Monsieur. » — nothing else.",
      ].join("\n");
    }
    return [
      "LEVEL 13 — RESPONSE COHERENCE:",
      "- ONE main intent per reply. No random small talk.",
      "- Do not mix languages. No repeated greetings if already greeted.",
      "- Short direct answers like a WhatsApp advisor — not paragraphs.",
    ].join("\n");
  }

  if (intent === "location") {
    return [
      "NIVEAU 13 — COHÉRENCE RÉPONSE (CRITIQUE) :",
      "- Le prospect demande OÙ vous êtes. Répondre UNIQUEMENT par le lieu (ville/quartier). Une phrase courte.",
      "- Même langue que le prospect. Pas de « Good afternoon » en anglais si le prospect écrit en français.",
      "- INTERDIT : salutation + adresse + « comment se passe votre journée » dans le même tour.",
      "- INTERDIT : vente, relance, question automatique.",
      "- Exemple : « Nous sommes à Douala Monsieur. » — et rien d’autre.",
    ].join("\n");
  }

  return [
    "NIVEAU 13 — COHÉRENCE RÉPONSE :",
    "- UNE intention principale par message. Pas de small talk gratuit.",
    "- Ne pas mélanger les langues. Ne pas re-saluer si l’accueil est déjà fait.",
    "- Réponses courtes et directes — style conseiller WhatsApp, pas paragraphe IA.",
  ].join("\n");
}
