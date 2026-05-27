import { buildContextualSocialReply } from "./contextual-social-replies";
import { buildHumanGreetingReply } from "./human-greeting-engine";
import { buildHesitationReply } from "./hesitation-signal-engine";
import { buildSmallTalkReply } from "./small-talk-engine";
import { detectSocialSignal, isSocialSignalKind } from "./social-signal-detector";
import { advanceConversationWarmup } from "./conversation-warmup-engine";
import type { SocialHumanizationInput, SocialRouteDecision } from "./types";
import { readConversationSocialV2 } from "@/lib/agents/memory/conversation-state-v2";

const HOLD_ONLY = /^\s*(je\s+vérifie|je\s+regarde|un\s+instant|let\s+me\s+check|one\s+moment)[\s.!?]*$/i;

function resolveLang(input: SocialHumanizationInput): "fr" | "en" | "es" {
  if (input.lang) return input.lang;
  const l = input.conversationState?.language;
  return l === "en" ? "en" : l === "es" ? "es" : "fr";
}

function allowEmoji(state: SocialHumanizationInput["conversationState"]): boolean {
  const since = state?.conversationalEtiquette?.repliesSinceLastEmoji ?? 7;
  return since >= 7;
}

/**
 * Route sociale PRIORITAIRE — avant sales, automation, business logic.
 */
export function routeSocialPriority(input: SocialHumanizationInput): SocialRouteDecision {
  const signal = detectSocialSignal(input.message);
  const lang = resolveLang(input);
  const socialV2 = readConversationSocialV2(input.conversationState);
  const turnCount = input.conversationState?.stats?.turn_count ?? 0;
  const hasAssistantBefore = (input.history ?? []).some((h) => h.role === "assistant");
  const welcomeDone =
    socialV2.welcomeDelivered === true || hasAssistantBefore || turnCount >= 2;

  const warmup = advanceConversationWarmup({
    previous: input.conversationState?.socialWarmup,
    signal,
    turnCount,
  });

  const isSocialPriority = isSocialSignalKind(signal);
  const suppressCommercial =
    isSocialPriority &&
    signal !== "thanks" &&
    signal !== "casual_ack" &&
    warmup.phase !== "commercial_ready";
  const suppressAutomation =
    isSocialPriority && (warmup.phase === "opening" || signal === "hesitation");
  const suppressHoldPhrases = isSocialPriority;
  const suppressSalesUrgency = isSocialPriority || warmup.phase === "opening";

  let instantReply: string | null = buildContextualSocialReply({
    message: input.message,
    agentName: input.agentName,
    businessName: input.businessName,
    businessIanaTimezone: input.businessIanaTimezone,
    personaKey: input.personaKey,
    prospectProfile: input.conversationState?.prospectProfile,
    welcomeAlreadyDelivered: welcomeDone,
    allowEmoji: allowEmoji(input.conversationState),
    lang,
    signal,
    history: input.history,
  });

  if (!instantReply && (signal === "greeting" || signal === "greeting_evening")) {
    instantReply = buildHumanGreetingReply({
      message: input.message,
      agentName: input.agentName,
      businessName: input.businessName,
      businessIanaTimezone: input.businessIanaTimezone,
      personaKey: input.personaKey,
      prospectProfile: input.conversationState?.prospectProfile,
      welcomeAlreadyDelivered: welcomeDone,
      allowEmoji: allowEmoji(input.conversationState),
      lang,
    });
  } else if (signal === "hesitation") {
    instantReply = buildHesitationReply({
      message: input.message,
      agentName: input.agentName,
      businessName: input.businessName,
      prospectProfile: input.conversationState?.prospectProfile,
      allowEmoji: allowEmoji(input.conversationState),
      lang,
      history: input.history,
    });
  } else if (
    signal === "wellbeing" ||
    signal === "wellbeing_followup" ||
    signal === "personal_activity" ||
    signal === "question_repeat" ||
    signal === "thanks" ||
    signal === "farewell_night" ||
    signal === "farewell_day" ||
    signal === "casual_ack"
  ) {
    const smallSignal =
      signal === "wellbeing_followup" || signal === "question_repeat" ? "wellbeing" : signal;
    instantReply = buildSmallTalkReply({
      signal: smallSignal,
      message: input.message,
      agentName: input.agentName,
      businessName: input.businessName,
      prospectProfile: input.conversationState?.prospectProfile,
      allowEmoji: allowEmoji(input.conversationState),
      lang,
    });
  }

  if (instantReply && HOLD_ONLY.test(instantReply)) {
    instantReply =
      lang === "en"
        ? "I'm listening 🙂"
        : lang === "es"
          ? "Le escucho 🙂"
          : "Je vous écoute 🙂";
  }

  const reasoning = isSocialPriority
    ? `signal_social_${signal}_priorité_sur_vente`
    : "pas_signal_social";

  return {
    signal,
    isSocialPriority,
    suppressCommercial,
    suppressAutomation,
    suppressHoldPhrases,
    suppressSalesUrgency,
    instantReply,
    warmup,
    reasoning,
  };
}
