import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runFullSellerReplyOrchestration } from "../core/orchestrator/full-seller-reply-orchestrator.js";
import {
  FullSellerChatReplyBodySchema,
  describePayloadStructure,
  formatValidationIssues,
  normalizeIncomingPayload,
  safeJsonForLog,
} from "../core/orchestrator/chat-reply-payload.js";
import { openRouterChat, openRouterEmbed } from "../core/orchestrator/openrouter-client.js";
import { verifyBackendAuth } from "../services/auth.js";

const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(16_000),
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
  /** Full seller reply — `generateAIReply` + Redis locks + human timing jobs. */
  app.post("/v1/chat/reply", async (req, reply) => {
    if (!verifyBackendAuth(req)) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const rawBody = req.body;
    console.log("[OPTIMA_RAILWAY_ORCHESTRATOR] raw_body_structure", describePayloadStructure(rawBody));
    console.log("[OPTIMA_RAILWAY_ORCHESTRATOR] raw_body_json", safeJsonForLog(rawBody));

    const normalized = normalizeIncomingPayload(rawBody);
    console.log("[OPTIMA_REPLY_PIPELINE] normalized_body_structure", describePayloadStructure(normalized));
    console.log("[OPTIMA_REPLY_PIPELINE] normalized_body_json", safeJsonForLog(normalized));

    const parsed = FullSellerChatReplyBodySchema.safeParse(normalized);
    if (!parsed.success) {
      const issues = formatValidationIssues(parsed.error);
      console.warn("[OPTIMA_RAILWAY_ORCHESTRATOR] invalid_body", {
        issueCount: issues.length,
        issues,
        zodFlatten: parsed.error.flatten(),
      });
      return reply.status(400).send({
        error: "invalid_body",
        issues,
        missing: issues.filter((i) => i.code === "missing").map((i) => i.path),
        invalid_type: issues.filter((i) => i.code === "invalid_type").map((i) => ({ path: i.path, received: i.received })),
        invalid_nesting: issues.filter((i) => i.code === "invalid_nesting").map((i) => i.path),
        undefined_values: issues.filter((i) => i.code === "undefined_value").map((i) => i.path),
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;

    try {
      req.log.info({ path: "/v1/chat/reply" }, "[OPTIMA_RAILWAY_ORCHESTRATOR] incoming_full_reply");
      const result = await runFullSellerReplyOrchestration({
        session_id: body.session_id,
        request_id: body.request_id,
        pipeline_trace_id: body.pipeline_trace_id,
        message: body.message,
        user_id: body.user_id,
        agent_id: body.agent_id,
        agent_name: body.agent_name,
        agent_personality: body.agent_personality,
        sales_style: body.sales_style,
        business_name: body.business_name,
        conversation_state: body.conversation_state,
        history: body.history,
        agent_role: body.agent_role,
        agent_tone: body.agent_tone,
        persona_key: body.persona_key ?? null,
        followup_after_hold: body.followup_after_hold,
        timing: body.timing,
      });

      return reply.send({
        ok: true,
        reply: result.reply,
        source: result.source,
        request_id: result.request_id,
        timing_scheduled: result.timing_scheduled,
        payload: result.payload,
        orchestrator_pipeline_debug: result.orchestrator_pipeline_debug,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code =
        e && typeof e === "object" && "code" in e && typeof (e as { code?: unknown }).code === "string"
          ? String((e as { code: string }).code)
          : undefined;

      if (msg === "DUPLICATE_REPLY_REQUEST") {
        return reply.status(409).send({ error: "duplicate_request" });
      }
      if (msg === "STALE_REPLY_TURN") {
        return reply.status(409).send({ error: "stale_reply_turn" });
      }
      if (code === "REPLY_ENGINE_NOT_FOUND" || msg.includes("REPLY_ENGINE_NOT_FOUND")) {
        req.log.error(e);
        return reply.status(500).send({
          error: "reply_engine_not_found",
          code: "REPLY_ENGINE_NOT_FOUND",
          message: msg,
        });
      }
      req.log.error(e);
      return reply.status(502).send({ error: "orchestration_failed", message: msg });
    }
  });

  /** Thin OpenRouter proxy — drop-in replacement for Vercel openRouterChat(). */
  app.post("/v1/llm/chat", async (req, reply) => {
    req.log.info({ path: "/v1/llm/chat" }, "[OPTIMA_AI_BACKEND] incoming_openrouter_chat");
    if (!verifyBackendAuth(req)) {
      req.log.warn("[OPTIMA_AI_BACKEND] unauthorized /v1/llm/chat");
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
    req.log.info({ path: "/v1/llm/embed" }, "[OPTIMA_AI_BACKEND] incoming_openrouter_embed");
    if (!verifyBackendAuth(req)) {
      req.log.warn("[OPTIMA_AI_BACKEND] unauthorized /v1/llm/embed");
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
