export type ModelPolicyInput = {
  preferHumanQuality?: boolean;
  latencyBudgetMs?: number;
};

export type ModelChoice = {
  model: string;
  reason: string;
};

export const DEFAULT_MODEL = "openai/gpt-4o-mini" as const;
export const MODEL_FALLBACKS = [DEFAULT_MODEL] as const;

export function chooseOpenRouterModel(input?: ModelPolicyInput): ModelChoice {
  void input;
  return { model: DEFAULT_MODEL, reason: "single_model_lock" };
}

