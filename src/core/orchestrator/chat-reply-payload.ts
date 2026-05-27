import { z } from "zod";

const AGENT_PERSONALITIES = ["chaleureux", "professionnel", "dynamique"] as const;
const SALES_STYLES = ["conseiller", "closer", "premium"] as const;

const HistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

/** Relaxed schema after normalization — migration-safe. */
export const FullSellerChatReplyBodySchema = z.object({
  session_id: z.string().min(1).max(200),
  request_id: z.string().min(1).max(120),
  pipeline_trace_id: z.string().min(1).max(320),
  message: z.string().min(1).max(4000),
  user_id: z.string().min(1).max(128),
  agent_id: z.string().min(1).max(128).optional(),
  agent_name: z.string().max(120).optional(),
  agent_personality: z.enum(AGENT_PERSONALITIES).optional(),
  sales_style: z.enum(SALES_STYLES).optional(),
  business_name: z.string().max(200).optional(),
  conversation_state: z.record(z.any()).optional(),
  history: z.array(HistoryTurnSchema).max(32).optional(),
  agent_role: z.string().max(400).optional(),
  agent_tone: z.string().max(200).optional(),
  persona_key: z.string().nullable().optional(),
  followup_after_hold: z.boolean().optional(),
  timing: z
    .object({
      read: z.number().int().min(0).max(60_000).optional(),
      typing: z.number().int().min(0).max(120_000).optional(),
      followUp: z.number().int().min(0).max(300_000).optional(),
    })
    .optional(),
});

export type FullSellerChatReplyBody = z.infer<typeof FullSellerChatReplyBodySchema>;

const CAMEL_TO_SNAKE: Record<string, string> = {
  sessionId: "session_id",
  requestId: "request_id",
  pipelineTraceId: "pipeline_trace_id",
  userId: "user_id",
  agentId: "agent_id",
  agentName: "agent_name",
  agentPersonality: "agent_personality",
  salesStyle: "sales_style",
  businessName: "business_name",
  conversationState: "conversation_state",
  agentRole: "agent_role",
  agentTone: "agent_tone",
  personaKey: "persona_key",
  followupAfterHold: "followup_after_hold",
};

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

function pickString(v: unknown, maxLen?: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return maxLen ? s.slice(0, maxLen) : s;
}

function ensureMinLen(id: string, minLen: number, prefix: string): string {
  const s = id.trim();
  if (s.length >= minLen) return s.slice(0, 120);
  const padded = `${prefix}${s}_${Date.now()}`;
  return padded.slice(0, 120);
}

function normalizeHistory(raw: unknown): Array<{ role: "user" | "assistant"; content: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = pickString((item as { content?: unknown }).content, 4000);
    if ((role !== "user" && role !== "assistant") || !content) continue;
    out.push({ role, content });
  }
  return out.length ? out.slice(-32) : undefined;
}

function normalizeConversationState(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const s = pickString(value);
  if (!s) return undefined;
  const lower = s.toLowerCase() as T;
  return (allowed as readonly string[]).includes(lower) ? lower : undefined;
}

function extractMessageFromLegacyMessages(messages: unknown[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    if ((m as { role?: string }).role === "user") {
      return pickString((m as { content?: unknown }).content, 4000);
    }
  }
  return undefined;
}

