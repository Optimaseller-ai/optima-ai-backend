import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { chatRoutes } from "./routes/chat.js";

async function main() {
  const env = loadEnv();
  console.log("[OPTIMA_BACKEND] autonomous_mode=true");
  console.log("[OPTIMA_BACKEND] monorepo_dependency=false");

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.register(healthRoutes);
  await app.register(chatRoutes);

  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`[OPTIMA_AI_BACKEND] listening on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error("[OPTIMA_AI_BACKEND] fatal", err);
  process.exit(1);
});
