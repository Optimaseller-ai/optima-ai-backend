import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type ConversationalEmotionalMemorySnapshot = {
  pastFrustration: boolean;
  pastHesitation: boolean;
  pastDistrust: boolean;
  enthusiasmSignal: boolean;
  relationalToneHint: string;
  adaptationNoteFr: string;
  adaptationNoteEn: string;
  adaptationNoteEs: string;
};

/** Mémoire émotionnelle conversationnelle — lecture état existant + message courant. */
export function buildConversationalEmotionalMemorySnapshot(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
}): ConversationalEmotionalMemorySnapshot {
  const m = String(args.message ?? "").toLowerCase();
  const st = args.conversationState;
  const pem = st?.prospectEmotionalMemory?.kind;
  const tone = st?.conversationProfile?.tone ?? "neutral";
  const habits = Array.isArray(st?.socialConversationHabits) ? st!.socialConversationHabits! : [];

  const pastFrustration = pem === "frustrated" || pem === "angry" || /(marre|résign|déç|décue)/i.test(m);
  const pastHesitation =
    tone === "hesitant" || habits.includes("hesitant_buyer") || /(h[eé]sit|pas\s+s[uû]r|voir\s+plus\s+tard)/i.test(m);
  const pastDistrust =
    /(arnaque|scam|pourquoi\s+croire|je\s+vous\s+connais\s+pas|m[eé]fie)/i.test(m) || pem === "financial_loss";
  const enthusiasmSignal = tone === "loyal" || /(super|g[eé]nial|j'adore|cool|merci\s+beaucoup)/i.test(m);

  const relationalToneHint =
    tone === "warm" || tone === "loyal"
      ? "warm_trust"
      : tone === "aggressive" || tone === "cold"
        ? "need_repair"
        : "neutral_professional";

  const adaptationNoteFr = [
    pastFrustration ? "Frustration récente ou thème sensible — rester posé, court, concret." : null,
    pastHesitation ? "Hésitation : rassurer sans presser." : null,
    pastDistrust ? "Méfiance : preuve courte + geste réel, pas slogans." : null,
    enthusiasmSignal ? "Bon feeling : rester naturel, éviter enchérir en marketing." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const adaptationNoteEn = [
    pastFrustration ? "Recent frustration — calm, short, concrete." : null,
    pastHesitation ? "Hesitating — reassure without pushing." : null,
    pastDistrust ? "Mistrust — one credible proof/action, no slogans." : null,
    enthusiasmSignal ? "Good vibes — stay natural; don’t stack hype." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const adaptationNoteEs = [
    pastFrustration ? "Frustración reciente — corto y concreto." : null,
    pastHesitation ? "Titubea — reaseguro sin presión." : null,
    pastDistrust ? "Desconfianza — prueba corta y real." : null,
    enthusiasmSignal ? "Buen ritmo — natural, sin marketing extra." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    pastFrustration,
    pastHesitation,
    pastDistrust,
    enthusiasmSignal,
    relationalToneHint,
    adaptationNoteFr: adaptationNoteFr || "Fil relationnel stable — continuité de personnalité.",
    adaptationNoteEn: adaptationNoteEn || "Stable relational thread — same personality.",
    adaptationNoteEs: adaptationNoteEs || "Hilo relacional estable — misma persona.",
  };
}
