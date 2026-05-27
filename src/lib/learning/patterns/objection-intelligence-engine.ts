import type { LearningMemory, ObjectionPattern, ScoredPhrase } from "../memory/learning-memory-types";

export type ObjectionKind = ObjectionPattern["kind"];

const OBJECTION_RULES: { kind: ObjectionKind; re: RegExp }[] = [
  { kind: "price", re: /\b(cher|prix|tarif|budget|trop\s+cher|expensive|cost)\b/i },
  { kind: "trust", re: /\b(confiance|arnaque|scam|fiable|sérieux|trust)\b/i },
  { kind: "delivery", re: /\b(livraison|delivery|expédition|shipping|délai\s+livraison)\b/i },
  { kind: "quality", re: /\b(qualité|quality|défaut|cassé|original)\b/i },
  { kind: "delay", re: /\b(attendre|délai|trop\s+long|when|quand)\b/i },
];

export function detectObjectionKind(message: string): ObjectionKind {
  const t = String(message ?? "");
  for (const r of OBJECTION_RULES) {
    if (r.re.test(t)) return r.kind;
  }
  return "other";
}

function bumpReply(list: ScoredPhrase[], reply: string, reassured: boolean, at: string): ScoredPhrase[] {
  const phrase = String(reply ?? "").trim().slice(0, 120);
  if (phrase.length < 10) return list;
  const idx = list.findIndex((x) => x.phrase === phrase);
  const delta = reassured ? 1 : 0;
  if (idx >= 0) {
    const cur = list[idx]!;
    const samples = cur.samples + 1;
    const score = (cur.score * cur.samples + delta * 100) / samples;
    const next = [...list];
    next[idx] = { phrase, score: Math.round(score), samples, lastSeen: at };
    return next.sort((a, b) => b.score - a.score).slice(0, 8);
  }
  return [{ phrase, score: reassured ? 85 : 30, samples: 1, lastSeen: at }, ...list].slice(0, 8);
}

export type ObjectionObservation = {
  userMessage: string;
  assistantReply: string;
  at: string;
  /** Prospect a continué positivement après la réponse */
  reassured?: boolean;
};

export function applyObjectionObservations(
  memory: LearningMemory,
  observations: ObjectionObservation[],
): LearningMemory {
  const patterns = new Map<ObjectionKind, ObjectionPattern>();
  for (const p of memory.objectionPatterns) {
    patterns.set(p.kind, { ...p, reassuringReplies: [...p.reassuringReplies] });
  }

  for (const o of observations) {
    const kind = detectObjectionKind(o.userMessage);
    const cur = patterns.get(kind) ?? {
      kind,
      frequency: 0,
      reassuringReplies: [],
    };
    cur.frequency += 1;
    cur.reassuringReplies = bumpReply(
      cur.reassuringReplies,
      o.assistantReply,
      o.reassured === true,
      o.at,
    );
    patterns.set(kind, cur);
  }

  return {
    ...memory,
    objectionPatterns: [...patterns.values()].sort((a, b) => b.frequency - a.frequency),
    updatedAt: new Date().toISOString(),
  };
}
