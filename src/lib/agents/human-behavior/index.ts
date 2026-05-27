/**
 * Human Behavior Engine — cœur comportemental conversationnel (Seller AI).
 * Hors UI / analytics : logique réutilisable côté serveur.
 */

export {
  runHumanResponseEngine,
  type HumanResponseEngineInput,
  type HumanResponseEngineResult,
} from "./human-response-engine";

export { ANTI_AI_PHRASE_BLACKLIST } from "./anti-ai/phrase-blacklist";
export { runAntiAiFilterPass, stripBlacklistedPhrases } from "./anti-ai/anti-ai-filter";
export { buildBusinessTimeContext, type BusinessTimeContext } from "./timing/time-context";
export {
  computeHumanResponseDelayMs,
  computeTypingDelayMs,
  humanDelayVariation,
} from "./timing/human-timing-engine";
export {
  detectProspectEmotion,
  emotionDelayFactor,
  type ProspectEmotion,
} from "./emotions/emotion-detector";
export { maybeSplitAssistantMessage } from "./conversation/message-splitting";
export { maybeHumanMicroPrefix } from "./conversation/micro-behaviors";
export {
  buildConversationStateEngineSnapshot,
  formatConversationStateEnginePromptBlock,
  tryHumanizedGreetingQuickReply,
  isProspectGreetingMessage,
} from "./conversation-state-engine";
export {
  buildPersonalWellbeingQuickReply,
  detectProspectTurnIntent,
  formatTurnIntentOrchestratorBlock,
  isPersonalWellbeingTurn,
  orchestrateHumanReply,
  salesOpportunityAllowedForIntent,
  type ProspectTurnIntent,
} from "./response-orchestrator";
export { filterAdvisorReplyHumanLikeness } from "./human-advisor-reply-filter";
export {
  buildConversationMemorySnapshot,
  type ConversationMemorySnapshot,
} from "./memory/conversation-memory";
