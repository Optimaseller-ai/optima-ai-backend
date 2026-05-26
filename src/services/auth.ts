import type { FastifyRequest } from "fastify";
import { loadEnv } from "../config/env.js";

export function verifyBackendAuth(req: FastifyRequest): boolean {
  const env = loadEnv();
  if (!env.OPTIMA_AI_BACKEND_SECRET) {
    return env.NODE_ENV === "development";
  }

  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length > 0 && token === env.OPTIMA_AI_BACKEND_SECRET;
}
