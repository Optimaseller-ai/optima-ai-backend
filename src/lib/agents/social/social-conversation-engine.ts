import "server-only";

import { buildContextualSocialReply, resolveSocialReplyForKnownSignal } from "./contextual-social-replies";
import { buildHesitationReply, isBannedHesitationReply } from "./hesitation-signal-engine";
import { buildSmallTalkReply } from "./small-talk-engine";
import { buildHumanGreetingReply } from "./human-greeting-engine";
import { resolveConversationRouting } from "./business-conversation-router";
import {
  classifyConversationIntent,
  type ConversationIntentResult,
  type ConversationIntentType,
} from "./conversation-intent-classifier";
import { detectSocialSignal, isSocialSignalKind } from "./social-signal-detector";
import type { SocialSignalKind } from "./types";
import type { GreetingReplyInput } from "./human-greeting-engine";

const BANNED_FALLBACK =
  /\b(je\s+suis\s+\w+\s+chez|dites[- ]moi\s+ce\s+que\s+vous\s+cherchez|quel\s+produit|comment\s+puis[- ]je\s+vous\s+aider|bonjour\s+—\s+je\s+suis|je\s+suis\s+là\s+—\s+dites)\b/i;

const GENERIC_ONLY = /^d['']?accord\s*[.!?…🙂]*$/i;
const GENERIC_ACK_ONLY = /^(ok|okay|oui|yes|compris|sure)\s*[.!?…🙂]*$/i;

export type SocialConversationInput = GreetingReplyInput & {
  turnCount?: number;
  welcomeAlreadyDelivered?: boolean;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  topics?: string[];
  disableSocialFallback?: boolean;
};

export type SocialConversationResult = {
  reply: string | null;
  intent: ConversationIntentType;
  signal: SocialSignalKind;
  classification: ConversationIntentResult;
  blockBusinessEngines: boolean;
  reasoning: string;
};

function isGenericReply(text: string): boolean {
  const t = String(text ?? "").trim();
  return (
    GENERIC_ONLY.test(t) ||
    GENERIC_ACK_ONLY.test(t) ||
    isBannedHesitationReply(t) ||
    t === "D'accord." ||
    t === "D'accord 🙂." ||
    t === "D'accord 🙂"
  );
}

function replyFromSignal(signal: SocialSignalKind, input: SocialConversationInput): string | null {
  const contextual = resolveSocialReplyForKnownSignal(signal, {
    ...input,
    signal,
    history: input.history,
  });
  if (contextual && !isGenericReply(contextual) && !BANNED_FALLBACK.test(contextual)) {
    return contextual;
  }

  const small = buildSmallTalkReply({
    signal: signal === "wellbeing_followup" ? "wellbeing" : signal === "question_repeat" ? "wellbeing" : signal,
    message: input.message,
    agentName: input.agentName,
    businessName: input.businessName,
    prospectProfile: input.prospectProfile,
    allowEmoji: input.allowEmoji,
    lang: input.lang,
  });

  if (small && !BANNED_FALLBACK.test(small) && !isGenericReply(small)) return small;

  if (signal === "hesitation") {
    return buildHesitationReply({
      message: input.message,
      agentName: input.agentName,
      businessName: input.businessName,
      prospectProfile: input.prospectProfile,
      allowEmoji: input.allowEmoji,
      lang: input.lang,
      history: input.history,
    });
  }

  if (signal === "greeting" || signal === "greeting_evening") {
    return buildHumanGreetingReply(input);
  }

  return contextual;
}

/**
 * Micro-conversations WhatsApp — jamais de « D'accord » générique si signal social connu.
 */
export function runSocialConversationEngine(input: SocialConversationInput): SocialConversationResult {
  const routing = resolveConversationRouting({
    message: input.message,
    topics: input.topics,
  });
  const disableSocial = input.disableSocialFallback ?? routing.disableSocialFallback;

  const classification = classifyConversationIntent({
    message: input.message,
    agentName: input.agentName,
    turnCount: input.turnCount,
    welcomeAlreadyDelivered: input.welcomeAlreadyDelivered,
    topics: routing.topics,
    disableSocialFallback: disableSocial,
  });

  if (disableSocial) {
    return {
      reply: null,
      intent: classification.intent,
      signal: "none",
      classification,
      blockBusinessEngines: false,
      reasoning: "business_intent_blocks_social_fallback",
    };
  }

  const signal = detectSocialSignal(input.message);
  let reply: string | null = null;

  if (isSocialSignalKind(signal)) {
    reply = replyFromSignal(signal, input);
  }

  if (!reply) {
    reply = buildContextualSocialReply({ ...input, signal, history: input.history });
  }

  if (!reply && signal === "hesitation") {
    reply = replyFromSignal("hesitation", input);
  }

  if (!reply && isSocialSignalKind(signal)) {
    reply = replyFromSignal(signal, input);
  }

  if (reply && (BANNED_FALLBACK.test(reply) || isGenericReply(reply))) {
    reply = isSocialSignalKind(signal) ? replyFromSignal(signal, { ...input, allowEmoji: true }) : null;
  }

  return {
    reply,
    intent: classification.intent,
    signal,
    classification,
    blockBusinessEngines: classification.blockBusinessEngines || isSocialSignalKind(signal),
    reasoning: isSocialSignalKind(signal) ? `social_signal:${signal}` : classification.reasoning,
  };
}
