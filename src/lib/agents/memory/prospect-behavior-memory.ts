import type { SellerBehaviorConversationState } from "./conversation-state";

export type ProspectBehaviorMemory = {
  politenessLevel01: number;
  addressing: "tu" | "vous";
  energy01: number;
  humor01: number;
  coldness01: number;
  aggressivity01: number;
  patience01: number;
  avgUserMsgLen: number;
  emojiFreq01: number;
  lastUpdatedAt: number;
};

export type EmotionalFlowMemory = {
  frustration01: number;
  curiosity01: number;
  interest01: number;
  fatigue01: number;
  hesitation01: number;
  impatience01: number;
  saturation01: number;
  highTrustMode: boolean;
  lastUpdatedAt: number;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function countEmoji(text: string) {
  return (String(text ?? "").match(/[\p{Extended_Pictographic}]/gu) ?? []).length;
}

function detectAddressing(text: string): "tu" | "vous" {
  const t = String(text ?? "").toLowerCase();
  if (/\btu\b|\bt['’]es\b|\btoi\b/.test(t)) return "tu";
  if (/\bvous\b|\bvotre\b|\bmonsieur\b|\bmadame\b/.test(t)) return "vous";
  return "vous";
}

function politenessScore(text: string) {
  const t = String(text ?? "").toLowerCase();
  let s = 0.4;
  if (/\bbonjour\b|\bbonsoir\b/.test(t)) s += 0.1;
  if (/\bmerci\b/.test(t)) s += 0.2;
  if (/\bsvp\b|\bs'il vous plait\b|\bs’il vous plaît\b/.test(t)) s += 0.2;
  return clamp01(s);
}

function humorScore(text: string) {
  const t = String(text ?? "");
  let s = 0;
  if (/😂|🤣|😄|😅|😉|😏|🤭/.test(t)) s += 0.5;
  if (/\bmdr\b|\blol\b|\bptdr\b/i.test(t)) s += 0.4;
  return clamp01(s);
}

function aggressionScore(text: string) {
  const t = String(text ?? "").toLowerCase();
  let s = 0;
  if (/\b(nul|arnaque|mensonge|ridicule|c'est mort|c’est mort)\b/.test(t)) s += 0.5;
  if (/!{2,}/.test(t)) s += 0.2;
  if (/\b(pfff|mdr)\b/.test(t) && /\b(vraiment|sérieux|serieux)\b/.test(t)) s += 0.2;
  return clamp01(s);
}

function coldnessScore(text: string) {
  const t = String(text ?? "").trim();
  let s = 0;
  if (t.length <= 4) s += 0.5;
  if (/^(ok|oui|non|bon|hmm+|hm+|hum+|d'accord|dac)$/i.test(t.toLowerCase())) s += 0.35;
  return clamp01(s);
}

function curiosityScore(text: string) {
  const t = String(text ?? "").toLowerCase();
  let s = 0;
  if (/\?/.test(t)) s += 0.4;
  if (/\b(pourquoi|comment|c'est quoi|c’est quoi|tu fais quoi)\b/.test(t)) s += 0.4;
  return clamp01(s);
}

export function updateProspectBehaviorState(input: {
  previous?: SellerBehaviorConversationState;
  userMessage: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): {
  prospect_behavior: ProspectBehaviorMemory;
  emotional_flow: EmotionalFlowMemory;
  ai_pressure_score: number;
} {
  const prev = (input.previous ?? {}) as any;
  const prevPb = (prev.prospect_behavior ?? null) as ProspectBehaviorMemory | null;
  const prevEf = (prev.emotional_flow ?? null) as EmotionalFlowMemory | null;
  const prevPressure = clamp01(Number(prev.ai_pressure_score ?? 0));

  const msg = String(input.userMessage ?? "");
  const addressing = detectAddressing(msg);
  const pol = politenessScore(msg);
  const humor = humorScore(msg);
  const aggr = aggressionScore(msg);
  const cold = coldnessScore(msg);
  const cur = curiosityScore(msg);
  const emojiCount = countEmoji(msg);

  const userTurns = (input.history ?? []).filter((h) => h.role === "user").slice(-8);
  const avgLen =
    userTurns.length > 0 ? Math.round(userTurns.reduce((a, b) => a + (b.content?.length ?? 0), 0) / userTurns.length) : msg.length;
  const emojiFreq01 = clamp01(emojiCount >= 1 ? 0.7 : 0.1);

  // Saturation: lots of short replies + low engagement.
  const shortCount = userTurns.filter((t) => String(t.content ?? "").trim().length <= 6).length;
  const saturation01 = clamp01(shortCount >= 3 ? 0.75 : shortCount >= 2 ? 0.55 : 0.2);

  const fatigue01 = clamp01(Number(prevEf?.fatigue01 ?? 0) * 0.85 + saturation01 * 0.25);
  const impatience01 = clamp01(saturation01 * 0.6 + aggr * 0.4);
  const frustration01 = clamp01(aggr * 0.6 + (prevEf?.frustration01 ?? 0) * 0.6);
  const hesitation01 = clamp01(cold * 0.35 + (msg.includes("...") ? 0.2 : 0));
  const interest01 = clamp01(0.25 + (cur * 0.35) + (humor * 0.15));

  const highTrustMode = clamp01(interest01 * 0.6 + (1 - saturation01) * 0.4) > 0.62;

  const nextPb: ProspectBehaviorMemory = {
    politenessLevel01: clamp01((prevPb?.politenessLevel01 ?? 0.5) * 0.7 + pol * 0.3),
    addressing: addressing === "tu" ? "tu" : (prevPb?.addressing ?? "vous"),
    energy01: clamp01(0.5 + humor * 0.2 - cold * 0.2),
    humor01: clamp01((prevPb?.humor01 ?? 0) * 0.6 + humor * 0.4),
    coldness01: clamp01((prevPb?.coldness01 ?? 0) * 0.6 + cold * 0.4),
    aggressivity01: clamp01((prevPb?.aggressivity01 ?? 0) * 0.6 + aggr * 0.4),
    patience01: clamp01(1 - saturation01),
    avgUserMsgLen: Math.max(1, Math.round((prevPb?.avgUserMsgLen ?? avgLen) * 0.7 + avgLen * 0.3)),
    emojiFreq01: clamp01((prevPb?.emojiFreq01 ?? 0) * 0.6 + emojiFreq01 * 0.4),
    lastUpdatedAt: Date.now(),
  };

  const nextEf: EmotionalFlowMemory = {
    frustration01,
    curiosity01: clamp01((prevEf?.curiosity01 ?? 0) * 0.6 + cur * 0.4),
    interest01,
    fatigue01,
    hesitation01,
    impatience01,
    saturation01,
    highTrustMode,
    lastUpdatedAt: Date.now(),
  };

  // Pressure score: rises if we previously pushed too much AND user now shows coldness/saturation.
  const nextPressure = clamp01(prevPressure * 0.85 + saturation01 * 0.25 + cold * 0.15);

  return {
    prospect_behavior: nextPb,
    emotional_flow: nextEf,
    ai_pressure_score: nextPressure,
  };
}

