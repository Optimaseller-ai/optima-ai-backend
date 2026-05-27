import type {
  HumanResponseStyle,
  IntentPriority,
  SalesConversationGoal,
} from "./types";

export type ResponseStyleGuide = {
  style: HumanResponseStyle;
  maxSentences: number;
  mustIncludeAction: boolean;
  instructionFr: string;
  instructionEn: string;
};

/** Style de réponse selon priorité et objectif commercial. */
export function deriveResponseStyle(args: {
  priority: IntentPriority;
  salesGoal: SalesConversationGoal;
  followupAfterHold?: boolean;
}): ResponseStyleGuide {
  if (args.followupAfterHold) {
    return {
      style: "decisive",
      maxSentences: 3,
      mustIncludeAction: true,
      instructionFr:
        "SUIVI OBLIGATOIRE : réponse CONCRÈTE (prix, stock, lien, taille). Interdit de redire « je vérifie » ou « un instant ».",
      instructionEn: "MANDATORY FOLLOW-UP: concrete answer (price, stock, link, size). No “let me check” again.",
    };
  }

  if (args.priority === "CRITICAL_BUYING_SIGNAL" || (args.priority === "HIGH" && args.salesGoal === "buy")) {
    return {
      style: "decisive",
      maxSentences: 3,
      mustIncludeAction: true,
      instructionFr:
        "Agir tout de suite : lien, paiement, réservation ou prochaine étape claire. INTERDIT : « je regarde », « un instant », « je vérifie ».",
      instructionEn: "Act now: link, payment, reservation, or clear next step. FORBIDDEN: “let me check”, “one moment”.",
    };
  }

  if (args.salesGoal === "reassure" || args.salesGoal === "support") {
    return {
      style: "empathetic",
      maxSentences: 3,
      mustIncludeAction: false,
      instructionFr: "Écouter d’abord, une phrase de reconnaissance, puis un fait rassurant — pas de script support.",
      instructionEn: "Acknowledge first, one reassuring fact — no support-bot script.",
    };
  }

  if (args.salesGoal === "compare" || args.salesGoal === "discover") {
    return {
      style: "advisory",
      maxSentences: 4,
      mustIncludeAction: false,
      instructionFr: "Conseiller comme en boutique : une reco ancrée, une question utile max.",
      instructionEn: "Advise like in-store: one grounded reco, at most one useful question.",
    };
  }

  if (args.priority === "LOW" || args.salesGoal === "chat") {
    return {
      style: "micro",
      maxSentences: 2,
      mustIncludeAction: false,
      instructionFr: "Réponse courte et humaine — pas de pitch commercial.",
      instructionEn: "Short human reply — no sales pitch.",
    };
  }

  return {
    style: "conversational",
    maxSentences: 3,
    mustIncludeAction: args.priority === "HIGH",
    instructionFr: "Naturel, chaleureux, une info utile + micro-suite si pertinent.",
    instructionEn: "Natural, warm, one useful fact + light next step if relevant.",
  };
}
