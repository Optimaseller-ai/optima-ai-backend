import "server-only";

import { runAntiAiFilterPass } from "./anti-ai/anti-ai-filter";
import { runAntiAiV3Pass } from "./anti-ai/anti-ai-v3";
import { orchestrateHumanReply } from "./response-orchestrator";
import { detectProspectEmotion } from "./emotions/emotion-detector";
import { inferConversationEmotionalTemperature, maxReplyCharsForTemperature } from "./emotions/conversation-emotion";
import { computeResponseWeight, minMessengerCharsForWeight } from "./response-weight-system";
import { softenArtificialEnthusiasm, stripCasualOpeners } from "./personality/professional-language";
import { computeHumanResponseDelayMs, computeTypingDelayMs } from "./timing/human-timing-engine";
import { buildBusinessTimeContext } from "./timing/time-context";
import { filterAdvisorReplyHumanLikeness } from "./human-advisor-reply-filter";
import { repairSocialSupportModeReply } from "./social-reply-repair";
import { runResponseCoherenceEngine } from "./coherence/response-coherence-engine";
import { runHumanConversationMasteryPipeline } from "./human-conversation-mastery/human-conversation-mastery-pipeline";
import { runHumanRealityCorePipeline } from "./human-reality-core/human-reality-pipeline";
import { runHumanSocialExistencePipeline } from "./human-social-existence/human-social-existence-pipeline";
import { runHumanSubconsciousImmersionPipeline } from "./human-subconscious-immersion/subconscious-immersion-pipeline";
import { runWhatsAppPresencePipeline } from "./whatsapp-presence/whatsapp-presence-engine";
import { enforceHumanConversationReply, inferIntentPriority } from "@/lib/agents/human-conversation";
import { polishReplyForPersonalityConsistency } from "@/lib/agents/personality";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type HumanResponseEngineInput = {
  rawAssistantText: string;
  microSeed?: string;
  repliesSinceLastEmoji?: number;
  /** Dernier message prospect (émotion + timing). */
  lastUserMessage?: string;
  /** Blacklist métier (profil vendeur). */
  extraPhraseBlacklist?: string[];
  /** Pour délais + fuseau. */
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  conversationState?: SellerBehaviorConversationState;
  agentName?: string;
  /** Derniers messages assistant (anti-répétition L14). */
  recentAssistantMessages?: string[];
};

export type HumanResponseEngineResult = {
  /** Texte prêt pour un canal « une bulle » (lignes courtes, anti-IA appliqué). */
  text: string;
  /** Plan multi-messages si découpe activée. */
  messagePlan: string[];
  meta: {
    emotion: ReturnType<typeof detectProspectEmotion>;
    suggestedDelayBeforeSendMs: number;
    suggestedTypingDurationMs: number;
    antiAiPhraseRemovals: number;
    wasShortened: boolean;
    usedMultiBubblePlan: boolean;
    coherenceIntent?: string;
    coherenceLanguage?: string;
    l14Mode?: string;
    l14Energy?: string;
    l15Atmosphere?: string;
    l15Familiarity?: string;
    l16RealismScore?: number;
    l16Attention?: string;
    l17Density?: string;
    l17SocialInstinct?: string;
    l19EnergyLevel?: string;
    l19MobilePhase?: string;
    l19Tension?: string;
  };
};

function applyEmojiPolicy(text: string, repliesSinceLastEmoji: number): string {
  let out = String(text ?? "").trim();
  const sinceEmoji = repliesSinceLastEmoji ?? 7;
  if (sinceEmoji < 7) {
    out = out.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s{2,}/g, " ").trim();
  } else {
    const emojis = out.match(/[\p{Extended_Pictographic}]/gu) ?? [];
    if (emojis.length > 1) {
      let kept = 0;
      out = out.replace(/[\p{Extended_Pictographic}]/gu, (m) => {
        kept += 1;
        return kept === 1 ? m : "";
      });
      out = out.replace(/\s{2,}/g, " ").trim();
    }
  }
  return out;
}

