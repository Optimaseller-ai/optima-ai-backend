import "server-only";

export { buildSocialExistenceSnapshot, runSocialExistenceTextPasses } from "./social-existence";
export type { SocialExistenceSnapshot } from "./social-existence";

export { runHumanSocialExistencePipeline, type HumanSocialExistencePipelineMeta } from "./human-social-existence-pipeline";

export { formatLevel16HumanSocialExistencePromptBlock } from "./social-existence-prompt-block";

export { computeAttentionVariationV2 } from "./attention-variation-v2";
export { inferHumanizedDigitalFatigue } from "./humanized-digital-fatigue";
export { computeConversationBreathingV4Ms } from "./conversation-breathing-v4";
export { computeConversationPacingV4, type ConversationPacingV4 } from "./conversation-pacing-v4";
export { pickDailyLifeSimulationCue, type DailyLifeCueFr } from "./daily-life-simulation";
export { detectImplicitSocialSituationV2, formatSocialAwarenessV2Hint } from "./social-awareness-v2";
export { buildConversationalEmotionalMemorySnapshot } from "./emotional-memory";
export { inferResponseInstinct } from "./response-instinct";
export { runAntiBotStructureV4Pass, formatAntiBotStructureV4PromptBlock } from "./anti-bot-structure-v4";
export { auditRealismV5, repairRealismV5 } from "./realism-score-v5";
export { formatHumanRelationshipEvolutionV2Block } from "./relationship-evolution-v2";
