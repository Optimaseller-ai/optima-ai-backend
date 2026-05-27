import { detectSocialSignal } from "./social-signal-detector";
import { buildHumanGreetingReply } from "./human-greeting-engine";
import { buildSmallTalkReply } from "./small-talk-engine";

const HOLD_ONLY =
  /^\s*(je\s+vérifie|je\s+verifie|je\s+regarde(\s+cela)?|un\s+instant|attendez|let\s+me\s+check|one\s+moment)[\s.!?]*$/i;

const HOLD_HEAVY =
  /\b(je\s+vérifie|je\s+verifie|un\s+instant\s+s'il|let\s+me\s+check)\b/i;

export function isHoldOnlyReply(text: string): boolean {
  return HOLD_ONLY.test(String(text ?? "").trim());
}

/** Remplace réponses « hold » seules par une réponse sociale humaine. */
export function sanitizeHoldReply(args: {
  text: string;
  lastUserMessage: string;
  agentName: string;
  businessName: string;
  businessIanaTimezone?: string;
  personaKey?: string | null;
  lang?: "fr" | "en" | "es";
  prospectProfile?: import("@/lib/agents/memory/prospect-profile").ProspectProfile;
  welcomeAlreadyDelivered?: boolean;
  allowEmoji?: boolean;
}): string {
  let out = String(args.text ?? "").trim();
  if (!out) return out;

  const lang = args.lang ?? "fr";
  const userMsg = String(args.lastUserMessage ?? "").trim();
  const signal = detectSocialSignal(userMsg);

  const mustReplace = isHoldOnlyReply(out) || (out.length < 28 && HOLD_HEAVY.test(out) && signal !== "none");

  if (!mustReplace) return out;

  if (signal === "greeting" || signal === "greeting_evening") {
    return buildHumanGreetingReply({
      message: userMsg,
      agentName: args.agentName,
      businessName: args.businessName,
      businessIanaTimezone: args.businessIanaTimezone,
      personaKey: args.personaKey,
      prospectProfile: args.prospectProfile,
      welcomeAlreadyDelivered: args.welcomeAlreadyDelivered,
      allowEmoji: args.allowEmoji,
      lang,
    });
  }

  const small = buildSmallTalkReply({
    signal: signal === "none" ? "wellbeing" : signal,
    message: userMsg,
    agentName: args.agentName,
    businessName: args.businessName,
    prospectProfile: args.prospectProfile,
    allowEmoji: args.allowEmoji,
    lang,
  });

  if (small) return small;

  return lang === "en"
    ? `Hi — I'm ${args.agentName} at ${args.businessName}. How can I help?`
    : lang === "es"
      ? `Hola — soy ${args.agentName} de ${args.businessName}. ¿En qué le ayudo?`
      : `Bonjour — je suis ${args.agentName} chez ${args.businessName}. Dites-moi ce qu'il vous faut.`;
}
