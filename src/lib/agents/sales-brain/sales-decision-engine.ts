import "server-only";

import { STRATEGY_INSTRUCTIONS } from "@/lib/ai/sales/strategy-dispatcher";
import { inferSalesTemperature } from "@/lib/agents/sales-intelligence/sales-scoring/sales-temperature";
import { deriveClosingStrategy } from "./closing/closing-strategy-engine";
import { applyAntiAggressiveGuard } from "./decision-engine/anti-aggressive-guard";
import { selectSalesStrategy, shouldEscalateToHuman } from "./decision-engine/strategy-selector";
import { toSalesInsightSnapshot } from "./decision-engine/supervisor-insights";
import { deriveFollowupStrategy } from "./followup-strategy/followup-strategy-engine";
import { buildObjectionResponseHints } from "./objection-handling/objection-responses";
import { analyzeProspectState } from "./prospect-analysis/prospect-analyzer";
import { deriveUpsellRecommendation } from "./upsell/upsell-recommendation-engine";
import type { SalesDecisionInput, SalesDecisionOutput } from "./types";

/**
 * Cerveau commercial intelligent — analyse, interprète, choisit une stratégie,
 * adapte l’approche et fait avancer naturellement vers la conversion.
 */
export function runSalesDecisionEngine(input: SalesDecisionInput): SalesDecisionOutput {
  const lang = input.lang ?? "fr";
  const analysisRaw = analyzeProspectState(input);

  let proposed = selectSalesStrategy(analysisRaw);
  if (shouldEscalateToHuman(input.message)) {
    proposed = {
      strategy: "HUMAN_ESCALATION",
      reasoning: "Demande sensible — escalade humaine recommandée.",
    };
  }

  const guarded = applyAntiAggressiveGuard({
    analysis: { ...analysisRaw, reasoning: proposed.reasoning, suggestedStrategy: proposed.strategy },
    proposedStrategy: proposed.strategy,
    recentSalesPushCount: input.recentSalesPushCount,
    message: input.message,
    blockAggressiveClose: input.blockAggressiveClose,
  });

  const activeStrategy = guarded.strategy;
  const analysis = {
    ...analysisRaw,
    suggestedStrategy: activeStrategy,
    reasoning: proposed.reasoning,
  };

  const temperatureSnap = inferSalesTemperature({
    buyingPhase: analysisRaw.buyingPhase as Parameters<typeof inferSalesTemperature>[0]["buyingPhase"],
    intentScore: analysisRaw.intentScore,
    conversationProfile: input.conversationProfile,
    turnCount: input.stats?.turn_count,
  });

  const closing = deriveClosingStrategy({
    temperature: analysis.temperature,
    intention: analysis.intention,
    emotion: analysis.emotion,
    closingIntensityHint: temperatureSnap.closingIntensityHint,
    blockHardClose: guarded.guards.blockHardClose,
    fatigueShorten: analysis.conversationFatigue > 0.45,
  });

  const upsell = deriveUpsellRecommendation({
    message: input.message,
    temperature: analysis.temperature,
    intention: analysis.intention,
    blockUpsell: guarded.guards.blockUpsell,
    lang,
  });

  const followup = deriveFollowupStrategy({
    silenceSuggestWait: analysisRaw.silenceSuggestWait,
    emotion: analysis.emotion,
    temperature: analysis.temperature,
    fatigue01: analysis.conversationFatigue,
    lang,
  });

  const objectionHints = buildObjectionResponseHints(analysis.activeObjections);

  const insights = {
    analysis,
    activeStrategy,
  };

  const followupHint =
    activeStrategy === "FOLLOWUP_WAIT"
      ? lang === "en"
        ? followup.hintEn
        : followup.hintFr
      : undefined;

  const promptSummaryFr = [
    `Stratégie : ${activeStrategy}`,
    `Intérêt ${analysis.temperature} · conversion ~${analysis.conversionProbability}%`,
    analysis.activeObjections.filter((o) => o !== "NONE").length
      ? `Objections : ${analysis.activeObjections.join(", ")}`
      : "Pas d’objection bloquante",
  ].join(" · ");

  return {
    insights,
    analysis,
    activeStrategy,
    strategyInstruction: STRATEGY_INSTRUCTIONS[activeStrategy],
    closingLevel: closing.level,
    closingLinesFr: closing.linesFr,
    closingLinesEn: closing.linesEn,
    objectionHints,
    upsell,
    followupHint,
    guards: guarded.guards,
    promptSummaryFr,
  };
}

export { toSalesInsightSnapshot };
