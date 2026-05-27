import type { LearningInsight, LearningMemory } from "../memory/learning-memory-types";

function insight(
  id: string,
  text: string,
  confidence: number,
  sampleSize: number,
  category: LearningInsight["category"],
): LearningInsight {
  return { id, text, confidence, sampleSize, category };
}

/** Génère des insights lisibles — toujours explicables (basés sur échantillons réels). */
export function generateSalesInsights(memory: LearningMemory): LearningInsight[] {
  const out: LearningInsight[] = [];
  const n = memory.totalObservations;

  if (memory.bestHours.length >= 2) {
    const top = [...memory.bestHours].sort((a, b) => b.conversionRate - a.conversionRate)[0];
    if (top && top.samples >= 3) {
      out.push(
        insight(
          "hour_peak",
          `Les prospects convertissent davantage vers ${top.label} (${top.conversionRate}% sur ${top.samples} conversations).`,
          Math.min(95, 50 + top.samples * 3),
          top.samples,
          "timing",
        ),
      );
    }
  }

  const topFollowup = memory.successfulFollowups[0];
  if (topFollowup && topFollowup.samples >= 2 && topFollowup.successRate >= 40) {
    out.push(
      insight(
        "followup_delay",
        `Les relances après ${topFollowup.label} performent mieux (${topFollowup.successRate}% de réponses).`,
        Math.min(90, 40 + topFollowup.samples * 5),
        topFollowup.samples,
        "followup",
      ),
    );
  }

  const topStyle = memory.stylePerformance[0];
  if (topStyle && topStyle.samples >= 3) {
    out.push(
      insight(
        "style_tone",
        `Le ton « ${topStyle.tone} » obtient les meilleurs résultats sur ce business (${topStyle.score}/100).`,
        Math.min(88, 45 + topStyle.samples * 4),
        topStyle.samples,
        "style",
      ),
    );
  }

  const topProduct = memory.bestProducts[0];
  if (topProduct && topProduct.mentions >= 3) {
    out.push(
      insight(
        "product_star",
        `« ${topProduct.name} » est le plus demandé (${topProduct.mentions} mentions, ${topProduct.conversions} conversions).`,
        Math.min(85, 40 + topProduct.mentions * 3),
        topProduct.mentions,
        "product",
      ),
    );
  }

  const topClosing = memory.topPerformingClosings[0];
  if (topClosing && topClosing.samples >= 2 && topClosing.score >= 60) {
    out.push(
      insight(
        "closing_phrase",
        `Formulation efficace : « ${topClosing.phrase.slice(0, 60)}${topClosing.phrase.length > 60 ? "…" : ""} » (${topClosing.score}% succès).`,
        Math.min(92, topClosing.score),
        topClosing.samples,
        "conversion",
      ),
    );
  }

  const topObjection = memory.objectionPatterns[0];
  if (topObjection && topObjection.frequency >= 3) {
    const labels: Record<string, string> = {
      price: "prix",
      trust: "confiance",
      delivery: "livraison",
      quality: "qualité",
      delay: "délai",
      other: "divers",
    };
    out.push(
      insight(
        `objection_${topObjection.kind}`,
        `Objection fréquente : ${labels[topObjection.kind] ?? topObjection.kind} (${topObjection.frequency} fois).`,
        Math.min(80, 30 + topObjection.frequency * 5),
        topObjection.frequency,
        "objection",
      ),
    );
  }

  if (n >= 10 && memory.conversions > 0) {
    const rate = Math.round((memory.conversions / n) * 100);
    out.push(
      insight(
        "conversion_rate",
        `Taux de conversion observé : ~${rate}% sur ${n} interactions enregistrées.`,
        Math.min(75, 35 + n),
        n,
        "conversion",
      ),
    );
  }

  return out.slice(0, 8);
}

export function attachInsights(memory: LearningMemory): LearningMemory {
  return { ...memory, insights: generateSalesInsights(memory) };
}
