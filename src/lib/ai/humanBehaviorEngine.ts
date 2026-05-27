import type {
  HumanBehaviorPlan,
  PipelineLanguage,
  SalesStrategyOutput,
  EmotionStageOutput,
  PersonalityOutput,
} from "./pipeline/pipeline-types";
import { computeQuestionBudget } from "./questionProbabilityEngine";

export function buildHumanBehaviorPlan(input: {
  lang: PipelineLanguage;
  message: string;
  turnCount?: number;
  microSeed?: string;
  emotion: EmotionStageOutput;
  sales: SalesStrategyOutput;
  personality: PersonalityOutput;
}): HumanBehaviorPlan {
  const turnCount = input.turnCount ?? 0;

  const { turnKind, budget } = computeQuestionBudget({
    message: input.message,
    turnCount,
    emotionLabel: input.emotion.emotionLabel,
    seed: input.microSeed,
  });

  const lower = String(input.message ?? "").toLowerCase();
  const allowShortReactionOnly = turnKind === "simple_ack" || /😂|🤣|😄|👍/.test(input.message);
  const allowHesitation = turnKind !== "purchase_intent" && turnKind !== "question";
  const mobileStyle = true;

  const directives: string[] = [];

  // Human WhatsApp norms
  directives.push("Écris comme un vendeur WhatsApp réel (mobile), pas comme un assistant IA.");
  directives.push("Réponses naturelles, parfois incomplètes; petites réactions possibles (ex: \"ah ok\", \"je vois\").");

  // Reduce interrogation
  if (!budget.askQuestion || budget.maxQuestions === 0) {
    directives.push("Ne pose pas de question sauf si absolument nécessaire.");
  } else {
    directives.push("Au maximum une question courte.");
  }

  // Emotion shaping
  if (input.emotion.requiresEmpathy) {
    directives.push("Ton empathique mais humain, sans phrases de support robotique.");
  }

  // Sales strategy shaping (balanced)
  if (input.sales.objective === "close") {
    directives.push("Aide à conclure simplement (dispo, prix, livraison) sans forcer.");
  } else if (input.sales.objective === "qualify") {
    directives.push("Qualifie légèrement, mais évite l'interrogatoire.");
  }

  // Personality/energy shaping
  if (input.personality.energy === "busy") {
    directives.push("Tu peux être bref, style \"attends je regarde\" / \"1 sec\".");
  }
  if (input.personality.energy === "playful") {
    directives.push("Léger et souriant, micro-emoji max 1 si ok.");
  }

  // First turns: avoid long speeches
  if (turnCount <= 1) {
    directives.push("Pas de pavé. Une ou deux phrases max si possible.");
  }

  // Avoid classic chatbot lines
  directives.push(
    "Interdit: \"Comment puis-je vous aider\", \"Je suis là pour vous aider\", \"N’hésitez pas\", \"Je comprends\", \"Puis-je vous aider\".",
  );

  // Very small user-message specific nudges
  if (/\b(rdv|rendez-vous)\b/.test(lower)) directives.push("Propose un créneau simplement, sans formulaire.");

  return {
    turnKind,
    questionBudget: budget,
    allowShortReactionOnly,
    allowHesitation,
    mobileStyle,
    preGenerationDirectives: directives,
  };
}