/** Maps camelCase, Phase-1 `messages`, and loose types → canonical snake_case body. */
export function normalizeIncomingPayload(raw: unknown): Record<string, unknown> {
  const src = asRecord(raw);
  const out: Record<string, unknown> = { ...src };

  for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
    if (out[snake] == null && out[camel] != null) {
      out[snake] = out[camel];
    }
    delete out[camel];
  }

  if (!out.message && Array.isArray(out.messages)) {
    const legacyMsg = extractMessageFromLegacyMessages(out.messages);
    if (legacyMsg) out.message = legacyMsg;
    if (!out.history && Array.isArray(out.messages)) {
      out.history = out.messages;
    }
    delete out.messages;
  }

  out.session_id = pickString(out.session_id, 200) ?? pickString(out.sessionId, 200);
  out.request_id = pickString(out.request_id, 120) ?? pickString(out.requestId, 120);
  out.pipeline_trace_id = pickString(out.pipeline_trace_id, 320) ?? pickString(out.pipelineTraceId, 320);
  out.message = pickString(out.message, 4000);
  out.user_id = pickString(out.user_id, 128) ?? pickString(out.userId, 128);

  if (typeof out.session_id === "string") {
    out.session_id = ensureMinLen(out.session_id, 8, "sess_");
  }
  if (typeof out.request_id === "string") {
    out.request_id = ensureMinLen(out.request_id, 8, "req_");
  }
  if (!out.pipeline_trace_id) {
    out.pipeline_trace_id = `pipe_${Date.now()}`;
  } else if (typeof out.pipeline_trace_id === "string") {
    out.pipeline_trace_id = ensureMinLen(out.pipeline_trace_id, 4, "pipe_");
  }

  const agentId = pickString(out.agent_id, 128);
  if (agentId) out.agent_id = agentId;

  const agentName = pickString(out.agent_name, 120);
  if (agentName) out.agent_name = agentName;

  const businessName = pickString(out.business_name, 200);
  if (businessName) out.business_name = businessName;

  const agentRole = pickString(out.agent_role, 400);
  if (agentRole) out.agent_role = agentRole;

  const agentTone = pickString(out.agent_tone, 200);
  if (agentTone) out.agent_tone = agentTone;

  const personality = coerceEnum(out.agent_personality, AGENT_PERSONALITIES);
  if (personality) out.agent_personality = personality;
  else delete out.agent_personality;

  const salesStyle = coerceEnum(out.sales_style, SALES_STYLES);
  if (salesStyle) out.sales_style = salesStyle;
  else delete out.sales_style;

  if (out.persona_key === undefined) {
    /* keep absent */
  } else if (out.persona_key === null || out.persona_key === "") {
    out.persona_key = null;
  } else {
    out.persona_key = pickString(out.persona_key, 120) ?? null;
  }

  if (out.followup_after_hold != null) {
    out.followup_after_hold = out.followup_after_hold === true || out.followup_after_hold === "true";
  }

  const history = normalizeHistory(out.history);
  if (history) out.history = history;
  else delete out.history;

  const state = normalizeConversationState(out.conversation_state);
  if (state !== undefined) out.conversation_state = state;
  else delete out.conversation_state;

  if (out.timing != null && typeof out.timing === "object" && !Array.isArray(out.timing)) {
    const t = out.timing as Record<string, unknown>;
    out.timing = {
      read: typeof t.read === "number" ? t.read : undefined,
      typing: typeof t.typing === "number" ? t.typing : undefined,
      followUp: typeof t.followUp === "number" ? t.followUp : typeof t.follow_up === "number" ? t.follow_up : undefined,
    };
  } else {
    delete out.timing;
  }

  delete out.messages;
  delete out.model;
  delete out.max_tokens;

  return out;
}

export type PayloadValidationIssue = {
  path: string;
  code: "missing" | "invalid_type" | "invalid_nesting" | "invalid_value" | "undefined_value";
  message: string;
  received?: unknown;
};

export function formatValidationIssues(error: z.ZodError): PayloadValidationIssue[] {
  const issues: PayloadValidationIssue[] = [];

  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    let code: PayloadValidationIssue["code"] = "invalid_value";
    if (issue.code === "invalid_type") {
      code = issue.received === "undefined" ? "undefined_value" : "invalid_type";
    } else if (issue.code === "invalid_union") {
      code = "invalid_nesting";
    } else if (issue.message.toLowerCase().includes("required")) {
      code = "missing";
    }

    issues.push({
      path,
      code,
      message: issue.message,
      received: "received" in issue ? (issue as { received?: unknown }).received : undefined,
    });
  }

  return issues;
}

export function describePayloadStructure(raw: unknown): Record<string, unknown> {
  if (raw == null) return { type: typeof raw, value: raw };
  if (Array.isArray(raw)) {
    return {
      type: "array",
      length: raw.length,
      sample: raw.slice(0, 2).map((v) => describePayloadStructure(v)),
    };
  }
  if (typeof raw !== "object") {
    return { type: typeof raw, value: raw };
  }

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const summary: Record<string, unknown> = {
    type: "object",
    keyCount: keys.length,
    keys,
    fields: {} as Record<string, unknown>,
  };

  const fields = summary.fields as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (k === "conversation_state" && v && typeof v === "object") {
      const st = v as Record<string, unknown>;
      fields[k] = {
        type: "object",
        keyCount: Object.keys(st).length,
        topKeys: Object.keys(st).slice(0, 24),
      };
    } else if (k === "history" && Array.isArray(v)) {
      fields[k] = { type: "array", length: v.length, first: v[0] ?? null };
    } else if (typeof v === "string") {
      fields[k] = { type: "string", length: v.length, preview: v.slice(0, 80) };
    } else {
      fields[k] = { type: Array.isArray(v) ? "array" : typeof v };
    }
  }

  return summary;
}

export function safeJsonForLog(raw: unknown, maxChars = 24_000): string {
  try {
    const s = JSON.stringify(raw);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}…[truncated ${s.length - maxChars} chars]`;
  } catch (e) {
    return JSON.stringify({ _unserializable: true, error: e instanceof Error ? e.message : String(e) });
  }
}
