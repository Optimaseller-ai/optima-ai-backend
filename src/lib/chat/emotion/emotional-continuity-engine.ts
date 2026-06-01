export type PersistentEmotionLabel =
  | "neutral"
  | "warm"
  | "friendly"
  | "excited"
  | "hesitant"
  | "frustrated"
  | "annoyed"
  | "angry"
  | "confused"
  | "playful"
  | "cold"
  | "trusting";

export type PersistentEmotionState = {
  label: PersistentEmotionLabel;
  score: number;
  lastDetectedAt: number;
  decayRate: "very_slow" | "slow" | "medium" | "fast";
  confidence: number;
  sourceMessage: string;
  minPersistTurns: number;
};

export type RelationshipState = {
  trustScore: number;
  warmthScore: number;
  frustrationScore: number;
  resistanceScore: number;
  engagementScore: number;
  humorCompatibility: number;
  buyerConfidence: number;
  emotionalMomentum: string;
  relationshipStage: string;
  updatedAt: number;
};

export type EmotionalContinuitySnapshot = {
  active: PersistentEmotionState;
  states: PersistentEmotionState[];
  relationship: RelationshipState;
  turnCount: number;
  updatedAt: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectProspectEmotion(message: string): {
  label: PersistentEmotionLabel;
  score: number;
  confidence: number;
  sourceMessage: string;
} {
  const m = norm(message);
  const src = String(message ?? "").slice(0, 220);
  if (!m) return { label: "neutral", score: 0.3, confidence: 0.4, sourceMessage: src };

  if (/\b(ça marche pas|ca marche pas|toujours le meme probleme|franchement|de[çc]u|fatigu[eé]|marre|panne)\b/i.test(m)) {
    return { label: "frustrated", score: 0.82, confidence: 0.88, sourceMessage: src };
  }
  if (/\b(col[eè]re|[ée]nerv[eé]|insupportable)\b/i.test(m)) {
    return { label: "angry", score: 0.9, confidence: 0.9, sourceMessage: src };
  }
  if (/\b(peut-etre|peut être|je vais voir|je reflechis|je réfléchis|je sais pas|j'hesite)\b/i.test(m)) {
    return { label: "hesitant", score: 0.64, confidence: 0.8, sourceMessage: src };
  }
  if (/\b(haha|mdr|lol|😂|🤣)\b/i.test(message)) {
    return { label: "playful", score: 0.62, confidence: 0.78, sourceMessage: src };
  }
  if (/\b(super|g[eé]nial|parfait|top|merci beaucoup)\b/i.test(m)) {
    return { label: "warm", score: 0.7, confidence: 0.76, sourceMessage: src };
  }
  if (m.length <= 4 || /^(ok|oui|non|d['’]?accord)$/.test(m)) {
    return { label: "cold", score: 0.6, confidence: 0.72, sourceMessage: src };
  }
  return { label: "neutral", score: 0.45, confidence: 0.55, sourceMessage: src };
}

export function computeFrustrationDecay(args: {
  currentFrustration: number;
  decayRate: PersistentEmotionState["decayRate"];
  turnsElapsed: number;
}): number {
  const mul = args.decayRate === "very_slow" ? 0.97 : args.decayRate === "slow" ? 0.93 : args.decayRate === "medium" ? 0.87 : 0.78;
  let out = clamp01(args.currentFrustration);
  for (let i = 0; i < Math.max(0, args.turnsElapsed); i++) out = clamp01(out * mul);
  return out;
}

export function computeTrustLevel(args: {
  previousTrust: number;
  emotion: PersistentEmotionLabel;
  confidence: number;
  turnCount: number;
}): number {
  let t = clamp01(args.previousTrust);
  if (args.emotion === "warm" || args.emotion === "friendly" || args.emotion === "trusting" || args.emotion === "playful") t += 0.08 * args.confidence;
  if (args.emotion === "frustrated" || args.emotion === "annoyed" || args.emotion === "angry") t -= 0.1 * args.confidence;
  if (args.turnCount > 20) t += 0.03;
  return clamp01(t);
}

export function computeConversationWarmth(args: {
  previousWarmth: number;
  emotion: PersistentEmotionLabel;
  confidence: number;
}): number {
  let w = clamp01(args.previousWarmth * 0.96);
  if (args.emotion === "warm" || args.emotion === "friendly" || args.emotion === "playful") w += 0.1 * args.confidence;
  if (args.emotion === "cold" || args.emotion === "angry") w -= 0.08 * args.confidence;
  return clamp01(w);
}

export function computeRelationshipState(args: {
  previous?: RelationshipState;
  detectedEmotion: PersistentEmotionLabel;
  detectedScore: number;
  confidence: number;
  turnCount: number;
}): RelationshipState {
  const prev =
    args.previous ??
    {
      trustScore: 0.4,
      warmthScore: 0.4,
      frustrationScore: 0.25,
      resistanceScore: 0.35,
      engagementScore: 0.45,
      humorCompatibility: 0.35,
      buyerConfidence: 0.35,
      emotionalMomentum: "stable",
      relationshipStage: "new_contact",
      updatedAt: Date.now(),
    };

  const trustScore = computeTrustLevel({
    previousTrust: prev.trustScore,
    emotion: args.detectedEmotion,
    confidence: args.confidence,
    turnCount: args.turnCount,
  });
  const warmthScore = computeConversationWarmth({
    previousWarmth: prev.warmthScore,
    emotion: args.detectedEmotion,
    confidence: args.confidence,
  });
  const frustrationScore = clamp01(
    args.detectedEmotion === "frustrated" || args.detectedEmotion === "angry" || args.detectedEmotion === "annoyed"
      ? Math.max(prev.frustrationScore, args.detectedScore)
      : prev.frustrationScore * 0.9,
  );
  const resistanceScore = clamp01(prev.resistanceScore * 0.9 + (args.detectedEmotion === "hesitant" || args.detectedEmotion === "cold" ? 0.12 : 0.02));
  const engagementScore = clamp01(prev.engagementScore * 0.92 + (args.detectedEmotion === "cold" ? 0.02 : 0.08));
  const humorCompatibility = clamp01(prev.humorCompatibility * 0.93 + (args.detectedEmotion === "playful" ? 0.12 : 0.02));
  const buyerConfidence = clamp01(prev.buyerConfidence * 0.9 + (args.detectedEmotion === "hesitant" ? 0.02 : 0.07));
  const emotionalMomentum = frustrationScore > prev.frustrationScore ? "tense_up" : trustScore > prev.trustScore ? "trust_up" : "stable";
  const relationshipStage = args.turnCount > 50 ? "established" : args.turnCount > 20 ? "developing" : "new_contact";

  return {
    trustScore,
    warmthScore,
    frustrationScore,
    resistanceScore,
    engagementScore,
    humorCompatibility,
    buyerConfidence,
    emotionalMomentum,
    relationshipStage,
    updatedAt: Date.now(),
  };
}

export function updateEmotionalContinuity(args: {
  previous?: EmotionalContinuitySnapshot;
  userMessage: string;
}): EmotionalContinuitySnapshot {
  const prev = args.previous;
  const detected = detectProspectEmotion(args.userMessage);
  const prevTurn = prev?.turnCount ?? 0;
  const turnCount = prevTurn + 1;

  const decayRate: PersistentEmotionState["decayRate"] =
    detected.label === "frustrated" || detected.label === "cold" ? "slow" : detected.label === "angry" ? "medium" : "very_slow";
  const minPersistTurns = detected.label === "angry" || detected.label === "frustrated" ? 4 : 2;
  const previousActive = prev?.active;
  const shouldKeepPrevious =
    previousActive &&
    previousActive.minPersistTurns > 0 &&
    (turnCount - Math.max(1, prevTurn)) <= previousActive.minPersistTurns &&
    previousActive.score >= detected.score + 0.15;

  const active: PersistentEmotionState = shouldKeepPrevious
    ? {
        ...previousActive!,
        minPersistTurns: Math.max(0, previousActive!.minPersistTurns - 1),
        score: computeFrustrationDecay({
          currentFrustration: previousActive!.score,
          decayRate: previousActive!.decayRate,
          turnsElapsed: 1,
        }),
        lastDetectedAt: Date.now(),
      }
    : {
        label: detected.label,
        score: detected.score,
        lastDetectedAt: Date.now(),
        decayRate,
        confidence: detected.confidence,
        sourceMessage: detected.sourceMessage,
        minPersistTurns,
      };

  const states = [active, ...(prev?.states ?? []).filter((s) => s.label !== active.label)].slice(0, 8);
  const relationship = computeRelationshipState({
    previous: prev?.relationship,
    detectedEmotion: active.label,
    detectedScore: active.score,
    confidence: active.confidence,
    turnCount,
  });

  return {
    active,
    states,
    relationship,
    turnCount,
    updatedAt: Date.now(),
  };
}

export function buildEmotionalContext(args: {
  snapshot?: EmotionalContinuitySnapshot;
}): string {
  const s = args.snapshot;
  if (!s) return "";
  const tone =
    s.active.label === "frustrated" || s.active.label === "angry"
      ? "Le ton doit etre calme, rassurant, et orienté resolution. Eviter humour ou vente agressive."
      : s.active.label === "warm" || s.active.label === "friendly" || s.active.label === "playful"
        ? "Le ton peut etre naturel et chaleureux, avec humour leger si pertinent."
        : s.active.label === "cold" || s.active.label === "hesitant"
          ? "Le ton doit etre court, clair, professionnel, sans pression commerciale."
          : "Le ton doit rester humain et cohérent avec la relation en cours.";
  return [
    `Le prospect est ${s.active.label} (intensite ${s.active.score.toFixed(2)}).`,
    `Confiance ${s.relationship.trustScore.toFixed(2)}, chaleur ${s.relationship.warmthScore.toFixed(2)}, frustration ${s.relationship.frustrationScore.toFixed(2)}.`,
    tone,
  ].join(" ");
}

