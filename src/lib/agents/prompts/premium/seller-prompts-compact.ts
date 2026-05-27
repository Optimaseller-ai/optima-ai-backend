import "server-only";

import { detectDominantLanguage } from "@/lib/agents/seller-language";
import type { PremiumSellerProfile, PremiumSellerContext } from "./seller-prompts";
import { formatSocialHumanizationPromptBlock } from "@/lib/agents/social";
import {
  formatEmotionalIntelligencePromptBlock,
  runEmotionalIntelligenceEngine,
} from "@/lib/agents/emotional-intelligence";
import {
  formatPersonalityConsistencyPromptBlockShort,
  runPersonalityConsistencyEngine,
} from "@/lib/agents/personality";
import { formatSalesDecisionPromptBlock, runSalesDecisionEngine } from "@/lib/agents/sales-brain";
import { detectProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import {
  formatHumanShortReplyPromptBlock,
  resolveHumanShortReplyContext,
} from "@/lib/agents/human-behavior/human-short-reply-engine";
import { formatProspectProfilePromptBlock } from "@/lib/agents/memory/prospect-profile";
import { truncateText } from "@/lib/ai/prompt-budget";

/** System prompt compact — personnalité short, pas le bloc complet à chaque tour. */
export function buildPremiumSystemPromptCompact(profile: PremiumSellerProfile, ctx: PremiumSellerContext): string {
  const lang = detectDominantLanguage({
    message: ctx.message,
    previous: ctx.conversationState?.language,
    history: ctx.history,
  });

  const turnIntent = ctx.prospectTurnIntent ?? detectProspectTurnIntent(ctx.message);
  const emotionalIntel = runEmotionalIntelligenceEngine({
    message: ctx.message,
    previousState: ctx.conversationState?.prospectEmotionalState,
    salesSignalsTrust01: ctx.conversationState?.salesSignalsMemory?.trustLevel01,
    turnCount: ctx.conversationState?.stats?.turn_count,
    commercialObjections: ctx.conversationState?.commercialMemory?.objections,
    lang,
  });

  const personality = runPersonalityConsistencyEngine({
    personaKey: ctx.personaKey,
    previousPersonalityState: ctx.conversationState?.conversationPersonalityState,
    message: ctx.message,
    prospectEmotion: emotionalIntel.state.dominantEmotion,
    frustrationLevel01: emotionalIntel.state.frustrationLevel,
    conversationComfort01: emotionalIntel.state.conversationComfort,
    turnCount: ctx.conversationState?.stats?.turn_count,
    lang,
  });

  const salesDecision = runSalesDecisionEngine({
    message: ctx.message,
    sellerIntent: ctx.conversationState?.lastSellerIntent ?? "other",
    conversationProfile: ctx.conversationState?.conversationProfile,
    commercialMemory: ctx.conversationState?.commercialMemory,
    salesSignalsMemory: ctx.conversationState?.salesSignalsMemory,
    stats: ctx.conversationState?.stats,
    lang,
    blockAggressiveClose: emotionalIntel.adaptation.blockAggressiveClose || ctx.socialHumanization?.suppressSalesUrgency,
  });

  const socialBlock = ctx.socialHumanization
    ? formatSocialHumanizationPromptBlock(ctx.socialHumanization, lang)
    : "";

  const prospectBlock = formatProspectProfilePromptBlock(ctx.conversationState?.prospectProfile, lang);

  const shortCtx = resolveHumanShortReplyContext({
    message: ctx.message,
    turnCount: ctx.conversationState?.stats?.turn_count,
    frustrationLevel01: ctx.conversationState?.prospectEmotionalState?.frustrationLevel,
  });
  const shortBlock = formatHumanShortReplyPromptBlock(shortCtx, lang);

  const coreFr = [
    `Tu es ${profile.agentName}, conseillère humaine WhatsApp chez ${profile.businessName} — pas un assistant IA.`,
    "WhatsApp réel : une phrase suffit souvent (70% des tours). Max 0–1 emoji.",
    "Interdit : relance en question, « si vous avez besoin », « n'hésitez pas », « vous avez prévu », « comment puis-je », « je reste à disposition ».",
    "Ne pas se présenter en bloc (nom + entreprise + question) — répondre au message seulement.",
    "Catalogue/prix uniquement si fourni ci-dessous — ne jamais inventer.",
    `Intention tour : ${turnIntent}.`,
  ].join("\n");

  const coreEn = [
    `You are ${profile.agentName}, a real human WhatsApp advisor at ${profile.businessName} — not an AI assistant.`,
    "Short replies (1–2 sentences), natural tone, 0–1 emoji max.",
    "Forbidden: generic support scripts, product pitch on pure social turns.",
    `Turn intent: ${turnIntent}.`,
  ].join("\n");

  const core = lang === "en" ? coreEn : lang === "es" ? coreFr.replace(/conseillère/g, "asesora") : coreFr;

  const parts = [
    core,
    "",
    shortBlock || "",
    "",
    formatPersonalityConsistencyPromptBlockShort(personality, lang),
    "",
    formatEmotionalIntelligencePromptBlock(emotionalIntel, lang),
    "",
    formatSalesDecisionPromptBlock(salesDecision, lang),
    "",
    prospectBlock || "",
    "",
    socialBlock || "",
    "",
    ctx.liveOrchestratorBlock ? truncateText(ctx.liveOrchestratorBlock, 500) : "",
    "",
    ctx.businessBrainBlock ? truncateText(ctx.businessBrainBlock, 900) : "",
    "",
    ctx.salesOpportunityBlock ? truncateText(ctx.salesOpportunityBlock, 400) : "",
    "",
    ctx.learningBlock ? truncateText(ctx.learningBlock, 300) : "",
  ].filter(Boolean);

  return parts.join("\n");
}
