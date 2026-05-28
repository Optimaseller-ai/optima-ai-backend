import { createAdminClientSafe } from "@/lib/supabase/admin";
import { openRouterChat, openRouterEmbed } from "@/lib/ai/openrouter";
import { logOpenRouterProxyConfigOnce } from "@/lib/ai/openrouter-proxy-config";
import { loadLlmCache, saveLlmCache } from "@/lib/redis/llm-response-cache";
import { resolveBusinessTimezone } from "@/lib/agents/timing/business-timezone";
import {
  searchBusinessKnowledge,
  retrieveBusinessContextFromSnapshot,
  formatRetrievalProductsForPrompt,
} from "@/lib/business-knowledge";
import { detectKnowledgeTopics } from "@/lib/business-knowledge/topic-detector";
import { shouldRunKnowledgeEmbedding, shouldSearchCatalog } from "@/lib/business-knowledge/should-search-catalog";
import { loadBusinessKnowledgeProfile } from "@/lib/business-knowledge/profile/business-knowledge-profile";
import {
  buildBusinessKnowledgeBase,
  buildServiceGroundedFallback,
  formatBusinessKnowledgeBaseBlock,
  mergeCatalogProducts,
} from "@/lib/business-brain/context/business-knowledge-base";
import { detectBusinessIntent } from "@/lib/business-brain/intent/business-intent-detector";
import {
  enforceStrictBusinessOutputFilter,
  formatStrictNoHallucinationBlock,
} from "@/lib/business-brain/grounding/strict-grounding";
import {
  analyzeSocialUnderstanding,
  buildCatalogGroundedReply,
  isLowHumanQualityReply,
  pickDirectedGreetingReply,
} from "@/lib/business-brain/social/social-understanding";
import { validateAndCleanOutgoingReply } from "@/lib/ai/validators/response-grounding-validator";
import { cleanMemoryFacts } from "@/lib/ai/memory/conversation-memory-cleaner";
import { stripAiSpeakerLabels } from "@/lib/chat/pipeline/strip-ai-labels";
import {
  resolveBusinessHoursContext,
  stripFakeVerificationPhrases,
} from "@/lib/agents/business-data/business-data-priority";
import { classifyProspectSalesIntent } from "@/lib/agents/sales/prospect-intent-classifier";
import { buildHumanSalesMemoryCallback } from "@/lib/agents/memory/human-sales-memory";
import { optimaLog } from "@/lib/logging/optima-logger";
import { logStructured } from "@/lib/logging/structured-log";
import { classifyConversationEmotion } from "@/lib/agents/emotional-intelligence/conversation-emotion-classifier";
import {
  buildCriticalPriorityReply,
  isAllowedMicroSocialMessage,
  shouldAllowSocialQuickPath,
} from "@/lib/chat/pipeline/conversation-priority-engine";
import { lockedLanguageFallback, resolveSessionLanguageLock } from "@/lib/chat/pipeline/session-language-lock";
import {
  postProcessPremiumReply,
  quickHumanReply,
  detectDominantLanguage,
  type PremiumSellerProfile,
} from "@/lib/agents/prompts/premium/seller-prompts";
import {
  DEFAULT_CONVERSATION_PROFILE,
  type SellerBehaviorConversationState,
} from "@/lib/agents/memory/conversation-state";
import { detectProspectTurnIntent, salesOpportunityAllowedForIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import { prospectExplicitlyRefusesOrder } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import { runSalesOpportunityEngine } from "@/lib/agents/sales/opportunity-engine";
import { runSalesDecisionEngine } from "@/lib/agents/sales-brain";
import { runLiveConversationOrchestrator } from "@/lib/orchestrator";
import type { ConversationLiveState } from "@/lib/orchestrator";
import type { SupervisorInsights } from "@/lib/ai/sales/types";
import {
  runEmotionalIntelligenceEngine,
  type EmotionalSupervisorInsights,
} from "@/lib/agents/emotional-intelligence";
import {
  runPersonalityConsistencyEngine,
  type PersonalitySupervisorInsights,
} from "@/lib/agents/personality";
import {
  classifyConversationIntent,
  runSocialConversationEngine,
  runSocialHumanizationLayer,
  type SocialHumanizationOutput,
  type SocialSupervisorInsights,
} from "@/lib/agents/social";
import { resolveConversationRouting } from "@/lib/agents/social/business-conversation-router";
import { detectSocialTeasing } from "@/lib/agents/social/social-teasing-detector";
import { humanSocialResponseEngine } from "@/lib/agents/social/human-social-response-engine";
import { computeBotRiskScore, stripSocialCommercialBlacklistedPhrases } from "@/lib/agents/social/social-bot-risk";
import { stripBlacklistedPhrases } from "@/lib/ai/validators/humanEnough";
import {
  beginReplyTurn,
  createCentralReplyOrchestrator,
  messageRequiresMainReplyPipeline,
  type OwnedReply,
  type ReplyTurnContext,
} from "@/lib/chat/pipeline/central-reply-manager";
import {
  resolveHumanShortReplyContext,
  tryBuildHumanMicroReply,
} from "@/lib/agents/human-behavior/human-short-reply-engine";
import type { ConversationPipelineDebugger } from "@/lib/chat/pipeline/conversation-pipeline-debugger";
import { resolveSocialOnlyHardLock } from "@/lib/chat/pipeline/social-only-hard-lock";
import { safeEngineExecute, safeEngineExecuteSync } from "@/lib/chat/pipeline/safe-engine-executor";
import {
  sanitizeConversationStateForLlm,
  sanitizeHistoryForLlm,
  sanitizeReplyTransformationChain,
} from "@/lib/chat/pipeline/contamination-filter";
import {
  detectWeakUserMessage,
  detectConversationEnding,
  pickEndingHumanReply,
  pickMinimalHumanReply,
  updateAiPressureScore,
} from "@/lib/chat/pipeline/human-silence-engine";
import { updateProspectBehaviorState } from "@/lib/agents/memory/prospect-behavior-memory";
import {
  adaptPersonalityEnergy,
  adaptSalesStrategy,
  applyCommercialAdaptationToHumanPlan,
  runAdaptiveCommercialBehavior,
  type CommercialAdaptationMemory,
} from "@/lib/agents/commercial/adaptive-commercial-behavior-engine";
import {
  formatRecoHintForPrompt,
  recommendFromCatalog,
} from "@/lib/agents/recommendation/catalog-recommender";
import {
  PROMPT_BUDGET,
  compressChatHistory,
  prepareOpenRouterPayload,
  truncateContextBlocks,
} from "@/lib/ai/prompt-budget";
import { chooseOpenRouterModel } from "@/lib/ai/openrouter/modelPolicy";
import { inferDynamicEnergy } from "@/lib/ai/dynamicEnergyEngine";
import { buildHumanBehaviorPlan } from "@/lib/ai/humanBehaviorEngine";
import { buildDynamicPromptBundle } from "@/lib/ai/prompts/dynamicPromptBuilder";
import { validateHumanReplyLength } from "@/lib/ai/validators/humanReplyValidator";
import { buildHumanDeliveryPlan } from "@/lib/chat/humanDeliverySimulator";
import { applyHumanImperfections } from "@/lib/ai/imperfectionEngine";
import { enforcePremiumEmojiPolicy } from "@/lib/ai/emojiPolicy";
import {
  getContextualFallback,
  safeGetContextualFallback,
  type ContextualFallbackInput,
} from "@/lib/chat/pipeline/contextual-fallbacks";

const MAX_HISTORY_MESSAGES = PROMPT_BUDGET.MAX_HISTORY_TURNS;
const MAX_CATALOG_PRODUCTS = PROMPT_BUDGET.MAX_PRODUCTS;
const CONTEXT_CACHE_TTL_MS = 45_000;
const PROFILE_CACHE_TTL_MS = 120_000;

type ProfileCacheEntry = {
  exp: number;
  profileBusinessName: string;
  sector: string;
  city: string;
  country: string;
  tone: unknown;
};

type RagCacheEntry = {
  exp: number;
  topChunks: string;
};

const profileCache = new Map<string, ProfileCacheEntry>();
const ragCache = new Map<string, RagCacheEntry>();

function cacheKeyMsg(userId: string, message: string) {
  return `${userId}:${message.trim().toLowerCase().slice(0, 240)}`;
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function logCtx(event: string, payload: Record<string, unknown>) {
  optimaLog.debug("OPTIMA_AI_BUSINESS_CONTEXT", { event, ...payload });
}

function pickContextualFallback(input: ContextualFallbackInput): string {
  if (typeof getContextualFallback === "function") {
    return safeGetContextualFallback(input);
  }
  const smile = input.allowEmoji ? " 🙂" : "";
  return input.lang === "en"
    ? `Sorry — I can help you pick an item${smile}.`
    : input.lang === "es"
      ? `Perdone — le ayudo a elegir un artículo${smile}.`
      : `Désolé, je peux vous aider à choisir un article${smile}.`;
}

async function openRouterChatWithOneRetry(
  payload: ReturnType<typeof prepareOpenRouterPayload> & {
    model?: string;
    maxTokensOverride?: number;
  },
) {
  const call = () =>
    openRouterChat({
      model: payload.model,
      messages: payload.messages,
      timeoutMs: 25_000,
      maxTokens: payload.maxTokensOverride ?? payload.maxTokens,
      temperature: 0.85,
      topP: 0.9,
      presencePenalty: 0.4,
      frequencyPenalty: 0.3,
      promptBudget: {
        finalPromptTokens: payload.finalPromptTokens,
        finalMaxTokens: payload.finalMaxTokens,
        remainingBudget: payload.remainingBudget,
        compressed: payload.compressed,
      },
    });
  try {
    console.log("[TRACE]", "openrouter_request_start", {
      model: payload.model,
      promptTokens: payload.finalPromptTokens,
      maxTokens: payload.maxTokensOverride ?? payload.maxTokens,
    });
    return await call();
  } catch (e1) {
    console.error("[OPTIMA_AI_ERROR]", e1);
    const msg = e1 instanceof Error ? e1.message : String(e1);
    if (/Missing OPENROUTER_API_KEY/i.test(msg)) throw e1;
    console.log("[TRACE]", "retry_start", { reason: msg });
    await delay(2000);
    try {
      const out = await call();
      console.log("[TRACE]", "retry_end", { ok: true });
      return out;
    } catch (e2) {
      console.error("[TRACE]", "retry_end", { ok: false, error: e2 instanceof Error ? e2.message : String(e2) });
      throw e2;
    }
  }
}

export type GenerateAIReplyResult = {
  reply: string;
  replyOwnership?: OwnedReply;
  replyTransformationChain?: import("@/lib/chat/pipeline/reply-transformation-chain").ReplyTransformLog[];
  socialOnlyMode?: boolean;
  liveOrchestrator?: ConversationLiveState;
  conversationStateNext?: SellerBehaviorConversationState;
  /** Insights superviseur (stratégie, objections, probabilité conversion). */
  supervisorInsights?: SupervisorInsights;
  /** Insights émotionnels (confiance, abandon, relation). */
  emotionalSupervisorInsights?: EmotionalSupervisorInsights;
  personalitySupervisorInsights?: PersonalitySupervisorInsights;
  socialSupervisorInsights?: SocialSupervisorInsights;
};

export async function generateAIReply(args: {
  message: string;
  userId: string;
  agentName?: string;
  agentPersonality?: "chaleureux" | "professionnel" | "dynamique";
  salesStyle?: "conseiller" | "closer" | "premium";
  businessName?: string;
  conversationState?: SellerBehaviorConversationState;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  agentRole?: string;
  agentTone?: string;
  personaKey?: string | null;
  /** Génération du 2e message après « je vérifie » */
  followupAfterHold?: boolean;
  sessionId?: string;
  agentId?: string;
  pipelineDebugger?: ConversationPipelineDebugger;
  replyTurn?: ReplyTurnContext;
}): Promise<GenerateAIReplyResult> {
  args = {
    ...args,
    conversationState: sanitizeConversationStateForLlm(args.conversationState),
    history: sanitizeHistoryForLlm(Array.isArray(args.history) ? args.history : []).history,
  };

  const dbg = args.pipelineDebugger;
  const pipelineStart = Date.now();
  console.log("[TRACE]", "generateAIReply_start", {
    ms: 0,
    session_id: args.sessionId,
    request_id: args.replyTurn?.request_id,
  });
  logCtx("generate_start", {
    userId: args.userId,
    messageLen: args.message.length,
    historyLen: Array.isArray(args.history) ? args.history.length : 0,
  });

  const admin = createAdminClientSafe();
  if (!admin) {
    console.error("[generateAIReply] No admin client");
    const lang = args.conversationState?.language === "en" ? "en" : args.conversationState?.language === "es" ? "es" : "fr";
    dbg?.setMeta({ responseMode: "fallback", fallbackKind: "discovery" });
    return {
      reply: pickContextualFallback({
        lang,
        userMessage: args.message,
        agentName: args.agentName ?? "Conseiller",
        businessName: args.businessName ?? "notre boutique",
        personaKey: args.personaKey,
        kind: "discovery",
      }),
    };
  }

  const { message, userId } = args;
  const rawHistory = Array.isArray(args.history) ? args.history : [];
  const { history, summarizedCount } = compressChatHistory(rawHistory, MAX_HISTORY_MESSAGES);
  if (summarizedCount > 0) {
    logCtx("history_compressed", { userId, summarizedCount, kept: history.length });
  }

  // Persistent human behavioral memory (stored in conversation_state; caller persists it).
  const behaviorUpdate = updateProspectBehaviorState({
    previous: args.conversationState,
    userMessage: message,
    history,
  });
  args.conversationState = {
    ...(args.conversationState ?? {}),
    prospect_behavior: behaviorUpdate.prospect_behavior,
    emotional_flow: behaviorUpdate.emotional_flow,
    ai_pressure_score: behaviorUpdate.ai_pressure_score,
  } as any;
  console.log("[PROSPECT_BEHAVIOR]", {
    request_id: args.replyTurn?.request_id,
    addressing: behaviorUpdate.prospect_behavior.addressing,
    politenessLevel01: behaviorUpdate.prospect_behavior.politenessLevel01,
    humor01: behaviorUpdate.prospect_behavior.humor01,
    coldness01: behaviorUpdate.prospect_behavior.coldness01,
    aggressivity01: behaviorUpdate.prospect_behavior.aggressivity01,
    avgUserMsgLen: behaviorUpdate.prospect_behavior.avgUserMsgLen,
    emojiFreq01: behaviorUpdate.prospect_behavior.emojiFreq01,
  });
  console.log("[EMOTIONAL_FLOW]", {
    request_id: args.replyTurn?.request_id,
    saturation01: behaviorUpdate.emotional_flow.saturation01,
    fatigue01: behaviorUpdate.emotional_flow.fatigue01,
    frustration01: behaviorUpdate.emotional_flow.frustration01,
    curiosity01: behaviorUpdate.emotional_flow.curiosity01,
    impatience01: behaviorUpdate.emotional_flow.impatience01,
    highTrustMode: behaviorUpdate.emotional_flow.highTrustMode,
  });

  const prospectTurnIntentEarly = detectProspectTurnIntent(message);
  const commercialAdaptRun = runAdaptiveCommercialBehavior({
    message,
    history,
    conversationState: args.conversationState,
    turnIntent: prospectTurnIntentEarly,
    lang: args.conversationState?.language === "en" ? "en" : args.conversationState?.language === "es" ? "es" : "fr",
  });
  args.conversationState = {
    ...(args.conversationState ?? {}),
    commercial_adaptation: commercialAdaptRun.adaptation,
    conversationProfile: {
      ...(args.conversationState?.conversationProfile ?? DEFAULT_CONVERSATION_PROFILE),
      ...commercialAdaptRun.conversationProfilePatch,
    },
  } as any;
  console.log("[COMMERCIAL_ADAPTATION]", {
    request_id: args.replyTurn?.request_id,
    dominantProfile: commercialAdaptRun.adaptation.dominantProfile,
    secondaryProfile: commercialAdaptRun.adaptation.secondaryProfile,
    conversationFatigue01: commercialAdaptRun.adaptation.conversationFatigue01,
    responseLengthTarget: commercialAdaptRun.adaptation.responseLengthTarget,
    commercialLevel01: commercialAdaptRun.adaptation.commercialLevel01,
    commercialAction: commercialAdaptRun.adaptation.commercialAction,
    persuasionStyle: commercialAdaptRun.adaptation.persuasionStyle,
    allowProductRecommend: commercialAdaptRun.adaptation.allowProductRecommend,
    noFollowUp: commercialAdaptRun.adaptation.noFollowUp,
  });

  let profileBusinessName: string;
  let sector: string;
  let city: string;
  let country: string;
  let tone: unknown;

  const profCached = profileCache.get(userId);
  if (profCached && Date.now() < profCached.exp) {
    profileBusinessName = profCached.profileBusinessName;
    sector = profCached.sector;
    city = profCached.city;
    country = profCached.country;
    tone = profCached.tone;
    logCtx("profile_cache_hit", { userId });
  } else {
    const profStart = Date.now();
    const { data: prof } = await admin
      .from("profiles")
      .select("business_name,business_type,city,country,tone,shop_name")
      .eq("id", userId)
      .maybeSingle();

    profileBusinessName = String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? "").trim() || "Notre boutique";
    sector = String((prof as any)?.business_type ?? "").trim() || "Non spécifié";
    city = String((prof as any)?.city ?? "").trim() || "Non spécifié";
    country = String((prof as any)?.country ?? "").trim();
    tone = (prof as any)?.tone ?? null;

    profileCache.set(userId, {
      exp: Date.now() + PROFILE_CACHE_TTL_MS,
      profileBusinessName,
      sector,
      city,
      country,
      tone,
    });
    logCtx("profile_loaded", { userId, ms: Date.now() - profStart });
  }

  const agentName = String(args.agentName ?? "").trim() || "Service client";
  const agentPersonality = args.agentPersonality ?? "chaleureux";
  const salesStyle = args.salesStyle ?? "conseiller";
  const businessNameFromReq = String(args.businessName ?? "").trim();
  const finalBusinessName = businessNameFromReq || profileBusinessName;

  const tzResolved = resolveBusinessTimezone({ city, country });

  const sellerProfile: PremiumSellerProfile = {
    agentName,
    businessName: finalBusinessName,
    sector,
    city,
    country: country || undefined,
    agentPersonality,
    salesStyle,
    agentRole: args.agentRole?.trim() || undefined,
    agentTone: args.agentTone?.trim() || undefined,
    businessIanaTimezone: tzResolved.iana,
  };

  const langLock = resolveSessionLanguageLock({
    message,
    history,
    previous: args.conversationState?.language,
  });
  const langForSocial = langLock.language;

  const emotionProfile = classifyConversationEmotion({
    message,
    previous: args.conversationState?.emotionalContinuity,
  });

  const socialTeasing = detectSocialTeasing({ message });
  console.log("[SOCIAL_DETECTOR]", {
    request_id: args.replyTurn?.request_id,
    active: socialTeasing.active,
    kind: socialTeasing.kind,
    reason: socialTeasing.reason,
  });
  console.log("[TRACE]", "emotion_analysis_end", {
    ms: Date.now() - pipelineStart,
    request_id: args.replyTurn?.request_id,
    emotion: (emotionProfile as any)?.dominant_emotion ?? (emotionProfile as any)?.label ?? "unknown",
  });

  const turnCount = args.conversationState?.stats?.turn_count ?? 0;
  const welcomeDone =
    args.conversationState?.conversationSocialV2?.welcomeDelivered === true || turnCount >= 2;
  const allowEmoji = (args.conversationState?.conversationalEtiquette?.repliesSinceLastEmoji ?? 7) >= 7;
  const socialUnderstanding = analyzeSocialUnderstanding(message);
  logStructured("[SOCIAL_ENGINE]", {
    request_id: args.replyTurn?.request_id,
    kind: socialUnderstanding.kind,
    isPureSocial: socialUnderstanding.isPureSocial,
    isGreetingDirected: socialUnderstanding.isGreetingDirected,
    isCatalogOverviewInquiry: socialUnderstanding.isCatalogOverviewInquiry,
    reason: socialUnderstanding.reason,
  });

  const businessIntentProbe = detectBusinessIntent(message);
  logStructured("[BUSINESS_INTENT]", {
    request_id: args.replyTurn?.request_id,
    intent: businessIntentProbe.intent,
    isCommercialLead: businessIntentProbe.isCommercialLead,
    blockSocialOnly: businessIntentProbe.blockSocialOnly,
    reason: businessIntentProbe.reason,
  });

  const conversationRouting = resolveConversationRouting({
    message,
    topics: businessIntentProbe.blockSocialOnly ? businessIntentProbe.topics : undefined,
  });
  if (businessIntentProbe.blockSocialOnly) {
    conversationRouting.disableSocialFallback = true;
    conversationRouting.allowSocialOnlyMode = false;
  }

  const replyTurn =
    args.replyTurn ??
    (args.sessionId
      ? beginReplyTurn(args.sessionId, message)
      : undefined);
  const replyManager = replyTurn ? createCentralReplyOrchestrator(replyTurn) : null;
  const forceMainPipeline =
    messageRequiresMainReplyPipeline(message) ||
    conversationRouting.disableSocialFallback ||
    emotionProfile.blocks_social_quick ||
    emotionProfile.requires_empathy;
  const shortReplyCtx = resolveHumanShortReplyContext({
    message,
    turnCount,
    frustrationLevel01: args.conversationState?.prospectEmotionalState?.frustrationLevel,
  });
  const transformLogs: import("@/lib/chat/pipeline/reply-transformation-chain").ReplyTransformLog[] = [];
  const weakSignal = detectWeakUserMessage(message);
  console.log("[HUMAN_SILENCE]", {
    request_id: args.replyTurn?.request_id,
    weak: weakSignal.weak,
    kind: weakSignal.kind,
    reason: weakSignal.reason,
  });

  if (socialUnderstanding.isGreetingDirected && !forceMainPipeline && args.followupAfterHold !== true) {
    const startGreeting = turnCount <= 1;
    const greetingReply = pickDirectedGreetingReply({
      message,
      lang: langForSocial,
      seed: `${args.sessionId ?? userId}|${args.replyTurn?.request_id ?? ""}|greeting`,
      businessName: sellerProfile.businessName,
      agentName: sellerProfile.agentName,
      isConversationStart: startGreeting,
    });
    logStructured("[SOCIAL_ENGINE]", {
      request_id: args.replyTurn?.request_id,
      action: "direct_greeting_reply",
      startGreeting,
      reply: greetingReply,
    });
    return {
      reply: greetingReply,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: false,
    };
  }

  // Highest priority: accept natural endings (no follow-up, no relance, no sales).
  // This must run before quick/social/LLM to avoid the “chatbot tries to keep convo alive” effect.
  const endingSignal = detectConversationEnding(message);
  if (!forceMainPipeline && endingSignal.ending && args.followupAfterHold !== true) {
    const ending = pickEndingHumanReply({
      userMessage: message,
      lang: langForSocial,
      seed: `${args.sessionId ?? userId}|${args.replyTurn?.request_id ?? ""}|ending|${endingSignal.kind}`,
    });
    console.log("[HUMAN_SILENCE_ENDING]", {
      request_id: args.replyTurn?.request_id,
      ending: true,
      kind: endingSignal.kind,
      reason: endingSignal.reason,
      reply: ending.reply,
    });
    console.log("[NO_FOLLOWUP]", { request_id: args.replyTurn?.request_id, reason: "conversation_ending" });
    dbg?.setMeta({ selectedStrategy: "HUMAN_ENDING" });
    return {
      reply: ending.reply,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: false,
    };
  }
  if (replyManager && forceMainPipeline) {
    replyManager.markMainPipelineStarted();
  }

  const conversationIntent = classifyConversationIntent({
    message,
    agentName: sellerProfile.agentName,
    turnCount,
    welcomeAlreadyDelivered: welcomeDone,
    topics: conversationRouting.topics,
    disableSocialFallback: conversationRouting.disableSocialFallback,
  });

  const socialConversation = runSocialConversationEngine({
    message,
    agentName: sellerProfile.agentName,
    businessName: sellerProfile.businessName,
    businessIanaTimezone: sellerProfile.businessIanaTimezone,
    personaKey: args.personaKey,
    prospectProfile: args.conversationState?.prospectProfile,
    welcomeAlreadyDelivered: welcomeDone,
    allowEmoji,
    lang: langForSocial,
    turnCount,
    topics: conversationRouting.topics,
    disableSocialFallback: conversationRouting.disableSocialFallback,
  });

  const socialHardLock = resolveSocialOnlyHardLock({
    message,
    conversationState: args.conversationState,
    agentName: sellerProfile.agentName,
    businessName: sellerProfile.businessName,
    personaKey: args.personaKey,
    lang: langForSocial,
    allowEmoji,
    topics: conversationRouting.topics,
  });

  const blockBusinessEngines = conversationRouting.disableSocialFallback
    ? false
    : conversationIntent.blockBusinessEngines ||
      socialConversation.blockBusinessEngines ||
      socialHardLock.hardLock ||
      socialTeasing.active;

  logStructured("[PIPELINE_ROUTE]", {
    request_id: args.replyTurn?.request_id,
    messagePreview: message.slice(0, 80),
    forceMainPipeline,
    disableSocialFallback: conversationRouting.disableSocialFallback,
    socialHardLock: socialHardLock.hardLock,
    blockBusinessEngines,
    intent: conversationIntent.intent,
    businessIntent: businessIntentProbe.intent,
  });

  dbg?.setMeta({
    socialSignal: conversationIntent.signal,
    selectedStrategy: socialTeasing.active ? "SOCIAL_HUMAN" : blockBusinessEngines ? `intent_${conversationIntent.intent}` : "commercial",
    primaryIntent: conversationRouting.primaryIntent,
    disableSocialFallback: conversationRouting.disableSocialFallback,
    routingTopics: conversationRouting.topics,
    shortReplyMode: shortReplyCtx.mode,
    humanShortMode: shortReplyCtx.humanShortMode,
    sessionLanguage: langForSocial,
    emotionalState: emotionProfile.state,
    frustrationScore: emotionProfile.frustration_score,
  });

  let socialLayer: SocialHumanizationOutput | null = null;
  const allowSocialHumanization =
    !emotionProfile.blocks_social_quick &&
    shouldAllowSocialQuickPath({
      message,
      emotion: emotionProfile,
      disableSocialFallback: conversationRouting.disableSocialFallback,
    });
  if (args.followupAfterHold !== true && allowSocialHumanization) {
    const socialRun = await safeEngineExecute({
      engine: "social_humanization",
      step: "social",
      debugger: dbg,
      inputSnapshot: { messageLen: message.length, intent: conversationIntent.intent },
      fallback: () => null,
      run: () =>
        runSocialHumanizationLayer({
          message,
          agentName: sellerProfile.agentName,
          businessName: sellerProfile.businessName,
          businessIanaTimezone: sellerProfile.businessIanaTimezone,
          personaKey: args.personaKey,
          conversationState: args.conversationState,
          history,
          lang: langForSocial,
        }),
    });
    socialLayer = socialRun.result ?? null;
    if (socialLayer?.signal) {
      dbg?.setMeta({ socialSignal: socialLayer.signal });
    }
  }

  const recentAssistantMessages = history
    .filter((m) => m.role === "assistant")
    .slice(-2)
    .map((m) => m.content);

  // Social-only mode must be non-destructive: keep it only as a fallback if LLM fails/empty/toxicity.
  // We do NOT hard-lock to social-only just because the message is a greeting.
  const socialOnly =
    allowSocialHumanization &&
    !conversationRouting.disableSocialFallback &&
    (args.conversationState?.socialOnlyMode?.active === true);

  const quick =
    args.followupAfterHold === true || emotionProfile.blocks_social_quick
      ? null
      : allowSocialHumanization
        ? socialConversation.reply ??
          socialLayer?.instantReply ??
          socialHardLock.fallbackReply ??
          (socialOnly
            ? null
            : isAllowedMicroSocialMessage(message)
              ? quickHumanReply(sellerProfile, {
                  message,
                  history,
                  conversationState: args.conversationState,
                })
              : null)
        : null;

  const postOpts = {
    microSeed: message + userId,
    repliesSinceLastEmoji: args.conversationState?.conversationalEtiquette?.repliesSinceLastEmoji ?? 7,
    lastUserMessage: message,
    businessIanaTimezone: sellerProfile.businessIanaTimezone,
    businessName: sellerProfile.businessName,
    city: sellerProfile.city,
    country: sellerProfile.country,
    conversationState: args.conversationState,
    agentName: sellerProfile.agentName,
    personaKey: args.personaKey ?? null,
    recentAssistantMessages,
    socialOnly,
    transformationLogs: transformLogs,
  };

  const microShortReply =
    !forceMainPipeline &&
    isAllowedMicroSocialMessage(message) &&
    !emotionProfile.blocks_social_quick &&
    shortReplyCtx.mode === "micro" &&
    shortReplyCtx.microIntent !== "none"
      ? tryBuildHumanMicroReply({
          message,
          agentName: sellerProfile.agentName,
          businessName: sellerProfile.businessName,
          lang: langForSocial,
          allowEmoji,
        })
      : null;

  const commercialAdaptEarly = (args.conversationState as any)?.commercial_adaptation as
    | CommercialAdaptationMemory
    | undefined;

  // Priority: minimal replies + no follow-up for weak engagement messages.
  const forceMinimalCommercial =
    commercialAdaptEarly?.commercialAction === "minimal_reply" ||
    commercialAdaptEarly?.responseLengthTarget === "mini";
  if (
    !forceMainPipeline &&
    args.followupAfterHold !== true &&
    (weakSignal.weak || (forceMinimalCommercial && message.trim().length <= 28))
  ) {
    const minimal = pickMinimalHumanReply({
      userMessage: message,
      allowEmoji,
      seed: `${args.sessionId ?? userId}|${args.replyTurn?.request_id ?? ""}|weak`,
    });
    console.log("[NO_FOLLOWUP]", { request_id: args.replyTurn?.request_id, reason: "weak_user_message" });
    dbg?.setMeta({ selectedStrategy: "HUMAN_SILENCE" });
    return {
      reply: minimal.reply,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: false,
    };
  }

  if (microShortReply && args.followupAfterHold !== true) {
    const polishedMicro = safeEngineExecuteSync({
      engine: "post_process",
      step: "humanization",
      debugger: dbg,
      fallback: () => microShortReply,
      run: () => postProcessPremiumReply(microShortReply, postOpts),
    }).result ?? microShortReply;
    dbg?.setMeta({
      responseMode: "quick_human",
      fallbackKind: "none",
      shortReplyMode: "micro",
      microIntent: shortReplyCtx.microIntent,
    });
    if (replyManager) {
      replyManager.submitCandidate({
        reply: polishedMicro,
        source: "quick_reply",
        lastUserMessage: message,
      });
      const owned = replyManager.finalize(polishedMicro);
      if (owned) {
        return {
          reply: owned.reply,
          replyOwnership: owned,
          replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
          socialOnlyMode: false,
        };
      }
    }
    return {
      reply: polishedMicro,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: false,
    };
  }

  const salesIntentTag = classifyProspectSalesIntent(message);
  const knowledgeProfile = await loadBusinessKnowledgeProfile(admin, userId);
  const priorityRaw = buildCriticalPriorityReply({
    message,
    lang: langForSocial,
    emotion: emotionProfile,
    facts: knowledgeProfile.facts,
    timezone: sellerProfile.businessIanaTimezone,
    businessName: sellerProfile.businessName,
  });

  if (priorityRaw && !socialTeasing.active) {
    const hoursCtx = resolveBusinessHoursContext({
      facts: knowledgeProfile.facts,
      timezone: sellerProfile.businessIanaTimezone,
    });
    dbg?.setMeta({
      has_business_hours: hoursCtx.has_business_hours,
      salesIntent: salesIntentTag,
      responseMode: "priority_critical",
    });

    const visitCount = args.conversationState?.humanSalesMemory?.visitCount ?? 0;
      const memoryHint =
        visitCount >= 2
          ? buildHumanSalesMemoryCallback(args.conversationState?.humanSalesMemory, langForSocial)
          : null;
      const withMemory = memoryHint ? `${priorityRaw} ${memoryHint}`.trim() : priorityRaw;
      const polishedPriority =
        safeEngineExecuteSync({
          engine: "post_process",
          step: "humanization",
          debugger: dbg,
          fallback: () => withMemory,
          run: () => postProcessPremiumReply(withMemory, postOpts),
        }).result ?? withMemory;
      dbg?.setMeta({ responseMode: "priority_business_data", fallbackKind: "none" });
      logCtx("priority_business_reply", {
        userId,
        ms: Date.now() - pipelineStart,
        salesIntent: salesIntentTag,
        has_business_hours: hoursCtx.has_business_hours,
      });
      if (replyManager) {
        replyManager.markMainPipelineStarted();
        replyManager.submitCandidate({
          reply: polishedPriority,
          source: "quick_reply",
          lastUserMessage: message,
        });
        const owned = replyManager.finalize(polishedPriority);
        if (owned) {
          return {
            reply: owned.reply,
            replyOwnership: owned,
            replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
            socialOnlyMode: false,
          };
        }
      }
    return {
      reply: polishedPriority,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: false,
    };
  }

  // Quick/social replies are allowed only when we are not running the main LLM pipeline.
  if (!forceMainPipeline && allowSocialHumanization && (quick || (socialOnly && blockBusinessEngines))) {
    const rawQuick =
      quick ??
      socialConversation.reply ??
      socialHardLock.fallbackReply ??
      socialLayer?.instantReply ??
      (conversationRouting.disableSocialFallback
        ? pickContextualFallback({
            lang: langForSocial,
            userMessage: message,
            agentName: sellerProfile.agentName,
            businessName: sellerProfile.businessName,
            personaKey: args.personaKey,
            kind: "discovery",
            topics: conversationRouting.topics,
            allowEmoji,
          })
        : lockedLanguageFallback({
            lang: langForSocial,
            businessName: sellerProfile.businessName,
            agentName: sellerProfile.agentName,
            kind: emotionProfile.requires_empathy ? "empathy" : "greeting",
          }));
    const polishedRun = safeEngineExecuteSync({
      engine: "post_process",
      step: "humanization",
      debugger: dbg,
      fallback: () => rawQuick,
      run: () => postProcessPremiumReply(rawQuick, { ...postOpts, socialOnly: false }),
    });
    const polished = polishedRun.result ?? rawQuick;
    for (const log of transformLogs) {
      dbg?.recordStep({
        step: "humanization",
        engine: "post_process",
        status: log.textLengthDelta < -20 ? "degraded" : "ok",
        ms: log.ms ?? 0,
        input: { chainStep: log.step, reason: log.transformationReason },
        output: { afterLen: log.afterText.length },
      });
    }
    dbg?.setMeta({
      responseMode: socialLayer?.instantReply ? "instant_social" : "quick_human",
      fallbackKind: "none",
    });
    logCtx("quick_reply", {
      userId,
      ms: Date.now() - pipelineStart,
      socialSignal: socialLayer?.signal ?? "none",
      socialInstant: Boolean(socialLayer?.instantReply),
    });
    if (replyManager) {
      replyManager.submitCandidate({
        reply: polished,
        source: socialOnly ? "social_candidate" : "quick_reply",
        lastUserMessage: message,
      });
      const owned = replyManager.finalize(polished);
      if (!owned) {
        return { reply: "", replyOwnership: undefined, socialOnlyMode: true };
      }
      return {
        reply: owned.reply,
        replyOwnership: owned,
        socialSupervisorInsights: socialLayer?.supervisor,
        replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
        socialOnlyMode: true,
      };
    }
    return {
      reply: polished,
      socialSupervisorInsights: socialLayer?.supervisor,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: true,
    };
  }

  if (!forceMainPipeline && allowSocialHumanization && blockBusinessEngines) {
    dbg?.setMeta({
      responseMode: "instant_social",
      fallbackKind: "social",
      fallbackReason: conversationIntent.reasoning,
      selectedStrategy: "social_only_hard_lock",
    });
    const raw =
      socialConversation.reply ??
      socialHardLock.fallbackReply ??
      (conversationRouting.disableSocialFallback
        ? pickContextualFallback({
            lang: langForSocial,
            userMessage: message,
            agentName: sellerProfile.agentName,
            businessName: sellerProfile.businessName,
            personaKey: args.personaKey,
            kind: "discovery",
            topics: conversationRouting.topics,
            allowEmoji,
          })
        : lockedLanguageFallback({
            lang: langForSocial,
            businessName: sellerProfile.businessName,
            agentName: sellerProfile.agentName,
            kind: "greeting",
          }));
    const polishedRun = safeEngineExecuteSync({
      engine: "post_process",
      step: "humanization",
      debugger: dbg,
      fallback: () => raw,
      run: () => postProcessPremiumReply(raw, postOpts),
    });
    const polishedSocial = polishedRun.result ?? raw;
    if (replyManager) {
      replyManager.submitCandidate({
        reply: polishedSocial,
        source: "social_candidate",
        lastUserMessage: message,
      });
      const owned = replyManager.finalize(polishedSocial);
      if (!owned) {
        return { reply: "", replyOwnership: undefined, socialOnlyMode: true };
      }
      return {
        reply: owned.reply,
        replyOwnership: owned,
        socialSupervisorInsights: socialLayer?.supervisor,
        socialOnlyMode: true,
      };
    }
    return {
      reply: polishedSocial,
      socialSupervisorInsights: socialLayer?.supervisor,
      socialOnlyMode: true,
    };
  }

  replyManager?.markMainPipelineStarted();

  const orchestratorRun = await safeEngineExecute({
    engine: "live_orchestrator",
    step: "strategy",
    debugger: dbg,
    inputSnapshot: { messageLen: message.length },
    fallback: () =>
      runLiveConversationOrchestrator({
        message,
        history,
        conversationState: args.conversationState,
        userId,
        sessionId: args.sessionId,
        agentId: args.agentId,
        lang: args.conversationState?.language,
        businessName: finalBusinessName,
        previousLiveState: null,
      }),
    run: () =>
      runLiveConversationOrchestrator({
        message,
        history,
        conversationState: args.conversationState,
        userId,
        sessionId: args.sessionId,
        agentId: args.agentId,
        lang: args.conversationState?.language,
        businessName: finalBusinessName,
        previousLiveState: args.conversationState?.liveOrchestrator ?? null,
      }),
  });
  const orchestrator = orchestratorRun.result!;
  dbg?.setMeta({ selectedStrategy: orchestrator.liveState.currentGoal });

  logCtx("live_orchestrator", {
    userId,
    goal: orchestrator.liveState.currentGoal,
    stage: orchestrator.liveState.conversationStage,
    action: orchestrator.selectedAction,
    temperature: orchestrator.liveState.prospectTemperature,
  });

  const q = message.trim();
  const knowledgeTopics = detectKnowledgeTopics(q);
  const runCatalogSearch = shouldSearchCatalog(q);
  logCtx(runCatalogSearch ? "catalog_search" : "catalog_search_skipped", {
    userId,
    querySnippet: q.slice(0, 40),
    topics: knowledgeTopics,
  });

  let queryEmbedding: number[] | undefined;
  const ragKey = cacheKeyMsg(userId, q);
  const ragHit = ragCache.get(ragKey);
  const runEmbed = shouldRunKnowledgeEmbedding(q, knowledgeTopics);
  if (ragHit && Date.now() < ragHit.exp) {
    logCtx("rag_cache_hit", { userId, chars: ragHit.topChunks.length });
  } else if (runEmbed) {
    try {
      const embedT0 = Date.now();
      queryEmbedding = (await openRouterEmbed({ input: q })) as number[];
      logCtx("reply_embed_ok", { userId, ms: Date.now() - embedT0, inputLen: q.length });
    } catch (e) {
      optimaLog.error("OPTIMA_AI_ERROR", e);
      logCtx("reply_rag_embed_failed", { userId, error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    logCtx("reply_embed_skipped", { userId, topics: knowledgeTopics });
  }

  const knowledgeSearch = await searchBusinessKnowledge({
    userId,
    prospectMessage: message,
    maxProducts: runCatalogSearch ? MAX_CATALOG_PRODUCTS : 0,
    includeVectorChunks: runEmbed,
    queryEmbedding,
  });

  const catalogBrief = knowledgeSearch.products.slice(0, PROMPT_BUDGET.MAX_PRODUCTS);
  const faqBrief = knowledgeSearch.faqEntries.slice(0, PROMPT_BUDGET.MAX_FAQ);
  logCtx("catalog_resolved", {
    userId,
    productCount: catalogBrief.length,
    faqCount: knowledgeSearch.faqEntries.length,
    topics: knowledgeSearch.topics,
  });

  let topChunks = "";
  if (ragHit && Date.now() < ragHit.exp) {
    topChunks = ragHit.topChunks;
  } else if (knowledgeSearch.documentChunks.length) {
    topChunks = knowledgeSearch.documentChunks
      .slice(0, PROMPT_BUDGET.MAX_CHUNKS)
      .map((text, i) => `- Extrait ${i + 1}:\n${text}`)
      .join("\n\n");
    ragCache.set(ragKey, { exp: Date.now() + CONTEXT_CACHE_TTL_MS, topChunks });
  }

  const langForSales = detectDominantLanguage({ message, previous: args.conversationState?.language });
  const prospectTurnIntent = detectProspectTurnIntent(message);

  const langForBrain: "fr" | "en" | "es" = langForSales === "en" ? "en" : langForSales === "es" ? "es" : "fr";

  const documentChunkBodies =
    topChunks.trim().length > 0
      ? topChunks
          .split(/\n\n/)
          .map((block) => block.replace(/^- Extrait \d+:\n?/i, "").trim())
          .filter(Boolean)
      : [];

  const knowledgeProfileBundle = await loadBusinessKnowledgeProfile(admin, userId);

  // Elargir le pool catalogue pour auto-services (régénéré à chaque requête = toujours à jour admin).
  let catalogPoolForKb = mergeCatalogProducts(catalogBrief, knowledgeSearch.products);
  const needsBroadCatalog =
    catalogPoolForKb.length < 8 ||
    businessIntentProbe.intent === "service_inquiry" ||
    businessIntentProbe.blockSocialOnly;
  if (needsBroadCatalog && admin) {
    const broadCatalog = await searchBusinessKnowledge({
      userId,
      prospectMessage: sellerProfile.sector || "catalogue produits",
      maxProducts: 32,
      includeVectorChunks: false,
    });
    catalogPoolForKb = mergeCatalogProducts(catalogPoolForKb, broadCatalog.products);
    logCtx("catalog_broad_for_brain", { userId, productCount: catalogPoolForKb.length });
  }

  const manualOfferLine = knowledgeProfileBundle.facts.companyImportantNotes
    ?.split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 8);

  const businessKnowledgeBase = buildBusinessKnowledgeBase({
    profile: knowledgeSearch.profile,
    identity: {
      businessName: sellerProfile.businessName,
      sector: sellerProfile.sector,
      country: sellerProfile.country,
      city: sellerProfile.city,
      offer: manualOfferLine,
    },
    facts: { ...knowledgeSearch.facts, ...knowledgeProfileBundle.facts },
    products: catalogPoolForKb,
    faqEntries: knowledgeSearch.faqEntries,
    lang: langForBrain,
  });
  const businessContextBlock = formatBusinessKnowledgeBaseBlock(businessKnowledgeBase, langForBrain);
  const strictGroundingBlock = formatStrictNoHallucinationBlock(langForBrain);
  logStructured("[BUSINESS_BRAIN]", {
    request_id: args.replyTurn?.request_id,
    servicesSource: businessKnowledgeBase.services_source,
    businessSummary: businessKnowledgeBase.business_summary,
    categories: businessKnowledgeBase.product_categories,
    services: businessKnowledgeBase.services,
    productCount: businessKnowledgeBase.products.length,
    disableSocialFallback: conversationRouting.disableSocialFallback,
    blockBusinessEngines,
  });
  logStructured("[AUTO_BUSINESS_SERVICES]", {
    request_id: args.replyTurn?.request_id,
    source: businessKnowledgeBase.services_source,
    services: businessKnowledgeBase.services,
    categories: businessKnowledgeBase.product_categories,
    summary: businessKnowledgeBase.business_summary,
  });
  if (socialUnderstanding.isCatalogOverviewInquiry || businessIntentProbe.intent === "service_inquiry") {
    const catalogReply = buildCatalogGroundedReply({
      knowledgeBase: businessKnowledgeBase,
      lang: langForBrain,
    });
    logStructured("[CATALOG_GROUNDED_REPLY]", {
      request_id: args.replyTurn?.request_id,
      reason: socialUnderstanding.isCatalogOverviewInquiry ? "social_catalog_overview" : "business_intent_service_inquiry",
      reply: catalogReply,
      categories: businessKnowledgeBase.product_categories.slice(0, 4),
      products: businessKnowledgeBase.products.slice(0, 4).map((p) => p.name),
    });
    return {
      reply: catalogReply,
      replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
      socialOnlyMode: false,
    };
  }

  const businessKnowledge = retrieveBusinessContextFromSnapshot({
    userId,
    prospectMessage: message,
    lang: langForBrain,
    snapshot: {
      profile: {
        ...knowledgeSearch.profile,
        businessName: sellerProfile.businessName,
        sector: sellerProfile.sector,
        city: sellerProfile.city,
        country: sellerProfile.country,
        businessIanaTimezone: sellerProfile.businessIanaTimezone,
        agentName: sellerProfile.agentName,
      },
      products: catalogBrief,
      documentChunks: (documentChunkBodies.length ? documentChunkBodies : knowledgeSearch.documentChunks).slice(
        0,
        PROMPT_BUDGET.MAX_CHUNKS,
      ),
      facts: knowledgeSearch.facts,
      faqEntries: faqBrief,
      loadedAt: new Date().toISOString(),
    },
    maxProducts: PROMPT_BUDGET.MAX_PRODUCTS,
    salesStyleFromSettings: knowledgeSearch.salesStyleFromSettings,
    legacyAgentSalesStyle: salesStyle,
    productMemory: args.conversationState?.productMemory,
    commercialMemory: args.conversationState?.commercialMemory,
    conversationProfile: args.conversationState?.conversationProfile,
  });

  const commercialAdaptForReco = (args.conversationState as any)?.commercial_adaptation as CommercialAdaptationMemory | undefined;
  let recoPrompt = "";
  if (commercialAdaptForReco?.allowProductRecommend !== false && !socialTeasing.active) {
    const reco = recommendFromCatalog({
      message,
      history,
      products: businessKnowledge.matchedProducts ?? catalogBrief,
      productMemory: args.conversationState?.productMemory,
      maxPicks: commercialAdaptForReco?.allowCrossSell ? 3 : 2,
      businessPriority: {
        preferSponsored: true,
        preferBestSellers: true,
        preferHighMargin: commercialAdaptForReco?.persuasionStyle === "balanced",
      },
    });
    if (reco.memoryNext) {
      (args.conversationState as any) = { ...(args.conversationState as any), productMemory: reco.memoryNext };
    }
    recoPrompt = formatRecoHintForPrompt({ picks: reco.picks, lang: langForBrain });
    console.log("[CATALOG_RECO]", {
      request_id: args.replyTurn?.request_id,
      picks: reco.picks.map((p) => ({ name: p.product.name, score: p.score, reasons: p.reasons })),
      budgetMaxFcfa: reco.need.budgetMaxFcfa,
      brandHint: reco.need.brandHint,
    });
  } else {
    console.log("[CATALOG_RECO]", { request_id: args.replyTurn?.request_id, skipped: true, reason: "commercial_adaptation" });
  }

  const productsTextMinimal = [formatRetrievalProductsForPrompt(businessKnowledge, langForBrain), recoPrompt]
    .filter(Boolean)
    .join("\n\n");
  const chunksTextMinimal = (businessKnowledge.documentChunksText || "").slice(0, PROMPT_BUDGET.MAX_BLOCK_CHARS);

  let salesOpportunityBlock: string | undefined;
  const commercialAdapt = (args.conversationState as any)?.commercial_adaptation as CommercialAdaptationMemory | undefined;
  const suppressCommercial =
    socialLayer?.suppressCommercial === true ||
    commercialAdapt?.commercialAction === "stop_selling" ||
    commercialAdapt?.allowProductRecommend === false;
  if (
    !suppressCommercial &&
    !args.followupAfterHold &&
    salesOpportunityAllowedForIntent(prospectTurnIntent) &&
    !prospectExplicitlyRefusesOrder(message) &&
    (commercialAdapt?.commercialLevel01 ?? 0.35) >= 0.28
  ) {
    const salesOpp = runSalesOpportunityEngine({
      message,
      history,
      conversationProfile: args.conversationState?.conversationProfile,
      productMemory: args.conversationState?.productMemory,
      commercialMemory: args.conversationState?.commercialMemory,
      lastIntent: args.conversationState?.lastSellerIntent,
      productsText: productsTextMinimal,
    });
    salesOpportunityBlock = langForSales === "en" ? salesOpp.promptBlockEn : salesOpp.promptBlockFr;
  }

  logCtx("business_knowledge", {
    userId,
    topics: businessKnowledge.topics,
    matchedProducts: businessKnowledge.matchedProducts.length,
    unknownDataRisk: businessKnowledge.unknownDataRisk,
  });

  let learningBlock: string | null = null;
  try {
    const { loadLearningMemoryFromDb } = await import("@/lib/learning/memory/learning-memory-store");
    const { formatLearningPromptBlock, sanitizeLearningMemoryForUse } = await import(
      "@/lib/learning/learning-safety"
    );
    const langHint = args.conversationState?.language === "en" ? "en" : args.conversationState?.language === "es" ? "es" : "fr";
    const mem = sanitizeLearningMemoryForUse(await loadLearningMemoryFromDb(userId));
    learningBlock = formatLearningPromptBlock(mem, langHint === "es" ? "fr" : langHint);
  } catch (e) {
    console.error("[TRACE]", "learning_memory_error", {
      request_id: args.replyTurn?.request_id,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }

  const blocksTruncated = truncateContextBlocks({
    businessBrainBlock: businessKnowledge.promptBlock,
    liveOrchestratorBlock: orchestrator.promptGuidanceBlock,
    salesOpportunityBlock,
    learningBlock: learningBlock ?? undefined,
  });

  // -------------------- NEW PIPELINE STAGES (pre-LLM) --------------------
  console.log("[TRACE]", "sales_strategy_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });
  const emotionStage = {
    language: langForBrain,
    emotionLabel: String((emotionProfile as any)?.dominant_emotion ?? (emotionProfile as any)?.label ?? "neutral"),
    blocksSocialQuick: (emotionProfile as any)?.blocks_social_quick === true,
    requiresEmpathy: (emotionProfile as any)?.requires_empathy === true,
  };

  let salesStage = {
    style: "balanced" as const,
    objective: socialTeasing.active
      ? ("answer" as const)
      : prospectTurnIntent === "achat"
        ? ("close" as const)
        : emotionStage.requiresEmpathy
          ? ("defuse" as const)
          : ("answer" as const),
    urgency: socialTeasing.active ? ("low" as const) : prospectTurnIntent === "achat" ? ("high" as const) : ("medium" as const),
    objectionHandling: socialTeasing.active ? false : prospectTurnIntent === "objection",
  };
  if (commercialAdapt) {
    salesStage = adaptSalesStrategy(salesStage, commercialAdapt);
  }
  console.log("[TRACE]", "sales_strategy_end", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });

  console.log("[TRACE]", "personality_engine_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });
  const energyPick = inferDynamicEnergy({
    lang: langForBrain,
    message,
    turnCount,
    localHour: new Date().getHours(),
    emotionLabel: emotionStage.emotionLabel,
    purchaseIntent: !socialTeasing.active && (prospectTurnIntent === "achat" || prospectTurnIntent === "demande_produit"),
  });

  const adaptedEnergy = commercialAdapt ? adaptPersonalityEnergy(energyPick.energy, commercialAdapt) : energyPick.energy;
  const personalityStage = {
    energy: adaptedEnergy,
    voice: "human_whatsapp_fr" as const,
    constraints: [
      "Ne pas sonner comme une IA.",
      "Réponse WhatsApp: courte, naturelle, pas FAQ.",
      adaptedEnergy === "busy" ? "Occasionnellement: \"attends je regarde\"." : "",
      commercialAdapt?.toneHint ? `Ton adapté: ${commercialAdapt.toneHint}.` : "",
    ].filter(Boolean),
  };
  console.log("[TRACE]", "personality_engine_end", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });

  const microSeed = `${args.sessionId ?? userId}|${args.replyTurn?.request_id ?? ""}|${turnCount}`;
  console.log("[TRACE]", "human_behavior_engine_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });
  const humanPlan = buildHumanBehaviorPlan({
    lang: langForBrain,
    message,
    turnCount,
    microSeed,
    emotion: emotionStage,
    sales: salesStage,
    personality: personalityStage,
  });
  // Light human mimetism based on prospect_behavior + emotional_flow.
  const pb = (args.conversationState as any)?.prospect_behavior;
  const ef = (args.conversationState as any)?.emotional_flow;
  if (pb?.addressing === "tu") {
    humanPlan.preGenerationDirectives.push("Tutoiement léger (sans être familier lourd).");
  } else {
    humanPlan.preGenerationDirectives.push("Vouvoiement (professionnel mais WhatsApp).");
  }
  if (ef?.saturation01 >= 0.55 || (args.conversationState as any)?.ai_pressure_score >= 0.55) {
    humanPlan.preGenerationDirectives.push("Le prospect semble saturé: réponds court, pas de relance, pas de question.");
    (humanPlan as any).questionBudget = { ...humanPlan.questionBudget, askQuestion: false, maxQuestions: 0, reason: "saturation_no_followup" };
  }
  if (pb?.coldness01 >= 0.6) {
    humanPlan.preGenerationDirectives.push("Prospect froid: réponse très courte, neutre, pas d'argumentaire.");
  }
  if (pb?.humor01 >= 0.5) {
    humanPlan.preGenerationDirectives.push("Prospect humour: tu peux répondre léger (0-1 emoji max).");
  }
  if (commercialAdapt) {
    applyCommercialAdaptationToHumanPlan(humanPlan, commercialAdapt);
    humanPlan.preGenerationDirectives.push(...commercialAdaptRun.directives.slice(0, 6));
  }
  console.log("[TRACE]", "human_behavior_engine_end", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });

  console.log("[QUESTION_PROBABILITY]", {
    request_id: args.replyTurn?.request_id,
    turnKind: humanPlan.turnKind,
    ...humanPlan.questionBudget,
  });

  const promptCtx = {
    message,
    history,
    followupAfterHold: args.followupAfterHold === true,
    conversationState: args.conversationState,
    personaKey: args.personaKey ?? null,
    productsText: productsTextMinimal,
    chunksText: chunksTextMinimal,
    salesOpportunityBlock: blocksTruncated.salesOpportunityBlock || undefined,
    prospectTurnIntent,
    businessBrainBlock: blocksTruncated.businessBrainBlock,
    liveOrchestratorBlock: blocksTruncated.liveOrchestratorBlock,
    learningBlock: blocksTruncated.learningBlock || undefined,
    socialHumanization: socialLayer ?? undefined,
    useCompactSystemPrompt: true,
  };

  const historyText = (promptCtx.history ?? [])
    .slice(-6)
    .map((m: any) => `${m.role === "user" ? "Prospect" : sellerProfile.agentName}: ${String(m.content ?? "").slice(0, 220)}`)
    .join("\n");

  const learningFactsRaw = blocksTruncated.learningBlock
    ? blocksTruncated.learningBlock
        .split("\n")
        .map((l) => l.replace(/^[\-\*\s]+/, "").trim())
        .filter(Boolean)
    : [];
  const cleanedLearningFacts = learningFactsRaw
    .map((l) => {
      const social = stripSocialCommercialBlacklistedPhrases({ reply: l, lang: langForBrain as any });
      if (social.removed.length) return null;
      const support = stripBlacklistedPhrases(l);
      if (support.removed.length) return null;
      return support.text;
    })
    .filter((x): x is string => Boolean(x));
  const memFacts = cleanMemoryFacts({ facts: cleanedLearningFacts, limit: 3 });
  console.log("[MEMORY_COMPRESSION]", {
    request_id: args.replyTurn?.request_id,
    factsBefore: learningFactsRaw.length,
    factsAfter: memFacts.facts.length,
    removedDuplicates: memFacts.removedDuplicates,
    removedNoise: memFacts.removedNoise,
  });

  console.log("[TRACE]", "dynamic_prompt_builder_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });
  const promptBundle = buildDynamicPromptBundle({
    agentName: sellerProfile.agentName,
    businessName: sellerProfile.businessName,
    message,
    historyText,
    productsText: promptCtx.productsText,
    chunksText: promptCtx.chunksText,
    learningFacts: memFacts.facts,
    emotion: emotionStage,
    sales: salesStage,
    personality: personalityStage,
    human: humanPlan,
    attempt: 1,
    businessContextBlock,
    strictGroundingBlock,
  });
  console.log("[TRACE]", "dynamic_prompt_builder_end", {
    ms: Date.now() - pipelineStart,
    request_id: args.replyTurn?.request_id,
    totalChars: promptBundle.totalChars,
    modules: promptBundle.includedModules,
  });

  const systemPrompt = promptBundle.systemPrompt;
  const userPrompt = promptBundle.userPrompt;

  const modelChoice = chooseOpenRouterModel({ preferHumanQuality: true, latencyBudgetMs: 25_000 });
  const openRouterPayload = prepareOpenRouterPayload(systemPrompt, userPrompt, {
    userMessageLen: message.length,
  });
  const openRouterPayloadWithModel = Object.assign(openRouterPayload, {
    model: modelChoice.model,
    maxTokensOverride: 180,
  });

  logCtx("prompt_ready", {
    userId,
    promptChars: openRouterPayload.promptChars,
    estimatedTokens: openRouterPayload.finalPromptTokens,
    finalMaxTokens: openRouterPayload.finalMaxTokens,
    remainingBudget: openRouterPayload.remainingBudget,
    compressed: openRouterPayload.compressed,
    promptModules: promptBundle.includedModules,
    promptTotalChars: promptBundle.totalChars,
    model: modelChoice.model,
    modelReason: modelChoice.reason,
    historyTurns: history.length,
    productsBlockChars: productsTextMinimal.length,
    chunksBlockChars: chunksTextMinimal.length,
    msSinceStart: Date.now() - pipelineStart,
  });

  const langForFallback =
    args.conversationState?.language === "en" ? "en" : args.conversationState?.language === "es" ? "es" : "fr";

  const fallbackTopics = businessKnowledge.topics ?? knowledgeSearch.topics ?? [];

  logOpenRouterProxyConfigOnce();

  const llmRun = await safeEngineExecute({
    engine: "openrouter",
    step: "response",
    debugger: dbg,
    inputSnapshot: {
      promptChars: openRouterPayload.promptChars,
      estimatedPromptTokens: openRouterPayload.finalPromptTokens,
    },
    fallback: () =>
      pickContextualFallback({
        lang: langForFallback,
        userMessage: message,
        agentName: sellerProfile.agentName,
        businessName: sellerProfile.businessName,
        personaKey: args.personaKey,
        kind: "generate_failed",
        frustrationLevel01: args.conversationState?.prospectEmotionalState?.frustrationLevel,
        topics: fallbackTopics,
        allowEmoji: true,
      }),
    run: async () => {
      const orStart = Date.now();
      const cacheContextKey = `${businessIntentProbe.intent}|${args.userId}|${args.sessionId ?? ""}`;
      const cached = await loadLlmCache({
        model: modelChoice.model,
        systemPrompt,
        userPrompt,
        message,
        contextKey: cacheContextKey,
      });
      if (cached) {
        return cached;
      }
      console.log("[TRACE]", "openrouter_request_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });
      let attempt = 1;
      let raw = await openRouterChatWithOneRetry(openRouterPayloadWithModel);
      console.log("[TRACE]", "openrouter_request_end", {
        ms: Date.now() - pipelineStart,
        request_id: args.replyTurn?.request_id,
        rawLen: raw.length,
      });

      console.log("[TRACE]", "validator_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id, attempt });
      let decision = validateHumanReplyLength(raw);
      console.log("[TRACE]", "validator_end", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id, attempt, ok: decision.ok });
      console.log("[HUMANIZATION_SCORE]", { request_id: args.replyTurn?.request_id, attempt, validator: decision });
      if (!decision.ok) {
        console.log("[TRACE]", "retry_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id, attempt: 2 });
        attempt = 2;
        const rebundle = buildDynamicPromptBundle({
          agentName: sellerProfile.agentName,
          businessName: sellerProfile.businessName,
          message,
          historyText,
          productsText: promptCtx.productsText,
          chunksText: promptCtx.chunksText,
          learningFacts: memFacts.facts,
          emotion: emotionStage,
          sales: salesStage,
          personality: personalityStage,
          human: humanPlan,
          attempt,
          businessContextBlock,
          strictGroundingBlock,
        });
        const retryPayload = prepareOpenRouterPayload(rebundle.systemPrompt, rebundle.userPrompt, {
          userMessageLen: message.length,
        });
        const retryWithModel = Object.assign(retryPayload, {
          model: modelChoice.model,
          maxTokensOverride: 180,
        });
        raw = await openRouterChatWithOneRetry(retryWithModel);
        console.log("[TRACE]", "retry_end", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id, rawLen: raw.length });
        decision = validateHumanReplyLength(raw);
        console.log("[HUMANIZATION_SCORE]", { request_id: args.replyTurn?.request_id, attempt, validator: decision });
      }
      logCtx("openrouter_total_ok", {
        userId,
        ms: Date.now() - orStart,
        finalPromptTokens: openRouterPayload.finalPromptTokens,
        finalMaxTokens: openRouterPayload.finalMaxTokens,
      });

      let processed = stripAiSpeakerLabels(postProcessPremiumReply(raw, postOpts), sellerProfile.agentName);
      let grounding = validateAndCleanOutgoingReply({
        reply: processed,
        userMessage: message,
        knowledgeBase: businessKnowledgeBase,
        agentName: sellerProfile.agentName,
      });
      let strictOutput = enforceStrictBusinessOutputFilter({
        reply: processed,
        userMessage: message,
        knowledgeBase: businessKnowledgeBase,
        businessIntent: businessIntentProbe.intent,
      });
      let lowQualityBlocked = isLowHumanQualityReply({
        userMessage: message,
        reply: processed,
        social: socialUnderstanding,
      });

      if ((!grounding.ok && grounding.shouldRegenerate) || strictOutput.blocked || lowQualityBlocked) {
        console.log("[GROUNDING_VALIDATION]", {
          request_id: args.replyTurn?.request_id,
          ok: false,
          issues: grounding.issues,
          regenerate: true,
        });
        if (strictOutput.blocked) {
          logStructured("[GROUNDING_BLOCK]", {
            request_id: args.replyTurn?.request_id,
            issues: strictOutput.issues,
            phase: "pre_regen",
          });
        }
        if (lowQualityBlocked) {
          logStructured("[LOW_QUALITY_REPLY_BLOCKED]", {
            request_id: args.replyTurn?.request_id,
            reply: processed,
            socialKind: socialUnderstanding.kind,
          });
        }
        const regenBundle = buildDynamicPromptBundle({
          agentName: sellerProfile.agentName,
          businessName: sellerProfile.businessName,
          message,
          historyText,
          productsText: promptCtx.productsText,
          chunksText: promptCtx.chunksText,
          learningFacts: memFacts.facts,
          emotion: emotionStage,
          sales: salesStage,
          personality: personalityStage,
          human: humanPlan,
          attempt: 3,
          businessContextBlock,
          strictGroundingBlock: `${strictGroundingBlock}\nCORRECTION: réponse précédente invalide (${grounding.issues.join(", ")}). Répondre UNIQUEMENT avec BUSINESS_CONTEXT.`,
        });
        const regenPayload = prepareOpenRouterPayload(regenBundle.systemPrompt, regenBundle.userPrompt, {
          userMessageLen: message.length,
        });
        const regenWithModel = Object.assign(regenPayload, {
          model: modelChoice.model,
          maxTokensOverride: 180,
        });
        raw = await openRouterChatWithOneRetry(regenWithModel);
        processed = stripAiSpeakerLabels(postProcessPremiumReply(raw, postOpts), sellerProfile.agentName);
        grounding = validateAndCleanOutgoingReply({
          reply: processed,
          userMessage: message,
          knowledgeBase: businessKnowledgeBase,
          agentName: sellerProfile.agentName,
        });
        strictOutput = enforceStrictBusinessOutputFilter({
          reply: processed,
          userMessage: message,
          knowledgeBase: businessKnowledgeBase,
          businessIntent: businessIntentProbe.intent,
        });
        lowQualityBlocked = isLowHumanQualityReply({
          userMessage: message,
          reply: processed,
          social: socialUnderstanding,
        });
      }

      if (!grounding.ok || strictOutput.blocked || lowQualityBlocked) {
        console.log("[GROUNDING_VALIDATION]", {
          request_id: args.replyTurn?.request_id,
          ok: false,
          issues: grounding.issues,
          fallback: true,
        });
        if (strictOutput.blocked) {
          logStructured("[GROUNDING_BLOCK]", {
            request_id: args.replyTurn?.request_id,
            issues: strictOutput.issues,
            phase: "fallback",
          });
        }
        if (lowQualityBlocked) {
          logStructured("[LOW_QUALITY_REPLY_BLOCKED]", {
            request_id: args.replyTurn?.request_id,
            reply: processed,
            socialKind: socialUnderstanding.kind,
            phase: "fallback",
          });
        }
        if (businessIntentProbe.intent === "service_inquiry" || socialUnderstanding.isCatalogOverviewInquiry) {
          processed = buildCatalogGroundedReply({
            knowledgeBase: businessKnowledgeBase,
            lang: langForBrain,
          });
          logStructured("[CATALOG_GROUNDED_REPLY]", {
            request_id: args.replyTurn?.request_id,
            reason: "strict_grounding_fallback",
            reply: processed,
          });
        } else {
          processed = buildServiceGroundedFallback(businessKnowledgeBase, langForBrain);
        }
      } else {
        console.log("[GROUNDING_VALIDATION]", { request_id: args.replyTurn?.request_id, ok: true });
      }

      const finalOut = grounding.cleanedReply || processed;
      await saveLlmCache({
        model: modelChoice.model,
        systemPrompt,
        userPrompt,
        message,
        contextKey: cacheContextKey,
        response: finalOut,
        intent: businessIntentProbe.intent === "service_inquiry" ? "catalog" : socialTeasing.active ? "social" : "default",
      });
      return finalOut;
    },
  });

  let cleaned = stripAiSpeakerLabels(
    llmRun.result ??
    pickContextualFallback({
      lang: langForFallback,
      userMessage: message,
      agentName: sellerProfile.agentName,
      businessName: sellerProfile.businessName,
      personaKey: args.personaKey,
      kind: "generate_failed",
      topics: fallbackTopics,
      allowEmoji: true,
    }),
    sellerProfile.agentName,
  );
  if (!llmRun.ok) {
    dbg?.setMeta({ responseMode: "fallback", fallbackKind: "generate_failed", fallbackReason: llmRun.fallbackReason });
  } else {
    dbg?.setMeta({ responseMode: "llm" });
  }

  cleaned = stripFakeVerificationPhrases(cleaned, langForBrain, false);

  // Update ai_pressure_score in runtime state (for prompt shaping + observability).
  const qCount = (cleaned.match(/\?/g) ?? []).length;
  const emojiCount = (cleaned.match(/[\p{Extended_Pictographic}]/gu) ?? []).length;
  const prevPressure = Number((args.conversationState as any)?.ai_pressure_score ?? 0);
  const nextPressure = updateAiPressureScore({
    previous: prevPressure,
    replyText: cleaned,
    questionCount: qCount,
    emojiCount,
  });
  (args.conversationState as any) = { ...(args.conversationState as any), ai_pressure_score: nextPressure };
  console.log("[AI_PRESSURE_SCORE]", { request_id: args.replyTurn?.request_id, ai_pressure_score: nextPressure });

  // Add light, irregular human imperfections (rare, seeded).
  // Must be subtle: avoids caricature, and runs before social bot-risk filtering.
  const pbImp = (args.conversationState as any)?.prospect_behavior;
  const efImp = (args.conversationState as any)?.emotional_flow;
  const imperf = applyHumanImperfections({
    text: cleaned,
    seed: microSeed,
    energy: pbImp?.energy01 ? (pbImp.energy01 > 0.65 ? "playful" : pbImp.energy01 < 0.35 ? "busy" : "focused") : undefined,
    saturation01: efImp?.saturation01,
    coldness01: pbImp?.coldness01,
    humor01: pbImp?.humor01,
  });
  if (imperf.applied.length) {
    cleaned = imperf.text;
    console.log("[HUMAN_IMPERFECTION]", { request_id: args.replyTurn?.request_id, applied: imperf.applied });
  }

  // Enforce premium emoji policy (default: none; allow only rarely in social/humor context).
  const pbEmoji = (args.conversationState as any)?.prospect_behavior;
  const emojiPolicy = enforcePremiumEmojiPolicy({
    reply: cleaned,
    userMessage: message,
    prospectEmojiFreq01: pbEmoji?.emojiFreq01,
    humor01: pbEmoji?.humor01,
    socialMode: socialTeasing.active,
    repliesSinceLastEmoji: args.conversationState?.conversationalEtiquette?.repliesSinceLastEmoji,
  });
  if (emojiPolicy.beforeEmoji !== emojiPolicy.afterEmoji) {
    console.log("[EMOJI_POLICY]", {
      request_id: args.replyTurn?.request_id,
      reason: emojiPolicy.reason,
      beforeEmoji: emojiPolicy.beforeEmoji,
      afterEmoji: emojiPolicy.afterEmoji,
    });
    cleaned = emojiPolicy.text;
  }

  if (socialTeasing.active) {
    // Post-generation blacklist filter (works even if LLM ignores prompt).
    const filtered = stripSocialCommercialBlacklistedPhrases({ reply: cleaned, lang: langForBrain as any });
    const supportFiltered = stripBlacklistedPhrases(filtered.text);

    const finalText = supportFiltered.text || filtered.text;
    console.log("[POST_BLACKLIST_FILTER]", {
      request_id: args.replyTurn?.request_id,
      removed: Array.from(new Set([...(filtered.removed ?? []), ...(supportFiltered.removed ?? [])])),
      beforeLen: cleaned.length,
      afterLen: finalText.length,
    });

    const { botRisk, hits } = computeBotRiskScore({ reply: finalText, lang: langForBrain as any });
    const humanAuthenticityScore = Number((1 - botRisk).toFixed(3));
    console.log("[HUMAN_AUTHENTICITY_SCORE]", {
      request_id: args.replyTurn?.request_id,
      humanAuthenticityScore,
      hits,
    });
    console.log("[BOT_RISK_SCORE]", {
      request_id: args.replyTurn?.request_id,
      botRisk,
      hits,
    });

    // If still too “botty”, replace with short human-social response.
    if (botRisk > 0.4) {
      console.log("[HUMAN_SOCIAL_RESPONSE_ENGINE]", {
        request_id: args.replyTurn?.request_id,
        reason: "botRisk_above_threshold",
      });
      cleaned = humanSocialResponseEngine({
        message,
        reply: cleaned,
        agentName: sellerProfile.agentName,
        businessName: sellerProfile.businessName,
        lang: langForBrain as any,
        teasing: socialTeasing,
        seed: microSeed,
      });
    } else {
      cleaned = finalText;
    }
  }

  console.log("[TRACE]", "delivery_simulation_start", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id });
  const deliveryPlan = buildHumanDeliveryPlan({ replyText: cleaned });
  console.log("[TRACE]", "delivery_simulation_end", { ms: Date.now() - pipelineStart, request_id: args.replyTurn?.request_id, ...deliveryPlan });
  logStructured("[DELIVERY_SIMULATION]", { request_id: args.replyTurn?.request_id, ...deliveryPlan });

  const emotionalRun = safeEngineExecuteSync({
    engine: "emotional_intelligence",
    step: "emotion",
    debugger: dbg,
    fallback: () =>
      runEmotionalIntelligenceEngine({
        message,
        previousState: args.conversationState?.prospectEmotionalState,
        lang: langForBrain,
      }),
    run: () =>
      runEmotionalIntelligenceEngine({
        message,
        previousState: args.conversationState?.prospectEmotionalState,
        salesSignalsTrust01: args.conversationState?.salesSignalsMemory?.trustLevel01,
        turnCount: args.conversationState?.stats?.turn_count,
        commercialObjections: args.conversationState?.commercialMemory?.objections,
        lang: langForBrain,
      }),
  });
  const emotionalIntel = emotionalRun.result!;
  dbg?.setMeta({ detectedEmotion: emotionalIntel.state.dominantEmotion });

  let salesDecision: ReturnType<typeof runSalesDecisionEngine>;
  if (socialTeasing.active) {
    console.log("[SALES_BYPASS]", {
      request_id: args.replyTurn?.request_id,
      reason: socialTeasing.reason,
    });
    // Build a minimal safe “social” decision object so downstream code keeps working.
    salesDecision = {
      insights: {
        analysis: {
          temperature: "Warm",
          emotion: "Joking",
          trust: "Medium",
          intention: "Medium",
          activeObjections: [],
          conversationFatigue: 0.2,
          conversionProbability: 30,
          suggestedStrategy: "SOFT_CONVERSATION",
          reasoning: "social_teasing_bypass",
        },
      },
      activeStrategy: "SOFT_CONVERSATION",
      analysis: {
        temperature: "Warm",
        emotion: "Joking",
        trust: "Medium",
        intention: "Medium",
        activeObjections: [],
        conversationFatigue: 0.2,
        conversionProbability: 30,
        suggestedStrategy: "SOFT_CONVERSATION",
        reasoning: "social_teasing_bypass",
      },
      strategyInstruction: "",
      closingLevel: "soft",
      closingLinesFr: [],
      closingLinesEn: [],
      objectionHints: [],
      upsell: undefined,
      followupHint: undefined,
      guards: {
        blockHardClose: false,
        blockUpsell: true,
        softenTone: true,
        reasons: ["social_teasing"],
      },
      promptSummaryFr: "SOCIAL_HUMAN: rapport, pas de vente",
    };
  } else {
    const salesDecisionRun = safeEngineExecuteSync({
      engine: "sales_decision",
      step: "strategy",
      debugger: dbg,
      fallback: () =>
        runSalesDecisionEngine({
          message,
          sellerIntent: "other",
          lang: langForBrain,
        }),
      run: () =>
        runSalesDecisionEngine({
          message,
          sellerIntent: args.conversationState?.lastSellerIntent ?? "other",
          conversationProfile: args.conversationState?.conversationProfile,
          commercialMemory: args.conversationState?.commercialMemory,
          salesSignalsMemory: args.conversationState?.salesSignalsMemory,
          stats: args.conversationState?.stats,
          lang: langForBrain,
          blockAggressiveClose:
            emotionalIntel.adaptation.blockAggressiveClose || socialLayer?.suppressSalesUrgency === true,
        }),
    });
    salesDecision = salesDecisionRun.result!;
  }

  const personalityRun = safeEngineExecuteSync({
    engine: "personality_consistency",
    step: "humanization",
    debugger: dbg,
    fallback: () =>
      runPersonalityConsistencyEngine({
        personaKey: args.personaKey,
        message,
        lang: langForBrain,
      }),
    run: () =>
      runPersonalityConsistencyEngine({
        personaKey: args.personaKey,
        previousPersonalityState: args.conversationState?.conversationPersonalityState,
        message,
        prospectEmotion: emotionalIntel.state.dominantEmotion,
        frustrationLevel01: emotionalIntel.state.frustrationLevel,
        conversationComfort01: emotionalIntel.state.conversationComfort,
        turnCount: args.conversationState?.stats?.turn_count,
        lang: langForBrain,
      }),
  });
  const personalityConsistency = personalityRun.result!;

  const llmSource = llmRun.ok ? ("openrouter" as const) : ("fallback" as const);
  let replyOwnership: OwnedReply | undefined;
  if (replyManager) {
    replyManager.submitCandidate({
      reply: cleaned,
      source: llmSource,
      lastUserMessage: message,
    });
    const owned = replyManager.finalize(cleaned);
    if (!owned) {
      return {
        reply: "",
        replyOwnership: undefined,
          replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
        socialOnlyMode: socialOnly,
        liveOrchestrator: orchestrator.liveState,
        supervisorInsights: salesDecision.insights,
        emotionalSupervisorInsights: emotionalIntel.supervisor,
        personalitySupervisorInsights: personalityConsistency.supervisor,
        socialSupervisorInsights: socialLayer?.supervisor,
      };
    }
    cleaned = owned.reply;
    replyOwnership = owned;
  }

  logCtx("generate_done", {
    userId,
    replyLen: cleaned.length,
    salesStrategy: salesDecision.activeStrategy,
    conversionPct: salesDecision.analysis.conversionProbability,
    dominantEmotion: emotionalIntel.state.dominantEmotion,
    abandonmentRisk: emotionalIntel.supervisor.abandonmentRisk,
    personalityConsistency: personalityConsistency.supervisor.consistencyScore,
    replySource: replyOwnership?.source,
    ms: Date.now() - pipelineStart,
  });
  return {
    reply: cleaned,
    replyOwnership,
    replyTransformationChain: sanitizeReplyTransformationChain(transformLogs as any),
    socialOnlyMode: socialOnly,
    liveOrchestrator: orchestrator.liveState,
    conversationStateNext: args.conversationState,
    supervisorInsights: salesDecision.insights,
    emotionalSupervisorInsights: emotionalIntel.supervisor,
    personalitySupervisorInsights: personalityConsistency.supervisor,
    socialSupervisorInsights: socialLayer?.supervisor,
  };
}
