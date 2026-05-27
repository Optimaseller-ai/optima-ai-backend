/**
 * Instinct conversationnel — quand parler, ralentir, rassurer, proposer, se taire.
 */

import { detectProspectEmotion } from "./emotions/emotion-detector";
import { inferConversationEmotionalTemperature } from "./emotions/conversation-emotion";
import { computeResponseWeight } from "./response-weight-system";

export type ConversationInstinct =
  | "listen"
  | "reassure"
  | "clarify"
  | "propose"
  | "slow_down"
  | "stay_short"
  | "steady";

export type ResponsePriority = "emotion_first" | "reassure_first" | "sell_light" | "steady";

export function inferConversationInstinct(userMessage: string): ConversationInstinct {
  const m = String(userMessage ?? "").trim();
  if (!m) return "steady";
  const temp = inferConversationEmotionalTemperature(m);
  const emotion = detectProspectEmotion(m);
  const weight = computeResponseWeight(m);

  if (temp === "frustré" || temp === "irrité" || emotion === "anger" || emotion === "frustration") {
    return "reassure";
  }
  if (/\b(je\s+vais\s+r[ée]fléchir|pas\s+s[ûu]r|h[ée]site|maybe|tal\s+vez|no\s+s[ée])\b/i.test(m)) {
    return "slow_down";
  }
  if (/\b(compliqu[ée]|confus|perdu|lost|no\s+entiendo)\b/i.test(m)) {
    return "clarify";
  }
  if (weight.tier === "light" && m.length < 12) return "stay_short";
  if (/\b(prix|stock|livraison|commander|acheter|disponible|taille|couleur|price|buy)\b/i.test(m)) {
    return "propose";
  }
  if (/\b(fatigu|stress|d[eé]prim|triste)\b/i.test(m)) return "listen";
  return "steady";
}

export function inferResponsePriority(instinct: ConversationInstinct): ResponsePriority {
  switch (instinct) {
    case "reassure":
    case "listen":
    case "slow_down":
      return "emotion_first";
    case "clarify":
      return "reassure_first";
    case "propose":
      return "sell_light";
    default:
      return "steady";
  }
}

export function formatConversationInstinctBlock(instinct: ConversationInstinct, priority: ResponsePriority, lang: "fr" | "en" | "es"): string {
  const mapFr: Record<ConversationInstinct, string> = {
    listen: "Écouter d’abord — pas pousser la vente.",
    reassure: "Rassurer / apaiser avant tout argumentaire.",
    clarify: "Simplifier — une question claire max.",
    propose: "Proposer seulement si le fil le demande — pas de forcing.",
    slow_down: "Ralentir — laisser respirer, pas enchaîner.",
    stay_short: "Réponse très courte — le fil respire.",
    steady: "Rythme normal de conseiller.",
  };
  const mapEn: Record<ConversationInstinct, string> = {
    listen: "Listen first — no sales push.",
    reassure: "Reassure before pitching.",
    clarify: "Simplify — one clear question max.",
    propose: "Offer only when the thread asks for it.",
    slow_down: "Slow down — give space.",
    stay_short: "Very short reply — let the thread breathe.",
    steady: "Normal advisor pace.",
  };
  if (lang === "en") {
    return [
      `CONVERSATION INSTINCT: ${mapEn[instinct]}`,
      priority === "emotion_first"
        ? "PRIORITY: emotion before sale."
        : priority === "reassure_first"
          ? "PRIORITY: reassure before details."
          : priority === "sell_light"
            ? "PRIORITY: light commercial move only if natural."
            : "PRIORITY: steady human pace.",
    ].join("\n");
  }
  if (lang === "es") {
    return `INSTINTO: ${instinct} — prioridad ${priority}.`;
  }
  return [
    `INSTINCT CONVERSATIONNEL : ${mapFr[instinct]}`,
    priority === "emotion_first"
      ? "PRIORITÉ : émotion avant vente."
      : priority === "reassure_first"
        ? "PRIORITÉ : rassurer avant détail."
        : priority === "sell_light"
          ? "PRIORITÉ : touche commerciale légère seulement si naturel."
          : "PRIORITÉ : rythme humain stable.",
  ].join("\n");
}
