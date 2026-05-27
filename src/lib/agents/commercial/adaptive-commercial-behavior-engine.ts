import type { SellerBehaviorConversationState, ConversationProfile, ProspectTone } from "@/lib/agents/memory/conversation-state";
import type { ProspectBehaviorMemory, EmotionalFlowMemory } from "@/lib/agents/memory/prospect-behavior-memory";
import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { HumanBehaviorPlan, SalesStrategyOutput, PersonalityOutput, EnergyState } from "@/lib/ai/pipeline/pipeline-types";
import type { QuestionBudget } from "@/lib/ai/pipeline/pipeline-types";

export type ProspectCommercialType =
  | "CURIEUX"
  | "PRESSE"
  | "FROID"
  | "CHALEUREUX"
  | "ACHETEUR"
  | "COMPARATEUR"
  | "MEFIANT";

export type ResponseLengthTarget = "mini" | "medium" | "detailed";

export type CommercialAction =
  | "recommend"
  | "wait"
  | "reassure"
  | "close"
  | "stop_selling"
  | "minimal_reply"
  | "answer_only";

export type PersuasionStyle = "none" | "soft" | "balanced" | "direct";

export type CommercialAdaptationMemory = {
  profileScores: Record<ProspectCommercialType, number>;
  dominantProfile: ProspectCommercialType;
  secondaryProfile?: ProspectCommercialType;
  conversationFatigue01: number;
  responseLengthTarget: ResponseLengthTarget;
  commercialLevel01: number;
  persuasionStyle: PersuasionStyle;
  commercialAction: CommercialAction;
  allowProductRecommend: boolean;
  allowCrossSell: boolean;
  noFollowUp: boolean;
  toneHint: string;
  preferredRhythm: "slow" | "normal" | "fast";
  lastUpdatedAt: number;
};

const ALL_PROFILES: ProspectCommercialType[] = [
  "CURIEUX",
  "PRESSE",
  "FROID",
  "CHALEUREUX",
  "ACHETEUR",
  "COMPARATEUR",
  "MEFIANT",
];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function emptyScores(): Record<ProspectCommercialType, number> {
  return {
    CURIEUX: 0,
    PRESSE: 0,
    FROID: 0,
    CHALEUREUX: 0,
    ACHETEUR: 0,
    COMPARATEUR: 0,
    MEFIANT: 0,
  };
}

