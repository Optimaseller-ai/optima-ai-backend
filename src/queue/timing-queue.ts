/**
 * Human timing queue — read / typing / follow-up / scheduled reply.
 * Phase 1 : enregistrement Redis + log (workers BullMQ / cron en phase 2).
 */

import { getRedis, redisKey } from "../redis/client.js";

export type TimingJobKind = "read_delay" | "typing_delay" | "follow_up_delay" | "scheduled_reply";

export type TimingJob = {
  id: string;
  kind: TimingJobKind;
  sessionId: string;
  requestId: string;
  delayMs: number;
  runAt: number;
  status: "pending" | "done" | "cancelled";
};

const memoryJobs: TimingJob[] = [];

export async function scheduleTimingJob(args: {
  kind: TimingJobKind;
  sessionId: string;
  requestId: string;
  delayMs: number;
}): Promise<TimingJob> {
  const job: TimingJob = {
    id: `${args.sessionId}:${args.requestId}:${args.kind}:${Date.now()}`,
    kind: args.kind,
    sessionId: args.sessionId,
    requestId: args.requestId,
    delayMs: args.delayMs,
    runAt: Date.now() + args.delayMs,
    status: "pending",
  };

  const r = getRedis();
  const key = redisKey("timing", args.sessionId, args.requestId);

  if (r) {
    await r.zadd(redisKey("timing_queue"), {
      score: job.runAt,
      member: JSON.stringify(job),
    });
    await r.set(`${key}:${args.kind}`, JSON.stringify(job), { ex: Math.ceil(args.delayMs / 1000) + 60 });
  } else {
    memoryJobs.push(job);
  }

  console.log("[OPTIMA_AI_BACKEND] timing_scheduled", {
    kind: args.kind,
    sessionId: args.sessionId,
    delayMs: args.delayMs,
  });

  return job;
}

export async function listPendingTimingJobs(sessionId: string): Promise<TimingJob[]> {
  const r = getRedis();
  if (!r) {
    return memoryJobs.filter((j) => j.sessionId === sessionId && j.status === "pending");
  }

  const now = Date.now();
  const raw = await r.zrange(redisKey("timing_queue"), 0, now, { byScore: true });
  const jobs: TimingJob[] = [];
  for (const item of raw) {
    try {
      const parsed = JSON.parse(String(item)) as TimingJob;
      if (parsed.sessionId === sessionId) jobs.push(parsed);
    } catch {
      /* skip */
    }
  }
  return jobs;
}
