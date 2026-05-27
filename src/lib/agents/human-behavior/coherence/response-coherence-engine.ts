import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { frenchHonorificSmart, englishHonorificSmart, spanishHonorificSmart } from "@/lib/agents/memory/prospect-profile";
import { readConversationSocialV2 } from "@/lib/agents/memory/conversation-state-v2";

import { lockReplyToPrimaryIntent } from "./single-response-lock";
import { dedupeSentences, splitIntoSentences } from "./duplicate-detector";
import { lockConversationLanguage, stripForeignLanguageSentences, type LockedLanguage } from "./language-lock";
import { stripOverTalking } from "./over-talking-filter";
import { orchestrateMessageBubbles } from "./message-bubble-orchestrator";
import { detectResponsePrimaryIntent, intentRequiresSingleBubble } from "./response-intent";
import { minimalRewriteForIntent, passesWhatsAppQualityGate } from "./response-quality";

export type ResponseCoherenceInput = {
  draftText: string;
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
  city?: string;
  businessName?: string;
  rushed?: boolean;
};

export type ResponseCoherenceResult = {
  text: string;
  messagePlan: string[];
  meta: {
    primaryIntent: ReturnType<typeof detectResponsePrimaryIntent>;
    lockedLanguage: LockedLanguage;
    duplicatesRemoved: number;
    qualityRewritten: boolean;
  };
};

function honorificForLang(lang: LockedLanguage, state?: SellerBehaviorConversationState): string | null {
  const p = state?.prospectProfile;
  if (lang === "en") return englishHonorificSmart(p);
  if (lang === "es") return spanishHonorificSmart(p);
  return frenchHonorificSmart(p);
}

/**
 * Niveau 13 — cohérence totale avant envoi (une intention, une langue, zéro pluie IA).
 */
export function runResponseCoherenceEngine(input: ResponseCoherenceInput): ResponseCoherenceResult {
  const lastUserMessage = String(input.lastUserMessage ?? "");
  const intent = detectResponsePrimaryIntent(lastUserMessage);
  const lockedLang = lockConversationLanguage({
    lastUserMessage,
    stateLanguage: input.conversationState?.language,
  });

  const socialV2 = readConversationSocialV2(input.conversationState);
  const turnCount = input.conversationState?.stats?.turn_count ?? 0;
  const greetingAlreadyDone =
    socialV2.welcomeDelivered === true || turnCount >= 1 || (input.conversationState?.memory?.length ?? 0) > 2;

  const beforeSentences = splitIntoSentences(input.draftText);
  let text = String(input.draftText ?? "").trim();

  text = stripForeignLanguageSentences(text, lockedLang);
  text = stripOverTalking(text, intent);
  text = lockReplyToPrimaryIntent({
    text,
    intent,
    lockedLang,
    greetingAlreadyDone,
    city: input.city,
  });

  const afterSentences = splitIntoSentences(text);
  const duplicatesRemoved = Math.max(0, beforeSentences.length - afterSentences.length);

  let qualityRewritten = false;
  if (
    !passesWhatsAppQualityGate({ reply: text, intent, lockedLang }) ||
    (intentRequiresSingleBubble(intent) && afterSentences.length > 2)
  ) {
    const rewrite = minimalRewriteForIntent({
      intent,
      lockedLang,
      city: input.city,
      honorific: honorificForLang(lockedLang, input.conversationState),
    });
    if (rewrite) {
      text = rewrite;
      qualityRewritten = true;
    } else {
      text = dedupeSentences(afterSentences).slice(0, intentRequiresSingleBubble(intent) ? 1 : 2).join(" ").trim();
    }
  }

  if (!text.trim()) {
    const fallback = minimalRewriteForIntent({
      intent,
      lockedLang,
      city: input.city,
      honorific: honorificForLang(lockedLang, input.conversationState),
    });
    text = fallback ?? (lockedLang === "en" ? "One moment." : lockedLang === "es" ? "Un momento." : "Un instant.");
    qualityRewritten = true;
  }

  const messagePlan = orchestrateMessageBubbles({
    text,
    intent,
    rushed: input.rushed,
    maxBubbles: intentRequiresSingleBubble(intent) ? 1 : undefined,
  });

  const finalText = messagePlan.length === 1 ? messagePlan[0]! : messagePlan.join("\n\n");

  return {
    text: finalText,
    messagePlan,
    meta: {
      primaryIntent: intent,
      lockedLanguage: lockedLang,
      duplicatesRemoved,
      qualityRewritten,
    },
  };
}
