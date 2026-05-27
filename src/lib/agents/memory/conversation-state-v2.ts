/**
 * Mémoire conversation sociale v2 — accueil, relation, fil social (niveau 12).
 */

import type { SellerBehaviorConversationState } from "./conversation-state";
import { detectSocialIntent, type SocialIntentKind } from "@/lib/agents/human-behavior/social-intent-engine";

export type ConversationSocialV2 = {
  /** Message « bienvenue chez … » déjà envoyé par l’assistant */
  welcomeDelivered?: boolean;
  /** Présentation « je suis … chez … » déjà faite */
  businessIntroDone?: boolean;
  /** Au moins 2 échanges utiles — relation établie */
  relationshipEstablished?: boolean;
  /** Le prospect est en mode social (pas achat) */
  socialThreadActive?: boolean;
  /** Fil avancé (≥3 tours user) */
  conversationAdvanced?: boolean;
  lastSocialIntent?: SocialIntentKind;
};

export function readConversationSocialV2(state?: SellerBehaviorConversationState): ConversationSocialV2 {
  return state?.conversationSocialV2 ?? {};
}

export function mergeConversationSocialV2ForUserTurn(args: {
  previous?: SellerBehaviorConversationState;
  message: string;
  agentName?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): ConversationSocialV2 {
  const prev = readConversationSocialV2(args.previous);
  const turn = args.previous?.stats?.turn_count ?? 0;
  const hasAssistant = (args.history ?? []).some((m) => m.role === "assistant");
  const intent = detectSocialIntent(args.message, {
    agentName: args.agentName,
    turnCount: turn,
    welcomeAlreadyDelivered: prev.welcomeDelivered === true || hasAssistant,
  });

  const socialKinds: SocialIntentKind[] = [
    "social_chat",
    "personal_question",
    "humor",
    "teasing",
    "curiosity",
    "simple_greeting",
  ];
  const socialNow = socialKinds.includes(intent.kind);

  return {
    welcomeDelivered: prev.welcomeDelivered === true || hasAssistant,
    businessIntroDone:
      prev.businessIntroDone === true || args.previous?.conversationalEtiquette?.businessPresentationDone === true,
    relationshipEstablished: prev.relationshipEstablished === true || turn >= 2 || hasAssistant,
    socialThreadActive: socialNow || prev.socialThreadActive === true,
    conversationAdvanced: turn >= 3 || prev.conversationAdvanced === true,
    lastSocialIntent: intent.kind,
  };
}

export function mergeConversationSocialV2AfterAssistant(args: {
  previous?: ConversationSocialV2;
  assistantReply: string;
}): ConversationSocialV2 {
  const prev = args.previous ?? {};
  const reply = String(args.assistantReply ?? "");
  const welcomeNow =
    prev.welcomeDelivered === true || /\b(bienvenue|welcome|bienvenido)\b/i.test(reply);
  const introNow =
    prev.businessIntroDone === true || (/\bje\s+suis\b/i.test(reply) && /\bchez\b/i.test(reply));

  return {
    ...prev,
    welcomeDelivered: welcomeNow,
    businessIntroDone: introNow,
  };
}

export function formatConversationStateV2PromptBlock(v2: ConversationSocialV2, lang: "fr" | "en" | "es"): string | null {
  if (!v2.welcomeDelivered && !v2.conversationAdvanced && !v2.socialThreadActive) return null;

  if (lang === "en") {
    return [
      "CONVERSATION STATE V2:",
      v2.welcomeDelivered ? "- Welcome already delivered — do NOT repeat welcome / business intro." : null,
      v2.relationshipEstablished ? "- Relationship established — natural advisor tone, not support script." : null,
      v2.socialThreadActive ? "- Social thread active — prioritize human presence over sales." : null,
      v2.conversationAdvanced ? "- Advanced thread — no first-contact patterns." : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (lang === "es") {
    return [
      "ESTADO CONVERSACIÓN V2:",
      v2.welcomeDelivered ? "- Bienvenida ya hecha — no repetir." : null,
      v2.socialThreadActive ? "- Hilo social — presencia humana." : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "ÉTAT CONVERSATION V2 :",
    v2.welcomeDelivered ? "- Accueil / bienvenue déjà fait — NE PAS recycler le message d’accueil." : null,
    v2.businessIntroDone ? "- Présentation entreprise déjà faite — pas de re-intro." : null,
    v2.relationshipEstablished ? "- Relation établie — conseiller réel, pas support client." : null,
    v2.socialThreadActive ? "- Fil social actif — présence humaine avant la vente." : null,
    v2.conversationAdvanced ? "- Conversation avancée — interdit les patterns premier contact." : null,
  ]
    .filter(Boolean)
    .join("\n");
}
