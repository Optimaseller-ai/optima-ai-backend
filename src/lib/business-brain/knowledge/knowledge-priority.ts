import "server-only";

export function formatKnowledgePrioritySystemBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "KNOWLEDGE PRIORITY (anti-hallucination):",
      "1) Stock/price/promo numbers from CATALOGUE block (authoritative for SKUs in this prompt).",
      "2) Operator-configured BUSINESS FACTS + DOCUMENT EXCERPTS when they conflict with nothing above.",
      "3) FAQ-style lines only if present in excerpts — humanized short form.",
      "4) Prospect memory — preferences, past objections — nuance tone, never override hard facts.",
      "5) LLM creative fill — LAST resort; if missing data: human hold + verify (no invention).",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "PRIORIDAD CONOCIMIENTO:",
      "1) Catálogo (stock/precio/promo).",
      "2) Documentos / datos operador.",
      "3) Memoria prospecto (tono).",
      "4) Modelo creativo — último; si falta dato → verificar.",
    ].join("\n");
  }
  return [
    "PRIORITÉ DES SOURCES (anti-hallucination) :",
    "1) Bloc CATALOGUE : stock / prix / promo pour les articles listés ici — source dure.",
    "2) Faits métier configurés + EXTRAITS DOCUMENTS — si pas de conflit avec le catalogue.",
    "3) FAQ / politiques : seulement si présentes dans extraits — reformulation humaine courte.",
    "4) Mémoire prospect (préférences, objections) : nuance le ton, ne contredit pas un fait catalogue.",
    "5) Complétion « intelligente » du modèle : **dernier recours** ; si trou → « un instant je vérifie » plutôt qu’inventer.",
  ].join("\n");
}
