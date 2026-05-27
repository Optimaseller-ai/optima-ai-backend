import "server-only";

import { runAntiAiFilterPass } from "../anti-ai/anti-ai-filter";

function stripNumberedManifesto(text: string): string {
  const lines = text.split(/\n/).map((l) => l.trim());
  const numbered = lines.filter((l) => /^\d+\.\s+/.test(l)).length;
  if (numbered >= 3) {
    return lines
      .filter((l) => !/^\d+\.\s+/.test(l))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return text;
}

function stripCorporateStarters(text: string, lang: "fr" | "en" | "es"): string {
  let t = text;
  const patterns =
    lang === "en"
      ? [/^(in\s+summary|to\s+summarize|here\s+are\s+the\s+points)\s*[:\-]?\s*/i, /^(firstly|secondly|finally)\s*[,\-]?\s*/i]
      : lang === "es"
        ? [/^(en\s+resumen|resumiendo)\s*[:\-]?\s*/i]
        : [
            /^(en\s+résumé|pour\s+résumer|voici\s+les\s+points)\s*[:\-]?\s*/i,
            /^(premièrement|deuxièmement|enfin)\s*[,\-]?\s*/i,
          ];
  for (const re of patterns) t = t.replace(re, "");
  return t.trim();
}

function capArtificialEnthusiasm(text: string): string {
  return text
    .replace(/!{2,}/g, "!")
    .replace(/\b(très\s+ravi|très\s+heureux|so\s+happy|really\s+excited)\b/gi, "");
}

/**
 * Filtre final L15 — ton IA, structure robotique, support froid.
 */
export function runFinalHumanFilter(text: string, lang: "fr" | "en" | "es", extraBlacklist?: string[]): string {
  let t = String(text ?? "").trim();
  if (!t) return t;

  t = stripNumberedManifesto(t);
  t = stripCorporateStarters(t, lang);
  t = capArtificialEnthusiasm(t);

  const pass = runAntiAiFilterPass(t, extraBlacklist);
  t = pass.text;

  t = t.replace(/^\s*[-•*]{1,2}\s+(.+)$/gm, "$1").trim();

  return t;
}
