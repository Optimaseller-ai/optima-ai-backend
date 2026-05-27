import { detectSellerIntent } from "@/lib/agents/sales/intent-detection";
import { detectConversationLanguage } from "@/lib/ai/language-detection";
import { detectProspectEffort } from "@/lib/agents/human-behavior/effort-detection";
import {
  classifyConversationEmotion,
  mergeEmotionalContinuity,
} from "@/lib/agents/emotional-intelligence/conversation-emotion-classifier";
import { mergeHumanSalesMemory, formatHumanSalesMemoryLine } from "@/lib/agents/memory/human-sales-memory";
import type { SellerBehaviorConversationState, SellerIntent } from "@/lib/agents/memory/conversation-state";

function asPartialState(raw: unknown): SellerBehaviorConversationState {
  if (!raw || typeof raw !== "object") return {};
  return raw as SellerBehaviorConversationState;
}

/**
 * Fusionne l'état comportemental après un message utilisateur (avant génération IA).
 */
export function mergeSellerBehaviorStateForUserTurn(args: {
  previous: unknown;
  message: string;
  recentChat?: Array<{ role: "user" | "assistant"; content: string }>;
  personaKey?: string | null;
}): { state: SellerBehaviorConversationState; intent: SellerIntent } {
  const prev = asPartialState(args.previous);
  const intent = detectSellerIntent(args.message);

  const language = detectConversationLanguage({
    message: args.message,
    previous: prev.language,
    history: args.recentChat,
  });

  const emotionSnapshot = classifyConversationEmotion({
    message: args.message,
    previous: prev.emotionalContinuity,
  });
  const emotionalContinuity = mergeEmotionalContinuity(
    prev.emotionalContinuity,
    emotionSnapshot,
    args.message,
  );

  const effort = detectProspectEffort(args.message);
  const humanSalesMemory = mergeHumanSalesMemory(prev.humanSalesMemory, {
    message: args.message,
    effortDetected: effort.effort_detected,
    effortSignals: effort.signals,
    soughtPerson: effort.soughtPerson,
  });

  const langCode = language === "en" ? "en" : language === "es" ? "es" : "fr";
  const humanSalesLine = formatHumanSalesMemoryLine(humanSalesMemory, langCode);
  const baseMemory = Array.isArray(prev.memory) ? prev.memory.map(String) : [];
  const memory = humanSalesLine
    ? [humanSalesLine, ...baseMemory.filter((l) => !l.startsWith("Le prospect est déjà passé")).slice(0, 18)]
    : baseMemory.slice(0, 20);

  const prevTurn = typeof prev.stats?.turn_count === "number" ? prev.stats.turn_count : 0;

  const state: SellerBehaviorConversationState = {
    ...prev,
    language,
    lastSellerIntent: intent,
    memory,
    humanSalesMemory,
    emotionalContinuity,
    stats: {
      ...prev.stats,
      turn_count: prevTurn + 1,
      last_active_at: Date.now(),
    },
  };

  return { state, intent };
}

/**
 * Enrichit la mémoire court terme après réponse assistant.
 */
export function mergeSellerBehaviorStateAfterAssistant(args: {
  state: SellerBehaviorConversationState;
  assistantReply: string;
}): SellerBehaviorConversationState {
  const snippet = String(args.assistantReply ?? "")
    .trim()
    .slice(0, 100)
    .replace(/\s+/g, " ");
  const mem = Array.isArray(args.state.memory) ? [...args.state.memory] : [];
  if (snippet) mem.unshift(`Dernière réponse agent: ${snippet}`);
  return {
    ...args.state,
    memory: mem.slice(0, 20),
    stats: {
      ...args.state.stats,
      last_active_at: Date.now(),
    },
  };
}
