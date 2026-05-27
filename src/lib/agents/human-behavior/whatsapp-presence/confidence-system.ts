import "server-only";

const HESITANT: RegExp[] = [
  /\b(je\s+pense\s+peut[- ]être|il\s+se\s+pourrait\s+que|je\s+ne\s+suis\s+pas\s+sûr)\b/gi,
  /\b(perhaps\s+maybe|i\s+guess\s+maybe|not\s+entirely\s+sure)\b/gi,
];

const OVER_ROBOT: RegExp[] = [
  /\b(conformément\s+à|selon\s+nos\s+procédures|veuillez\s+noter\s+que)\b/gi,
];

export function applyConfidenceTone(text: string): { text: string; adjusted: boolean } {
  let out = String(text ?? "").trim();
  let adjusted = false;

  for (const re of HESITANT) {
    if (re.test(out)) {
      out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
      adjusted = true;
    }
    re.lastIndex = 0;
  }

  for (const re of OVER_ROBOT) {
    if (re.test(out)) {
      out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
      adjusted = true;
    }
    re.lastIndex = 0;
  }

  return { text: out, adjusted };
}

export function formatConfidencePromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") return "CONFIDENCE: calm, sure, professional — never robotic hedging or corporate jargon.";
  if (lang === "es") return "CONFIANZA: calmo, seguro, profesional — sin dudas robóticas.";
  return "CONFIANCE : calme, sûr, professionnel — pas d’hésitation robotique ni de jargon corporate.";
}
