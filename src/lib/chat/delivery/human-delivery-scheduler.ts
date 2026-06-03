import { redisDel, redisGet, redisKey, redisSet } from "@/lib/redis/redis-client";
import { logStructured } from "@/lib/logging/structured-log";
import type { FragmentedReply } from "@/lib/chat/humanization/message-fragmentation-engine";
import type { ConversationFatigueState } from "@/lib/chat/humanization/conversation-fatigue-engine";
import { fatigueTypingMultiplier } from "@/lib/chat/humanization/conversation-fatigue-engine";
import {
  broadcastFragment,
  broadcastMessageComplete,
  broadcastMessageRead,
  broadcastTypingStart,
  broadcastTypingStop,
} from "@/lib/realtime/human-delivery-broadcaster";

export type DeliveryEvent = "seen" | "typing_start" | "typing_stop" | "message";

export type ScheduledDeliveryStep = {
  type: DeliveryEvent;
  executeAt: number;
  payload?: any;
};

export type HumanDeliveryPlan = {
  steps: ScheduledDeliveryStep[];
  totalDurationMs: number;
  fragmented: boolean;
  humanDeliveryScore: number;
};

type EmotionLabel = "frustrated" | "warm" | "friendly" | "cold" | "hesitant" | "playful" | "neutral";

type RuntimeDeliveryState = {
  sessionId: string;
  requestId: string;
  startedAt: number;
  currentStep: number;
  paused: boolean;
  status: "active" | "paused" | "cancelled" | "completed";
  typingActive: boolean;
  pendingFragments: number;
  totalSteps: number;
  plan: HumanDeliveryPlan;
};

type SchedulerArgs = {
  sessionId: string;
  requestId: string;
  userMessage: string;
  fallbackReply: string;
  fragmentedReply?: FragmentedReply;
  emotion?: string;
  personality?: { typingSpeed?: number; reactionDelayStyle?: "fast" | "normal" | "slow" };
  fatigue?: ConversationFatigueState;
};

const DELIVERY_TTL_SEC = 90;
const activeTimers = new Map<string, NodeJS.Timeout[]>();
const activeStates = new Map<string, RuntimeDeliveryState>();

