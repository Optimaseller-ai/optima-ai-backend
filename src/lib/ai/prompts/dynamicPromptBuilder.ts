import type {
  DynamicPromptBundle,
  EmotionStageOutput,
  HumanBehaviorPlan,
  PersonalityOutput,
  SalesStrategyOutput,
} from "../pipeline/pipeline-types";

import { CORE_SYSTEM_PROMPT } from "./modules/core";
import { HUMAN_RULES } from "./modules/human";
import { WHATSAPP_RULES } from "./modules/whatsapp";
import { BLACKLIST_RULES } from "./modules/blacklist";
import { SALES_RULES } from "./modules/sales";
import { EMOTION_RULES } from "./modules/emotion";

function joinNonEmpty(lines: Array<string | undefined>): string {
  return lines
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

function truncateBlock(label: string, text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (!t) return "";
  if (t.length <= maxChars) return `${label}\n${t}`;
  return `${label}\n${t.slice(0, Math.max(0, maxChars - 16)).trimEnd()}\n[…]`;
}

export function buildDynamicPromptBundle(input: {
  agentName: string;
  businessName: string;
  message: string;
  historyText?: string;
  productsText?: string;
  faqText?: string;
  chunksText?: string;
  learningFacts?: string[];
  emotion: EmotionStageOutput;
  sales: SalesStrategyOutput;
  personality: PersonalityOutput;
  human: HumanBehaviorPlan;
  attempt?: number;
  businessContextBlock?: string;
  strictGroundingBlock?: string;
}): DynamicPromptBundle {
  const included: Array<{ key: string; text: string }> = [];

  // Always include core + human + blacklist. Add others only when useful.
  included.push({ key: "core", text: CORE_SYSTEM_PROMPT });
  included.push({ key: "human", text: HUMAN_RULES });
  included.push({ key: "blacklist", text: BLACKLIST_RULES });
  included.push({ key: "whatsapp", text: WHATSAPP_RULES });

  if (input.sales.objective !== "answer") included.push({ key: "sales", text: SALES_RULES });
  if (input.emotion.requiresEmpathy || input.emotion.blocksSocialQuick) included.push({ key: "emotion", text: EMOTION_RULES });

  const behaviorDirectives = input.human.preGenerationDirectives.slice(0, 8).join("\n- ");
  const personaConstraints = input.personality.constraints.slice(0, 6).join("\n- ");

  const contextHeader = joinNonEmpty([
    `Agent: ${input.agentName}`,
    `Business: ${input.businessName}`,
    `Langue: ${input.emotion.language}`,
    `Énergie: ${input.personality.energy}`,
    `Objectif: ${input.sales.objective}`,
    input.human.questionBudget.maxQuestions === 0 ? "Questions: 0" : "Questions: 1 max",
  ]);

  const facts = Array.isArray(input.learningFacts) ? input.learningFacts.filter(Boolean).slice(0, 3) : [];
  const factsBlock = facts.length ? `Mémoire utile (facts):\n- ${facts.join("\n- ")}` : "";

  const systemPrompt = joinNonEmpty([
    input.strictGroundingBlock,
    input.businessContextBlock,
    included.map((m) => m.text).join("\n\n"),
    "Contexte:",
    contextHeader,
    personaConstraints ? `Contraintes personnalité:\n- ${personaConstraints}` : "",
    behaviorDirectives ? `Directives humaines (avant génération):\n- ${behaviorDirectives}` : "",
    factsBlock,
  ]);

  // User prompt: keep it short and “WhatsApp-y”, include only essential blocks.
  const userPrompt = joinNonEmpty([
    truncateBlock("Historique (récent):", input.historyText ?? "", 650),
    truncateBlock("Produits (si utile):", input.productsText ?? "", 420),
    truncateBlock("FAQ (si utile):", input.faqText ?? "", 280),
    truncateBlock("Infos/RAG (si utile):", input.chunksText ?? "", 420),
    `Message prospect:\n${String(input.message ?? "").trim()}`,
    "",
    input.attempt && input.attempt >= 2
      ? "IMPORTANT: la réponse précédente était trop courte. Réponds plus humainement (>= 18 caractères) sauf si c’est une exception évidente."
      : "",
  ]);

  // Enforce < 2500 chars by dropping optional modules in order.
  const maxChars = 2500;
  const calcTotal = (sys: string, user: string) => sys.length + user.length;
  let sys = systemPrompt;
  let usr = userPrompt;

  const dropOrder = ["emotion", "sales", "whatsapp"]; // keep core/human/blacklist
  let moduleList = included;

  for (const drop of dropOrder) {
    if (calcTotal(sys, usr) <= maxChars) break;
    moduleList = moduleList.filter((m) => m.key !== drop);
    const rebuiltSys = joinNonEmpty([
      moduleList.map((m) => m.text).join("\n\n"),
      "Contexte:",
      contextHeader,
      personaConstraints ? `Contraintes personnalité:\n- ${personaConstraints}` : "",
      behaviorDirectives ? `Directives humaines (avant génération):\n- ${behaviorDirectives}` : "",
      factsBlock,
    ]);
    sys = rebuiltSys;
  }

  // Final shrink: reduce blocks in user prompt if still too large.
  if (calcTotal(sys, usr) > maxChars) {
    usr = joinNonEmpty([
      truncateBlock("Historique (récent):", input.historyText ?? "", 420),
      truncateBlock("Produits:", input.productsText ?? "", 260),
      truncateBlock("Infos:", input.chunksText ?? "", 260),
      `Message prospect:\n${String(input.message ?? "").trim()}`,
    ]);
  }

  const totalChars = calcTotal(sys, usr);
  return {
    systemPrompt: sys,
    userPrompt: usr,
    includedModules: moduleList.map((m) => m.key),
    totalChars,
  };
}

