/**
 * Identité agent publique : même conseiller pour une boutique donnée (fallback stable si pas de persona_key).
 * À utiliser côté serveur (page, API init) — jamais `pickRandomCommercialAgent` pour le chat public.
 */

import {
  getCommercialAgentById,
  pickStableCommercialAgentForSeed,
  toCommercialAgentPublic,
  type CommercialAgentPublic,
} from "@/lib/agents/personality/commercial-agents";

export function resolvePublicPersonaForAgent(args: {
  personaKey: string | null | undefined;
  /** Identifiant stable (ex. agents.id UUID) */
  agentId: string;
}): CommercialAgentPublic {
  const def = getCommercialAgentById(args.personaKey) ?? pickStableCommercialAgentForSeed(args.agentId);
  return toCommercialAgentPublic(def);
}

export { pickStableCommercialAgentForSeed } from "@/lib/agents/personality/commercial-agents";
