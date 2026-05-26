/**
 * AI Orchestrator — point d'entrée unique pour la génération de réponses.
 * Phase 1 : OpenRouter uniquement. Les moteurs social/timing/memory s'y branchent progressivement.
 */

export { openRouterChat, openRouterEmbed, OpenRouterRequestError } from "./openrouter-client.js";
export type { OpenRouterMessage } from "./openrouter-client.js";
export { runReplyOrchestration, type ReplyOrchestrationInput, type ReplyOrchestrationResult } from "./reply-orchestrator.js";
