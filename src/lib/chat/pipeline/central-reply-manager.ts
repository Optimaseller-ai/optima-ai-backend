import { randomUUID } from "crypto";

export type ReplySource =
  | "openrouter"
  | "fallback"
  | "hold_sanitize"
  | "quick_reply"
  | "social_candidate";

export type OwnedReply = {
  reply: string;
  source: ReplySource;
  requestId: string;
  createdAt: number;
  userMessage: string;
};

export type ReplyTurnContext = {
  sessionId: string;
  requestId: string;
  userMessage: string;
  startedAt: number;
};

type ActiveTurn = {
  requestId: string;
  userMessage: string;
  startedAt: number;
};

/** Verrou global par session — une seule génération active. */
const activeReplyMap = new Map<string, ActiveTurn>();

const SOURCE_PRIORITY: Record<ReplySource, number> = {
  openrouter: 100,
  fallback: 70,
  hold_sanitize: 65,
  quick_reply: 25,
  social_candidate: 10,
};

export function beginReplyTurn(sessionId: string, userMessage: string, requestId?: string): ReplyTurnContext {
  const sid = String(sessionId ?? "").trim() || "anonymous";
  const turn: ReplyTurnContext = {
    sessionId: sid,
    requestId: requestId?.trim() || randomUUID(),
    userMessage: String(userMessage ?? "").trim(),
    startedAt: Date.now(),
  };
  activeReplyMap.set(sid, {
    requestId: turn.requestId,
    userMessage: turn.userMessage,
    startedAt: turn.startedAt,
  });
  return turn;
}

export function getActiveReplyTurn(sessionId: string): ActiveTurn | null {
  return activeReplyMap.get(String(sessionId ?? "").trim()) ?? null;
}

/** True si ce tour est encore le propriétaire actif de la session. */
export function isActiveReplyTurn(turn: ReplyTurnContext | undefined | null): boolean {
  if (!turn?.sessionId || !turn.requestId) return false;
  const active = activeReplyMap.get(turn.sessionId);
  if (!active) return false;
  return active.requestId === turn.requestId;
}

/** Invalide les réponses dont le message utilisateur ne correspond plus au tour actif. */
export function isReplyContextFresh(turn: ReplyTurnContext, lastUserMessage?: string): boolean {
  if (!isActiveReplyTurn(turn)) return false;
  const current = String(lastUserMessage ?? turn.userMessage).trim();
  const active = activeReplyMap.get(turn.sessionId);
  if (!active) return false;
  return active.userMessage === current;
}

/**
 * Avant tout envoi final : null si tour périmé (quick reply async, social stale, etc.).
 */
export function assertReplyOwnership<T>(
  turn: ReplyTurnContext | undefined | null,
  value: T,
  opts?: { lastUserMessage?: string },
): T | null {
  if (!turn) return value;
  if (!isReplyContextFresh(turn, opts?.lastUserMessage)) return null;
  return value;
}

export function releaseReplyTurn(sessionId: string, requestId: string): void {
  const sid = String(sessionId ?? "").trim();
  const active = activeReplyMap.get(sid);
  if (active?.requestId === requestId) {
    activeReplyMap.delete(sid);
  }
}

export class CentralReplyOrchestrator {
  private readonly turn: ReplyTurnContext;
  private candidates: OwnedReply[] = [];
  private mainReplyGenerated = false;
  cancelQuickReply = false;

  constructor(turn: ReplyTurnContext) {
    this.turn = turn;
  }

  get context(): ReplyTurnContext {
    return this.turn;
  }

  get hasMainReply(): boolean {
    return this.mainReplyGenerated;
  }

  /** Pipeline business (OpenRouter) prioritaire sur quick/social. */
  markMainPipelineStarted(): void {
    this.mainReplyGenerated = true;
    this.cancelQuickReply = true;
  }

  submitCandidate(args: {
    reply: string;
    source: ReplySource;
    lastUserMessage?: string;
  }): boolean {
    const text = String(args.reply ?? "").trim();
    if (!text) return false;
    if (!isReplyContextFresh(this.turn, args.lastUserMessage)) return false;

    if (args.source === "openrouter" || args.source === "fallback" || args.source === "hold_sanitize") {
      this.mainReplyGenerated = true;
      this.cancelQuickReply = true;
    }

    if (this.cancelQuickReply && (args.source === "quick_reply" || args.source === "social_candidate")) {
      return false;
    }

    this.candidates.push({
      reply: text,
      source: args.source,
      requestId: this.turn.requestId,
      createdAt: Date.now(),
      userMessage: String(args.lastUserMessage ?? this.turn.userMessage).trim(),
    });
    return true;
  }

  selectFinalReply(): OwnedReply | null {
    if (!isActiveReplyTurn(this.turn)) return null;

    const fresh = this.candidates.filter((c) => c.userMessage === this.turn.userMessage);
    if (!fresh.length) return null;

    fresh.sort((a, b) => {
      const pa = SOURCE_PRIORITY[a.source] ?? 0;
      const pb = SOURCE_PRIORITY[b.source] ?? 0;
      if (pb !== pa) return pb - pa;
      return b.createdAt - a.createdAt;
    });

    return fresh[0] ?? null;
  }

  finalize(fallback?: string): OwnedReply | null {
    const selected = this.selectFinalReply();
    if (selected) return selected;

    const fb = String(fallback ?? "").trim();
    if (!fb || !isReplyContextFresh(this.turn)) return null;

    return {
      reply: fb,
      source: "fallback",
      requestId: this.turn.requestId,
      createdAt: Date.now(),
      userMessage: this.turn.userMessage,
    };
  }
}

export function createCentralReplyOrchestrator(turn: ReplyTurnContext): CentralReplyOrchestrator {
  return new CentralReplyOrchestrator(turn);
}

/** Message mixte hésitation + question business → jamais quick/social seul. */
export function messageRequiresMainReplyPipeline(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return false;
  if (
    /\b(tu\s+es\s+s[uû]r|vous\s+êtes\s+s[uû]r|c'?est\s+s[uû]r|c'?est\s+certain|stock|dispo|disponible|arrivé|arrive|en\s+stock|combien|prix|commander|livraison)\b/i.test(
      m,
    )
  ) {
    return true;
  }
  return false;
}
