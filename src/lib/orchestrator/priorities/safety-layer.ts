import type { OrchestratorActionKind } from "../types";

export type SafetyCheckResult = {
  allowed: boolean;
  flags: string[];
  blockedAction?: OrchestratorActionKind;
  substituteAction?: OrchestratorActionKind;
};

export function evaluateOrchestratorSafety(args: {
  selectedAction: OrchestratorActionKind;
  recentFollowupCount: number;
  lastFollowupAt?: number;
  duplicateActionBurst: boolean;
  automationAggressive: boolean;
}): SafetyCheckResult {
  const flags: string[] = [];
  const now = Date.now();

  if (args.recentFollowupCount >= 3) {
    flags.push("followup_spam_cap");
    if (args.selectedAction === "schedule_followup") {
      return {
        allowed: false,
        flags,
        blockedAction: args.selectedAction,
        substituteAction: "reply_now",
      };
    }
  }

  if (args.lastFollowupAt && now - args.lastFollowupAt < 4 * 60 * 60 * 1000 && args.selectedAction === "schedule_followup") {
    flags.push("followup_cooldown_4h");
    return {
      allowed: false,
      flags,
      blockedAction: args.selectedAction,
      substituteAction: "wait",
    };
  }

  if (args.duplicateActionBurst) {
    flags.push("duplicate_action_burst");
    return {
      allowed: false,
      flags,
      blockedAction: args.selectedAction,
      substituteAction: "reply_now",
    };
  }

  if (args.automationAggressive && args.selectedAction === "trigger_n8n") {
    flags.push("automation_soft_gate");
    return {
      allowed: false,
      flags,
      blockedAction: args.selectedAction,
      substituteAction: "request_admin_approval",
    };
  }

  return { allowed: true, flags };
}