function enforceShortMessengerShape(text: string, maxChars = 420): { text: string; wasShortened: boolean } {
  let out = String(text ?? "").trim();
  const origLen = out.length;
  const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
  out = lines.slice(0, 3).join("\n");
  if (out.length > maxChars) out = out.slice(0, maxChars).trim();
  return { text: out, wasShortened: out.length < origLen || lines.length > 3 };
}

function clampReplyLengthForNegativeEmotion(
  text: string,
  userMsg: string,
  emotion: ReturnType<typeof detectProspectEmotion>,
): string {
  const weight = computeResponseWeight(userMsg);
  if (weight.tier === "heavy") return text;
  const temp = inferConversationEmotionalTemperature(userMsg);
  const max = maxReplyCharsForTemperature(temp);
  if (emotion !== "anger" && emotion !== "frustration" && temp !== "frustré" && temp !== "irrité") return text;
  if (text.length <= max) return text;
  const chunks = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  let acc = "";
  for (const c of chunks) {
    const next = acc ? `${acc} ${c}` : c;
    if (next.length > max) break;
    acc = next;
  }
  if (acc.trim().length >= 20) return acc.trim();
  return text.slice(0, max).trim();
}

/**
 * Pipeline central : humanise une réponse brute du modèle (Seller AI).
 */
