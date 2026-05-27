import "server-only";

import type { OpenRouterMessage } from "./openrouter";

export const PROMPT_BUDGET = {
  SAFE_CONTEXT_LIMIT: 7000,
  MODEL_CONTEXT_LIMIT: 8192,
  MAX_SYSTEM_CHARS: 4000,
  MAX_USER_CHARS: 2800,
  MAX_HISTORY_TURNS: 6,
  MAX_PRODUCTS: 3,
  MAX_FAQ: 2,
  MAX_CHUNKS: 2,
  MAX_BLOCK_CHARS: 900,
  MIN_MAX_TOKENS: 300,
  MAX_MAX_TOKENS: 1200,
} as const;

export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 4);
}

export function estimateMessagesTokens(messages: OpenRouterMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += (m.content?.length ?? 0) + (m.role?.length ?? 0) + 8;
  }
  return estimateTokensFromChars(chars);
}

export function truncateText(text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  if (maxChars < 80) return t.slice(0, maxChars);
  return `${t.slice(0, maxChars - 20).trimEnd()}\n[…tronqué]`;
}

export type ChatHistoryTurn = { role: "user" | "assistant"; content: string };

/** Garde les 6 derniers tours ; résume les messages plus anciens en une ligne. */
export function compressChatHistory(
  history: ChatHistoryTurn[],
  maxTurns = PROMPT_BUDGET.MAX_HISTORY_TURNS,
): { history: ChatHistoryTurn[]; summarizedCount: number } {
  const list = Array.isArray(history) ? history.filter((h) => h?.content?.trim()) : [];
  if (list.length <= maxTurns) return { history: list, summarizedCount: 0 };

  const dropped = list.slice(0, -maxTurns);
  const tail = list.slice(-maxTurns);
  const userBits = dropped
    .filter((h) => h.role === "user")
    .slice(-3)
    .map((h) => h.content.trim().slice(0, 60))
    .join(" · ");
  const summaryLine = userBits
    ? `[Contexte: ${dropped.length} messages avant — sujets: ${userBits}]`
    : `[Contexte: ${dropped.length} messages précédents — fil WhatsApp en cours.]`;

  return {
    history: [{ role: "user", content: summaryLine }, ...tail],
    summarizedCount: dropped.length,
  };
}

export function truncateContextBlocks(input: {
  productsText?: string;
  chunksText?: string;
  businessBrainBlock?: string;
  liveOrchestratorBlock?: string;
  salesOpportunityBlock?: string;
  learningBlock?: string;
}): {
  productsText: string;
  chunksText: string;
  businessBrainBlock: string;
  liveOrchestratorBlock: string;
  salesOpportunityBlock: string;
  learningBlock: string;
} {
  return {
    productsText: truncateText(input.productsText ?? "", PROMPT_BUDGET.MAX_BLOCK_CHARS),
    chunksText: truncateText(input.chunksText ?? "", PROMPT_BUDGET.MAX_BLOCK_CHARS),
    businessBrainBlock: truncateText(input.businessBrainBlock ?? "", PROMPT_BUDGET.MAX_BLOCK_CHARS),
    liveOrchestratorBlock: truncateText(input.liveOrchestratorBlock ?? "", 500),
    salesOpportunityBlock: truncateText(input.salesOpportunityBlock ?? "", 450),
    learningBlock: truncateText(input.learningBlock ?? "", 350),
  };
}

export type CompressPromptResult = {
  systemPrompt: string;
  userPrompt: string;
  estimatedPromptTokens: number;
  compressed: boolean;
  compressionSteps: string[];
};

/**
 * Hard cap global — ne jamais dépasser SAFE_CONTEXT_LIMIT tokens estimés.
 */
