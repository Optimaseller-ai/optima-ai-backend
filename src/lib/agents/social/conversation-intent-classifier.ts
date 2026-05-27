import { SOCIAL_WELLBEING_FOLLOWUP_INLINE } from "./social-signal-patterns";
import { detectSocialSignal, isSocialSignalKind } from "./social-signal-detector";
import { isHesitationSignalMessage } from "./hesitation-signal-engine";
import { detectSocialIntent } from "@/lib/agents/human-behavior/social-intent-engine";
import {
  resolveConversationRouting,
  type ConversationRoutingIntent,
} from "./business-conversation-router";

export type ConversationIntentType =
  | "social"
  | "emotional"
  | "sales"
  | "support"
  | "curiosity"
  | "frustration"
  | "hesitation";

export type ConversationIntentResult = {
  intent: ConversationIntentType;
  /** true = pas d’orchestrateur, catalogue, embeddings, automation, RAG vente */
  blockBusinessEngines: boolean;
  signal: string;
  reasoning: string;
};

const SALES_STRONG =
  /\b(prix|stock|dispo|commander|acheter|livraison|modèle|modele|article|lien|payer|fcfa|€|devis|je\s+veux|besoin\s+d['’']?un|i\s+want\s+to\s+buy|quiero\s+comprar)\b/i;

const SUPPORT =
  /\b(réclamation|plainte|rembours|retour|sav|panne|cassé|casse|défectueux|inadmissible)\b/i;

const FRUSTRATION =
  /\b(tu\s+d[ée]range|vous\s+d[ée]range|d[ée]range|énerv|frustr|marre|arnaque|honte|trop\s+cher)\b/i;

const WELLBEING =
  /\b(ça\s+va|ca\s+va|comment\s+vas|comment\s+allez|la\s+journée|la\s+forme|tu\s+vas\s+bien|how\s+are\s+you|qué\s+tal)\b/i;

const THANKS = /^(merci|thanks|gracias|thank\s+you|thx|bcp|beaucoup)[\s!.?👍🙏]*$/i;

const CASUAL =
  /\b(ah\s+ok|ah\s+d'accord|dac|d'accord|ok\s+la|ouais|cool|super)\b/i;

/**
 * Classifie l’intention du tour utilisateur AVANT tout moteur business.
 */
function intentFromRoutingPrimary(primary: ConversationRoutingIntent): ConversationIntentResult | null {
  switch (primary) {
    case "complaint":
      return {
        intent: "support",
        blockBusinessEngines: false,
        signal: "support",
        reasoning: "routing_complaint_priority",
      };
    case "payment":
    case "order":
    case "product":
      return {
        intent: "sales",
        blockBusinessEngines: false,
        signal: "sales",
        reasoning: `routing_${primary}_priority`,
      };
    case "faq":
      return {
        intent: "curiosity",
        blockBusinessEngines: false,
        signal: "faq",
        reasoning: "routing_faq_priority",
      };
    default:
      return null;
  }
}

export function classifyConversationIntent(args: {
  message: string;
  agentName?: string | null;
  turnCount?: number;
  welcomeAlreadyDelivered?: boolean;
  topics?: string[];
  disableSocialFallback?: boolean;
}): ConversationIntentResult {
  const msg = String(args.message ?? "").trim();
  const lower = msg.toLowerCase();
  const routing = resolveConversationRouting({ message: msg, topics: args.topics });
  const disableSocial = args.disableSocialFallback ?? routing.disableSocialFallback;

  if (disableSocial) {
    const routed = intentFromRoutingPrimary(routing.primaryIntent);
    if (routed) return routed;
  }

  const signal = detectSocialSignal(msg);
  const socialIntent = detectSocialIntent(msg, {
    agentName: args.agentName,
    turnCount: args.turnCount ?? 0,
    welcomeAlreadyDelivered: args.welcomeAlreadyDelivered,
  });

  if (SUPPORT.test(lower)) {
    return {
      intent: "support",
      blockBusinessEngines: false,
      signal: "support",
      reasoning: "support_complaint",
    };
  }

  if (SALES_STRONG.test(lower) && !FRUSTRATION.test(lower)) {
    return {
      intent: "sales",
      blockBusinessEngines: false,
      signal: "sales",
      reasoning: "explicit_commercial_signal",
    };
  }

  if (FRUSTRATION.test(lower) || socialIntent.kind === "frustration" || socialIntent.kind === "teasing") {
    return {
      intent: "frustration",
      blockBusinessEngines: true,
      signal: signal !== "none" ? signal : socialIntent.kind,
      reasoning: "frustration_or_disruption",
    };
  }

  if (isHesitationSignalMessage(msg) || signal === "hesitation") {
    return {
      intent: "hesitation",
      blockBusinessEngines: true,
      signal: "hesitation",
      reasoning: "hesitation_marker",
    };
  }

  if (THANKS.test(lower) || signal === "thanks") {
    return {
      intent: "social",
      blockBusinessEngines: true,
      signal: "thanks",
      reasoning: "thanks_only",
    };
  }

  if (
    WELLBEING.test(lower) ||
    SOCIAL_WELLBEING_FOLLOWUP_INLINE.test(lower) ||
    signal === "wellbeing" ||
    signal === "wellbeing_followup" ||
    signal === "question_repeat" ||
    signal === "personal_activity" ||
    CASUAL.test(lower)
  ) {
    return {
      intent: "emotional",
      blockBusinessEngines: true,
      signal: signal !== "none" ? signal : "wellbeing",
      reasoning: "wellbeing_or_casual_mood",
    };
  }

  if (isSocialSignalKind(signal) || socialIntent.kind === "simple_greeting" || socialIntent.kind === "social_chat") {
    return {
      intent: "social",
      blockBusinessEngines: true,
      signal: signal !== "none" ? signal : socialIntent.kind,
      reasoning: "social_priority",
    };
  }

  if (socialIntent.kind === "personal_question" || socialIntent.kind === "curiosity" || /\?/.test(msg)) {
    return {
      intent: "curiosity",
      blockBusinessEngines: !SALES_STRONG.test(lower),
      signal: socialIntent.kind,
      reasoning: "curiosity_or_personal_question",
    };
  }

  if (socialIntent.kind === "humor") {
    return {
      intent: "social",
      blockBusinessEngines: true,
      signal: "humor",
      reasoning: "social_humor",
    };
  }

  return {
    intent: "social",
    blockBusinessEngines: !SALES_STRONG.test(lower) && msg.length < 120,
    signal: "general",
    reasoning: "default_non_sales_short",
  };
}
