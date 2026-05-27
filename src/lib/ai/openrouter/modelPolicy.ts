export type ModelPolicyInput = {
  preferHumanQuality?: boolean;
  latencyBudgetMs?: number;
};

export type ModelChoice = {
  model: string;
  reason: string;
};

export const OPENROUTER_FALLBACK_MODELS = [
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.5-pro",
  "openai/gpt-4o-mini",
] as const;

export function chooseOpenRouterModel(input?: ModelPolicyInput): ModelChoice {
  const preferQuality = input?.preferHumanQuality ?? true;
  const latency = input?.latencyBudgetMs ?? 25_000;

  if (preferQuality && latency >= 18_000) return { model: OPENROUTER_FALLBACK_MODELS[0], reason: "prefer_human_quality" };
  if (latency >= 18_000) return { model: OPENROUTER_FALLBACK_MODELS[1], reason: "balanced_quality_latency" };
  return { model: OPENROUTER_FALLBACK_MODELS[2], reason: "fast_fallback" };
}

