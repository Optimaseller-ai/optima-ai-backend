export type AgentPersonalityProfile = {
  // Strict shape requested
  identityStyle: string;
  speechStyle: string;
  emojiStyle: string;
  warmthStyle: string;
  salesStyle: string;
  humorStyle: string;
  questionStyle: string;
  typingStyle: string;
  energyStyle: string;
  relationshipStyle: string;
  reactionStyle: string;
  greetingStyle: string;
  closingStyle: string;
  memoryStyle: string;
  fallbackStyle: string;
  humanImperfectionStyle: string;

  // Important fields
  agentSignature: string;
  dominantTraits: string[];
  forbiddenPatterns: string[];
  favoriteExpressions: string[];
  emojiFrequency: number; // 0..1
  averageSentenceLength: number; // target words
  questionRate: number; // 0..1
  humorLevel: number; // 0..1
  warmthLevel: number; // 0..1
  salesPressure: number; // 0..1
  typingSpeed: number; // multiplier (0.7..1.3)
  fragmentationStyle: "rare" | "normal" | "often";
  reactionDelayStyle: "fast" | "normal" | "slow";
  smallTalkProbability: number; // 0..1
  playfulnessScore: number; // 0..1
  confidenceStyle: "soft" | "balanced" | "assertive";
  humanImperfectionLevel: number; // 0..1 (rare)
  personalityConsistencyScore: number; // 0..1
  createdAt: number;
  updatedAt: number;
};

