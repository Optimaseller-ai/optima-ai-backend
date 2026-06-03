import "server-only";

import { buildSocialHumanFallback } from "@/lib/chat/humanization/social-fallbacks";
import { logStructured } from "@/lib/logging/structured-log";
import {
  HUMAN_REPLY_REGEN_HINT_FR,
  isValidHumanReply,
  validateHumanReply,
  type HumanReplyValidation,
} from "./human-reply-validator";

export type EnsureValidHumanReplyResult = {
  reply: string;
  validation: HumanReplyValidation;
  source: "original" | "regen" | "fallback";
  regenerated: boolean;
};

export type EnsureValidHumanReplyArgs = {
  reply: string;
  userMessage?: string;
  requestId?: string;
  lang?: "fr" | "en" | "es";
  socialOnly?: boolean;
  regenOnce?: () => Promise<string>;
};

function logValidation(args: {
  requestId?: string;
  validation: HumanReplyValidation;
  source: EnsureValidHumanReplyResult["source"];
  socialOnly?: boolean;
}) {
  logStructured("[HUMAN_REPLY_VALIDATION]", {
    request_id: args.requestId,
    valid: args.validation.valid,
    humanReplyScore: args.validation.humanReplyScore,
    reason: args.validation.reason,
    emojiOnly: args.validation.emojiOnly,
    source: args.source,
    socialOnly: args.socialOnly === true,
  });
  logStructured("[HUMAN_REPLY_SCORE]", {
    request_id: args.requestId,
    score: args.validation.humanReplyScore,
    valid: args.validation.valid,
  });
}

export async function ensureValidHumanReply(
  args: EnsureValidHumanReplyArgs,
): Promise<EnsureValidHumanReplyResult> {
  const seed = String(args.userMessage ?? "") + (args.requestId ?? "");

  let validation = validateHumanReply(args.reply);
  logValidation({ requestId: args.requestId, validation, source: "original", socialOnly: args.socialOnly });

  if (validation.valid) {
    return { reply: String(args.reply ?? "").trim(), validation, source: "original", regenerated: false };
  }

  if (validation.emojiOnly) {
    logStructured("[EMOJI_ONLY_BLOCKED]", {
      request_id: args.requestId,
      reply: String(args.reply ?? "").slice(0, 80),
    });
  }
  logStructured("[INVALID_REPLY_REJECTED]", {
    request_id: args.requestId,
    reason: validation.reason,
    reply: String(args.reply ?? "").slice(0, 80),
  });

  if (args.regenOnce) {
    logStructured("[REGENERATION_TRIGGERED]", {
      request_id: args.requestId,
      reason: validation.reason,
      hint: HUMAN_REPLY_REGEN_HINT_FR,
    });
    try {
      const regenRaw = await args.regenOnce();
      const regenValidation = validateHumanReply(regenRaw);
      logValidation({ requestId: args.requestId, validation: regenValidation, source: "regen", socialOnly: args.socialOnly });
      if (regenValidation.valid) {
        return {
          reply: String(regenRaw).trim(),
          validation: regenValidation,
          source: "regen",
          regenerated: true,
        };
      }
      validation = regenValidation;
    } catch (e) {
      logStructured("[REGENERATION_TRIGGERED]", {
        request_id: args.requestId,
        failed: true,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const fallback = buildSocialHumanFallback({
    seed,
    lang: args.lang,
    userMessage: args.userMessage,
  });
  const fallbackValidation = validateHumanReply(fallback);
  logStructured("[FALLBACK_HUMAN_REPLY]", {
    request_id: args.requestId,
    reply: fallback,
    previousReason: validation.reason,
    score: fallbackValidation.humanReplyScore,
  });
  logValidation({
    requestId: args.requestId,
    validation: fallbackValidation,
    source: "fallback",
    socialOnly: args.socialOnly,
  });

  return {
    reply: fallback,
    validation: fallbackValidation,
    source: "fallback",
    regenerated: Boolean(args.regenOnce),
  };
}

/** Social / quick paths — pas de regen LLM, fallback immédiat si invalide. */
export function ensureValidHumanReplySync(args: {
  reply: string;
  userMessage?: string;
  requestId?: string;
  lang?: "fr" | "en" | "es";
  socialOnly?: boolean;
}): EnsureValidHumanReplyResult {
  const seed = String(args.userMessage ?? "") + (args.requestId ?? "");
  const validation = validateHumanReply(args.reply);
  logValidation({ requestId: args.requestId, validation, source: "original", socialOnly: args.socialOnly });

  if (validation.valid) {
    return { reply: String(args.reply ?? "").trim(), validation, source: "original", regenerated: false };
  }

  if (validation.emojiOnly) {
    logStructured("[EMOJI_ONLY_BLOCKED]", {
      request_id: args.requestId,
      reply: String(args.reply ?? "").slice(0, 80),
    });
  }
  logStructured("[INVALID_REPLY_REJECTED]", {
    request_id: args.requestId,
    reason: validation.reason,
    reply: String(args.reply ?? "").slice(0, 80),
  });

  const fallback = buildSocialHumanFallback({
    seed,
    lang: args.lang,
    userMessage: args.userMessage,
  });
  const fallbackValidation = validateHumanReply(fallback);
  logStructured("[FALLBACK_HUMAN_REPLY]", {
    request_id: args.requestId,
    reply: fallback,
    previousReason: validation.reason,
  });
  logValidation({
    requestId: args.requestId,
    validation: fallbackValidation,
    source: "fallback",
    socialOnly: args.socialOnly,
  });

  return {
    reply: fallback,
    validation: fallbackValidation,
    source: "fallback",
    regenerated: false,
  };
}

export function canPersistAssistantReply(reply: string): boolean {
  return isValidHumanReply(reply);
}
