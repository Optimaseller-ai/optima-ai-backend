import "server-only";

import type { RealismV2Lang } from "../realism-score-v2";

/**
 * Anti-structure « bot » v4 : léger nettoyage downstream (après L15).
 */
export function runAntiBotStructureV4Pass(text: string, lang: RealismV2Lang): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  out = out.replace(/\b(n['’]?h[eé]sitez\s+pas\s+[àa]|feel\s+free\s+to|no\s+dude\s+necesite)\b[^.!?]*[.!?]?/gi, "");
  out = out.replace(/\b(je\s+suis\s+ravi\s+de\s+vous\s+aider|happy\s+to\s+help\b[^.!?]*)/gi, "");
  out = out.replace(/\b(ci[- ]dessous|below\s+you\s+will\s+find|a\s+continuaci[oó]n)\b[^.!?]*:?/gi, "");
  out = out.replace(/^\s*[-*•]\s*[-*•]\s+/gm, "- ");
  const q = (out.match(/\?/g) ?? []).length;
  if (q >= 2) {
    const first = out.indexOf("?");
    if (first >= 0) {
      const second = out.indexOf("?", first + 1);
      if (second > 0) {
        out =
          out.slice(0, second).replace(/\?\s*$/, ".") + out.slice(second + 1).replace(/^\s*\?/, "").trim();
      }
    }
  }
  if (lang === "fr") {
    out = out.replace(/\b(je\s+reste\s+[àa]\s+votre\s+enti[eè]re\s+disposition[^.!?]*)/gi, "");
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

export function formatAntiBotStructureV4PromptBlock(lang: RealismV2Lang): string {
  const fr =
    "ANTI-BOT STRUCTURE V4 : pas de « n’hésitez pas », pas de scaffolding « ci-dessous », max 1 question, phrases un peu imparfaites OK, zéro liste ChatGPT.";
  const en =
    "ANTI-BOT STRUCTURE V4: no “feel free”, no “below you’ll find”, max one question, slight natural roughness ok, no GPT essay layout.";
  const es =
    "ANTI-BOT V4: sin “no dude en…”, sin maquetas tipo FAQ, máx. 1 pregunta, naturalidad imperfecta ok.";
  return lang === "en" ? en : lang === "es" ? es : fr;
}
