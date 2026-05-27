import type { SalesInsightSnapshot } from "@/lib/agent-control-panel/snapshot-types";
import type { SalesDecisionOutput } from "../types";

/** Mappe la sortie moteur vers le panneau supervision / agent control. */
export function toSalesInsightSnapshot(output: SalesDecisionOutput): SalesInsightSnapshot {
  const a = output.analysis;
  const objections =
    a.activeObjections.filter((o) => o !== "NONE").join(", ") || "Aucune objection active";
  return {
    strategy: output.activeStrategy,
    objection: objections,
    decisionReason: a.reasoning,
    urgencyLevel:
      output.closingLevel === "direct"
        ? "Élevée (close direct autorisé)"
        : output.closingLevel === "medium"
          ? "Modérée"
          : "Basse — conseil & confiance",
    nextRecommendation:
      output.upsell?.promptLineFr ??
      output.closingLinesFr[0] ??
      output.followupHint ??
      "Écouter et guider sans forcer.",
  };
}
