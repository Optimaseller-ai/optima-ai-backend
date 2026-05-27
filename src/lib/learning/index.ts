export type {
  LearningMemory,
  LearningInsight,
  ScoredPhrase,
  ProductPerformance,
  HourPerformance,
  FollowupPerformance,
  ObjectionPattern,
} from "./memory/learning-memory-types";

export type { BusinessLearningAdminView } from "./learning-admin-types";

export {
  getBusinessLearningView,
  observeConversationTurn,
  buildLearningPromptHints,
} from "./business-learning-engine";

export { recordLearningTurn, type LearningTurnInput } from "./conversations/conversation-learning";
export { detectObjectionKind } from "./patterns/objection-intelligence-engine";
export { isClosingPhrase } from "./patterns/conversion-pattern-tracker";
export { sanitizeLearningMemoryForUse, DEFAULT_LEARNING_SAFETY } from "./learning-safety";
