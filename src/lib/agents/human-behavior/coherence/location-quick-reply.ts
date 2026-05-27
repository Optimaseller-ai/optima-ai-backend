import type { ProspectProfile } from "@/lib/agents/memory/prospect-profile";
import { englishHonorificSmart, frenchHonorificSmart, spanishHonorificSmart } from "@/lib/agents/memory/prospect-profile";
import type { ConversationLanguage } from "@/lib/ai/language-detection";
import { detectResponsePrimaryIntent } from "./response-intent";

export function isLocationQuestion(message: string): boolean {
  return detectResponsePrimaryIntent(message) === "location";
}

export function buildLocationQuickReply(args: {
  message: string;
  lang: ConversationLanguage;
  city?: string;
  prospectProfile?: ProspectProfile;
}): string | null {
  if (!isLocationQuestion(args.message)) return null;

  const city = String(args.city ?? "").trim();
  if (!city || /^non\s+sp[eé]cifi/i.test(city)) return null;

  if (args.lang === "en") {
    const honor = englishHonorificSmart(args.prospectProfile);
    return honor ? `We're in ${city}, ${honor}.` : `We're in ${city}.`;
  }
  if (args.lang === "es") {
    const honor = spanishHonorificSmart(args.prospectProfile);
    return honor ? `Estamos en ${city}, ${honor}.` : `Estamos en ${city}.`;
  }
  const honor = frenchHonorificSmart(args.prospectProfile);
  return honor ? `Nous sommes à ${city} ${honor}.` : `Nous sommes à ${city} Monsieur.`;
}