export function compressPromptForOpenRouter(systemPrompt: string, userPrompt: string): CompressPromptResult {
  const steps: string[] = [];
  let system = String(systemPrompt ?? "");
  let user = String(userPrompt ?? "");
  let compressed = false;

  const apply = () => estimateTokensFromChars(system.length + user.length);

  let tokens = apply();

  if (system.length > PROMPT_BUDGET.MAX_SYSTEM_CHARS) {
    system = truncateText(system, PROMPT_BUDGET.MAX_SYSTEM_CHARS);
    steps.push("system_cap_4000");
    compressed = true;
  }

  if (user.length > PROMPT_BUDGET.MAX_USER_CHARS) {
    user = truncateText(user, PROMPT_BUDGET.MAX_USER_CHARS);
    steps.push("user_cap_2800");
    compressed = true;
  }

  tokens = apply();

  if (tokens > PROMPT_BUDGET.SAFE_CONTEXT_LIMIT) {
    const ratio = PROMPT_BUDGET.SAFE_CONTEXT_LIMIT / Math.max(tokens, 1);
    const sysTarget = Math.floor(system.length * ratio * 0.55);
    const userTarget = Math.floor(user.length * ratio * 0.45);
    system = truncateText(system, Math.max(1200, sysTarget));
    user = truncateText(user, Math.max(800, userTarget));
    steps.push("global_ratio_compress");
    compressed = true;
  }

  tokens = apply();

  while (tokens > PROMPT_BUDGET.SAFE_CONTEXT_LIMIT && system.length > 900) {
    system = truncateText(system, Math.floor(system.length * 0.82));
    steps.push("system_iterative_shrink");
    compressed = true;
    tokens = apply();
  }

  while (tokens > PROMPT_BUDGET.SAFE_CONTEXT_LIMIT && user.length > 500) {
    user = truncateText(user, Math.floor(user.length * 0.82));
    steps.push("user_iterative_shrink");
    compressed = true;
    tokens = apply();
  }

  return {
    systemPrompt: system,
    userPrompt: user,
    estimatedPromptTokens: tokens,
    compressed,
    compressionSteps: steps,
  };
}

export function computeDynamicMaxTokens(
  estimatedPromptTokens: number,
  opts?: { userMessageLen?: number },
): {
  maxTokens: number;
  remainingBudget: number;
} {
  const remaining = PROMPT_BUDGET.MODEL_CONTEXT_LIMIT - estimatedPromptTokens;
  let maxTokens = Math.max(
    PROMPT_BUDGET.MIN_MAX_TOKENS,
    Math.min(PROMPT_BUDGET.MAX_MAX_TOKENS, remaining - 64),
  );
  const userLen = opts?.userMessageLen ?? 0;
  if (userLen > 0 && userLen < 25) {
    maxTokens = Math.min(maxTokens, 72);
  } else if (userLen < 50) {
    maxTokens = Math.min(maxTokens, 110);
  }
  return { maxTokens, remainingBudget: remaining - maxTokens };
}

export type PreparedOpenRouterPayload = {
  messages: OpenRouterMessage[];
  maxTokens: number;
  finalPromptTokens: number;
  finalMaxTokens: number;
  remainingBudget: number;
  promptChars: number;
  compressed: boolean;
  compressionSteps: string[];
};

export function prepareOpenRouterPayload(
  systemPrompt: string,
  userPrompt: string,
  opts?: { userMessageLen?: number },
): PreparedOpenRouterPayload {
  const compressedBundle = compressPromptForOpenRouter(systemPrompt, userPrompt);
  const messages: OpenRouterMessage[] = [
    { role: "system", content: compressedBundle.systemPrompt },
    { role: "user", content: compressedBundle.userPrompt },
  ];

  const finalPromptTokens = estimateMessagesTokens(messages);
  const { maxTokens, remainingBudget } = computeDynamicMaxTokens(finalPromptTokens, {
    userMessageLen: opts?.userMessageLen,
  });
  const promptChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);

  console.log("[OPTIMA_PROMPT_BUDGET]", {
    finalPromptTokens,
    finalMaxTokens: maxTokens,
    remainingBudget,
    promptChars,
    compressed: compressedBundle.compressed,
    compressionSteps: compressedBundle.compressionSteps,
  });

  return {
    messages,
    maxTokens,
    finalPromptTokens,
    finalMaxTokens: maxTokens,
    remainingBudget,
    promptChars,
    compressed: compressedBundle.compressed,
    compressionSteps: compressedBundle.compressionSteps,
  };
}
