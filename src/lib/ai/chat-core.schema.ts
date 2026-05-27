import { z } from "zod";

export const ALLOWED_MODELS = [
  "openai/gpt-4o-mini",
  "deepseek/deepseek-chat-v3",
  "anthropic/claude-3.5-sonnet",
  "perplexity/sonar",
] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export const CORE_MODES = [
  "reply",
  "followup",
  "closing",
  "complaint",
  "promo",
  "business_chat",
] as const;
export type CoreMode = (typeof CORE_MODES)[number];

export const chatCoreRequestSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
        ts: z.string().optional(),
      }),
    )
    .default([]),
  mode: z.enum(CORE_MODES).optional(),
  userTimezone: z.string().min(1).optional(),
  model: z.enum(ALLOWED_MODELS).optional(),
  responseFormat: z.enum(["single", "items_3"]).optional(),
  plan: z.enum(["free", "pro"]).optional(),
  businessProfile: z
    .object({
      ownerName: z.string().nullable().optional(),
      businessName: z.string().nullable().optional(),
      businessType: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      contactPhone: z.string().nullable().optional(),
      mainGoal: z.string().nullable().optional(),
      brandTone: z.string().nullable().optional(),
      responseStyle: z.string().nullable().optional(),
      primaryLanguage: z.string().nullable().optional(),
      offer: z.string().nullable().optional(),
    })
    .optional(),
});