export type PersonalityState = {
  profile: AgentPersonalityProfile;
  lastConsistencyScore: number;
  lastDriftReasons: string[];
  updatedAt: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function rand01(seed: string): number {
  const x = Math.sin(hashSeed(seed)) * 10000;
  return x - Math.floor(x);
}

function pick<T>(seed: string, arr: readonly T[]): T {
  const idx = Math.floor(rand01(seed) * arr.length);
  return arr[Math.max(0, Math.min(arr.length - 1, idx))]!;
}

function pickMany(seed: string, arr: readonly string[], min: number, max: number): string[] {
  const count = clamp(Math.floor(rand01(seed + "|n") * (max - min + 1)) + min, min, max);
  const out: string[] = [];
  for (let i = 0; i < arr.length && out.length < count; i++) {
    const s = arr[(hashSeed(seed + "|" + i) + i) % arr.length]!;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

const FORBIDDEN_PATTERNS = [
  "comment puis-je vous aider",
  "je suis là pour",
  "n'hésitez pas",
  "je reste à votre disposition",
  "en tant qu'ia",
  "assistant",
  "avec plaisir",
];

const TRAITS = [
  "énergique",
  "calme",
  "rassurant",
  "direct",
  "urbain",
  "élégant",
  "drôle",
  "posé",
  "professionnel",
  "spontané",
  "vendeur_moderne",
];

const EXPRESSIONS = [
  "ah oui je vois 😅",
  "attends je regarde",
  "😂 sérieux ?",
  "hmm pas faux",
  "oui ça arrive souvent ça",
  "franchement celui-là il est solide",
  "ok je check",
  "je vois ce que tu veux dire",
  "c'est bizarre quand même",
];

export function buildAgentPersonalityProfile(args: {
  sessionId: string;
  agentName?: string;
  agentId?: string;
  personaKey?: string | null;
  now?: number;
  previous?: AgentPersonalityProfile | null;
}): AgentPersonalityProfile {
  const now = typeof args.now === "number" ? args.now : Date.now();
  const baseSignature = `${args.agentId ?? ""}|${args.agentName ?? ""}|${args.personaKey ?? ""}|${args.sessionId}`;
  const agentSignature = `sig_${hashSeed(baseSignature).toString(16)}`;
  const seed = agentSignature;

  const dominantTraits = pickMany(seed + "|traits", TRAITS, 3, 5);
  const emojiFrequency = clamp01(rand01(seed + "|emoji"));
  const questionRate = clamp01(rand01(seed + "|q"));
  const humorLevel = clamp01(rand01(seed + "|humor"));
  const warmthLevel = clamp01(rand01(seed + "|warmth"));
  const salesPressure = clamp01(rand01(seed + "|sales"));

  const averageSentenceLength = clamp(Math.round(6 + rand01(seed + "|sent") * 10), 6, 16);
  const typingSpeed = clamp(0.8 + rand01(seed + "|typing") * 0.7, 0.7, 1.3);
  const playfulnessScore = clamp01((humorLevel * 0.6 + emojiFrequency * 0.4) * (dominantTraits.includes("drôle") ? 1.05 : 1));
  const smallTalkProbability = clamp01(0.12 + warmthLevel * 0.35);

  const fragmentationStyle: AgentPersonalityProfile["fragmentationStyle"] =
    pick(seed + "|frag", ["rare", "normal", "often"] as const);
  const reactionDelayStyle: AgentPersonalityProfile["reactionDelayStyle"] =
    pick(seed + "|delay", ["fast", "normal", "slow"] as const);
  const confidenceStyle: AgentPersonalityProfile["confidenceStyle"] =
    pick(seed + "|conf", ["soft", "balanced", "assertive"] as const);

  const favoriteExpressions = pickMany(seed + "|expr", EXPRESSIONS, 3, 6);

  const prev = args.previous ?? null;
  const createdAt = prev?.createdAt ?? now;
  const personalityConsistencyScore = clamp01(prev?.personalityConsistencyScore ?? 0.82);

  return {
    identityStyle: dominantTraits.includes("urbain") ? "vendeur WhatsApp moderne" : dominantTraits.includes("élégant") ? "mature élégant" : "humain WhatsApp",
    speechStyle: dominantTraits.includes("direct") ? "phrases courtes, direct" : "naturel, conversationnel",
    emojiStyle: emojiFrequency > 0.65 ? "emojis fréquents mais pas partout" : emojiFrequency > 0.35 ? "emojis parfois" : "peu d'emojis",
    warmthStyle: warmthLevel > 0.65 ? "chaleureux" : warmthLevel > 0.35 ? "neutre chaleureux" : "plutôt froid",
    salesStyle: salesPressure > 0.65 ? "vendeur assumé (mais humain)" : salesPressure > 0.35 ? "conseiller premium" : "soft, pas de push",
    humorStyle: humorLevel > 0.6 ? "humour léger" : humorLevel > 0.35 ? "sobre" : "peu d'humour",
    questionStyle: questionRate > 0.6 ? "pose parfois une question" : "pose peu de questions",
    typingStyle: typingSpeed < 0.9 ? "lent et posé" : typingSpeed > 1.15 ? "rapide" : "rythme normal",
    energyStyle: dominantTraits.includes("énergique") ? "énergie haute" : dominantTraits.includes("calme") ? "énergie basse" : "énergie moyenne",
    relationshipStyle: warmthLevel > 0.55 ? "relationnel" : "factuel",
    reactionStyle: playfulnessScore > 0.55 ? "réactions spontanées" : "réactions rares",
    greetingStyle: warmthLevel > 0.6 ? "salut + chaleureux" : "salut simple",
    closingStyle: salesPressure > 0.6 ? "propose une prochaine étape légère" : "clôture courte",
    memoryStyle: "rappelle 1 détail max si utile, sinon rien",
    fallbackStyle: "si doute: réponse courte + question simple",
    humanImperfectionStyle: "petites imperfections rares (jamais excessif)",

    agentSignature,
    dominantTraits,
    forbiddenPatterns: FORBIDDEN_PATTERNS,
    favoriteExpressions,
    emojiFrequency,
    averageSentenceLength,
    questionRate,
    humorLevel,
    warmthLevel,
    salesPressure,
    typingSpeed,
    fragmentationStyle,
    reactionDelayStyle,
    smallTalkProbability,
    playfulnessScore,
    confidenceStyle,
    humanImperfectionLevel: clamp01(0.04 + rand01(seed + "|imperf") * 0.12),
    personalityConsistencyScore,
    createdAt,
    updatedAt: now,
  };
}

export function computeConversationStyle(profile: AgentPersonalityProfile): string[] {
  const lines: string[] = [];
  lines.push(`Style: ${profile.identityStyle}.`);
  lines.push(`Parle: ${profile.speechStyle}.`);
  lines.push(`Emojis: ${profile.emojiStyle}.`);
  lines.push(`Chaleur: ${Math.round(profile.warmthLevel * 100)}%.`);
  lines.push(`Pression vente: ${Math.round(profile.salesPressure * 100)}%.`);
  lines.push(profile.questionRate > 0.55 ? "Pose parfois 1 question." : "Pose rarement des questions.");
  if (profile.favoriteExpressions.length) lines.push(`Expressions: ${profile.favoriteExpressions.slice(0, 2).join(" / ")}.`);
  return lines;
}

export function generatePersonalityInstructions(args: {
  profile: AgentPersonalityProfile;
  lang: "fr" | "en" | "es";
}): string {
  const p = args.profile;
  // Compact, natural language (no JSON).
  if (args.lang !== "fr") {
    return `Stay consistent as the same WhatsApp advisor: short, human, avoid corporate phrases, keep the agent's unique rhythm (emoji=${Math.round(
      p.emojiFrequency * 100,
    )}%, questions=${Math.round(p.questionRate * 100)}%, warmth=${Math.round(p.warmthLevel * 100)}%).`;
  }
  const traitHint = p.dominantTraits.slice(0, 3).join(", ");
  const emojiHint =
    p.emojiFrequency > 0.65 ? "utilise parfois des emojis (sans en mettre partout)" : p.emojiFrequency > 0.35 ? "emojis occasionnels" : "très peu d’emojis";
  const qHint = p.questionRate > 0.6 ? "pose parfois une petite question (max 1)" : "pose rarement des questions";
  const lenHint = p.averageSentenceLength <= 9 ? "phrases plutôt courtes" : "phrases posées mais simples";
  const fav = p.favoriteExpressions[0] ? `Tu peux ponctuellement dire: “${p.favoriteExpressions[0]}”.` : "";
  return [
    `Identité stable: tu es un humain WhatsApp avec un style unique (${traitHint}).`,
    `${lenHint}, ton naturel, pas trop parfait.`,
    `${emojiHint}; ${qHint}.`,
    `Évite le style assistant/corporate (ex: ${p.forbiddenPatterns.slice(0, 2).join(", ")}).`,
    fav,
  ]
    .filter(Boolean)
    .join(" ");
}

export function computeEmojiStyle(profile: AgentPersonalityProfile): { emojiFrequency: number; maxPerReply: 0 | 1 | 2 } {
  const freq = clamp01(profile.emojiFrequency);
  const maxPerReply: 0 | 1 | 2 = freq < 0.25 ? 0 : freq < 0.65 ? 1 : 2;
  return { emojiFrequency: freq, maxPerReply };
}

export function computeVocabularyStyle(profile: AgentPersonalityProfile): { averageSentenceLength: number; forbiddenPatterns: string[] } {
  return { averageSentenceLength: profile.averageSentenceLength, forbiddenPatterns: profile.forbiddenPatterns };
}

export function computeReplyEnergy(profile: AgentPersonalityProfile): number {
  return clamp01(0.35 + profile.playfulnessScore * 0.25 + (profile.dominantTraits.includes("énergique") ? 0.2 : 0));
}

export function computeQuestionFrequency(profile: AgentPersonalityProfile): number {
  return clamp01(profile.questionRate);
}

export function computeHumorLevel(profile: AgentPersonalityProfile): number {
  return clamp01(profile.humorLevel);
}

export function computeTypingBehavior(profile: AgentPersonalityProfile): { typingSpeed: number; reactionDelayStyle: AgentPersonalityProfile["reactionDelayStyle"] } {
  return { typingSpeed: profile.typingSpeed, reactionDelayStyle: profile.reactionDelayStyle };
}

export function computeWarmthLevel(profile: AgentPersonalityProfile): number {
  return clamp01(profile.warmthLevel);
}

export function computeSalesPressure(profile: AgentPersonalityProfile): number {
  return clamp01(profile.salesPressure);
}

export function selectHumanReaction(profile: AgentPersonalityProfile, seed: string): string | null {
  const roll = rand01(profile.agentSignature + "|react|" + seed);
  if (roll > profile.playfulnessScore) return null;
  return pick(profile.agentSignature + "|reactpick|" + seed, ["😂", "ah ok", "hmm", "aie", "oui je vois 😅"] as const);
}

export function computeReplyEnergyStyle(profile: AgentPersonalityProfile): AgentPersonalityProfile["energyStyle"] {
  return profile.energyStyle;
}

export function detectPersonalityDrift(args: {
  profile: AgentPersonalityProfile;
  reply: string;
  recentAssistantReplies?: string[];
}): { drifted: boolean; score: number; reasons: string[] } {
  const text = String(args.reply ?? "").toLowerCase();
  const reasons: string[] = [];
  let penalty = 0;

  for (const p of args.profile.forbiddenPatterns) {
    if (p && text.includes(p)) {
      penalty += 0.22;
      reasons.push(`forbidden_pattern:${p}`);
      break;
    }
  }
  if (/\b(je vous remercie|cordialement|bien à vous)\b/i.test(text)) {
    penalty += 0.18;
    reasons.push("too_formal");
  }
  if (text.length > 420 && args.profile.averageSentenceLength <= 10) {
    penalty += 0.12;
    reasons.push("too_long_for_style");
  }
  if (args.recentAssistantReplies?.length) {
    const last = String(args.recentAssistantReplies[args.recentAssistantReplies.length - 1] ?? "").toLowerCase();
    if (last && last.slice(0, 60) === text.slice(0, 60)) {
      penalty += 0.14;
      reasons.push("repetitive_opening");
    }
  }
  const score = clamp01(1 - penalty);
  return { drifted: score < 0.62, score, reasons };
}

export function repairPersonalityDrift(args: {
  profile: AgentPersonalityProfile;
  drift: ReturnType<typeof detectPersonalityDrift>;
  lang: "fr" | "en" | "es";
}): string {
  if (!args.drift.drifted) return "";
  if (args.lang !== "fr") return "Reduce corporate tone. Short WhatsApp phrasing. Keep the same persona.";
  const fav = args.profile.favoriteExpressions[0] ? `Tu peux repartir sur une formule naturelle type: “${args.profile.favoriteExpressions[0]}”.` : "";
  return [
    "ALERTE: tu dérives vers un ton trop IA/générique.",
    "Reviens au style WhatsApp de l’agent: phrases courtes, naturel, pas de formules corporate.",
    fav,
  ]
    .filter(Boolean)
    .join(" ");
}

export function applyPersonalityVariation(args: {
  profile: AgentPersonalityProfile;
  humanDirectives: string[];
  lang: "fr" | "en" | "es";
}): { directives: string[] } {
  const p = args.profile;
  const directives = [...args.humanDirectives];
  const instr = generatePersonalityInstructions({ profile: p, lang: args.lang });
  directives.push(instr);
  return { directives };
}

export function buildPersistentAgentIdentity(args: { profile: AgentPersonalityProfile; lang: "fr" | "en" | "es" }): string {
  // Compact identity string for logs / prompt.
  const lines = computeConversationStyle(args.profile);
  return args.lang === "fr" ? lines.join(" ") : lines.join(" ");
}

export function repairPersonalityProfile(args: {
  previous: PersonalityState | null;
  nextProfile: AgentPersonalityProfile;
  drift: ReturnType<typeof detectPersonalityDrift>;
}): PersonalityState {
  const now = Date.now();
  const baseScore = clamp01(args.drift.score);
  const prevScore = clamp01(args.previous?.lastConsistencyScore ?? args.nextProfile.personalityConsistencyScore);
  const blended = clamp01(prevScore * 0.65 + baseScore * 0.35);
  return {
    profile: { ...args.nextProfile, personalityConsistencyScore: blended, updatedAt: now },
    lastConsistencyScore: blended,
    lastDriftReasons: args.drift.reasons,
    updatedAt: now,
  };
}

