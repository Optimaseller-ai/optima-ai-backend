import "server-only";

import { STRATEGY_INSTRUCTIONS } from "@/lib/ai/sales/strategy-dispatcher";
import type { SalesDecisionOutput } from "./types";

/** Bloc prompt SALES DECISION ENGINE pour l’agent LLM. */
export function formatSalesDecisionPromptBlock(output: SalesDecisionOutput, lang: "fr" | "en" | "es"): string {
  const a = output.analysis;
  const strat = STRATEGY_INSTRUCTIONS[output.activeStrategy];
  const closing =
    lang === "en" ? output.closingLinesEn.join(" · ") : output.closingLinesFr.join(" · ");
  const ob = output.objectionHints[0];
  const obLine =
    ob && lang === "en"
      ? ob.guidanceEn.join(" ")
      : ob?.guidanceFr.join(" ") ?? "";
  const upsell =
    lang === "en" ? output.upsell?.promptLineEn : output.upsell?.promptLineFr;

  const guardNote =
    output.guards.blockHardClose || output.guards.blockUpsell
      ? lang === "en"
        ? `ANTI-PRESSURE: no hard close=${output.guards.blockHardClose}; no upsell=${output.guards.blockUpsell}. Advise, don't push.`
        : `ANTI-PRESSION : pas de close agressif=${output.guards.blockHardClose} ; pas d'upsell=${output.guards.blockUpsell}. Conseiller, ne pas forcer.`
      : lang === "en"
        ? "Human sales style: guide and reassure — never sound like a bot pushing a sale."
        : "Style vendeur humain : conseiller, rassurer — jamais robot qui pousse à acheter.";

  const header =
    lang === "en"
      ? "SALES DECISION ENGINE (strategic brain — obey this turn):"
      : lang === "es"
        ? "MOTOR DE DECISIÓN COMERCIAL (cerebro estratégico — obedecer este turno):"
        : "SALES DECISION ENGINE (cerveau stratégique — respecter ce tour) :";

  return [
    header,
    "",
    lang === "en"
      ? `Active strategy: ${output.activeStrategy} | Interest: ${a.temperature} | Emotion: ${a.emotion} | Trust: ${a.trust} | Buy intent: ${a.intention}`
      : `Stratégie active : ${output.activeStrategy} | Intérêt : ${a.temperature} | Émotion : ${a.emotion} | Confiance : ${a.trust} | Intention achat : ${a.intention}`,
    lang === "en"
      ? `Conversion estimate: ${a.conversionProbability}% | Fatigue: ${(a.conversationFatigue * 100).toFixed(0)}% | Reason: ${a.reasoning}`
      : `Probabilité conversion : ${a.conversionProbability}% | Fatigue : ${(a.conversationFatigue * 100).toFixed(0)}% | Raison : ${a.reasoning}`,
    "",
    strat.trim(),
    "",
    guardNote,
    obLine ? (lang === "en" ? `Objection handling: ${obLine}` : `Objections : ${obLine}`) : "",
    closing ? (lang === "en" ? `Closing cues (shape, don't copy): ${closing}` : `Formes de close (ne pas copier mot pour mot) : ${closing}`) : "",
    upsell ? (lang === "en" ? `Upsell (once, natural): ${upsell}` : `Upsell (une fois, naturel) : ${upsell}`) : "",
    output.followupHint ? (lang === "en" ? `Follow-up: ${output.followupHint}` : `Relance : ${output.followupHint}`) : "",
    "",
    lang === "en"
      ? "Supervisor view: strategy + objections + conversion % are logged for the merchant dashboard."
      : "Vue superviseur : stratégie + objections + % conversion visibles côté marchand.",
  ]
    .filter(Boolean)
    .join("\n");
}
