export type { SmartProspectProfile, LeadTemperature } from "./lead-profile/prospect-profile";
export { emptySmartProspectProfile, mergeSmartProspectProfile, normalizeContact } from "./lead-profile/prospect-profile";
export { PreChatFormSchema, type PreChatFormInput } from "./lead-profile/validation";
export { scoreLeadTemperature, evolveLeadTemperature, type LeadScoringSignals } from "./lead-scoring/lead-temperature";
export { buildCrmMemoryFromState, formatCrmMemoryPromptBlock } from "./crm-memory/crm-memory-engine";
export { draftHumanEmail, type EmailFollowupKind, type HumanEmailDraft } from "./email-followups/email-followup-engine";
export { readPreChatProfile, writePreChatProfile, isPreChatComplete } from "./pre-chat/storage";
export { maskEmail, maskPhone, hashContactStable } from "./pre-chat/privacy";
export { formatProspectLeadAwarenessBlock, mergeLeadIntoConversationState } from "./pre-chat/agent-awareness";
