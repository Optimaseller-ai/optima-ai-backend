import { randomUUID } from "crypto";

export type HumanMemoryCategory =
  | "identity"
  | "product_interest"
  | "complaint"
  | "emotion"
  | "relationship"
  | "purchase"
  | "preference"
  | "urgency"
  | "humor"
  | "context";

export type HumanMemory = {
  id: string;
  category: HumanMemoryCategory;
  content: string;
  importanceScore: number;
  emotionalWeight: number;
  createdAt: number;
  updatedAt: number;
  lastReferencedAt: number;
  expiresAt?: number;
  sourceMessage?: string;
  reusable: boolean;
};

export type EmotionalContinuityState = {
  mood: "neutral" | "frustrated" | "enthusiastic" | "angry" | "hesitant" | "humorous";
  frustration01: number;
  trust01: number;
  warmth01: number;
  updatedAt: number;
};

export type HumanMemoryState = {
  memories: HumanMemory[];
  emotionalState: EmotionalContinuityState;
  relationship: {
    familiarity01: number;
    trust01: number;
    turnsTogether: number;
  };
  updatedAt: number;
};

const LOW_VALUE_RE = /^(ok|oui|non|merci|salut|bonjour|bonsoir|d['’]?accord|ca marche|ça marche)$/i;

function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function now(): number {
  return Date.now();
}

export function rankMemoryImportance(input: { category: HumanMemoryCategory; content: string }): {
  importanceScore: number;
  emotionalWeight: number;
  reusable: boolean;
  expiresAt?: number;
} {
  const c = norm(input.content);
  if (!c || LOW_VALUE_RE.test(c)) {
    return { importanceScore: 0.05, emotionalWeight: 0, reusable: false, expiresAt: now() + 24 * 3600 * 1000 };
  }
  let importanceScore = 0.35;
  let emotionalWeight = 0.15;
  let reusable = true;
  let expiresAt: number | undefined;
  if (input.category === "identity") importanceScore = 0.95;
  if (input.category === "complaint") {
    importanceScore = 0.9;
    emotionalWeight = 0.8;
  }
  if (input.category === "emotion") {
    importanceScore = 0.85;
    emotionalWeight = 0.95;
  }
  if (input.category === "product_interest" || input.category === "purchase") importanceScore = 0.82;
  if (input.category === "urgency") importanceScore = 0.8;
  if (input.category === "humor") {
    importanceScore = 0.45;
    emotionalWeight = 0.4;
    expiresAt = now() + 14 * 24 * 3600 * 1000;
  }
  if (input.category === "context" || input.category === "relationship") {
    importanceScore = 0.4;
    expiresAt = now() + 7 * 24 * 3600 * 1000;
  }
  return { importanceScore, emotionalWeight, reusable, expiresAt };
}

export function extractHumanMemories(args: {
  userMessage: string;
  assistantReply?: string;
}): HumanMemory[] {
  const out: HumanMemory[] = [];
  const m = String(args.userMessage ?? "").trim();
  const n = norm(m);
  if (!n) return out;

  const push = (category: HumanMemoryCategory, content: string) => {
    const scored = rankMemoryImportance({ category, content });
    out.push({
      id: randomUUID(),
      category,
      content: content.trim().slice(0, 220),
      importanceScore: scored.importanceScore,
      emotionalWeight: scored.emotionalWeight,
      createdAt: now(),
      updatedAt: now(),
      lastReferencedAt: now(),
      expiresAt: scored.expiresAt,
      sourceMessage: m.slice(0, 220),
      reusable: scored.reusable,
    });
  };

  const name = m.match(/\bje\s+m['’]appelle\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]{1,30})\b/i)?.[1];
  if (name) push("identity", `Prospect name: ${name.trim().split(/\s+/).slice(0, 2).join(" ")}`);

  const city = m.match(/\b(j'habite|je vis)\s+[àa]\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]{1,30})\b/i)?.[2];
  if (city) push("identity", `City: ${city.trim()}`);

  const product = m.match(/\b(oraimo|freepods|iphone|samsung|tecno|infinix|airpods|ecouteurs?|casque|montre)\b/i)?.[1];
  if (product) push("product_interest", `Interested in ${product}`);

  if (/\b(batterie|autonomie|marche\s+pas|panne|coupe|defaut|d[eé]faut|probleme|probl[eè]me)\b/i.test(n)) {
    push("complaint", m);
  }
  if (/\b(frustr|fatigu|de[çc]u|enerve|col[eè]re|marre)\b/i.test(n)) push("emotion", "Frustration detected");
  if (/\b(super|g[eé]nial|top|parfait|content)\b/i.test(n)) push("emotion", "Positive enthusiasm detected");
  if (/\b(haha|mdr|lol|😂|🤣)\b/i.test(m)) push("humor", "Humor style active");
  if (/\b(urgent|vite|rapidement|aujourd'hui|maintenant)\b/i.test(n)) push("urgency", "Urgency signal");
  if (/\b(budget|pas trop cher|cher|prix)\b/i.test(n)) push("preference", m);
  if (/\b(hesite|j'hesite|je compare|entre deux)\b/i.test(n)) push("purchase", "Hesitation before purchase");

  return out;
}

export function emotionalContinuityEngine(args: {
  previous?: EmotionalContinuityState;
  userMessage: string;
}): EmotionalContinuityState {
  const prev = args.previous ?? {
    mood: "neutral",
    frustration01: 0.2,
    trust01: 0.4,
    warmth01: 0.4,
    updatedAt: now(),
  };
  const n = norm(args.userMessage);
  let frustration01 = Math.max(0, Math.min(1, prev.frustration01 * 0.88));
  let trust01 = Math.max(0, Math.min(1, prev.trust01 * 0.95));
  let warmth01 = Math.max(0, Math.min(1, prev.warmth01 * 0.95));
  let mood: EmotionalContinuityState["mood"] = prev.mood;

  if (/\b(frustr|de[çc]u|marche\s+pas|panne|col[eè]re|enerve|fatigu)\b/i.test(n)) {
    frustration01 = Math.max(frustration01, 0.7);
    trust01 = Math.max(0, trust01 - 0.12);
    mood = /col[eè]re|enerve/.test(n) ? "angry" : "frustrated";
  } else if (/\b(super|g[eé]nial|parfait|top|merci)\b/i.test(n)) {
    frustration01 = Math.max(0, frustration01 - 0.15);
    trust01 = Math.min(1, trust01 + 0.1);
    warmth01 = Math.min(1, warmth01 + 0.1);
    mood = "enthusiastic";
  } else if (/\b(hesite|doute|pas sur)\b/i.test(n)) {
    mood = "hesitant";
  } else if (/\b(haha|mdr|lol|😂|🤣)\b/i.test(n)) {
    mood = "humorous";
  } else if (frustration01 > 0.5) {
    mood = "frustrated";
  } else {
    mood = "neutral";
  }

  return { mood, frustration01, trust01, warmth01, updatedAt: now() };
}

function dedupeMemories(memories: HumanMemory[]): HumanMemory[] {
  const seen = new Map<string, HumanMemory>();
  for (const m of memories) {
    const k = `${m.category}:${norm(m.content)}`;
    const prev = seen.get(k);
    if (!prev) {
      seen.set(k, m);
      continue;
    }
    if (m.importanceScore >= prev.importanceScore) {
      seen.set(k, { ...prev, ...m, createdAt: prev.createdAt, updatedAt: now() });
    }
  }
  return Array.from(seen.values());
}

export function cleanupOldMemories(memories: HumanMemory[]): HumanMemory[] {
  const ts = now();
  return memories
    .filter((m) => !m.expiresAt || m.expiresAt > ts)
    .filter((m) => m.importanceScore >= 0.15)
    .sort((a, b) => b.importanceScore - a.importanceScore || b.updatedAt - a.updatedAt)
    .slice(0, 60);
}

export function updateHumanMemory(args: {
  previous?: HumanMemoryState;
  userMessage: string;
  assistantReply?: string;
  turnsTogether?: number;
}): HumanMemoryState {
  const previous = args.previous ?? {
    memories: [],
    emotionalState: {
      mood: "neutral",
      frustration01: 0.2,
      trust01: 0.4,
      warmth01: 0.4,
      updatedAt: now(),
    },
    relationship: { familiarity01: 0.2, trust01: 0.4, turnsTogether: 0 },
    updatedAt: now(),
  };
  const extracted = extractHumanMemories({ userMessage: args.userMessage, assistantReply: args.assistantReply });
  const merged = dedupeMemories([...previous.memories, ...extracted]).map((m) => ({ ...m, updatedAt: now() }));
  const emotionalState = emotionalContinuityEngine({
    previous: previous.emotionalState,
    userMessage: args.userMessage,
  });
  const turns = Math.max(previous.relationship.turnsTogether + 1, args.turnsTogether ?? 0);
  const familiarity01 = Math.min(1, previous.relationship.familiarity01 + (turns > 50 ? 0.02 : 0.008));
  const trust01 = Math.max(0, Math.min(1, (previous.relationship.trust01 * 0.9 + emotionalState.trust01 * 0.1)));
  return {
    memories: cleanupOldMemories(merged),
    emotionalState,
    relationship: { familiarity01, trust01, turnsTogether: turns },
    updatedAt: now(),
  };
}

export function buildHumanContext(args: {
  memoryState?: HumanMemoryState;
  maxItems?: number;
}): string[] {
  const state = args.memoryState;
  if (!state) return [];
  const maxItems = Math.max(1, args.maxItems ?? 5);
  const picked = [...state.memories]
    .sort((a, b) => b.importanceScore + b.emotionalWeight - (a.importanceScore + a.emotionalWeight))
    .slice(0, maxItems)
    .map((m) => m.content);
  const emotion = `Emotional continuity: mood=${state.emotionalState.mood}, frustration=${state.emotionalState.frustration01.toFixed(
    2,
  )}, trust=${state.emotionalState.trust01.toFixed(2)}`;
  return [emotion, ...picked].slice(0, maxItems + 1);
}