function normEmotion(v?: string): EmotionLabel {
  const x = String(v ?? "neutral").toLowerCase();
  if (x.includes("frustr")) return "frustrated";
  if (x.includes("warm")) return "warm";
  if (x.includes("friend")) return "friendly";
  if (x.includes("cold")) return "cold";
  if (x.includes("hesit")) return "hesitant";
  if (x.includes("play")) return "playful";
  return "neutral";
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function random01(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function jitter(base: number, seed: string, spread = 0.22): number {
  const r = random01(hashSeed(seed));
  const j = 1 + (r - 0.5) * 2 * spread;
  return Math.round(base * j);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function classifyLength(text: string): "short" | "medium" | "long" {
  const len = String(text ?? "").trim().length;
  if (len <= 60) return "short";
  if (len <= 180) return "medium";
  return "long";
}

export function computeSeenDelay(args: { userMessage: string; emotion?: string; seed: string }): number {
  const bucket = classifyLength(args.userMessage);
  let base = bucket === "short" ? 2800 : bucket === "medium" ? 5200 : 7600;
  const e = normEmotion(args.emotion);
  if (e === "hesitant") base += 900;
  if (e === "frustrated") base += 500;
  if (e === "playful") base -= 450;
  return clamp(jitter(base, `${args.seed}|seen`), 2000, 10_000);
}

export function computeTypingDelay(args: { emotion?: string; fragmentIndex: number; seed: string }): number {
  const e = normEmotion(args.emotion);
  let base = args.fragmentIndex === 0 ? 1100 : 1500;
  if (e === "hesitant") base += 900;
  if (e === "playful") base -= 350;
  if (e === "frustrated") base += 300;
  return clamp(jitter(base, `${args.seed}|typing-delay|${args.fragmentIndex}`), 700, 4200);
}

export function computeTypingDuration(args: {
  fragmentText: string;
  emotion?: string;
  difficulty?: "low" | "medium" | "high";
  fragmentCount: number;
  seed: string;
  typingSpeed?: number;
}): number {
  const len = String(args.fragmentText ?? "").trim().length;
  const e = normEmotion(args.emotion);
  let base = 500 + len * 42;
  if (args.difficulty === "high") base += 900;
  if (args.difficulty === "medium") base += 350;
  if (args.fragmentCount >= 3) base += 250;
  if (e === "frustrated") base -= 300;
  if (e === "hesitant") base += 500;
  if (e === "playful" && len < 16) base -= 180;
  const speed = typeof args.typingSpeed === "number" && Number.isFinite(args.typingSpeed) ? args.typingSpeed : 1;
  return clamp(jitter(base / clamp(speed, 0.7, 1.3), `${args.seed}|typing-duration|${len}`), 400, 6500);
}

export function simulateHumanReading(args: { userMessage: string; emotion?: string; seed: string }): number {
  return computeSeenDelay(args);
}

export function simulateHumanThinking(args: { emotion?: string; seed: string }): number {
  const e = normEmotion(args.emotion);
  let base = 900;
  if (e === "hesitant") base += 950;
  if (e === "frustrated") base += 420;
  if (e === "playful") base -= 200;
  return clamp(jitter(base, `${args.seed}|thinking`), 500, 3200);
}

export function computeFragmentDeliveryPlan(args: {
  fragments: { content: string; typingDurationMs?: number; delayMs?: number }[];
  emotion?: string;
  seed: string;
  personality?: { typingSpeed?: number; reactionDelayStyle?: "fast" | "normal" | "slow" };
  fatigue?: ConversationFatigueState;
}): ScheduledDeliveryStep[] {
  const steps: ScheduledDeliveryStep[] = [];
  let cursor = 0;
  const seenDelay = simulateHumanReading({ userMessage: args.fragments.map((f) => f.content).join(" "), emotion: args.emotion, seed: args.seed });
  cursor += seenDelay;
  steps.push({ type: "seen", executeAt: cursor });
  logStructured("[SEEN_SCHEDULED]", { seenDelayMs: seenDelay });

  let think = simulateHumanThinking({ emotion: args.emotion, seed: args.seed });
  const delayStyle = args.personality?.reactionDelayStyle ?? "normal";
  if (delayStyle === "fast") think = Math.max(450, Math.round(think * 0.78));
  if (delayStyle === "slow") think = Math.min(3200, Math.round(think * 1.22));
  cursor += think;

  for (let i = 0; i < args.fragments.length; i++) {
    const f = args.fragments[i]!;
    const td = computeTypingDelay({ emotion: args.emotion, fragmentIndex: i, seed: args.seed });
    cursor += td;
    steps.push({ type: "typing_start", executeAt: cursor, payload: { fragmentIndex: i } });

    const typeMs = clamp(
      Math.round(
        f.typingDurationMs ??
          computeTypingDuration({
            fragmentText: f.content,
            emotion: args.emotion,
            fragmentCount: args.fragments.length,
            difficulty: f.content.length > 110 ? "high" : f.content.length > 45 ? "medium" : "low",
            seed: `${args.seed}|frag-${i}`,
            typingSpeed: (args.personality?.typingSpeed ?? 1) * fatigueTypingMultiplier(args.fatigue),
          }),
      ),
      400,
      6500,
    );
    cursor += typeMs;
    steps.push({ type: "typing_stop", executeAt: cursor, payload: { fragmentIndex: i } });
    steps.push({
      type: "message",
      executeAt: cursor + 40,
      payload: { fragmentIndex: i, content: f.content },
    });

    if (i < args.fragments.length - 1) {
      const pauseBase = f.delayMs ?? (args.emotion === "frustrated" ? 2200 : 1500);
      cursor += clamp(jitter(pauseBase, `${args.seed}|pause|${i}`), 700, 5200);
    }
  }
  return steps;
}

export function buildDeliveryTimeline(args: {
  userMessage: string;
  fallbackReply: string;
  fragmentedReply?: FragmentedReply;
  emotion?: string;
  seed: string;
  personality?: { typingSpeed?: number; reactionDelayStyle?: "fast" | "normal" | "slow" };
  fatigue?: ConversationFatigueState;
}): HumanDeliveryPlan {
  const fromFragments =
    args.fragmentedReply?.fragments?.length && args.fragmentedReply.fragmented
      ? args.fragmentedReply.fragments.map((f) => ({
          content: String(f.content ?? "").trim(),
          typingDurationMs: Number(f.typingDurationMs ?? 0) || undefined,
          delayMs: Number(f.delayMs ?? 0) || undefined,
        }))
      : [{ content: String(args.fallbackReply ?? "").trim() }];

  const fragments = fromFragments.filter((x) => x.content.length > 0).slice(0, 3);
  const steps = computeFragmentDeliveryPlan({
    fragments,
    emotion: args.emotion,
    seed: args.seed,
    personality: args.personality,
    fatigue: args.fatigue,
  });
  const rawTotal = steps.length ? Math.max(...steps.map((s) => s.executeAt)) : 0;
  const totalDurationMs = clamp(rawTotal, 1000, 25_000);

  const timings = steps.map((s) => s.executeAt);
  let variance = 0;
  if (timings.length > 3) {
    const deltas = timings.slice(1).map((t, i) => t - timings[i]!);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    variance = deltas.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / deltas.length;
  }
  const varianceScore = clamp(variance / 500000, 0, 1);
  const emotionScore = normEmotion(args.emotion) === "cold" && fragments.length > 1 ? 0.4 : 0.9;
  const fragmentScore = fragments.length === 1 ? 0.65 : fragments.length === 2 ? 0.88 : 0.93;
  const humanDeliveryScore = Number(clamp(0.4 * varianceScore + 0.25 * emotionScore + 0.35 * fragmentScore, 0, 1).toFixed(3));

  logStructured("[DELIVERY_PLAN_CREATED]", {
    fragmented: fragments.length > 1,
    fragments: fragments.length,
    steps: steps.length,
    totalDurationMs,
  });
  logStructured("[HUMAN_TIMING_SCORE]", { humanDeliveryScore, varianceScore, emotionScore, fragmentScore });

  return { steps, totalDurationMs, fragmented: fragments.length > 1, humanDeliveryScore };
}

function stateKey(sessionId: string): string {
  return redisKey("delivery_state", sessionId);
}

async function saveState(state: RuntimeDeliveryState): Promise<void> {
  await redisSet(stateKey(state.sessionId), state, DELIVERY_TTL_SEC);
}

export async function cancelPendingDelivery(sessionId: string): Promise<void> {
  const timers = activeTimers.get(sessionId) ?? [];
  for (const t of timers) clearTimeout(t);
  activeTimers.delete(sessionId);

  const st = activeStates.get(sessionId);
  if (st) {
    st.status = "cancelled";
    st.typingActive = false;
    await saveState(st);
  }
  activeStates.delete(sessionId);
  await redisDel(stateKey(sessionId));
  logStructured("[DELIVERY_CANCELLED]", { session_id: sessionId });
}

export async function pauseDelivery(sessionId: string): Promise<void> {
  const st = activeStates.get(sessionId);
  if (!st) return;
  st.paused = true;
  st.status = "paused";
  await saveState(st);
}

export async function resumeDelivery(sessionId: string): Promise<void> {
  const st = activeStates.get(sessionId);
  if (!st) return;
  st.paused = false;
  st.status = "active";
  await saveState(st);
}

export async function scheduleHumanDelivery(args: SchedulerArgs): Promise<HumanDeliveryPlan> {
  await cancelPendingDelivery(args.sessionId);
  const emotion = normEmotion(args.emotion);
  const seed = `${args.sessionId}|${args.requestId}|${Date.now()}`;
  const plan = buildDeliveryTimeline({
    userMessage: args.userMessage,
    fallbackReply: args.fallbackReply,
    fragmentedReply: args.fragmentedReply,
    emotion,
    seed,
    personality: args.personality,
    fatigue: args.fatigue,
  });

  const runtime: RuntimeDeliveryState = {
    sessionId: args.sessionId,
    requestId: args.requestId,
    startedAt: Date.now(),
    currentStep: 0,
    paused: false,
    status: "active",
    typingActive: false,
    pendingFragments: plan.steps.filter((s) => s.type === "message").length,
    totalSteps: plan.steps.length,
    plan,
  };

  activeStates.set(args.sessionId, runtime);
  await saveState(runtime);

  const timers: NodeJS.Timeout[] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]!;
    const timeout = setTimeout(async () => {
      const st = activeStates.get(args.sessionId);
      if (!st || st.status === "cancelled" || st.paused) return;
      st.currentStep = i;
      let hadError = false;
      try {
        if (step.type === "typing_start") {
          st.typingActive = true;
          logStructured("[TYPING_STARTED]", { session_id: args.sessionId, step: i });
          await broadcastTypingStart({
            session_id: args.sessionId,
            message_id: args.requestId,
            fragment_index: Number(step.payload?.fragmentIndex ?? 0),
            delay_ms: step.executeAt,
            meta: { emotion, step: i },
          });
        } else if (step.type === "typing_stop") {
          st.typingActive = false;
          logStructured("[TYPING_STOPPED]", { session_id: args.sessionId, step: i });
          await broadcastTypingStop({
            session_id: args.sessionId,
            message_id: args.requestId,
            fragment_index: Number(step.payload?.fragmentIndex ?? 0),
            delay_ms: step.executeAt,
            meta: { emotion, step: i },
          });
        } else if (step.type === "seen") {
          await broadcastMessageRead({
            session_id: args.sessionId,
            message_id: args.requestId,
            delay_ms: step.executeAt,
            meta: { emotion, step: i },
          });
        } else if (step.type === "message") {
          st.pendingFragments = Math.max(0, st.pendingFragments - 1);
          logStructured("[FRAGMENT_SENT]", {
            session_id: args.sessionId,
            step: i,
            pending: st.pendingFragments,
            len: String(step.payload?.content ?? "").length,
          });
          await broadcastFragment({
            session_id: args.sessionId,
            message_id: args.requestId,
            fragment_index: Number(step.payload?.fragmentIndex ?? 0),
            fragment: String(step.payload?.content ?? ""),
            delay_ms: step.executeAt,
            meta: { emotion, step: i, pending: st.pendingFragments },
          });
        }

        if (i === plan.steps.length - 1) {
          st.status = "completed";
          st.typingActive = false;
          await broadcastMessageComplete({
            session_id: args.sessionId,
            message_id: args.requestId,
            delay_ms: plan.totalDurationMs,
            meta: {
              emotion,
              fragmented: plan.fragmented,
              totalDurationMs: plan.totalDurationMs,
              humanDeliveryScore: plan.humanDeliveryScore,
            },
          });
          await saveState(st);
          logStructured("[DELIVERY_COMPLETED]", { session_id: args.sessionId, request_id: args.requestId });
        } else {
          await saveState(st);
        }
      } catch (e) {
        hadError = true;
        logStructured("[REALTIME_DELIVERY_ERROR]", {
          session_id: args.sessionId,
          request_id: args.requestId,
          step: i,
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        // Watchdog: ensure typing indicator never stays stuck on UI.
        if (hadError && st.typingActive) {
          st.typingActive = false;
          try {
            await broadcastTypingStop({
              session_id: args.sessionId,
              message_id: args.requestId,
              delay_ms: step.executeAt,
              meta: { emotion, step: i, watchdog: true },
            });
          } catch {
            /* ignore */
          }
        }
      }
    }, step.executeAt);
    timers.push(timeout);
  }
  activeTimers.set(args.sessionId, timers);
  return plan;
}

export async function getDeliveryState(sessionId: string): Promise<RuntimeDeliveryState | null> {
  const inMem = activeStates.get(sessionId);
  if (inMem) return inMem;
  return redisGet<RuntimeDeliveryState>(stateKey(sessionId));
}

