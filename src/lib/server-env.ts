import { z } from "zod";

const optionalTrimmed = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().optional());

const serverEnvSchema = z.object({
  OPENROUTER_API_KEY: optionalTrimmed.pipe(z.string().min(1).optional()),
  OPENROUTER_MODEL: optionalTrimmed.pipe(z.string().min(1).optional()),
  OPENROUTER_EMBEDDING_MODEL: optionalTrimmed.pipe(z.string().min(1).optional()),
  OPENROUTER_SITE_URL: optionalTrimmed.pipe(z.string().url().optional()),
  OPENROUTER_APP_NAME: optionalTrimmed.pipe(z.string().min(1).optional()),
});

export const serverEnv = serverEnvSchema.parse({
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_EMBEDDING_MODEL: process.env.OPENROUTER_EMBEDDING_MODEL,
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL,
  OPENROUTER_APP_NAME: process.env.OPENROUTER_APP_NAME,
});
