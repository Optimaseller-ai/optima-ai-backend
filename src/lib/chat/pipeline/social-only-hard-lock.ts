import "server-only";

import { resolveConversationRouting } from "@/lib/agents/social/business-conversation-router";
import { classifyConversationIntent } from "@/lib/agents/social/conversation-intent-classifier";
import { runSocialConversationEngine } from "@/lib/agents/social/social-conversation-engine";
import { detectSocialSignal, isSocialSignalKind } from "@/lib/agents/social/social-signal-detector";
import { detectSocialIntent } from "@/lib/agents/human-behavior/social-intent-engine";
import { isHesitationSignalMessage } from "@/lib/agents/social/hesitation-signal-engine";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { resolveSocialOnlyMode } from "./social-only-mode";
import { lockedLanguageFallback } from "./session-language-lock";
import { classifyConversationEmotion } from "@/lib/agents/emotional-intelligence/conversation-emotion-classifier";

const COMMERCIAL_STRONG =
  /\b(prix|stock|dispo|commander|acheter|livraison|modèle|modele|article|lien|payer|fcfa|€|devis|je\s+veux|besoin\s+d['’']?un)\b/i;

const FRUSTRATION_SOCIAL =
  /\b(tu\s+d[ée]range|vous\s+d[ée]range|d[ée]range|désol[eé]\s+de\s+deranger|sorry\s+to\s+bother|am\s+i\s+bothering)\b/i;

const THANKS_SOFT = /\b(merci|thanks|gracias)\b/i;
const EMOTION_SOCIAL =
  /\b(ça\s+va|comment\s+allez|bonsoir|bonjour|salut|coucou|hmm|hum|euh|ah\s+ok|ah\s+d'accord)\b/i;

export type SocialOnlyHardLockSnapshot = {
  active: boolean;
  hardLock: boolean;
  signal: string;
  reason: string;
  /** Dernier recours humain — jamais script commercial. */
  fallbackReply: string | null;
};

function minimalSocialFallback(
  lang: "fr" | "en" | "es",
  signal: string,
  businessName: string,
  agentName: string,
  requiresEmpathy: boolean,
): string {
  if (requiresEmpathy) {
    return lockedLanguageFallback({ lang, businessName, agentName, kind: "empathy" });
  }
  if (signal === "wellbeing_followup" || signal === "wellbeing") {
    return lockedLanguageFallback({ lang, businessName, agentName, kind: "greeting" });
  }
  if (signal === "personal_activity") {
    return lang === "en"
      ? `On WhatsApp for ${businessName} right now 🙂`
      : lang === "es"
        ? `Atendiendo mensajes de ${businessName} ahora 🙂`
        : `Je réponds aux messages chez ${businessName} là 🙂`;
  }
  return lockedLanguageFallback({ lang, businessName, agentName, kind: "greeting" });
}

/**
 * Verrou social strict : aucun orchestrateur, RAG, catalogue, automation, vente.
 */
export function resolveSocialOnlyHardLock(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
  agentName?: string | null;
  businessName?: string;
  personaKey?: string | null;
  lang?: "fr" | "en" | "es";
  allowEmoji?: boolean;
  topics?: string[];
}): SocialOnlyHardLockSnapshot {
  const msg = String(args.message ?? "").trim();
  const lang =
    args.lang ??
    (args.conversationState?.language === "en" ? "en" : args.conversationState?.language === "es" ? "es" : "fr");

  const routing = resolveConversationRouting({ message: msg, topics: args.topics });
  const emotion = classifyConversationEmotion({
    message: msg,
    previous: args.conversationState?.emotionalContinuity,
  });
  if (routing.disableSocialFallback || emotion.blocks_social_quick) {
    return {
      active: false,
      hardLock: false,
      signal: routing.primaryIntent,
      reason: `business_intent:${routing.primaryIntent}`,
      fallbackReply: null,
    };
  }

  const base = resolveSocialOnlyMode({
    message: msg,
    conversationState: args.conversationState,
    agentName: args.agentName,
  });

  const signal = detectSocialSignal(msg);
  const intent = detectSocialIntent(msg, {
    agentName: args.agentName,
    turnCount: args.conversationState?.stats?.turn_count ?? 0,
    welcomeAlreadyDelivered:
      args.conversationState?.conversationSocialV2?.welcomeDelivered === true ||
      (args.conversationState?.stats?.turn_count ?? 0) >= 2,
  });

  const classified = classifyConversationIntent({
    message: msg,
    agentName: args.agentName,
    turnCount: args.conversationState?.stats?.turn_count ?? 0,
    welcomeAlreadyDelivered:
      args.conversationState?.conversationSocialV2?.welcomeDelivered === true ||
      (args.conversationState?.stats?.turn_count ?? 0) >= 2,
    topics: routing.topics,
    disableSocialFallback: routing.disableSocialFallback,
  });

  const socialConvo = runSocialConversationEngine({
    message: msg,
    agentName: args.agentName ?? "Conseiller",
    businessName: args.businessName ?? "notre boutique",
    personaKey: args.personaKey,
    prospectProfile: args.conversationState?.prospectProfile,
    allowEmoji: args.allowEmoji ?? true,
    lang,
    turnCount: args.conversationState?.stats?.turn_count ?? 0,
  });
  const contextual = socialConvo.reply;

  const hasCommercial = COMMERCIAL_STRONG.test(msg);
  const socialEmotion =
    isSocialSignalKind(signal) ||
    isHesitationSignalMessage(msg) ||
    FRUSTRATION_SOCIAL.test(msg) ||
    intent.kind === "frustration" ||
    intent.kind === "teasing" ||
    intent.kind === "social_chat" ||
    intent.kind === "simple_greeting" ||
    (THANKS_SOFT.test(msg) && EMOTION_SOCIAL.test(msg)) ||
    (EMOTION_SOCIAL.test(msg) && !hasCommercial);

  const active =
    (base.active || classified.blockBusinessEngines || socialEmotion || Boolean(contextual)) && !hasCommercial;
  const hardLock = active || classified.blockBusinessEngines;

  return {
    active,
    hardLock,
    signal: signal !== "none" ? signal : intent.kind,
    reason: active
      ? `social_only_hard_lock:${contextual ? "contextual" : base.reason}`
      : "commercial_allowed",
    fallbackReply: active
      ? contextual ??
        minimalSocialFallback(
          lang,
          signal !== "none" ? signal : classified.intent,
          args.businessName ?? "notre boutique",
          args.agentName ?? "Conseiller",
          emotion.requires_empathy,
        )
      : null,
  };
}
