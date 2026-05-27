/**
 * Allègement naturel quand tension / complication — pas support client IA.
 */

export function detectConversationTension(message: string): boolean {
  const m = String(message ?? "").trim();
  return /\b(compliqu[ée]|difficile|énerv|frustr|marre|ras\s+le|trop\s+cher|arnaque|scam|stress)\b/i.test(m);
}

export function formatConversationReliefPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "CONVERSATION RELIEF:",
      "- When it feels heavy: lighten naturally (“Yeah, a bit.” / “Let’s simplify.”) — never AI support scripts.",
    ].join("\n");
  }
  if (lang === "es") {
    return "ALIVIO CONVERSACIONAL: aligerar sin guion de soporte IA.";
  }
  return [
    "SOULAGEMENT CONVERSATIONNEL :",
    "- Si tension (« ça devient compliqué ») : alléger (« Oui un peu. » « On va simplifier. ») — jamais phrases support client IA.",
  ].join("\n");
}

export function tryConversationReliefQuickReply(message: string, lang: "fr" | "en" | "es"): string | null {
  if (!detectConversationTension(message)) return null;
  if (!/\b(compliqu|difficile|simplif)\b/i.test(message)) return null;
  if (lang === "en") return "Yeah — let’s simplify.";
  if (lang === "es") return "Sí — lo simplificamos.";
  return "Oui un peu. On va simplifier.";
}
