import "server-only";

const OFF_TOPIC =
  /\b(météo|politique|football|match|blague|vacances|film|série|tiktok|instagram)\b/i;

const SALES_ANCHOR =
  /\b(modèle|budget|téléphone|phone|stock|prix|livraison|garantie|accessoire|pc|ordinateur)\b/i;

export function detectOffTopicDrift(userMessage: string): boolean {
  const t = String(userMessage ?? "").trim();
  if (!t) return false;
  return OFF_TOPIC.test(t) && !SALES_ANCHOR.test(t);
}

export function formatConversationRedirectionBlock(lang: "fr" | "en" | "es", offTopic: boolean): string | null {
  if (!offTopic) return null;
  if (lang === "en") {
    return "OFF-TOPIC: acknowledge briefly like a human, then steer back to their shopping need — no lecture, no brutality.";
  }
  if (lang === "es") {
    return "FUERA DE TEMA: reconocer breve y volver al necesidad de compra con naturalidad.";
  }
  return "HORS-SUJET : accuser réception brièvement comme un humain, puis revenir naturellement vers leur besoin — sans brutalité.";
}
