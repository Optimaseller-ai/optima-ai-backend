import "server-only";

import { ANTI_AI_PHRASE_BLACKLIST } from "./phrase-blacklist";

export type AntiAiFilterResult = {
  text: string;
  removedPhraseHits: number;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Supprime les occurrences des phrases blacklistées (insensible à la casse). */
export function stripBlacklistedPhrases(text: string, extraBlacklist: string[] = []): AntiAiFilterResult {
  let out = String(text ?? "").trim();
  let hits = 0;
  const all = [...ANTI_AI_PHRASE_BLACKLIST, ...extraBlacklist.map((x) => x.trim()).filter(Boolean)];
  for (const phrase of all) {
    if (!phrase) continue;
    const re = new RegExp(escapeRegex(phrase), "gi");
    const before = out;
    out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
    if (before !== out) hits += 1;
  }
  return { text: out, removedPhraseHits: hits };
}

/** Motifs « corporate / IA » à adoucir ou retirer. */
export function stripAssistantMetaLanguage(text: string): string {
  return String(text ?? "")
    .replace(/\b(en tant qu['’]assistant|en tant qu['’]ia|je suis une ia|je suis une intelligence artificielle)\b/gi, "")
    .replace(/\b(nous vous informons que|il est important de noter que|pour résumer|en conclusion)\b/gi, "")
    .replace(/\b(officiellement|veuillez|nous\s+vous\s+informons|conformément)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fermetures génériques souvent trop « script » en fin de message. */
export function stripTrailingScriptClosings(text: string): string {
  return String(text ?? "")
    .replace(/\b(à bientôt|bonne journée|bonne soirée)\b\.?$/i, "")
    .replace(/\s*\?\s*$/, "")
    .trim();
}

/** Tournures « support client bancaire / IA » à retirer même si absentes de la blacklist exacte. */
/** Formulations « rapport / cours » trop IA — version courte type vendeur rue. */
export function stripSchoolExplainerTone(text: string): string {
  let out = String(text ?? "");
  const pairs: [RegExp, string][] = [
    [
      /\bNous\s+n['’']avons\s+actuellement\s+pas\s+ce\s+produit\s+en\s+raison\s+d['’']une\s+rupture\s+de\s+stock\b\.?/gi,
      "Pas dispo pour le moment — stock terminé.",
    ],
    [
      /\bNous\s+n['’']avons\s+pas\s+ce\s+modèle\s+disponible\s+actuellement\s+en\s+raison\s+de\b[^.!?]{0,60}[.!?]?/gi,
      "Pas dispo pour le moment.",
    ],
    [
      /\bWe\s+currently\s+do\s+not\s+have\s+this\s+product\s+(?:in\s+stock|available)\s+because\b[^.!?]{0,80}[.!?]?/gi,
      "Not available right now — out of stock.",
    ],
    [
      /\bActualmente\s+no\s+tenemos\s+este\s+producto\s+(?:disponible|en\s+stock)\s+debido\s+a\b[^.!?]{0,80}[.!?]?/gi,
      "Ahora no está disponible.",
    ],
  ];
  for (const [re, rep] of pairs) out = out.replace(re, rep);
  return out.replace(/\s{2,}/g, " ").trim();
}

export function stripCorporateEmotionalClichés(text: string): string {
  let out = String(text ?? "");
  const patterns: RegExp[] = [
    /\bje\s+comprends\s+votre\s+déception\b[\s.,!?…:;-]*/gi,
    /\bje\s+comprends\s+parfaitement\b[\s.,!?…:;-]*/gi,
    /\bje\s+comprends\s+ce\s+que\s+vous\s+ressentez\b[\s.,!?…:;-]*/gi,
    /\bje\s+comprends\s+parfaitement\s+votre\s+frustration\b[\s.,!?…:;-]*/gi,
    /\bje\s+comprends\s+votre\s+frustration\b[\s.,!?…:;-]*/gi,
    /\bje\s+suis\s+là\s+pour\s+(vous\s+)?aider\b[\s.,!?…:;-]*/gi,
    /\bje\s+suis\s+là\s+pour\s+résoudre(\s+cela|\s+ça)?\b[\s.,!?…:;-]*/gi,
    /\bvotre\s+satisfaction\s+est\s+(notre|ma)\s+priorité\b[\s.,!?…:;-]*/gi,
    /\bnous\s+nous\s+excusons\b[\s.,!?…:;-]*/gi,
    /\bmerci\s+de\s+votre\s+patience\b[\s.,!?…:;-]*/gi,
    /\bje\s+vais\s+faire\s+le\s+nécessaire\b[\s.,!?…:;-]*/gi,
    /\bpuis-je\s+quand\s+même\s+vous\s+proposer\b[^.!?…]*[.!?…]?/gi,
    /\bI\s+understand\s+your\s+disappointment\b[\s.,!?…:;-]*/gi,
    /\bI\s+understand\s+what\s+you(?:'re|\s+are)\s+feeling\b[\s.,!?…:;-]*/gi,
    /\bI\s+understand\s+perfectly\b[\s.,!?…:;-]*/gi,
    /\bI\s*'?\s*m\s+here\s+to\s+help\b[\s.,!?…:;-]*/gi,
    /\bI\s*'?\s*m\s+here\s+to\s+resolve(\s+this)?\b[\s.,!?…:;-]*/gi,
    /\byour\s+satisfaction\s+is\s+our\s+priority\b[\s.,!?…:;-]*/gi,
    /\bwe\s+apologize\b[\s.,!?…:;-]*/gi,
    /\bthank\s+you\s+for\s+your\s+patience\b[\s.,!?…:;-]*/gi,
    /\bI\s*'?\s*ll\s+do\s+what(?:'s|\s+is)\s+necessary\b[\s.,!?…:;-]*/gi,
    /\bmay\s+I\s+still\s+offer\b[^.!?…]*[.!?…]?/gi,
    /\bentiendo\s+su\s+decepci[oó]n\b[\s.,!?…:;-]*/gi,
    /\bestoy\s+aqu[ií]\s+para\s+(ayudarle|resolverlo)\b[\s.,!?…:;-]*/gi,
    /\bgracias\s+por\s+su\s+paciencia\b[\s.,!?…:;-]*/gi,
  ];
  for (const re of patterns) out = out.replace(re, " ");
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?…])/g, "$1")
    .replace(/^\s*[.,;]\s*/g, "")
    .trim();
}

export function runAntiAiFilterPass(text: string, extraBlacklist?: string[]): AntiAiFilterResult {
  const a = stripBlacklistedPhrases(text, extraBlacklist);
  const b = stripAssistantMetaLanguage(a.text);
  const c = stripCorporateEmotionalClichés(b);
  const s = stripSchoolExplainerTone(c);
  const d = stripTrailingScriptClosings(s);
  return { text: d, removedPhraseHits: a.removedPhraseHits };
}
