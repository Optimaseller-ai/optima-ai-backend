import type { OrchestratorActionKind, TimelineEvent, TimelineEventKind } from "../types";

export function appendTimelineEvent(
  timeline: TimelineEvent[],
  kind: TimelineEventKind,
  label: string,
  meta?: Record<string, string | number | boolean>,
): TimelineEvent[] {
  const event: TimelineEvent = {
    at: new Date().toISOString(),
    kind,
    label,
    meta,
  };
  return [...timeline.slice(-24), event];
}

export function buildTurnTimeline(args: {
  action: OrchestratorActionKind;
  followupAt?: string | null;
  workflowTrigger?: string | null;
  silencePauseMs?: number;
}): TimelineEvent[] {
  const now = new Date();
  const events: TimelineEvent[] = [];

  const t0 = now.toISOString();
  events.push({ at: t0, kind: "seen", label: "Message prospect vu" });

  if (args.silencePauseMs && args.silencePauseMs > 0) {
    const tPause = new Date(now.getTime() + Math.min(args.silencePauseMs, 8000)).toISOString();
    events.push({ at: tPause, kind: "silence", label: "Pause humaine avant réponse" });
  }

  const tType = new Date(now.getTime() + (args.silencePauseMs ?? 800)).toISOString();
  events.push({ at: tType, kind: "typing", label: "Frappe en cours" });

  if (args.action !== "hold_silence") {
    const tReply = new Date(now.getTime() + (args.silencePauseMs ?? 1200) + 1400).toISOString();
    events.push({ at: tReply, kind: "reply", label: "Réponse agent" });
  }

  if (args.followupAt) {
    events.push({
      at: args.followupAt,
      kind: "followup_scheduled",
      label: "Relance programmée",
    });
  }

  if (args.workflowTrigger) {
    events.push({
      at: new Date(now.getTime() + 5000).toISOString(),
      kind: "workflow",
      label: `Workflow ${args.workflowTrigger}`,
    });
  }

  return events;
}
