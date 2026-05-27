import "server-only";

import { routeSocialPriority } from "./social-priority-router";
import type { SocialHumanizationInput, SocialRouteDecision, SocialSupervisorInsights } from "./types";

export type SocialHumanizationOutput = SocialRouteDecision & {
  supervisor: SocialSupervisorInsights;
};

/** Couche sociale humaine — exécuter AVANT tout moteur commercial. */
export function runSocialHumanizationLayer(input: SocialHumanizationInput): SocialHumanizationOutput {
  const route = routeSocialPriority(input);

  return {
    ...route,
    supervisor: {
      activeSignal: route.signal,
      socialPriority: route.isSocialPriority,
      warmupPhase: route.warmup.phase,
      usedInstantReply: Boolean(route.instantReply),
    },
  };
}
