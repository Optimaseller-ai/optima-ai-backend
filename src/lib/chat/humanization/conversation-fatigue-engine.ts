import { logStructured } from "@/lib/logging/structured-log";

export type ConversationPhase =
  | "fresh"
  | "engaged"
  | "comfortable"
  | "dense"
  | "fatigued"
  | "drained"
  | "recovery";

export type ConversationFatigueState = {
  fatigueScore: number;
  energyLevel: number;
  conversationDensity: number;
  cognitiveLoad: number;
  responseCompression: number;
  questionProbability: number;
  commercialPersistence: number;
  humanDrift: number;
  microPatience: number;
  warmthDecay: number;
  lastFatigueUpdateAt: number;
  totalMessages: number;
  longConversationDetected: boolean;
  silenceRecoveryBoost: number;
  conversationPhase: ConversationPhase;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const SILENCE_RECOVERY_MS = 20 * 60 * 1000;

export function computeConversationDensity(args: {
  totalMessages: number;
  recentUserMessages: number;
  avgMessageLength: number;
}): number {
  const msgFactor = clamp01(args.totalMessages / 28);
  const burstFactor = clamp01(args.recentUserMessages / 8);
  const lenFactor = clamp01(args.avgMessageLength / 180);
  return clamp01(msgFactor * 0.45 + burstFactor * 0.35 + lenFactor * 0.2);
}

export function computeCognitiveLoad(args: {
  userMessage: string;
  historyTurns: number;
  hasCommercialIntent?: boolean;
}): number {
  const len = String(args.userMessage ?? "").trim().length;
  const lenLoad = clamp01(len / 320);
  const histLoad = clamp01(args.historyTurns / 24);
  const commercial = args.hasCommercialIntent ? 0.12 : 0;
  const questionMarks = (String(args.userMessage ?? "").match(/\?/g) ?? []).length;
  const qLoad = clamp01(questionMarks / 3) * 0.08;
  return clamp01(lenLoad * 0.55 + histLoad * 0.35 + commercial + qLoad);
}

export function computeCommercialPersistence(args: {
  fatigueScore: number;
  phase: ConversationPhase;
  baseSalesPressure?: number;
}): number {
  const base = typeof args.baseSalesPressure === "number" ? args.baseSalesPressure : 0.55;
  let p = clamp01(base * (1 - args.fatigueScore * 0.55));
  if (args.phase === "fresh" || args.phase === "engaged") p = clamp01(p + 0.12);
  if (args.phase === "fatigued" || args.phase === "drained") p = clamp01(p * 0.72);
  if (args.phase === "recovery") p = clamp01(p + 0.08);
  return p;
}

export function computeConversationFatigue(args: {
  previous?: ConversationFatigueState | null;
  totalMessages: number;
  conversationDensity: number;
  cognitiveLoad: number;
  silenceRecoveryBoost: number;
}): number {
  const prev = clamp01(args.previous?.fatigueScore ?? 0);
  const turnBoost = clamp01(args.totalMessages / 32) * 0.55;
  const densityBoost = args.conversationDensity * 0.28;
  const loadBoost = args.cognitiveLoad * 0.22;
  let score = clamp01(prev * 0.82 + turnBoost + densityBoost + loadBoost - args.silenceRecoveryBoost * 0.35);
  if (args.totalMessages <= 2) score = Math.min(score, 0.12);
  return score;
}

export function computeEnergyLevel(args: {
  fatigueScore: number;
  silenceRecoveryBoost: number;
  phase: ConversationPhase;
}): number {
  let energy = clamp01(1 - args.fatigueScore * 0.72 + args.silenceRecoveryBoost * 0.25);
  if (args.phase === "engaged") energy = clamp01(energy + 0.12);
  if (args.phase === "drained") energy = clamp01(energy - 0.08);
  if (args.phase === "recovery") energy = clamp01(energy + 0.1);
  return energy;
}

export function computeReplyCompression(args: { fatigueScore: number; phase: ConversationPhase }): number {
  let c = clamp01(args.fatigueScore * 0.85);
  if (args.phase === "comfortable") c = clamp01(c * 0.75);
  if (args.phase === "fatigued" || args.phase === "drained") c = clamp01(c + 0.12);
  if (args.phase === "fresh") c = clamp01(c * 0.35);
  return c;
}

export function computeQuestionReduction(args: { phase: ConversationPhase; fatigueScore: number }): number {
  const byPhase: Record<ConversationPhase, number> = {
    fresh: 0.75,
    engaged: 0.68,
    comfortable: 0.45,
    dense: 0.38,
    fatigued: 0.18,
    drained: 0.08,
    recovery: 0.42,
  };
  const base = byPhase[args.phase] ?? 0.45;
  return clamp01(base * (1 - args.fatigueScore * 0.15));
}

export function computeHumanDrift(args: { fatigueScore: number; phase: ConversationPhase }): number {
  let d = clamp01(args.fatigueScore * 0.55);
  if (args.phase === "comfortable" || args.phase === "engaged") d = clamp01(d + 0.08);
  if (args.phase === "drained") d = clamp01(d + 0.1);
  return d;
}

function detectConversationPhase(args: {
  fatigueScore: number;
  conversationDensity: number;
  totalMessages: number;
  silenceRecoveryBoost: number;
}): ConversationPhase {
  if (args.silenceRecoveryBoost > 0.15 && args.fatigueScore > 0.25) return "recovery";
  if (args.totalMessages <= 3) return "fresh";
  if (args.fatigueScore >= 0.72) return "drained";
  if (args.fatigueScore >= 0.52) return "fatigued";
  if (args.conversationDensity >= 0.62) return "dense";
  if (args.totalMessages >= 8 && args.fatigueScore < 0.35) return "comfortable";
  if (args.totalMessages >= 4 && args.fatigueScore < 0.45) return "engaged";
  return "comfortable";
}

export function buildFatigueContext(args: {
  state: ConversationFatigueState;
  agentName?: string;
  lang?: "fr" | "en" | "es";
}): string {
  const name = String(args.agentName ?? "L'agent").trim() || "L'agent";
  const lang = args.lang ?? "fr";
  const phase = args.state.conversationPhase;

  if (lang !== "fr") {
    return `Long conversation (${phase}). ${name} replies more naturally and briefly, stays warm, avoids unnecessary questions.`;
  }

  if (phase === "fresh") {
    return `${name} est au début de l'échange: ton naturel, un peu d'énergie, sans être lourd.`;
  }
  if (phase === "engaged") {
    return `${name} est bien lancé dans la conversation: énergie ok, style WhatsApp fluide.`;
  }
  if (phase === "comfortable") {
    return `Fil confortable. ${name} reste chaleureux et naturel, sans sur-jouer le vendeur.`;
  }
  if (phase === "dense") {
    return `Beaucoup d'infos échangées. ${name} condense un peu, reste clair et poli.`;
  }
  if (phase === "fatigued") {
    return `Conversation longue. ${name} répond plus brièvement et naturellement, reste chaleureux mais évite les questions inutiles.`;
  }
  if (phase === "drained") {
    return `Fil très long. ${name} est plus direct et compact, toujours poli, presque pas de questions.`;
  }
  if (phase === "recovery") {
    return `Pause longue détectée. ${name} retrouve un peu d'énergie, reste humain et accueillant.`;
  }
  return `${name} adapte son rythme à la durée de la conversation.`;
}

export function applyFatigueStyle(args: {
  state: ConversationFatigueState;
  agentName?: string;
  lang?: "fr" | "en" | "es";
}): { directives: string[] } {
  const lang = args.lang ?? "fr";
  const directives: string[] = [];
  const phase = args.state.conversationPhase;

  if (args.state.responseCompression >= 0.45) {
    directives.push(
      lang === "fr"
        ? "Compresse la réponse: moins de formules, plus direct (ex: \"je regarde ça 🙂\", \"attendez je vérifie\")."
        : "Compress reply: fewer formulas, more direct.",
    );
  }
  if (args.state.questionProbability < 0.35) {
    directives.push(
      lang === "fr"
        ? "Évite les questions de relance (\"et vous ?\", \"je peux vous aider ?\")."
        : "Avoid follow-up questions.",
    );
  }
  if (args.state.humanDrift >= 0.35) {
    directives.push(
      lang === "fr"
        ? "Légère dérive humaine ok: phrases plus courtes, micro-réactions naturelles (\"oui je vois 😅\", \"hmm bizarre\")."
        : "Slight human drift ok: shorter lines, natural micro-reactions.",
    );
  }
  if (args.state.commercialPersistence < 0.35) {
    directives.push(
      lang === "fr"
        ? "Moins pushy commercialement: conseille sans insister."
        : "Less sales push: advise without insisting.",
    );
  }
  if (phase === "drained" || phase === "fatigued") {
    directives.push(lang === "fr" ? "Reste poli et clair, jamais sec ou froid." : "Stay polite and clear, never cold.");
  }
  return { directives };
}

export function updateConversationFatigue(args: {
  previous?: ConversationFatigueState | null;
  userMessage: string;
  historyTurns?: number;
  agentName?: string;
  baseSalesPressure?: number;
  now?: number;
}): ConversationFatigueState {
  const now = typeof args.now === "number" ? args.now : Date.now();
  const prev = args.previous ?? null;
  const totalMessages = (prev?.totalMessages ?? 0) + 1;
  const lastAt = prev?.lastFatigueUpdateAt ?? now;
  const silenceMs = Math.max(0, now - lastAt);
  const silenceRecoveryBoost = silenceMs >= SILENCE_RECOVERY_MS ? clamp01((silenceMs - SILENCE_RECOVERY_MS) / (60 * 60 * 1000)) : 0;

  const msgLen = String(args.userMessage ?? "").trim().length;
  const conversationDensity = computeConversationDensity({
    totalMessages,
    recentUserMessages: Math.min(8, totalMessages),
    avgMessageLength: msgLen,
  });
  const cognitiveLoad = computeCognitiveLoad({
    userMessage: args.userMessage,
    historyTurns: args.historyTurns ?? totalMessages,
    hasCommercialIntent: /\b(prix|produit|commande|acheter|catalogue|dispo)\b/i.test(args.userMessage),
  });

  const fatigueScore = computeConversationFatigue({
    previous: prev,
    totalMessages,
    conversationDensity,
    cognitiveLoad,
    silenceRecoveryBoost,
  });

  const conversationPhase = detectConversationPhase({
    fatigueScore,
    conversationDensity,
    totalMessages,
    silenceRecoveryBoost,
  });

  const energyLevel = computeEnergyLevel({ fatigueScore, silenceRecoveryBoost, phase: conversationPhase });
  const responseCompression = computeReplyCompression({ fatigueScore, phase: conversationPhase });
  const questionProbability = computeQuestionReduction({ phase: conversationPhase, fatigueScore });
  const commercialPersistence = computeCommercialPersistence({
    fatigueScore,
    phase: conversationPhase,
    baseSalesPressure: args.baseSalesPressure,
  });
  const humanDrift = computeHumanDrift({ fatigueScore, phase: conversationPhase });
  const microPatience = clamp01(0.85 - fatigueScore * 0.35 + silenceRecoveryBoost * 0.1);
  const warmthDecay = clamp01(fatigueScore * 0.22 - silenceRecoveryBoost * 0.12);
  const longConversationDetected = totalMessages >= 14 || fatigueScore >= 0.5;

  const state: ConversationFatigueState = {
    fatigueScore,
    energyLevel,
    conversationDensity,
    cognitiveLoad,
    responseCompression,
    questionProbability,
    commercialPersistence,
    humanDrift,
    microPatience,
    warmthDecay,
    lastFatigueUpdateAt: now,
    totalMessages,
    longConversationDetected,
    silenceRecoveryBoost,
    conversationPhase,
  };

  logStructured("[FATIGUE_SCORE]", { fatigueScore, phase: conversationPhase, totalMessages });
  logStructured("[ENERGY_LEVEL]", { energyLevel, phase: conversationPhase });
  logStructured("[QUESTION_REDUCTION]", { questionProbability, phase: conversationPhase });
  logStructured("[REPLY_COMPRESSION]", { responseCompression, phase: conversationPhase });
  logStructured("[COMMERCIAL_PERSISTENCE]", { commercialPersistence, phase: conversationPhase });
  logStructured("[HUMAN_DRIFT]", { humanDrift, phase: conversationPhase });
  if (silenceRecoveryBoost > 0) {
    logStructured("[FATIGUE_RECOVERY]", { silenceRecoveryBoost, silenceMs });
  }

  const context = buildFatigueContext({ state, agentName: args.agentName, lang: "fr" });
  logStructured("[FATIGUE_CONTEXT]", { context: context.slice(0, 280), phase: conversationPhase });

  return state;
}

export type FatigueDeliveryHints = {
  fatigueScore?: number;
  energyLevel?: number;
  conversationPhase?: ConversationPhase;
  responseCompression?: number;
};

export function fatigueFragmentationBias(state?: ConversationFatigueState | null): {
  suppressFragmentation: boolean;
  preferCompact: boolean;
} {
  if (!state) return { suppressFragmentation: false, preferCompact: false };
  const high = state.fatigueScore >= 0.55 || state.conversationPhase === "fatigued" || state.conversationPhase === "drained";
  const fresh = state.conversationPhase === "fresh" || state.conversationPhase === "engaged";
  return {
    suppressFragmentation: high,
    preferCompact: high || state.responseCompression >= 0.5,
  };
}

export function fatigueTypingMultiplier(state?: ConversationFatigueState | null): number {
  if (!state) return 1;
  if (state.fatigueScore >= 0.6) return 1.15;
  if (state.conversationPhase === "fresh") return 0.95;
  return 1;
}
