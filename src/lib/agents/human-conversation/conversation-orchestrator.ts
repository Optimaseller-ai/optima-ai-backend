import "server-only";

import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import { runSalesDecisionEngine } from "@/lib/agents/sales-brain";
import { analyzeProspectSilence } from "@/lib/agents/sales-brain/prospect-analysis/silence-analyzer";
import { buildConversationMemory, formatMemoryPromptLines } from "./conversation-memory-engine";
import { deriveHumanToneHints } from "./human-tone-engine";
import { inferIntentPriority, isCriticalBuyingPriority } from "./intent-priority-engine";
import { deriveResponseStyle } from "./response-style-engine";
import { inferSalesConversationGoal } from "./sales-context-engine";
import type { ConversationOrchestratorInput, ConversationOrchestratorPlan } from "./types";

function mapEmotionLabel(emotion: ReturnType<typeof detectProspectEmotion>): string {
  const map: Record<string, string> = {
    neutral: "Neutral",
    curiosity: "Neutral",
    hesitation: "Hesitant",
    impatience: "Frustrated",
    enthusiasm: "Excited",
    confusion: "Hesitant",
    satisfaction: "Excited",
    purchase_interest: "Excited",
    anger: "Frustrated",
    frustration: "Frustrated",
  };
  return map[emotion] ?? "Neutral";
}

function nextActionForGoal(
  goal: ReturnType<typeof inferSalesConversationGoal>,
  priority: ReturnType<typeof inferIntentPriority>["priority"],
): string {
  if (isCriticalBuyingPriority(priority)) return "send_payment_or_confirm_order";
  if (goal === "buy") return "close_or_send_link";
  if (goal === "delivery") return "confirm_delivery_window";
  if (goal === "reassure") return "acknowledge_and_reassure";
  if (goal === "compare") return "differentiate_once";
  if (goal === "human_handoff") return "smooth_human_handoff";
  if (goal === "discover") return "guide_product_fit";
  return "listen_and_respond";
}

/**
 * Orchestrateur conversationnel — avant chaque réponse agent.
 * Analyse émotion, urgence, intention, frustration, achat, silence, confiance, historique.
 */
export function runConversationOrchestrator(input: ConversationOrchestratorInput): ConversationOrchestratorPlan {
  const lang = input.lang ?? "fr";
  const message = String(input.message ?? "");
  const { priority, rationale: priorityReason } = inferIntentPriority(message);
  const salesGoal = inferSalesConversationGoal({
    message,
    sellerIntent: input.sellerIntent,
  });
  const rawEmotion = detectProspectEmotion(message);
  const emotion = mapEmotionLabel(rawEmotion);
  const frustration = rawEmotion === "frustration" || rawEmotion === "anger" || /\b(déçu|decu|marre|nul)\b/i.test(message);

  const salesDecision = runSalesDecisionEngine({
    message,
    sellerIntent: input.sellerIntent,
    conversationProfile: input.conversationProfile,
    commercialMemory: input.commercialMemory,
    salesSignalsMemory: undefined,
    stats: input.stats,
    silenceMs: input.silenceMs,
    lang,
  });

  const silence = analyzeProspectSilence({
    silenceMs: input.silenceMs,
    lastActiveAt: input.stats?.last_active_at,
  });

  const lastAssistant = input.recentAssistantMessages?.slice(-1)[0];
  const memory = buildConversationMemory({
    message,
    conversationProfile: input.conversationProfile,
    commercialMemory: input.commercialMemory,
    previous: input.humanMemory,
    salesGoal,
    lastAssistantLine: lastAssistant,
  });

  const toneHints = deriveHumanToneHints({
    priority,
    frustration,
    emotion,
    lang,
  });

  const styleGuide = deriveResponseStyle({
    priority,
    salesGoal,
    followupAfterHold: input.followupAfterHold,
  });

  const forbidHoldPhrases =
    isCriticalBuyingPriority(priority) ||
    priority === "HIGH" ||
    input.followupAfterHold === true ||
    memory.recentHoldPhrases.length >= 2;

  const trustLow = salesDecision.analysis.trust === "Low";
  const buyingSignal =
    isCriticalBuyingPriority(priority) ||
    salesDecision.analysis.intention === "High" ||
    salesGoal === "buy";

  const reasoning = [
    priorityReason,
    `objectif=${salesGoal}`,
    salesDecision.analysis.reasoning,
    forbidHoldPhrases ? "hold_interdit" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    intentPriority: priority,
    salesGoal,
    emotion,
    frustration,
    buyingSignal,
    silenceNotable: silence.suggestFollowupWait,
    trustLow,
    tone: toneHints.tone,
    energy: toneHints.energy,
    responseStyle: styleGuide.style,
    salesStrategy: salesDecision.activeStrategy,
    nextAction: nextActionForGoal(salesGoal, priority),
    memory,
    forbidHoldPhrases,
    reasoning,
  };
}

export function formatOrchestratorMemoryBlock(plan: ConversationOrchestratorPlan, lang: "fr" | "en" | "es"): string {
  return formatMemoryPromptLines(plan.memory, lang).join("\n");
}
