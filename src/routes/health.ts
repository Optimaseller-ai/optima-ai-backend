import type { FastifyInstance } from "fastify";
import { getRedis } from "../redis/client.js";
import { getSupabaseAdmin } from "../supabase/client.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "optima-ai-backend",
    redis: Boolean(getRedis()),
    supabase: Boolean(getSupabaseAdmin()),
    timestamp: new Date().toISOString(),
  }));
}
