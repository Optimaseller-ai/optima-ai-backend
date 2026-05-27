import type { FastifyInstance } from "fastify";
import { getRedis } from "../redis/client.js";
import { getSupabaseAdmin } from "../supabase/client.js";

function safeDeps() {
  try {
    return {
      redis: Boolean(getRedis()),
      supabase: Boolean(getSupabaseAdmin()),
    };
  } catch (e) {
    console.warn("[OPTIMA_AI_BACKEND] health_deps_check_failed", e);
    return { redis: false, supabase: false };
  }
}

export async function healthRoutes(app: FastifyInstance) {
  const liveness = () => ({
    ok: true,
    service: "optima-ai-backend",
    timestamp: new Date().toISOString(),
  });

  /** Railway / load-balancer probe — must return 200 quickly, no heavy work. */
  app.get("/health", async (_req, reply) => {
    const deps = safeDeps();
    return reply.status(200).send({
      ...liveness(),
      ...deps,
    });
  });

  /** Default probe path on some platforms. */
  app.get("/", async (_req, reply) => {
    return reply.status(200).send(liveness());
  });
}