function scoreMessageProfiles(message: string): Record<ProspectCommercialType, number> {
  const m = norm(message);
  const s = emptyScores();
  if (!m) return s;

  if (/\?/.test(m) || /\b(pourquoi|comment|c'est quoi|c’est quoi|tu conseilles|vous conseillez)\b/.test(m)) s.CURIEUX += 0.45;
  if (m.length <= 14 || /\b(vite|rapide|direct|tout de suite|maintenant|dispo\??)\b/.test(m)) s.PRESSE += 0.5;
  if (/^(ok|oui|non|bon|hmm+|hm+)$/i.test(m) || m.length <= 5) s.FROID += 0.45;
  if (/😂|🤣|😄|mdr|lol|salut|coucou|ça va|ca va/i.test(m) || m.length > 55) s.CHALEUREUX += 0.35;
  if (/\b(prix|tarif|combien|commander|acheter|stock|dispo|livraison|paiement|facture)\b/.test(m)) s.ACHETEUR += 0.55;
  if (/\b(vs|contre|compar|autre magasin|ailleurs|moins cher ailleurs|concurrent)\b/.test(m)) s.COMPARATEUR += 0.55;
  if (/\b(garantie|preuve|fiable|arnaque|confiance|authentique|original|vrai)\b/.test(m)) s.MEFIANT += 0.5;

  return s;
}

function scoreHistoryProfiles(history: Array<{ role: "user" | "assistant"; content: string }>): Record<ProspectCommercialType, number> {
  const s = emptyScores();
  const users = history.filter((h) => h.role === "user").slice(-8);
  const assistants = history.filter((h) => h.role === "assistant").slice(-8);
  if (!users.length) return s;

  const questionCount = users.filter((u) => /\?/.test(String(u.content ?? ""))).length;
  if (questionCount >= 2) s.CURIEUX += 0.35;

  const avgLen = users.reduce((a, u) => a + String(u.content ?? "").length, 0) / users.length;
  if (avgLen <= 12) s.PRESSE += 0.35;
  if (avgLen <= 8) s.FROID += 0.25;

  const dryCount = users.filter((u) => /^(ok|oui|non|bon|hmm+)$/i.test(norm(String(u.content ?? "")))).length;
  if (dryCount >= 2) s.FROID += 0.35;

  const warmCount = users.filter((u) => /😂|🤣|😄|mdr|salut|merci/i.test(String(u.content ?? ""))).length;
  if (warmCount >= 1) s.CHALEUREUX += 0.25;

  const buySignals = users.filter((u) =>
    /\b(prix|stock|dispo|commander|acheter|livraison)\b/i.test(String(u.content ?? "")),
  ).length;
  if (buySignals >= 1) s.ACHETEUR += 0.35;

  const compareSignals = users.filter((u) => /\b(vs|compar|ailleurs|concurrent)\b/i.test(String(u.content ?? ""))).length;
  if (compareSignals >= 1) s.COMPARATEUR += 0.3;

  const trustSignals = users.filter((u) => /\b(garantie|fiable|preuve|arnaque)\b/i.test(String(u.content ?? ""))).length;
  if (trustSignals >= 1) s.MEFIANT += 0.3;

  // Agent talked too much vs prospect -> fatigue signal (handled separately too).
  if (assistants.length > users.length + 1) s.FROID += 0.15;

  return s;
}

function mergeScores(
  prev: Record<ProspectCommercialType, number> | undefined,
  msgScores: Record<ProspectCommercialType, number>,
  histScores: Record<ProspectCommercialType, number>,
  pb?: ProspectBehaviorMemory,
  ef?: EmotionalFlowMemory,
): Record<ProspectCommercialType, number> {
  const out = emptyScores();
  for (const k of ALL_PROFILES) {
    const behavioral =
      k === "CURIEUX"
        ? (ef?.curiosity01 ?? 0) * 0.4
        : k === "PRESSE"
          ? (ef?.impatience01 ?? 0) * 0.45
          : k === "FROID"
            ? (pb?.coldness01 ?? 0) * 0.5 + (ef?.saturation01 ?? 0) * 0.25
            : k === "CHALEUREUX"
              ? (pb?.humor01 ?? 0) * 0.35 + (pb?.energy01 ?? 0) * 0.2
              : k === "ACHETEUR"
                ? (ef?.interest01 ?? 0) * 0.4
                : k === "MEFIANT"
                  ? (pb?.aggressivity01 ?? 0) * 0.25 + (ef?.frustration01 ?? 0) * 0.25
                  : 0;

    out[k] = clamp01(
      (prev?.[k] ?? 0) * 0.55 + msgScores[k] * 0.35 + histScores[k] * 0.2 + behavioral * 0.35,
    );
  }
  return out;
}

function pickDominant(scores: Record<ProspectCommercialType, number>): {
  dominant: ProspectCommercialType;
  secondary?: ProspectCommercialType;
} {
  const ranked = ALL_PROFILES.map((k) => ({ k, v: scores[k] })).sort((a, b) => b.v - a.v);
  const dominant = ranked[0]?.k ?? "CURIEUX";
  const secondary = ranked[1] && ranked[1].v >= 0.35 && ranked[1].v + 0.08 >= ranked[0].v ? ranked[1].k : undefined;
  return { dominant, secondary };
}

function computeConversationFatigue(input: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  ef?: EmotionalFlowMemory;
  aiPressure?: number;
  agentQuestionHeavy?: boolean;
}): number {
  const users = input.history.filter((h) => h.role === "user").slice(-6);
  const assistants = input.history.filter((h) => h.role === "assistant").slice(-6);
  let f = clamp01((input.ef?.fatigue01 ?? 0) * 0.5 + (input.ef?.saturation01 ?? 0) * 0.35 + (input.aiPressure ?? 0) * 0.25);

  if (assistants.length > users.length) f += 0.12;
  const dry = users.filter((u) => norm(String(u.content ?? "")).length <= 6).length;
  if (dry >= 2) f += 0.15;
  if (input.agentQuestionHeavy) f += 0.1;

  return clamp01(f);
}

function inferCommercialAction(args: {
  dominant: ProspectCommercialType;
  fatigue01: number;
  turnIntent: ProspectTurnIntent;
  message: string;
  commercialLevel01: number;
}): CommercialAction {
  const m = norm(args.message);
  if (args.fatigue01 >= 0.72 || args.dominant === "FROID") {
    if (m.length <= 10) return "minimal_reply";
    return "stop_selling";
  }
  if (args.dominant === "MEFIANT" || args.turnIntent === "plainte") return "reassure";
  if (args.turnIntent === "achat" || /\b(je prends|je commande|je paie)\b/.test(m)) return "close";
  if (args.dominant === "ACHETEUR" && (args.turnIntent === "demande_produit" || /\b(prix|stock|dispo|iphone|samsung)\b/.test(m))) {
    return args.commercialLevel01 >= 0.45 ? "recommend" : "answer_only";
  }
  if (args.dominant === "COMPARATEUR") return "answer_only";
  if (args.dominant === "PRESSE") return m.length <= 18 ? "minimal_reply" : "answer_only";
  if (args.dominant === "CURIEUX" && args.fatigue01 < 0.5) return "answer_only";
  if (args.dominant === "CHALEUREUX" && args.commercialLevel01 < 0.4) return "wait";
  return "answer_only";
}

function inferLengthTarget(args: {
  dominant: ProspectCommercialType;
  fatigue01: number;
  avgUserLen: number;
  message: string;
  action: CommercialAction;
}): ResponseLengthTarget {
  const mLen = String(args.message ?? "").trim().length;
  if (args.action === "minimal_reply" || args.fatigue01 >= 0.65) return "mini";
  if (args.dominant === "PRESSE" || mLen <= 12 || args.avgUserLen <= 14) return "mini";
  if (args.dominant === "FROID") return "mini";
  if (args.dominant === "ACHETEUR" && mLen <= 28) return "medium";
  if (args.dominant === "CURIEUX" && mLen > 80 && args.fatigue01 < 0.45) return "detailed";
  return "medium";
}

function inferCommercialLevel(args: {
  dominant: ProspectCommercialType;
  fatigue01: number;
  turnIntent: ProspectTurnIntent;
  highTrust?: boolean;
}): number {
  let level = 0.35;
  if (args.dominant === "ACHETEUR") level = 0.78;
  if (args.dominant === "COMPARATEUR") level = 0.45;
  if (args.dominant === "CURIEUX") level = 0.4;
  if (args.dominant === "CHALEUREUX") level = 0.42;
  if (args.dominant === "FROID") level = 0.18;
  if (args.dominant === "PRESSE") level = 0.5;
  if (args.dominant === "MEFIANT") level = 0.28;
  if (args.turnIntent === "achat") level = 0.85;
  if (args.turnIntent === "demande_produit") level = Math.max(level, 0.62);
  if (args.highTrust) level = Math.min(0.72, level + 0.12);
  level *= 1 - args.fatigue01 * 0.55;
  return clamp01(level);
}

function inferPersuasionStyle(args: {
  dominant: ProspectCommercialType;
  commercialLevel01: number;
  fatigue01: number;
}): PersuasionStyle {
  if (args.fatigue01 >= 0.6 || args.dominant === "FROID") return "none";
  if (args.dominant === "MEFIANT") return "soft";
  if (args.dominant === "PRESSE") return "direct";
  if (args.dominant === "ACHETEUR" && args.commercialLevel01 >= 0.65) return "balanced";
  if (args.dominant === "CHALEUREUX") return "soft";
  return args.commercialLevel01 >= 0.55 ? "balanced" : "soft";
}

function toneHintForProfile(p: ProspectCommercialType, lang: "fr" | "en" | "es"): string {
  const fr: Record<ProspectCommercialType, string> = {
    CURIEUX: "pédagogue mais court, répondre aux questions sans survendre",
    PRESSE: "direct, zéro blabla, une info utile",
    FROID: "neutre, très court, pas de relance",
    CHALEUREUX: "vivant, conversationnel, pas commercial lourd",
    ACHETEUR: "commercial naturel, guider vers achat sans forcing",
    COMPARATEUR: "factuel, honnête, pas de liste catalogue",
    MEFIANT: "rassurant, concret, preuves/garanties si dispo",
  };
  if (lang === "en") {
    return (
      {
        CURIEUX: "helpful, concise answers",
        PRESSE: "short and direct",
        FROID: "neutral, minimal",
        CHALEUREUX: "warm, conversational",
        ACHETEUR: "natural sales guidance",
        COMPARATEUR: "honest comparison, no lists",
        MEFIANT: "reassuring, concrete",
      }[p] ?? fr[p]
    );
  }
  return fr[p];
}

function mapProfileToProspectTone(p: ProspectCommercialType): ProspectTone {
  switch (p) {
    case "PRESSE":
      return "rushed";
    case "FROID":
      return "cold";
    case "CHALEUREUX":
      return "warm";
    case "ACHETEUR":
      return "ready_to_buy";
    case "CURIEUX":
      return "curious";
    default:
      return "neutral";
  }
}

export function runAdaptiveCommercialBehavior(input: {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationState?: SellerBehaviorConversationState;
  turnIntent: ProspectTurnIntent;
  lang?: "fr" | "en" | "es";
}): {
  adaptation: CommercialAdaptationMemory;
  directives: string[];
  conversationProfilePatch?: Partial<ConversationProfile>;
} {
  const lang = input.lang ?? "fr";
  const history = input.history ?? [];
  const prev = (input.conversationState as any)?.commercial_adaptation as CommercialAdaptationMemory | undefined;
  const pb = input.conversationState?.prospect_behavior;
  const ef = input.conversationState?.emotional_flow;
  const aiPressure = Number(input.conversationState?.ai_pressure_score ?? 0);

  const msgScores = scoreMessageProfiles(input.message);
  const histScores = scoreHistoryProfiles(history);
  const profileScores = mergeScores(prev?.profileScores, msgScores, histScores, pb, ef);
  const { dominant: dominantProfile, secondary: secondaryProfile } = pickDominant(profileScores);

  const agentQuestions = history
    .filter((h) => h.role === "assistant")
    .slice(-4)
    .filter((h) => /\?/.test(String(h.content ?? ""))).length;
  const conversationFatigue01 = computeConversationFatigue({
    history,
    ef,
    aiPressure,
    agentQuestionHeavy: agentQuestions >= 2,
  });

  const avgUserLen = pb?.avgUserMsgLen ?? 20;
  const commercialLevel01 = inferCommercialLevel({
    dominant: dominantProfile,
    fatigue01: conversationFatigue01,
    turnIntent: input.turnIntent,
    highTrust: ef?.highTrustMode,
  });
  const commercialAction = inferCommercialAction({
    dominant: dominantProfile,
    fatigue01: conversationFatigue01,
    turnIntent: input.turnIntent,
    message: input.message,
    commercialLevel01,
  });
  const responseLengthTarget = inferLengthTarget({
    dominant: dominantProfile,
    fatigue01: conversationFatigue01,
    avgUserLen,
    message: input.message,
    action: commercialAction,
  });
  const persuasionStyle = inferPersuasionStyle({ dominant: dominantProfile, commercialLevel01, fatigue01: conversationFatigue01 });

  const allowProductRecommend =
    commercialAction === "recommend" ||
    (commercialAction === "close" && commercialLevel01 >= 0.5) ||
    (dominantProfile === "ACHETEUR" && commercialLevel01 >= 0.55 && conversationFatigue01 < 0.55);

  const allowCrossSell =
    allowProductRecommend && commercialLevel01 >= 0.62 && conversationFatigue01 < 0.45 && input.turnIntent === "demande_produit";

  const noFollowUp =
    commercialAction === "minimal_reply" ||
    commercialAction === "stop_selling" ||
    conversationFatigue01 >= 0.6 ||
    dominantProfile === "FROID" ||
    dominantProfile === "PRESSE";

  const preferredRhythm: "slow" | "normal" | "fast" =
    dominantProfile === "PRESSE" ? "fast" : dominantProfile === "FROID" || conversationFatigue01 >= 0.55 ? "slow" : "normal";

  const adaptation: CommercialAdaptationMemory = {
    profileScores,
    dominantProfile,
    secondaryProfile,
    conversationFatigue01,
    responseLengthTarget,
    commercialLevel01,
    persuasionStyle,
    commercialAction,
    allowProductRecommend,
    allowCrossSell,
    noFollowUp,
    toneHint: toneHintForProfile(dominantProfile, lang),
    preferredRhythm,
    lastUpdatedAt: Date.now(),
  };

  const directives: string[] = [
    `Profil prospect dominant: ${dominantProfile}${secondaryProfile ? ` (+ ${secondaryProfile})` : ""}.`,
    `Ton: ${adaptation.toneHint}.`,
    `Longueur cible: ${responseLengthTarget === "mini" ? "très courte (1 ligne)" : responseLengthTarget === "medium" ? "moyenne (1-2 phrases)" : "détaillée seulement si utile"}.`,
    `Niveau commercial: ${Math.round(commercialLevel01 * 100)}%.`,
    `Action: ${commercialAction}.`,
  ];

  if (noFollowUp) directives.push("Pas de relance, pas de question en fin de message.");
  if (!allowProductRecommend) directives.push("Ne pas pousser de produit sauf si le prospect le demande explicitement.");
  if (allowProductRecommend) directives.push("Tu peux recommander 1 produit max, naturellement (pas de liste).");
  if (allowCrossSell) directives.push("Cross-sell doux possible (accessoire) en une phrase max, seulement si ça colle.");
  if (persuasionStyle === "none") directives.push("Zéro persuasion, juste répondre.");
  if (commercialAction === "minimal_reply") directives.push('Mode silence humain: "oui", "ça marche", "je regarde", etc.');

  const conversationProfilePatch: Partial<ConversationProfile> = {
    tone: mapProfileToProspectTone(dominantProfile),
    interestLevel: commercialLevel01 >= 0.65 ? "hot" : commercialLevel01 >= 0.4 ? "warm" : "cold",
    buyingIntent: Math.round(commercialLevel01 * 100),
    preferredLanguageStyle: dominantProfile === "CHALEUREUX" ? "warm" : dominantProfile === "FROID" ? "formal" : "neutral",
  };

  return { adaptation, directives, conversationProfilePatch };
}

export function applyCommercialAdaptationToHumanPlan(
  humanPlan: HumanBehaviorPlan,
  adaptation: CommercialAdaptationMemory,
): HumanBehaviorPlan {
  if (adaptation.noFollowUp) {
    humanPlan.questionBudget = {
      askQuestion: false,
      maxQuestions: 0,
      roll: humanPlan.questionBudget.roll,
      reason: "commercial_adaptation_no_followup",
    } satisfies QuestionBudget;
    humanPlan.allowShortReactionOnly = true;
  }

  if (adaptation.responseLengthTarget === "mini") {
    humanPlan.preGenerationDirectives.push("Réponse mini: pas de paragraphe, pas d'argumentaire.");
    humanPlan.allowShortReactionOnly = true;
  } else if (adaptation.responseLengthTarget === "medium") {
    humanPlan.preGenerationDirectives.push("Réponse moyenne: 1-2 phrases max.");
  }

  if (adaptation.commercialAction === "stop_selling") {
    humanPlan.preGenerationDirectives.push("Stop vente: pas de promo, pas de relance commerciale.");
  }
  if (adaptation.commercialAction === "reassure") {
    humanPlan.preGenerationDirectives.push("Rassurer concrètement (garantie/SAV) sans jargon IA.");
  }
  if (adaptation.commercialAction === "close") {
    humanPlan.preGenerationDirectives.push("Aider à conclure (dispo, prix, livraison) simplement.");
  }

  return humanPlan;
}

export function adaptSalesStrategy(
  sales: SalesStrategyOutput,
  adaptation: CommercialAdaptationMemory,
): SalesStrategyOutput {
  if (adaptation.commercialAction === "stop_selling" || adaptation.commercialLevel01 < 0.25) {
    return { ...sales, objective: "answer", urgency: "low", objectionHandling: false };
  }
  if (adaptation.commercialAction === "close") {
    return { ...sales, objective: "close", urgency: "high" };
  }
  if (adaptation.commercialAction === "recommend" && adaptation.allowProductRecommend) {
    return { ...sales, objective: "qualify", urgency: "medium" };
  }
  if (adaptation.commercialAction === "reassure") {
    return { ...sales, objective: "defuse", urgency: "low" };
  }
  return sales;
}

export function adaptPersonalityEnergy(energy: EnergyState, adaptation: CommercialAdaptationMemory): EnergyState {
  if (adaptation.dominantProfile === "PRESSE") return "busy";
  if (adaptation.dominantProfile === "CHALEUREUX") return "playful";
  if (adaptation.dominantProfile === "ACHETEUR" && adaptation.commercialLevel01 >= 0.6) return "premium_seller";
  if (adaptation.dominantProfile === "FROID" || adaptation.conversationFatigue01 >= 0.6) return "chill";
  return energy;
}
