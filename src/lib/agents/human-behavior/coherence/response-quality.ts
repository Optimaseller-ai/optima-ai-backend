import type { LockedLanguage } from "./language-lock";
import type { ResponsePrimaryIntent } from "./response-intent";
import { looksWrongLanguage } from "./language-lock";

/** « Un vrai conseiller WhatsApp répondrait-il comme ça ? » */
export function passesWhatsAppQualityGate(args: {
  reply: string;
  intent: ResponsePrimaryIntent;
  lockedLang: LockedLanguage;
}): boolean {
  const r = String(args.reply ?? "").trim();
  if (!r || r.length < 3) return false;
  if (looksWrongLanguage(r, args.lockedLang)) return false;

  const sentences = r.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (args.intent === "location" && sentences.length > 2) return false;
  if (args.intent === "location" && /\b(how'?s\s+your\s+day|comment\s+se\s+passe)\b/i.test(r)) return false;

  const dupGreeting =
    (/\bgood\s+(morning|afternoon|evening)\b/i.test(r) ? 1 : 0) +
    (/\b(bonjour|bonsoir)\b/i.test(r) ? 1 : 0);
  if (dupGreeting > 1) return false;

  if (args.intent === "location") {
    const hasLocation = /\b(situé|situe|located|nous\s+sommes|we\s+are|à\s+\w|in\s+\w)/i.test(r);
    if (!hasLocation && r.length > 80) return false;
  }

  return true;
}

export function minimalRewriteForIntent(args: {
  intent: ResponsePrimaryIntent;
  lockedLang: LockedLanguage;
  city?: string;
  honorific?: string | null;
}): string | null {
  const city = String(args.city ?? "").trim();
  const h = args.honorific?.trim();
  const frHonor = h || "Monsieur";

  if (args.intent === "location" && city) {
    if (args.lockedLang === "en") return `We're in ${city}${h ? `, ${h}` : ""}.`;
    if (args.lockedLang === "es") return `Estamos en ${city}.`;
    return `Nous sommes à ${city} ${frHonor}.`;
  }
  return null;
}
