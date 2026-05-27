import "server-only";

import { primaryObjection } from "./objections/objection-detector";
import { formatHumanReassuranceGuidance } from "./objections/human-reassurance";
import { formatAntiRobotSalesSystemBlock } from "./anti-robot-sales";
import type { LiveSalesIntelligenceSnapshot } from "./live-sales-intelligence-engine";

/** Bloc système LIVE SALES INTELLIGENCE (injecté après Human Reality Core). */
export function formatLiveSalesIntelligencePromptBlock(
  snapshot: LiveSalesIntelligenceSnapshot,
  lang: "fr" | "en" | "es",
): string {
  const ob = primaryObjection(snapshot.objections);
  const reassurance = formatHumanReassuranceGuidance(ob, lang);
  const r0 = snapshot.recos[0];
  const recoLine = r0
    ? lang === "en"
      ? r0.promptLineEn
      : lang === "es"
        ? r0.promptLineEs
        : r0.promptLineFr
    : lang === "en"
      ? "Cross/alternatives: only grounded in catalogue, one suggestion max."
      : lang === "es"
        ? "Alternativas: sólo desde catálogo, una máx."
        : "Cross / alternatives : seulement ancrées catalogue — une proposition max.";

  const closingSamples =
    lang === "en" ? snapshot.closing.cuesEn.join(" · ") : snapshot.closing.cuesFr.join(" · ");

  const urg =
    snapshot.urgency.level === "ambient"
      ? lang === "en"
        ? 'Optional SINGLE subtle urgency line (“moving quickly this week” / “we still have a few running”) — only if truthful.'
        : lang === "es"
          ? "Una línea muy sutil de ritmo si es verdad — jamás urgencia ficticia."
          : "Phrase unique et subtile (« ça bouge vite en ce moment », « encore quelques paires là ») seulement si vrai au stock."
      : lang === "en"
        ? "No urgency gimmicks."
        : lang === "es"
          ? "Sin trucos de urgencia."
          : "Pas d’urgence artificielle.";

  const lines: string[] = [
    lang === "en"
      ? "LIVE SALES INTELLIGENCE (real-time advising):"
      : lang === "es"
        ? "INTELIGENCIA COMERCIAL EN TIEMPO REAL:"
        : "INTELLIGENCE COMMERCIALE TEMPS RÉEL (« live ») :",
    "",
    lang === "en"
      ? `Buying read: phase=${snapshot.buying.phase} score=${snapshot.buying.intentScore} (${snapshot.buying.rationale}).`
      : lang === "es"
        ? `Señal de compra: fase=${snapshot.buying.phase} score=${snapshot.buying.intentScore}.`
        : `Lecture achat : phase=${snapshot.buying.phase} · score=${snapshot.buying.intentScore} (${snapshot.buying.rationale}).`,
    lang === "en"
      ? `Sales temperature: ${snapshot.temperature.temperature}; pace↑${snapshot.temperature.conversationalPaceHint}; commercial rhythm≈${snapshot.temperature.commercialCadenceHint.toFixed(
          2,
        )}; closing depth=${snapshot.temperature.closingIntensityHint}`
      : lang === "es"
        ? `Temperatura: ${snapshot.temperature.temperature} · intensidad de cierre ${snapshot.temperature.closingIntensityHint}.`
        : `Température vente : ${snapshot.temperature.temperature} · rythme commercial ≈ ${snapshot.temperature.commercialCadenceHint.toFixed(
            2,
          )} · closing=${snapshot.temperature.closingIntensityHint}`,
    "",
    lang === "en" ? `Guidance now: ${snapshot.guidance.headline}` : `Orient maintenant : ${snapshot.guidance.headline}`,
    lang === "en"
      ? `Primary move: ${snapshot.guidance.primaryMove}.`
      : lang === "es"
        ? `Movimiento: ${snapshot.guidance.primaryMove}.`
        : `Mouvement principal : ${snapshot.guidance.primaryMove}.`,
    "",
    lang === "en"
      ? `Fatigue (${(snapshot.fatigue.fatigueScore01 * 100).toFixed(0)}%): shorter=${snapshot.fatigue.shortenReplies}, fewerQs=${snapshot.fatigue.fewerQuestions}`
      : `Fatigue (${(snapshot.fatigue.fatigueScore01 * 100).toFixed(0)} %) — réponses + courtes=${snapshot.fatigue.shortenReplies}, questions −=${snapshot.fatigue.fewerQuestions}`,
    "",
    reassurance.length ? (lang === "en" ? "REASSURE (seller voice):" : lang === "es" ? "REASEGURAR (vendedor):" : "RASSURER (vendeur, pas FAQ) :") : null,
    ...reassurance.map((x) => `- ${x}`),
    "",
    lang === "en" ? "SOFT PRODUCT / CROSS (max one line):" : lang === "es" ? "CROSS natural (una línea max):" : "CROSS / VARIANTE naturelle :",
    `- ${recoLine}`,
    snapshot.upsell.suggestTierStepUp
      ? lang === "en"
        ? `- Upsell justification frame: ${snapshot.upsell.justifyWith}.`
        : lang === "es"
          ? `- Marco upsell : ${snapshot.upsell.justifyWith}.`
          : `- Upsell légitimé via : ${snapshot.upsell.justifyWith}.`
      : null,
    "",
    lang === "en" ? `Smart closer (${snapshot.closing.strength}) — shape-only:` : lang === "es" ? `Cierre (${snapshot.closing.strength}):` : `Closing ${snapshot.closing.strength} (formes, pas mot-à-mot) :`,
    `- ${closingSamples}`,
    "",
    lang === "en" ? "Natural urgency gate:" : "Urgence crédible :",
    `- ${urg}`,
    ...snapshot.urgency.guardrails.slice(0, 2).map((g) => `- ${g}`),
    "",
    snapshot.salesMemory && typeof snapshot.salesMemory.trustLevel01 === "number"
      ? lang === "en"
        ? `Sales memory cues: trust≈${(snapshot.salesMemory.trustLevel01 * 100).toFixed(
            0,
          )}%; objections seen: ${(snapshot.salesMemory.objectionKinds ?? []).slice(0, 5).join(", ") || "—"}`
        : lang === "es"
          ? `Memoria venta: confianza ≈ ${(snapshot.salesMemory.trustLevel01 * 100).toFixed(0)}%`
          : `Mémoire signaux : confiance≈ ${(snapshot.salesMemory.trustLevel01 * 100).toFixed(
              0,
            )} % · objections vues : ${(snapshot.salesMemory.objectionKinds ?? []).slice(0, 5).join(", ") || "—"}`
      : null,
    snapshot.salesMemory?.budgetEcho?.length
      ? lang === "en"
        ? `- Budget echoes: ${snapshot.salesMemory.budgetEcho.join(" · ")}`
        : lang === "es"
          ? `- Presupuesto mencionado: ${snapshot.salesMemory.budgetEcho.join(" · ")}`
          : `- Budget déjà évoqué : ${snapshot.salesMemory.budgetEcho.join(" · ")}`
      : null,
    snapshot.salesMemory?.preferredEcho?.length
      ? lang === "en"
        ? `- Preferred/ref echoes: ${snapshot.salesMemory.preferredEcho.join(" · ")}`
        : lang === "es"
          ? `- Preferencias/ref: ${snapshot.salesMemory.preferredEcho!.join(" · ")}`
          : `- Produits/références évoqués : ${snapshot.salesMemory.preferredEcho!.join(" · ")}`
      : null,
    "",
    formatAntiRobotSalesSystemBlock(lang),
  ].filter(Boolean) as string[];

  return lines.join("\n");
}
