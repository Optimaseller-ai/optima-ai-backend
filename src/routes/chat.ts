import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runReplyOrchestration } from "../core/orchestrator/reply-orchestrator.js";
import { openRouterChat, openRouterEmbed } from "../core/orchestrator/openrouter-client.js";
import { verifyBackendAuth } from "../services/auth.js";

const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(16_000),
});

const ChatReplyBodySchema = z.object({
  session_id: z.string().trim().min(8).max(200),
  request_id: z.string().trim().min(8).max(120),
  message: z.string().trim().min(1).max(4000),
  messages: z.array(ChatMessageSchema).min(1).max(32),
  model: z.string().optional(),
  max_tokens: z.number().int().min(64).max(4096).optional(),
  timing: z
    .object({
      read: z.number().int().min(0).max(60_000).optional(),
      typing: z.number().int().min(0).max(120_000).optional(),
      followUp: z.number().int().min(0).max(300_000).optional(),
    })
    .optional(),
});

const OpenRouterChatBodySchema = z.object({
  model: z.string().optional(),
  messages: z.array(ChatMessageSchema).min(1).max(32),
  max_tokens: z.number().int().min(64).max(4096).optional(),
  timeout_ms: z.number().int().min(1000).max(120_000).optional(),
});

const EmbedBodySchema = z.object({
  model: z.string().optional(),
  input: z.string().min(1).max(32_000),
  timeout_ms: z.number().int().min(1000).max(120_000).optional(),
});

export async function chatRoutes(app: FastifyInstance) {
  /** Orchestrated reply — Phase 1 migration entry (OpenRouter + Redis locks). */
  app.post("/v1/chat/reply", async (req, reply) => {
    if (!verifyBackendAuth(req)) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const parsed = ChatReplyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const body = parsed.data;

    try {
      const result = await runReplyOrchestration({
        sessionId: body.session_id,
        requestId: body.request_id,
        message: body.message,
        messages: body.messages,
        model: body.model,
        maxTokens: body.max_tokens,
        timing: body.timing,
      });

      return reply.send({
        ok: true,
        reply: result.reply,
        source: result.source,
        request_id: result.requestId,
        timing_scheduled: result.timingScheduled,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "DUPLICATE_REPLY_REQUEST") {
        return reply.status(409).send({ error: "duplicate_request" });
      }
      req.log.error(e);
      return reply.status(502).send({ error: "orchestration_failed", message: msg });
    }
  });

  /** Thin OpenRouter proxy — drop-in replacement for Vercel openRouterChat(). */
  app.post("/v1/llm/chat", async (req, reply) => {
    if (!verifyBackendAuth(req)) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const parsed = OpenRouterChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    try {
      const content = await openRouterChat({
        model: parsed.data.model,
        messages: parsed.data.messages,
        maxTokens: parsed.data.max_tokens,
        timeoutMs: parsed.data.timeout_ms,
      });
      return reply.send({ ok: true, content });
    } catch (e) {
      const status = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 502;
      req.log.error(e);
      return reply.status(status >= 400 && status < 600 ? status : 502).send({
        error: "openrouter_failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post("/v1/llm/embed", async (req, reply) => {
    if (!verifyBackendAuth(req)) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const parsed = EmbedBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    try {
      const embedding = await openRouterEmbed({
        model: parsed.data.model,
        input: parsed.data.input,
        timeoutMs: parsed.data.timeout_ms,
      });
      return reply.send({ ok: true, embedding });
    } catch (e) {
      req.log.error(e);
      return reply.status(502).send({ error: "embed_failed", message: e instanceof Error ? e.message : String(e) });
    }
  });
}
