import "server-only";

import { buildBusinessTimeContext } from "@/lib/agents/human-behavior/timing/time-context";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { SellerLanguage } from "@/lib/agents/seller-language";

import { analyzeResponseSelection, formatAdvancedResponseSelectionBlock } from "./advanced-response-selection";
import { formatAfricanBusinessCulturePromptBlock } from "./african-business-culture";
import { formatConfidencePromptBlock, applyConfidenceTone } from "./confidence-system";
import { formatConversationContinuityBlock } from "./conversation-continuity";
import { detectOffTopicDrift, formatConversationRedirectionBlock } from "./conversation-redirection";
import {
  extractHumanConversationMemory,
  formatHumanConversationMemoryBlock,
} from "./conversation-memory-human";
import { applyDuplicationShieldV3 } from "./duplication-shield-v3";
import { formatDigitalEnergyPromptBlock, resolveDigitalEnergy } from "./digital-energy";
import { formatFollowupIntelligencePromptBlock } from "./followup-intelligence";
import { maybeApplyHumanImperfectionV2 } from "./human-imperfection-v2";
import { computeMobileBehaviorTiming } from "./mobile-behavior";
import { stageWhatsAppMessages } from "./message-staging";
import { formatNaturalReassurancePromptBlock } from "./natural-reassurance";
import { diversifyResponseOpener } from "./response-variety-v5";
import { detectWhatsAppSocialTension, formatWhatsAppSocialTensionBlock } from "./social-tension";
import { formatHumanSalesSubtletyBlock } from "./sales-subtlety";
import { applyWhatsAppRealismFilter } from "./whatsapp-realism-filter";

export type WhatsAppPresencePrePromptInput = {
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  lang: SellerLanguage;
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
};

/** Blocs prompt L19 — avant génération LLM. */
export function buildWhatsAppPresencePrePromptBlock(input: WhatsAppPresencePrePromptInput): string {
  const lang: "fr" | "en" | "es" = input.lang === "en" ? "en" : input.lang === "es" ? "es" : "fr";
  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
  });
  const energy = resolveDigitalEnergy(timeCtx.daySlot, timeCtx.hour);
  const selection = analyzeResponseSelection({
    lastUserMessage: input.lastUserMessage,
    conversationState: input.conversationState,
    daySlot: timeCtx.daySlot,
    hourLocal: timeCtx.hour,
  });
  const tension = detectWhatsAppSocialTension(input.lastUserMessage);
  const offTopic = detectOffTopicDrift(input.lastUserMessage);
  const mem = extractHumanConversationMemory(input.conversationState);

  const parts = [
    "LEVEL 19 — ELITE WHATSAPP HUMAN PRESENCE:",
    "The prospect must feel a real active human on WhatsApp — indistinguishable from a modern African sales advisor.",
    formatAfricanBusinessCulturePromptBlock(input.lang),
    formatDigitalEnergyPromptBlock(energy, lang),
    formatConfidencePromptBlock(lang),
    formatNaturalReassurancePromptBlock(lang),
    formatHumanSalesSubtletyBlock(input.lang),
    formatFollowupIntelligencePromptBlock(input.lang),
    formatAdvancedResponseSelectionBlock(selection, lang),
    formatWhatsAppSocialTensionBlock(tension, lang),
    formatConversationRedirectionBlock(lang, offTopic),
    formatHumanConversationMemoryBlock(mem, lang),
    formatConversationContinuityBlock(input.conversationState, lang),
  ].filter(Boolean) as string[];

  return parts.join("\n\n");
}

export type WhatsAppPresencePipelineInput = {
  text: string;
  messagePlan: string[];
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  lang: "fr" | "en" | "es";
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  microSeed?: string;
  recentAssistantMessages?: string[];
};

export type WhatsAppPresencePipelineResult = {
  text: string;
  messagePlan: string[];
  meta: {
    energyLevel: string;
    mobilePhase: string;
    tension: string;
    realismFixes: number;
    strippedDuplicates: number;
    maxBubbles: number;
    extraDelayMs: number;
    extraTypingMs: number;
  };
};

/** Post-traitement L19 — après pipelines L14–L17. */
export function runWhatsAppPresencePipeline(
  input: WhatsAppPresencePipelineInput,
): WhatsAppPresencePipelineResult {
  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
  });
  const energy = resolveDigitalEnergy(timeCtx.daySlot, timeCtx.hour);
  const selection = analyzeResponseSelection({
    lastUserMessage: input.lastUserMessage,
    conversationState: input.conversationState,
    daySlot: timeCtx.daySlot,
    hourLocal: timeCtx.hour,
  });
  const fatigue = input.conversationState?.stats?.fatigue ?? 0;
  const seed = input.microSeed ?? input.lastUserMessage;

  let text = String(input.text ?? "").trim();
  let plan = input.messagePlan.length ? [...input.messagePlan] : [text];

  const realism = applyWhatsAppRealismFilter(text);
  text = realism.text;
  plan = plan.map((b) => applyWhatsAppRealismFilter(b).text).filter(Boolean);

  const confidence = applyConfidenceTone(text);
  text = confidence.text;

  text = diversifyResponseOpener(text, input.recentAssistantMessages, input.lang, seed);

  const imperfection = maybeApplyHumanImperfectionV2(text, seed, input.lang);
  text = imperfection.text;

  if (selection.preferShort && text.length > 320) {
    const chunks = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    text = chunks.slice(0, 2).join(" ").trim() || text.slice(0, 320).trim();
  }

  if (selection.allowStaging) {
    plan = stageWhatsAppMessages({ text, microSeed: seed, maxBubbles: selection.maxBubbles });
  } else {
    plan = [text];
  }

  const shield = applyDuplicationShieldV3({
    text: plan.join("\n\n"),
    messagePlan: plan,
    recentAssistantMessages: input.recentAssistantMessages,
    socialOnlyMode: input.conversationState?.socialOnlyMode?.active === true,
  });
  text = shield.text;
  plan = shield.messagePlan;

  const mobile = computeMobileBehaviorTiming({
    userMessage: input.lastUserMessage,
    replyChars: text.length,
    daySlot: timeCtx.daySlot,
    delaySeed: seed,
    fatigue,
  });

  return {
    text,
    messagePlan: plan.length ? plan : text ? [text] : [],
    meta: {
      energyLevel: energy.level,
      mobilePhase: mobile.phase,
      tension: selection.tension,
      realismFixes: realism.fixes,
      strippedDuplicates: shield.strippedDuplicates,
      maxBubbles: selection.maxBubbles,
      extraDelayMs:
        mobile.readPauseMs + mobile.thinkPauseMs + mobile.resumeBumpMs + mobile.microInterruptMs,
      extraTypingMs: mobile.typingProgressiveMs,
    },
  };
}

export function formatLevel19WhatsAppPresencePromptBlock(
  input: WhatsAppPresencePrePromptInput,
): string {
  return buildWhatsAppPresencePrePromptBlock(input);
}
