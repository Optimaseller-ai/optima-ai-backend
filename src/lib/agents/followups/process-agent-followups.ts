import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateAIReplyUnified } from "@/lib/agents/business-context/generate-ai-reply-unified";
import { isRailwayFullOrchestratorEnabled } from "@/lib/ai/openrouter-proxy-config";
import { resolvePublicPersonaForAgent } from "@/lib/chat/agent-identity-manager";
import { conversationsUpdateWithOptionalColumnFallback, isMissingConversationStateColumn } from "@/lib/chat/conversation-state-db";

type StoredMessage = { role: "user" | "assistant"; content: string; ts: string };

export async function processDueAgentFollowups(opts: { max?: number } = {}) {
  const max = opts.max ?? 30;
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("pending_agent_followups")
    .select("id,conversation_id,payload")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(max);

  if (error) {
    console.error("[OPTIMA_AI_ERROR]", error);
    return { ok: false as const, processed: 0, results: [] as { id: string; ok: boolean; reason?: string }[] };
  }

  const results: { id: string; ok: boolean; reason?: string }[] = [];

  for (const row of due ?? []) {
    const id = String((row as any).id);
    const conversationId = String((row as any).conversation_id);
    const payload = ((row as any).payload ?? {}) as {
      lastUserMessage?: string;
      lang?: "fr" | "en" | "es";
      conversationState?: unknown;
      personaKey?: string;
    };

    const { data: claimed } = await admin
      .from("pending_agent_followups")
      .update({ status: "processing" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimed?.id) {
      results.push({ id, ok: false, reason: "already_claimed" });
      continue;
    }

    try {
      let convRes = await admin
        .from("conversations")
        .select("id,messages,agent_id,conversation_state,session_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (convRes.error && isMissingConversationStateColumn(convRes.error)) {
        convRes = await admin.from("conversations").select("id,messages,agent_id,session_id").eq("id", conversationId).maybeSingle();
      }
      const conv = convRes.data;
      const cErr = convRes.error;
      if (cErr || !conv?.id) {
        await admin.from("pending_agent_followups").update({ status: "cancelled" }).eq("id", id);
        results.push({ id, ok: false, reason: "no_conversation" });
        continue;
      }

      const { data: agentRow } = await admin
        .from("agents")
        .select("id,user_id,name,persona_key,is_active")
        .eq("id", (conv as any).agent_id)
        .maybeSingle();
      if (!agentRow?.id || !(agentRow as any).is_active) {
        await admin.from("pending_agent_followups").update({ status: "cancelled" }).eq("id", id);
        results.push({ id, ok: false, reason: "no_agent" });
        continue;
      }

      const persona = resolvePublicPersonaForAgent({
        personaKey: (agentRow as any).persona_key,
        agentId: String((agentRow as any).id),
      });
      const businessName = String((agentRow as any).name ?? "").trim() || "Notre boutique";
      const lastUser =
        typeof payload.lastUserMessage === "string" && payload.lastUserMessage.trim()
          ? payload.lastUserMessage.trim()
          : "";

      const rawHistory = Array.isArray((conv as any).messages) ? ((conv as any).messages as any[]) : [];
      const history: Array<{ role: "user" | "assistant"; content: string }> = rawHistory
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-12)
        .map((m) => ({ role: m.role, content: String(m.content) }));

      if (!lastUser) {
        await admin.from("pending_agent_followups").update({ status: "cancelled" }).eq("id", id);
        results.push({ id, ok: false, reason: "empty_trigger" });
        continue;
      }

      const convStateRaw = (conv as any)?.conversation_state;
      const fromPayload = typeof payload.conversationState === "object" && payload.conversationState ? payload.conversationState : {};
      const fromDb = typeof convStateRaw === "object" && convStateRaw ? convStateRaw : {};
      const mergedBehaviorState = {
        ...fromDb,
        ...fromPayload,
        language: payload.lang === "en" || payload.lang === "es" || payload.lang === "fr" ? payload.lang : (fromPayload as any).language ?? (fromDb as any).language ?? "fr",
      } as any;

      const sessionIdForOrchestrator = String((conv as any).session_id ?? conversationId).trim() || String(conversationId);
      const followupReqId = `followup_${id}_${Date.now()}`;
      const followupTraceId = `followup_${conversationId}_${Date.now()}`;

      let followupText = "";
      try {
        const gen = await generateAIReplyUnified({
          message: lastUser,
          userId: (agentRow as any).user_id,
          agentName: persona.name,
          agentPersonality: persona.personality,
          salesStyle: persona.salesStyle,
          businessName,
          agentRole: persona.role,
          agentTone: persona.tone,
          history,
          followupAfterHold: true,
          conversationState: mergedBehaviorState,
          personaKey: payload.personaKey ?? (agentRow as any).persona_key ?? persona.id,
          railwayMeta: isRailwayFullOrchestratorEnabled()
            ? {
                session_id: sessionIdForOrchestrator,
                request_id: followupReqId,
                pipeline_trace_id: followupTraceId,
              }
            : undefined,
        });
        followupText = gen.reply;
      } catch (e) {
        console.error("[OPTIMA_AI_ERROR]", e);
        followupText =
          payload.lang === "en"
            ? "Thanks for waiting — tell me the model you want and I’ll confirm stock and price."
            : payload.lang === "es"
              ? "Gracias por esperar — indíqueme el modelo que quiere y confirmo stock y precio."
              : "Merci d’avoir attendu — dites-moi le modèle exact et je vous confirme prix et dispo.";
      }

      const trimmed = String(followupText ?? "").trim();
      if (!trimmed) {
        await admin.from("pending_agent_followups").update({ status: "cancelled" }).eq("id", id);
        results.push({ id, ok: false, reason: "empty_reply" });
        continue;
      }

      const msgs = [...rawHistory] as StoredMessage[];
      msgs.push({ role: "assistant", content: trimmed, ts: new Date().toISOString() });

      const { error: convUpErr } = await conversationsUpdateWithOptionalColumnFallback(admin, conversationId, {
        messages: msgs as any,
        last_message_at: new Date().toISOString(),
        last_ai_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (convUpErr) console.error("[CHAT_METADATA_UPDATE_FAILED] followup conversations update", convUpErr);

      await admin.from("pending_agent_followups").update({ status: "sent", message: trimmed }).eq("id", id);

      results.push({ id, ok: true });
    } catch (e) {
      console.error("[OPTIMA_AI_ERROR]", e);
      await admin.from("pending_agent_followups").update({ status: "pending" }).eq("id", id);
      results.push({ id, ok: false, reason: "exception" });
    }
  }

  return { ok: true as const, processed: results.length, results };
}
