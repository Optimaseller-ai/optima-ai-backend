import "server-only";

import { rebuildLearningFromConversations } from "./conversations/rebuild-learning-from-history";
import { recordLearningTurn, type LearningTurnInput } from "./conversations/conversation-learning";
import { loadLearningMemoryFromDb, persistLearningMemory } from "./memory/learning-memory-store";
import type { LearningMemory } from "./memory/learning-memory-types";
import { attachInsights } from "./analytics/sales-insight-generator";
import { formatLearningPromptBlock, sanitizeLearningMemoryForUse } from "./learning-safety";

import type { BusinessLearningAdminView } from "./learning-admin-types";

export type { BusinessLearningAdminView } from "./learning-admin-types";

/** Moteur central — léger, explicable, contrôlable. */
export async function getBusinessLearningView(businessId: string): Promise<BusinessLearningAdminView> {
  let memory = await loadLearningMemoryFromDb(businessId);

  if (memory.totalObservations < 3) {
    try {
      await rebuildLearningFromConversations(businessId, 35);
      memory = await loadLearningMemoryFromDb(businessId);
    } catch {
      // historique indisponible
    }
  }

  memory = attachInsights(sanitizeLearningMemoryForUse(memory));
  await persistLearningMemory(memory);

  return {
    memory,
    topResponses: memory.effectiveResponses.slice(0, 5),
    topClosings: memory.topPerformingClosings.slice(0, 5),
    topProducts: memory.bestProducts.slice(0, 5),
    bestHours: memory.bestHours.slice(0, 4),
    topFollowups: memory.successfulFollowups.slice(0, 4),
    topObjections: memory.objectionPatterns.slice(0, 5),
    insights: memory.insights,
  };
}

export async function observeConversationTurn(input: LearningTurnInput): Promise<void> {
  try {
    await recordLearningTurn(input);
  } catch (e) {
    console.warn("[LEARNING_TURN_FAILED]", e);
  }
}

export function buildLearningPromptHints(memory: LearningMemory, lang: "fr" | "en" = "fr"): string | null {
  return formatLearningPromptBlock(memory, lang);
}
