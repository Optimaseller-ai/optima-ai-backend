import "server-only";

import { STRATEGY_INSTRUCTIONS } from "@/lib/ai/sales/strategy-dispatcher";
import type { ConversationOrchestratorPlan } from "./types";
import { FORBIDDEN_HOLD_PHRASES } from "./human-reply-guard";
import { deriveResponseStyle } from "./response-style-engine";
import { deriveHumanToneHints } from "./human-tone-engine";

/** Bloc prompt injecté — comportement humain avancé. */
export function formatHumanConversationPromptBlock(
  plan: ConversationOrchestratorPlan,
  lang: "fr" | "en" | "es",
): string {
  const style = deriveResponseStyle({
    priority: plan.intentPriority,
    salesGoal: plan.salesGoal,
  });
  const tone = deriveHumanToneHints({
    priority: plan.intentPriority,
    frustration: plan.frustration,
    emotion: plan.emotion,
    lang,
  });

  const stratBlock = plan.salesStrategy ? STRATEGY_INSTRUCTIONS[plan.salesStrategy]?.trim() : "";

  const header =
    lang === "en"
      ? "HUMAN CONVERSATION ORCHESTRATOR (mandatory — real salesperson, not generic AI assistant):"
      : lang === "es"
        ? "ORQUESTADOR CONVERSACIÓN HUMANA (obligatorio — vendedor real, no asistente IA):"
        : "ORCHESTRATEUR CONVERSATION HUMAINE (obligatoire — vraie commerciale, pas assistant IA générique) :";

  const priorityLine =
    lang === "en"
      ? `Intent priority: ${plan.intentPriority} | Goal: ${plan.salesGoal} | Emotion: ${plan.emotion} | Next: ${plan.nextAction}`
      : `Priorité : ${plan.intentPriority} | Objectif : ${plan.salesGoal} | Émotion : ${plan.emotion} | Action : ${plan.nextAction}`;

  const holdBan = plan.forbidHoldPhrases
    ? lang === "en"
      ? `ABSOLUTE BAN this turn: ${FORBIDDEN_HOLD_PHRASES.slice(0, 4).join(" / ")} — deliver facts or payment link NOW.`
      : `INTERDIT ce tour : ${FORBIDDEN_HOLD_PHRASES.slice(0, 3).join(" / ")} — donner faits, stock, lien ou paiement MAINTENANT.`
    : lang === "en"
      ? "At most ONE short “checking” beat per several turns — never stack holds."
      : "Au plus UNE courte formule « je regarde » tous les plusieurs tours — jamais en rafale.";

  const memoryLines = plan.memory.lastAskedTopics.length
    ? lang === "en"
      ? `Remember they already asked: ${plan.memory.lastAskedTopics.join(", ")}.`
      : `Mémoriser — déjà demandé : ${plan.memory.lastAskedTopics.join(", ")}.`
    : "";

  const promiseLines = plan.memory.lastPromises.length
    ? lang === "en"
      ? `Honor promises: ${plan.memory.lastPromises.join(", ")}.`
      : `Tenir les promesses : ${plan.memory.lastPromises.join(", ")}.`
    : "";

  const microSample = tone.microOpeners.slice(0, 3).join(" / ");

  return [
    header,
    "",
    priorityLine,
    lang === "en" ? `Tone: ${plan.tone} | Energy: ${plan.energy} | Style: ${plan.responseStyle}` : `Ton : ${plan.tone} | Énergie : ${plan.energy} | Style : ${plan.responseStyle}`,
    lang === "en" ? style.instructionEn : style.instructionFr,
    holdBan,
    memoryLines,
    promiseLines,
    lang === "en"
      ? `Natural micro-openers (vary): ${microSample}`
      : `Micro-accroches naturelles (varier) : ${microSample}`,
    ...tone.fluidityRules.map((r) => `- ${r}`),
    stratBlock ? `\n${stratBlock}` : "",
    "",
    lang === "en"
      ? "Sound like a competent reactive salesperson — warmth, continuity, commercial logic."
      : "Sonner comme une commerciale compétente et réactive — chaleur, continuité, logique vente.",
  ]
    .filter(Boolean)
    .join("\n");
}
