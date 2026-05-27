import "server-only";

import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { isClosedStatus } from "@/lib/chat/relance";

import { applyFollowupObservations } from "../analytics/followup-learning-engine";
import { attachInsights } from "../analytics/sales-insight-generator";
import { loadLearningMemoryFromDb, persistLearningMemory } from "../memory/learning-memory-store";
import type { HourPerformance, LearningMemory } from "../memory/learning-memory-types";
import {
  applyConversionObservations,
  isClosingPhrase,
} from "../patterns/conversion-pattern-tracker";
import { applyObjectionObservations, detectObjectionKind } from "../patterns/objection-intelligence-engine";
import { applyProductObservations, extractProductMentions } from "../products/product-interest-engine";
import {
  recordResponsePerformance,
  type ResponseOutcome,
} from "../responses/response-performance-memory";
import { normalizeSalesTone, applyStyleObservations } from "../sales/agent-style-optimizer";
import { sanitizeLearningMemoryForUse } from "../learning-safety";

export type LearningTurnInput = {
  businessId: string;
  conversationId?: string;
  userMessage: string;
  assistantReply: string;
  conversationState?: SellerBehaviorConversationState;
  status?: string;
  salesStyle?: string;
  localHour?: number;
  relanceCount?: number;
  msSinceLastUserMessage?: number;
  /** Prospect a répondu après la dernière relance */
  repliedAfterFollowup?: boolean;
};

function hourLabel(h: number): string {
  if (h >= 6 && h < 12) return "le matin";
  if (h >= 12 && h < 17) return "l’après-midi";
  if (h >= 17 && h < 21) return "le soir";
  return "en fin de journée";
}

function applyHourObservation(memory: LearningMemory, hour: number, converted: boolean): LearningMemory {
  const buckets = new Map<number, HourPerformance>();
  for (const h of memory.bestHours) buckets.set(h.hour, { ...h });

  const cur = buckets.get(hour) ?? {
    hour,
    label: hourLabel(hour),
    conversionRate: 0,
    samples: 0,
  };
  const samples = cur.samples + 1;
  const conversionRate = (cur.conversionRate * cur.samples + (converted ? 100 : 0)) / samples;
  buckets.set(hour, {
    hour,
    label: hourLabel(hour),
    conversionRate: Math.round(conversionRate),
    samples,
  });

  const bestHours = [...buckets.values()].sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 8);
  return { ...memory, bestHours };
}

function inferOutcome(status?: string, userMessage?: string): ResponseOutcome {
  if (status && isClosedStatus(status)) {
    if (status === "closed_won") return "success";
    if (status === "closed_lost") return "abandon";
  }
  const em = detectProspectEmotion(String(userMessage ?? ""));
  if (em === "curiosity" || em === "purchase_interest" || em === "enthusiasm") return "ongoing";
  if (em === "anger" || em === "frustration") return "abandon";
  return "ongoing";
}

/** Enregistre un tour de conversation dans la mémoire d’apprentissage. */
export async function recordLearningTurn(input: LearningTurnInput): Promise<LearningMemory> {
  const at = new Date().toISOString();
  const converted = input.status === "closed_won";
  const emotion = detectProspectEmotion(input.userMessage);
  const outcome = inferOutcome(input.status, input.userMessage);
  const state = input.conversationState;

  let memory = await loadLearningMemoryFromDb(input.businessId);

  memory = recordResponsePerformance(memory, {
    assistantReply: input.assistantReply,
    prospectEmotion: emotion,
    outcome,
    at,
    msToNextUserReply: input.msSinceLastUserMessage,
  });

  memory = applyConversionObservations(memory, [
    {
      assistantPhrase: input.assistantReply,
      converted,
      at,
      closingLike: isClosingPhrase(input.assistantReply),
    },
  ]);

  if (detectObjectionKind(input.userMessage) !== "other") {
    memory = applyObjectionObservations(memory, [
      {
        userMessage: input.userMessage,
        assistantReply: input.assistantReply,
        at,
        reassured: outcome !== "abandon" && emotion !== "anger",
      },
    ]);
  }

  const products = extractProductMentions({
    text: `${input.userMessage} ${input.assistantReply}`,
    preferredProducts: state?.conversationProfile?.preferredProducts,
    viewedProducts: state?.productMemory?.viewedProducts,
  });
  if (products.length) {
    memory = applyProductObservations(
      memory,
      products.map((name) => ({ productName: name, at, converted })),
    );
  }

  if (typeof input.localHour === "number") {
    memory = applyHourObservation(memory, input.localHour, converted);
  }

  memory = applyStyleObservations(memory, [
    {
      tone: normalizeSalesTone(input.salesStyle ?? state?.tone_mode),
      at,
      converted,
      positiveReply:
        emotion === "curiosity" || emotion === "purchase_interest" || emotion === "enthusiasm",
    },
  ]);

  if ((input.relanceCount ?? 0) > 0 && input.msSinceLastUserMessage != null) {
    const delayHours = input.msSinceLastUserMessage / (1000 * 60 * 60);
    memory = applyFollowupObservations(memory, [
      {
        delayHours,
        at,
        replied: input.repliedAfterFollowup,
        converted,
      },
    ]);
  }

  memory = {
    ...memory,
    totalObservations: memory.totalObservations + 1,
    conversions: memory.conversions + (converted ? 1 : 0),
  };

  memory = attachInsights(memory);
  memory = sanitizeLearningMemoryForUse(memory);
  await persistLearningMemory(memory);
  return memory;
}
