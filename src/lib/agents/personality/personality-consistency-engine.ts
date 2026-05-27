import "server-only";

import { reduceAiDetectionPatterns } from "./anti-ai-detection";
import { balanceHumanBehavior } from "./human-behavior-balancer";
import type { AgentStablePersonality, ConversationPersonalityState } from "./conversation-personality-state";
import { buildConversationPersonalityState } from "./personality-memory-engine";
import { resolveAgentStablePersonality } from "./personality-engine";
import { coerceConversationPersonalityState, deriveResponseEnergy, type ResponseEnergyPlan } from "./response-energy-engine";
import { checkToneConsistency } from "./tone-consistency-engine";

const PERSONALITY_ENERGY_FALLBACK: ResponseEnergyPlan = {
  effectiveEnergy: "medium",
  pacingHintFr: "Rythme naturel équilibré.",
  pacingHintEn: "Balanced natural pace.",
  reasoning: "fallback_personality_engine",
};

function safeDeriveResponseEnergy(
  input: PersonalityConsistencyInput,
  stable: AgentStablePersonality,
  state: ConversationPersonalityState,
  enthusiasm: boolean,
): { energy: ResponseEnergyPlan; fallbackUsed: boolean; errorMessage?: string } {
  try {
    const energy = deriveResponseEnergy({
      stable,
      state,
      prospectEmotion: input.prospectEmotion,
      frustrationLevel01: input.frustrationLevel01,
      enthusiasm,
    });
    console.log("[OPTIMA_PERSONALITY_ENGINE]", {
      input: {
        personaKey: input.personaKey,
        messageLen: input.message.length,
        prospectEmotion: input.prospectEmotion,
        frustrationLevel01: input.frustrationLevel01,
        turnCount: input.turnCount,
      },
      energy: energy.effectiveEnergy,
      fallback_used: false,
      error_message: null,
    });
    return { energy, fallbackUsed: false };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[OPTIMA_PERSONALITY_ENGINE]", {
      input: {
        personaKey: input.personaKey,
        messageLen: input.message.length,
        prospectEmotion: input.prospectEmotion,
      },
      energy: PERSONALITY_ENERGY_FALLBACK.effectiveEnergy,
      fallback_used: true,
      error_message: errorMessage,
    });
    return { energy: PERSONALITY_ENERGY_FALLBACK, fallbackUsed: true, errorMessage };
  }
}

export type PersonalityConsistencyInput = {
  personaKey?: string | null;
  previousPersonalityState?: ConversationPersonalityState;
  message: string;
  prospectEmotion?: string;
  frustrationLevel01?: number;
  conversationComfort01?: number;
  turnCount?: number;
  recentAssistantMessages?: string[];
  draftReply?: string;
  lang?: "fr" | "en" | "es";
};

export type PersonalitySupervisorInsights = {
  activePersonality: string;
  agentId: string;
  consistencyScore: number;
  humanizationQuality: "low" | "medium" | "high";
  emotionalStability: "stable" | "watch" | "at_risk";
  toneStyle: string;
  effectiveEnergy: string;
};

export type PersonalityConsistencyOutput = {
  stable: AgentStablePersonality;
  state: ConversationPersonalityState;
  energy: ReturnType<typeof deriveResponseEnergy>;
  toneCheck: ReturnType<typeof checkToneConsistency>;
  supervisor: PersonalitySupervisorInsights;
  consistencyRulesFr: string[];
  consistencyRulesEn: string[];
};

function humanizationQuality(consistency: number, violations: number): "low" | "medium" | "high" {
  if (consistency >= 0.78 && violations === 0) return "high";
  if (consistency >= 0.55) return "medium";
  return "low";
}

function emotionalStability(consistency: number, frustration: number): "stable" | "watch" | "at_risk" {
  if (frustration > 0.55) return "at_risk";
  if (consistency < 0.5) return "watch";
  return "stable";
}

/** Moteur principal — cohérence personnalité sur tout le fil. */
export function runPersonalityConsistencyEngine(input: PersonalityConsistencyInput): PersonalityConsistencyOutput {
  try {
    return runPersonalityConsistencyEngineCore(input);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[OPTIMA_PERSONALITY_ENGINE]", {
      scope: "runPersonalityConsistencyEngine",
      fallback_used: true,
      error_message: errorMessage,
    });
    return runPersonalityConsistencyEngineCore({
      ...input,
      previousPersonalityState: undefined,
    });
  }
}

function runPersonalityConsistencyEngineCore(input: PersonalityConsistencyInput): PersonalityConsistencyOutput {
  const stable = resolveAgentStablePersonality(input.personaKey);
  const builtState = buildConversationPersonalityState({
    stable,
    previous: input.previousPersonalityState,
    prospectComfort01: input.conversationComfort01,
    turnCount: input.turnCount,
  });
  const state = coerceConversationPersonalityState(builtState, stable);

  const enthusiasm =
    /\b(super|génial|top|hâte|yes|🔥)\b/i.test(input.message) ||
    String(input.prospectEmotion ?? "").toLowerCase().includes("excit");

  const { energy } = safeDeriveResponseEnergy(input, stable, state, enthusiasm);

  const stateWithEnergy = { ...state, effectiveEnergy: energy.effectiveEnergy };
  let toneCheck: ReturnType<typeof checkToneConsistency>;
  try {
    toneCheck = checkToneConsistency({
      stable,
      state: stateWithEnergy,
      draftReply: input.draftReply,
      recentAssistantMessages: input.recentAssistantMessages,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[OPTIMA_PERSONALITY_ENGINE]", {
      scope: "tone_consistency",
      fallback_used: true,
      error_message: errorMessage,
    });
    toneCheck = {
      consistencyScore: 0.72,
      violations: [],
      guardRulesFr: ["Ton humain stable — pas de script commercial."],
      guardRulesEn: ["Stable human tone — no commercial script."],
    };
  }

  const consistencyRulesFr = [
    ...toneCheck.guardRulesFr,
    energy.pacingHintFr,
    `Chaleur ${stable.warmthLevel} · empathie ${stable.empathyLevel} · formalité ${stable.formalityLevel}.`,
    stable.salesPressure === "low"
      ? "Pression commerciale basse — conseiller, pas pousser."
      : "Pression modérée — prochaine étape naturelle seulement.",
  ];

  const consistencyRulesEn = [...toneCheck.guardRulesEn, energy.pacingHintEn];

  const supervisor: PersonalitySupervisorInsights = {
    activePersonality: `${stable.displayName} (${stable.toneStyle})`,
    agentId: stable.agentId,
    consistencyScore: toneCheck.consistencyScore,
    humanizationQuality: humanizationQuality(toneCheck.consistencyScore, toneCheck.violations.length),
    emotionalStability: emotionalStability(toneCheck.consistencyScore, input.frustrationLevel01 ?? 0),
    toneStyle: stable.toneStyle,
    effectiveEnergy: energy.effectiveEnergy,
  };

  return {
    stable,
    state: { ...stateWithEnergy, consistencyScore: toneCheck.consistencyScore },
    energy,
    toneCheck,
    supervisor,
    consistencyRulesFr,
    consistencyRulesEn,
  };
}

/** Post-traitement réponse — anti-IA + équilibre humain. */
export function polishReplyForPersonalityConsistency(
  text: string,
  recentAssistantMessages?: string[],
): string {
  let out = text;
  const balanced = balanceHumanBehavior(out, recentAssistantMessages);
  out = balanced.text;
  const ai = reduceAiDetectionPatterns(out);
  return ai.text;
}
