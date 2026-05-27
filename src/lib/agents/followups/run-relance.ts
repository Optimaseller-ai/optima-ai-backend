import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { openRouterChat } from "@/lib/ai/openrouter";
import { getBusinessContext } from "@/lib/agents/business-context/catalog-rag";
import { resolveBusinessTimezone } from "@/lib/agents/timing/business-timezone";
import { getCommercialAgentById } from "@/lib/agents/personality/commercial-agents";
import { conversationsUpdateWithOptionalColumnFallback, isMissingConversationStateColumn } from "@/lib/chat/conversation-state-db";
import { getNextRelanceAt, isClosedStatus, type ConversationStatus } from "@/lib/agents/followups/relance-schedule";
import { smartRelanceSystemPrompt, smartRelanceUserPrompt } from "@/lib/agents/followups/smart-sales-followups";

type StoredMessage = { role: "user" | "assistant"; content: string; ts: string };

function relanceNumberToLabel(n: number) {
  const x = Math.max(1, Math.min(3, Math.floor(n)));
  return x === 1 ? "Relance 1 (30 min après silence)" : x === 2 ? "Relance 2 (2 h)" : "Relance 3 (24 h)";
}

export async function runRelanceForConversation(args: { conversationId: string; force?: boolean }) {
  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  let convRes = await admin
    .from("conversations")
    .select("id,agent_id,session_id,status,last_ai_message_at,last_user_message_at,relance_count,next_relance_at,messages,conversation_state")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (convRes.error && isMissingConversationStateColumn(convRes.error)) {
    convRes = await admin
      .from("conversations")
      .select("id,agent_id,session_id,status,last_ai_message_at,last_user_message_at,relance_count,next_relance_at,messages")
      .eq("id", args.conversationId)
      .maybeSingle();
  }
  if (convRes.error) throw convRes.error;
  const conv = convRes.data;
  if (!conv?.id) return { ok: false as const, reason: "not_found" as const };

  const status = (typeof (conv as any).status === "string" ? (conv as any).status : "active") as ConversationStatus;
  if (isClosedStatus(status)) return { ok: false as const, reason: "closed" as const };

  const relanceCount = typeof (conv as any).relance_count === "number" ? (conv as any).relance_count : 0;
  if (relanceCount >= 3) return { ok: false as const, reason: "maxed" as const };

  const due = (conv as any).next_relance_at ? new Date(String((conv as any).next_relance_at)) : null;
  if (!args.force && due && due.getTime() > now.getTime()) return { ok: false as const, reason: "not_due" as const };

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id,user_id,is_active,name,slug,persona_key")
    .eq("id", conv.agent_id)
    .maybeSingle();
  if (agentErr) throw agentErr;
  if (!agent?.id || !agent.is_active) return { ok: false as const, reason: "unknown_agent" as const };

  const { data: sub } = await admin.from("subscriptions").select("plan").eq("user_id", agent.user_id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return { ok: false as const, reason: "plan" as const };

  const { data: prof } = await admin
    .from("profiles")
    .select("business_name,shop_name,full_name,first_name,business_type,goal,country,city,offer,brand_tone,response_style,language")
    .eq("id", agent.user_id)
    .maybeSingle();

  const profileSummary = [
    prof?.business_name || prof?.shop_name ? `Business: ${prof?.business_name ?? prof?.shop_name}` : null,
    prof?.business_type ? `Type: ${prof.business_type}` : null,
    prof?.country || prof?.city ? `Localisation: ${(prof?.city ?? "").trim()} ${(prof?.country ?? "").trim()}`.trim() : null,
    prof?.offer ? `Offre: ${prof.offer}` : null,
    (prof as any)?.brand_tone ? `Ton: ${(prof as any).brand_tone}` : null,
    (prof as any)?.response_style ? `Style: ${(prof as any).response_style}` : null,
    (prof as any)?.language ? `Langue: ${(prof as any).language}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const history = (Array.isArray((conv as any).messages) ? ((conv as any).messages as any[]) : []) as StoredMessage[];
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const ctx = await getBusinessContext(agent.user_id, lastUser || "catalogue");

  const nextRelanceNumber = relanceCount + 1;
  const label = relanceNumberToLabel(nextRelanceNumber);

  const persona = getCommercialAgentById((agent as any).persona_key);
  const agentDisplayName = persona?.name ?? String(agent.name ?? "Conseiller");
  const businessLabel = String(prof?.business_name ?? prof?.shop_name ?? agent.name ?? "Boutique").trim() || "Boutique";
  const profLang = String((prof as any)?.language ?? "").toLowerCase();
  const stateLang = (conv as any)?.conversation_state?.language;
  const lang: "fr" | "en" | "es" =
    stateLang === "es" || profLang.startsWith("es")
      ? "es"
      : stateLang === "en" || profLang.startsWith("en")
        ? "en"
        : "fr";

  const userPrompt = smartRelanceUserPrompt({
    relanceLabel: label,
    profileSummary: profileSummary || "N/A",
    catalogueOrDocs: ctx.context || "N/A",
    lastUserMessage: lastUser,
    lang,
  });

  const relanceText = await openRouterChat({
    messages: [
      { role: "system", content: smartRelanceSystemPrompt({ agentDisplayName, businessLabel, lang }) },
      { role: "user", content: userPrompt },
    ],
  });

  const clean = relanceText.trim();
  if (!clean) return { ok: false as const, reason: "empty" as const };

  const updatedHistory: StoredMessage[] = [...history, { role: "assistant", content: clean, ts: nowIso }];
  const nextRelanceAt = getNextRelanceAt({
    relanceCount: nextRelanceNumber,
    from: now,
    businessIanaTimezone: resolveBusinessTimezone({
      city: typeof (prof as any)?.city === "string" ? (prof as any).city : null,
      country: typeof prof?.country === "string" ? prof.country : null,
    }).iana,
  });

  const { error: upErr } = await conversationsUpdateWithOptionalColumnFallback(admin, conv.id, {
    messages: updatedHistory as any,
    status: status === "active" ? "pending" : status,
    relance_count: nextRelanceNumber,
    last_message_at: nowIso,
    last_ai_message_at: nowIso,
    next_relance_at: nextRelanceAt,
    updated_at: nowIso,
  });
  if (upErr) {
    console.error("[RELANCE_UPDATE_FAILED]", upErr);
    return { ok: false as const, reason: "persist_failed" as const };
  }

  return { ok: true as const, conversationId: conv.id, relance: clean, relanceCount: nextRelanceNumber, nextRelanceAt };
}

