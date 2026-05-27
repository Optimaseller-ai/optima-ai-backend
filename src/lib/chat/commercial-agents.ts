export {
  COMMERCIAL_AGENTS,
  getCommercialAgentById,
  pickRandomCommercialAgent,
  resolveCommercialAgentKey,
  toCommercialAgentPublic,
  type CommercialAgentDef,
  type CommercialAgentGender,
  type CommercialAgentPublic,
} from "@/lib/agents/personality/commercial-agents";

export { pickStableCommercialAgentForSeed, resolvePublicPersonaForAgent } from "@/lib/chat/agent-identity-manager";
