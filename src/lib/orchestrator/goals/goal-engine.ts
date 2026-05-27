import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import type { ConversationGoal, ConversationStage, ProspectTemperature } from "../types";

export function resolveConversationGoal(args: {
  stage: ConversationStage;
  intent: ProspectTurnIntent;
  temperature: ProspectTemperature;
  emotion: ProspectEmotion;
  hasContactInfo: boolean;
}): ConversationGoal {
  if (args.intent === "demande_horaires") return "learn_need";
  if (args.intent === "effort_visite") return "reassure";
  if (args.emotion === "frustration" || args.emotion === "anger" || args.intent === "plainte") {
    return "resolve_complaint";
  }
  if (args.emotion === "hesitation" || args.intent === "objection") return "reassure";
  if (args.intent === "achat" || args.stage === "closing") {
    return args.hasContactInfo ? "finalize_order" : "capture_phone";
  }
  if (args.stage === "negotiation") return "reassure";
  if (args.stage === "recommendation" || args.intent === "demande_produit") return "recommend_product";
  if (args.stage === "followup" && args.temperature === "cold") return "schedule_followup";
  if (args.stage === "greeting") return "learn_need";
  if (args.stage === "post_sale") return "maintain_relationship";
  if (args.temperature === "warm" && !args.hasContactInfo) return "capture_phone";
  return "learn_need";
}

export function goalGuidanceLine(goal: ConversationGoal, lang: "fr" | "en" | "es"): string {
  const fr: Record<ConversationGoal, string> = {
    learn_need: "Objectif : comprendre le besoin avant de vendre.",
    recommend_product: "Objectif : proposer un produit pertinent (une piste, pas un catalogue).",
    reassure: "Objectif : rassurer — ton calme, factuel.",
    capture_email: "Objectif : obtenir un email si naturel dans le fil.",
    capture_phone: "Objectif : coordonnées pour suivi commande — sans insister.",
    finalize_order: "Objectif : finaliser la commande — étapes claires.",
    trigger_payment: "Objectif : orienter vers paiement validé en interne.",
    schedule_followup: "Objectif : programmer une relance humaine plus tard.",
    maintain_relationship: "Objectif : entretenir la relation — pas de push vente.",
    resolve_complaint: "Objectif : apaiser et clarifier — pas de vente avant résolution.",
  };
  if (lang === "en") {
    const en: Partial<Record<ConversationGoal, string>> = {
      learn_need: "Goal: understand need before selling.",
      recommend_product: "Goal: one relevant product hint.",
      reassure: "Goal: reassure calmly.",
      finalize_order: "Goal: clear order steps.",
      resolve_complaint: "Goal: listen and clarify — no sales push yet.",
    };
    return en[goal] ?? fr[goal];
  }
  if (lang === "es") {
    const es: Partial<Record<ConversationGoal, string>> = {
      learn_need: "Objetivo: entender la necesidad antes de vender.",
      recommend_product: "Objetivo: sugerir un producto relevante.",
      reassure: "Objetivo: tranquilizar — tono calmado.",
      resolve_complaint: "Objetivo: escuchar y aclarar — sin vender aún.",
    };
    return es[goal] ?? fr[goal];
  }
  return fr[goal];
}
