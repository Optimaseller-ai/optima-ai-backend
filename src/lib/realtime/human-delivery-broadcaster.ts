import { getSupabaseAdmin } from "@/supabase/client";
import { getRedis, redisKey } from "@/lib/redis/redis-client";
import { logStructured } from "@/lib/logging/structured-log";

export type HumanDeliveryEventKind =
  | "message_read"
  | "typing_start"
  | "typing_stop"
  | "fragment_send"
  | "message_complete";

export type HumanDeliveryBroadcastPayload = {
  session_id: string;
  sequence_id: number;
  message_id: string;
  fragment_index: number | null;
  event: HumanDeliveryEventKind;
  delay_ms: number;
  created_at: number;
  fragment: string | null;
  meta?: Record<string, unknown>;
};

const CHANNEL_PREFIX = "chat_delivery";
const EVENT_NAME = "human_delivery";

const channelCache = new Map<string, { channel: any; subscribed: boolean }>();
const localSeq = new Map<string, number>();
const localFp = new Map<string, number>(); // key -> expiresAt

function channelName(sessionId: string): string {
  // IMPORTANT: frontend subscribes to this literal channel name (includes `*`).
  return `${CHANNEL_PREFIX}:${sessionId}:*`;
}

async function getOrCreateChannel(sessionId: string): Promise<any | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const name = channelName(sessionId);
  const existing = channelCache.get(name);
  if (existing?.channel) return existing.channel;

  const channel = supabase.channel(name, {
    config: {
      broadcast: { ack: false },
    },
  });
  channelCache.set(name, { channel, subscribed: false });
  try {
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        const row = channelCache.get(name);
        if (row) row.subscribed = true;
      }
    });
  } catch (e) {
    logStructured("[REALTIME_DELIVERY_ERROR]", {
      session_id: sessionId,
      error: e instanceof Error ? e.message : String(e),
      stage: "subscribe",
    });
  }
  return channel;
}

async function nextSequenceId(sessionId: string): Promise<number> {
  const r = getRedis();
  if (r) {
    try {
      const n = await r.incr(redisKey("delivery_seq", sessionId));
      logStructured("[SEQUENCE_ID]", { session_id: sessionId, sequence_id: n });
      return Number(n);
    } catch {
      // fallback to local
    }
  }
  const prev = localSeq.get(sessionId) ?? 0;
  const next = prev + 1;
  localSeq.set(sessionId, next);
  logStructured("[SEQUENCE_ID]", { session_id: sessionId, sequence_id: next, mode: "local" });
  return next;
}

async function claimFingerprint(args: {
  sessionId: string;
  messageId: string;
  fragmentIndex: number | null;
  event: HumanDeliveryEventKind;
}): Promise<boolean> {
  const fpKey = redisKey(
    "delivery_fp",
    args.sessionId,
    args.messageId,
    String(args.fragmentIndex ?? "null"),
    args.event,
  );
  const ttlSec = 30;
  const r = getRedis();
  if (r) {
    try {
      const res = await r.set(fpKey, "1", { ex: ttlSec, nx: true });
      return res === "OK";
    } catch {
      // fallback local
    }
  }
  const now = Date.now();
  const exp = localFp.get(fpKey) ?? 0;
  if (exp > now) return false;
  localFp.set(fpKey, now + ttlSec * 1000);
  return true;
}

