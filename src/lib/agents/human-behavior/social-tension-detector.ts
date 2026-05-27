/**
 * Tension sociale légère (sarcasme, lassitude, méfiance…) — adoucir le ton côté prompt / délais.
 * Client + serveur.
 */

export type SocialTensionKind = "none" | "irritation" | "sarcasm" | "fatigue" | "skepticism";

export function detectSocialTension(message: string): SocialTensionKind {
  const t = String(message ?? "").trim();
  if (!t) return "none";
  const low = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (/\b(ben\s+oui|ah\s+bon|super\s+genial|genial\s+quoi|clairement\s+pas|mdr\s+ok|lol\s+ok)\b/i.test(low)) return "sarcasm";
  if (/\b(bref|laisse\s+tomber|lassé|las|fatigu|marre|ras\s*le\s*bol|whatever|forget\s+it)\b/i.test(low)) return "fatigue";
  if (/\b(méfiant|méfiance|arnaque|scam|pas\s+confiance|j\s*ai\s+déjà\s+été\s+arnaque|on\s+verra\s+bien)\b/i.test(low)) return "skepticism";
  if (/\b(énerv|agac|stop|assez|calme|tu\s+fais\s+exprès)\b/i.test(low)) return "irritation";

  return "none";
}

export function formatSocialTensionPromptBlock(kind: SocialTensionKind, lang: "fr" | "en" | "es"): string | null {
  if (kind === "none") return null;
  if (lang === "en") {
    const m: Record<Exclude<SocialTensionKind, "none">, string> = {
      sarcasm: "SOCIAL TENSION: dry / sarcastic vibe — stay calm, short, no matching irony; answer the substance gently.",
      fatigue: "SOCIAL TENSION: tired / wants to drop it — respect brevity, offer a clean exit, no pushy upsell lines.",
      skepticism: "SOCIAL TENSION: mistrust — acknowledge it like a human (not “I understand”), then facts; no corporate reassurance.",
      irritation: "SOCIAL TENSION: annoyed — de-escalate: slower, shorter, dignified.",
    };
    return m[kind as Exclude<SocialTensionKind, "none">];
  }
  if (lang === "es") {
    const m: Record<Exclude<SocialTensionKind, "none">, string> = {
      sarcasm: "TENSIÓN SOCIAL: ironía — calma, breve, sin ironía de vuelta.",
      fatigue: "TENSIÓN SOCIAL: cansancio / cierre — respete la salida, sin insistencia.",
      skepticism: "TENSIÓN SOCIAL: desconfianza — reconocer con naturalidad, luego datos.",
      irritation: "TENSIÓN SOCIAL: molestia — desescalada, muy breve.",
    };
    return m[kind as Exclude<SocialTensionKind, "none">];
  }
  const m: Record<Exclude<SocialTensionKind, "none">, string> = {
    sarcasm:
      "TENSION SOCIALE : ton sec / ironique — rester calme, court, sans renvoyer l’ironie ; répondre au fond avec naturel.",
    fatigue:
      "TENSION SOCIALE : lassitude / envie d’arrêter — respecter la brièveté, proposer une sortie propre, zéro relance agressive.",
    skepticism:
      "TENSION SOCIALE : méfiance / arnaque évoquée — accuser réception comme un humain (pas « je comprends » creux), puis fait utile.",
    irritation: "TENSION SOCIALE : agacement — désescalade : plus lent, plus court, digne.",
  };
  return m[kind as Exclude<SocialTensionKind, "none">];
}