export function runHumanResponseEngine(input: HumanResponseEngineInput): HumanResponseEngineResult {
  const userMsg = String(input.lastUserMessage ?? "");
  const emotion = detectProspectEmotion(userMsg);
  const weight = computeResponseWeight(userMsg);
  const maxShape = Math.max(
    maxReplyCharsForTemperature(inferConversationEmotionalTemperature(userMsg)),
    minMessengerCharsForWeight(weight.tier),
  );

  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
  });

  const realismLang: "fr" | "en" | "es" =
    input.conversationState?.language === "en" ? "en" : input.conversationState?.language === "es" ? "es" : "fr";
  const antiV3 = runAntiAiV3Pass(input.rawAssistantText, realismLang, input.extraPhraseBlacklist);
  let out = antiV3.text;
  const anti = { removedPhraseHits: antiV3.flags.length };

  out = stripCasualOpeners(out);
  out = softenArtificialEnthusiasm(out);

  const shortPack = enforceShortMessengerShape(out, maxShape);
  out = shortPack.text;

  out = applyEmojiPolicy(out, input.repliesSinceLastEmoji ?? 7);

  const orchestrated = orchestrateHumanReply({
    lastUserMessage: userMsg,
    draftText: out,
    microSeed: input.microSeed ?? out,
    repliesSinceLastEmoji: input.repliesSinceLastEmoji ?? 7,
    stateLanguage: input.conversationState?.language,
  });
  const plan = orchestrated.messagePlan;
  const usedMulti = plan.length > 1;
  let text = orchestrated.text;
  text = clampReplyLengthForNegativeEmotion(text, userMsg, emotion);

  const humanPass = filterAdvisorReplyHumanLikeness({
    reply: text,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
  });
  text = humanPass.text;
  text = repairSocialSupportModeReply({
    reply: text,
    userMessage: userMsg,
    lang: realismLang,
    agentName: input.agentName,
  });

  const coherence = runResponseCoherenceEngine({
    draftText: text,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
    city: input.city,
    businessName: input.country,
  });
  text = coherence.text;
  const finalPlan = coherence.messagePlan.length ? coherence.messagePlan : plan;

  const mastery = runHumanConversationMasteryPipeline({
    text,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
    recentAssistantMessages: input.recentAssistantMessages,
    microSeed: input.microSeed ?? userMsg,
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
  });
  text = mastery.text;

  const reality = runHumanRealityCorePipeline({
    text,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
    microSeed: input.microSeed ?? userMsg,
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
    lang: realismLang,
    extraPhraseBlacklist: input.extraPhraseBlacklist,
  });
  text = reality.text;

  const existence = runHumanSocialExistencePipeline({
    text,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
    microSeed: input.microSeed ?? userMsg,
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
    lang: realismLang,
  });
  text = existence.text;

  const subconscious = runHumanSubconsciousImmersionPipeline({
    text,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
    microSeed: input.microSeed ?? userMsg,
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
    lang: realismLang,
    emotion,
    extraPhraseBlacklist: input.extraPhraseBlacklist,
    recentAssistantMessages: input.recentAssistantMessages,
  });
  text = subconscious.text;

  const whatsappPresence = runWhatsAppPresencePipeline({
    text,
    messagePlan: finalPlan,
    lastUserMessage: userMsg,
    conversationState: input.conversationState,
    lang: realismLang,
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
    microSeed: input.microSeed ?? userMsg,
    recentAssistantMessages: input.recentAssistantMessages,
  });
  text = whatsappPresence.text;
  const finalPlanL19 = whatsappPresence.messagePlan.length ? whatsappPresence.messagePlan : finalPlan;

  const intentPriority = inferIntentPriority(userMsg).priority;
  const humanGuard = enforceHumanConversationReply({
    text,
    intentPriority,
    lang: realismLang,
    recentAssistantMessages: input.recentAssistantMessages,
    seed: input.microSeed ?? userMsg,
  });
  text = humanGuard.text;
  text = polishReplyForPersonalityConsistency(text, input.recentAssistantMessages);

  const delay =
    computeHumanResponseDelayMs({
      prospectMessage: userMsg,
      emotion,
      daySlot: timeCtx.daySlot,
      replyCharEstimate: text.length,
      hourLocal: timeCtx.hour,
      delaySeed: input.microSeed ?? userMsg,
    }) +
    mastery.meta.microDelay.readPauseExtraMs +
    reality.meta.rhythm.readPauseExtraMs +
    existence.meta.snapshot.fatigue.calmReadExtraMs +
    existence.meta.snapshot.pacing.readSimMs +
    existence.meta.snapshot.pacing.thinkPauseMs +
    existence.meta.snapshot.pacing.microInterruptMs +
    existence.meta.snapshot.breathingExtraMs +
    subconscious.meta.rhythm.hesitationPauseMs +
    subconscious.meta.rhythm.reflectionBumpMs +
    subconscious.meta.rhythm.microInterruptMs +
    whatsappPresence.meta.extraDelayMs;

  const typing =
    computeTypingDelayMs(text, emotion, timeCtx.hour) +
    mastery.meta.microDelay.typingExtraMs +
    reality.meta.rhythm.typingVarianceMs +
    existence.meta.snapshot.fatigue.typingSlowdownMs +
    existence.meta.snapshot.pacing.typingProgressiveMs +
    subconscious.meta.rhythm.resumeTypingMs +
    whatsappPresence.meta.extraTypingMs;

  return {
    text,
    messagePlan: finalPlanL19,
    meta: {
      emotion,
      suggestedDelayBeforeSendMs: delay,
      suggestedTypingDurationMs: typing,
      antiAiPhraseRemovals: anti.removedPhraseHits,
      wasShortened: shortPack.wasShortened,
      usedMultiBubblePlan: finalPlanL19.length > 1,
      coherenceIntent: coherence.meta.primaryIntent,
      coherenceLanguage: coherence.meta.lockedLanguage,
      l14Mode: mastery.meta.mode,
      l14Energy: mastery.meta.energy,
      l15Atmosphere: reality.meta.snapshot.atmosphere.atmosphere,
      l15Familiarity: reality.meta.snapshot.social.familiarity,
      l16RealismScore: existence.meta.realismScore,
      l16Attention: existence.meta.snapshot.attention.wanderHint,
      l17Density: subconscious.meta.snapshot.density,
      l17SocialInstinct: subconscious.meta.snapshot.instinct.primary,
      l19EnergyLevel: whatsappPresence.meta.energyLevel,
      l19MobilePhase: whatsappPresence.meta.mobilePhase,
      l19Tension: whatsappPresence.meta.tension,
    },
  };
}