export async function broadcastHumanDeliveryEvent(args: {
  session_id: string;
  message_id: string;
  fragment_index: number | null;
  event: HumanDeliveryEventKind;
  delay_ms: number;
  fragment: string | null;
  meta?: Record<string, unknown>;
}): Promise<{ ok: true; sequence_id: number } | { ok: false; reason: string }> {
  const sessionId = String(args.session_id ?? "").trim();
  const messageId = String(args.message_id ?? "").trim();
  if (!sessionId || !messageId) return { ok: false, reason: "missing_ids" };

  const claimed = await claimFingerprint({
    sessionId,
    messageId,
    fragmentIndex: args.fragment_index,
    event: args.event,
  });
  if (!claimed) {
    logStructured("[REALTIME_BROADCAST]", {
      session_id: sessionId,
      message_id: messageId,
      event: args.event,
      skipped: "duplicate_fingerprint",
    });
    return { ok: false, reason: "duplicate_fingerprint" };
  }

  const channel = await getOrCreateChannel(sessionId);
  if (!channel) {
    logStructured("[REALTIME_DELIVERY_ERROR]", { session_id: sessionId, error: "supabase_not_configured" });
    return { ok: false, reason: "supabase_not_configured" };
  }

  const sequence_id = await nextSequenceId(sessionId);
  const payload: HumanDeliveryBroadcastPayload = {
    session_id: sessionId,
    sequence_id,
    message_id: messageId,
    fragment_index: args.fragment_index,
    event: args.event,
    delay_ms: Math.max(0, Number(args.delay_ms ?? 0)),
    created_at: Date.now(),
    fragment: args.fragment,
    meta: args.meta ?? undefined,
  };

  try {
    logStructured("[REALTIME_BROADCAST]", {
      session_id: sessionId,
      channel: channelName(sessionId),
      event: EVENT_NAME,
      kind: args.event,
      sequence_id,
    });
    if (args.event === "fragment_send") {
      logStructured("[FRAGMENT_BROADCAST]", {
        session_id: sessionId,
        message_id: messageId,
        fragment_index: args.fragment_index,
        len: (args.fragment ?? "").length,
        sequence_id,
      });
    }

    await channel.send({ type: "broadcast", event: EVENT_NAME, payload });
    logStructured("[REALTIME_DELIVERY_OK]", { session_id: sessionId, sequence_id, event: args.event });
    return { ok: true, sequence_id };
  } catch (e) {
    logStructured("[REALTIME_DELIVERY_ERROR]", {
      session_id: sessionId,
      sequence_id,
      event: args.event,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: "send_failed" };
  }
}

export async function broadcastTypingStart(args: {
  session_id: string;
  message_id: string;
  delay_ms: number;
  fragment_index?: number | null;
  meta?: Record<string, unknown>;
}) {
  logStructured("[TYPING_START_SENT]", { session_id: args.session_id, message_id: args.message_id });
  return broadcastHumanDeliveryEvent({
    session_id: args.session_id,
    message_id: args.message_id,
    fragment_index: args.fragment_index ?? null,
    event: "typing_start",
    delay_ms: args.delay_ms,
    fragment: null,
    meta: args.meta,
  });
}

export async function broadcastTypingStop(args: {
  session_id: string;
  message_id: string;
  delay_ms: number;
  fragment_index?: number | null;
  meta?: Record<string, unknown>;
}) {
  logStructured("[TYPING_STOP_SENT]", { session_id: args.session_id, message_id: args.message_id });
  return broadcastHumanDeliveryEvent({
    session_id: args.session_id,
    message_id: args.message_id,
    fragment_index: args.fragment_index ?? null,
    event: "typing_stop",
    delay_ms: args.delay_ms,
    fragment: null,
    meta: args.meta,
  });
}

export async function broadcastMessageRead(args: {
  session_id: string;
  message_id: string;
  delay_ms: number;
  meta?: Record<string, unknown>;
}) {
  return broadcastHumanDeliveryEvent({
    session_id: args.session_id,
    message_id: args.message_id,
    fragment_index: null,
    event: "message_read",
    delay_ms: args.delay_ms,
    fragment: null,
    meta: args.meta,
  });
}

export async function broadcastFragment(args: {
  session_id: string;
  message_id: string;
  fragment_index: number;
  fragment: string;
  delay_ms: number;
  meta?: Record<string, unknown>;
}) {
  return broadcastHumanDeliveryEvent({
    session_id: args.session_id,
    message_id: args.message_id,
    fragment_index: args.fragment_index,
    event: "fragment_send",
    delay_ms: args.delay_ms,
    fragment: args.fragment,
    meta: args.meta,
  });
}

export async function broadcastMessageComplete(args: {
  session_id: string;
  message_id: string;
  delay_ms: number;
  meta?: Record<string, unknown>;
}) {
  logStructured("[MESSAGE_COMPLETE_SENT]", { session_id: args.session_id, message_id: args.message_id });
  return broadcastHumanDeliveryEvent({
    session_id: args.session_id,
    message_id: args.message_id,
    fragment_index: null,
    event: "message_complete",
    delay_ms: args.delay_ms,
    fragment: null,
    meta: args.meta,
  });
}

