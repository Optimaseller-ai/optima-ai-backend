import type { ProspectAnalysis, SalesStrategy } from "@/lib/ai/sales/types";

function hasActiveObjection(analysis: ProspectAnalysis): boolean {
  return analysis.activeObjections.some((o) => o !== "NONE");
}

/**
 * Choisit la stratégie commerciale active à partir de l’analyse prospect.
 * Exemples produit : hésitant → TRUST_BUILDING ; prêt → DIRECT_CLOSE ; silencieux → FOLLOWUP_WAIT.
 */
export function selectSalesStrategy(analysis: ProspectAnalysis & { silenceSuggestWait?: boolean }): {
  strategy: SalesStrategy;
  reasoning: string;
} {
  if (analysis.emotion === "Frustrated") {
    return {
      strategy: "TRUST_BUILDING",
      reasoning: "Prospect frustré — calmer, rassurer, pas pousser la vente.",
    };
  }

  if (analysis.silenceSuggestWait && analysis.intention !== "High") {
    return {
      strategy: "FOLLOWUP_WAIT",
      reasoning: "Silence prolongé — pause ou relance value-add légère.",
    };
  }

  if (hasActiveObjection(analysis)) {
    return {
      strategy: "OBJECTION_HANDLING",
      reasoning: `Objection(s) active(s) : ${analysis.activeObjections.join(", ")}.`,
    };
  }

  if (analysis.trust === "Low" || analysis.emotion === "Skeptical" || analysis.emotion === "Hesitant") {
    return {
      strategy: "TRUST_BUILDING",
      reasoning: "Confiance ou hésitation — construire la crédibilité avant de closer.",
    };
  }

  if (analysis.temperature === "Hot" && analysis.intention === "High") {
    return {
      strategy: "DIRECT_CLOSE",
      reasoning: "Température chaude et intention forte — finaliser naturellement.",
    };
  }

  if (analysis.intention === "High" || (analysis.temperature === "Hot" && analysis.intention === "Medium")) {
    return {
      strategy: "SOFT_CLOSE",
      reasoning: "Intention d’achat présente — test de décision à faible friction.",
    };
  }

  if (
    analysis.temperature === "Warm" &&
    analysis.intention === "Medium" &&
    analysis.conversationFatigue < 0.45
  ) {
    return {
      strategy: "UPSELL",
      reasoning: "Intérêt réel — enrichir le panier ou guider vers une meilleure option.",
    };
  }

  if (analysis.temperature === "Warm" || analysis.intention === "Medium") {
    return {
      strategy: "PRODUCT_GUIDANCE",
      reasoning: "Intérêt modéré — guider sur le produit et la valeur.",
    };
  }

  if (analysis.conversationFatigue > 0.6) {
    return {
      strategy: "FOLLOWUP_WAIT",
      reasoning: "Fatigue conversationnelle — raccourcir et ne pas empiler le commercial.",
    };
  }

  if (analysis.emotion === "Excited") {
    return {
      strategy: "PRODUCT_GUIDANCE",
      reasoning: "Prospect enthousiaste — canaliser vers le bon choix.",
    };
  }

  return {
    strategy: "SOFT_CONVERSATION",
    reasoning: "Phase découverte — relation et écoute avant toute pression.",
  };
}

/** Situations complexes (plainte lourde, demande juridique, etc.). */
export function shouldEscalateToHuman(message: string): boolean {
  const m = String(message ?? "").toLowerCase();
  return /\b(avocat|tribunal|plainte officielle|remboursement intégral|chargeback|fraude|police)\b/i.test(m);
}
