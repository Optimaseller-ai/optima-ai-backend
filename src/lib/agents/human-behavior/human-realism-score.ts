/**
 * Heuristique « réalisme humain » — score léger + micro-réécritures anti-robot.
 * Importable serveur ; utilisé après le filtre anti-IA principal.
 */

export type HumanRealismLang = "fr" | "en" | "es";

export type HumanRealismAudit = {
  /** 100 = rien à signaler ; baisse si drapeaux */
  score: number;
  flags: string[];
};

function flag(audit: HumanRealismAudit, f: string) {
  audit.flags.push(f);
  audit.score = Math.max(0, audit.score - 12);
}

export function auditHumanRealism(text: string): HumanRealismAudit {
  const audit: HumanRealismAudit = { score: 100, flags: [] };
  const t = String(text ?? "").trim();
  if (!t) return audit;

  if (/\b(je\s+comprends\s+parfaitement\s+votre\s+frustration|je\s+comprends\s+parfaitement)\b/i.test(t)) flag(audit, "ai_empathy_stack");
  if (/\b(n['’']hésitez\s+pas\s+à\s+revenir|feel\s+free\s+to\s+reach\s+out|no\s+dude\s+en\s+contactar)\b/i.test(t)) flag(audit, "script_closing");
  if ((t.match(/\!/g) ?? []).length >= 4) flag(audit, "excess_enthusiasm");
  if (/\b(excellent|parfait|super)\b.*\b(excellent|parfait|super)\b/i.test(t)) flag(audit, "stacked_praise");
  if (/\n{3,}/.test(t)) flag(audit, "over_segmented");
  if (/^[-*•]\s/m.test(t)) flag(audit, "bullet_robot");
  if (/\b(merci\s+d['’']?avoir\s+contacté|thank\s+you\s+for\s+contacting|gracias\s+por\s+contactar)\b/i.test(t)) flag(audit, "service_signoff");
  if (/\b(it\s+is\s+worth\s+noting|il\s+convient\s+de\s+noter|permitame\s+informarle)\b/i.test(t)) flag(audit, "chatgpt_structure");
  if (/\b(delighted\s+to|enchanté\s+de\s+vous\s+assister|ravi\s+de\s+vous\s+accompagner)\b/i.test(t)) flag(audit, "over_polite");

  return audit;
}

/** Réécritures conservatrices — ne pas casser le fond. */
export function repairHumanRealism(text: string, lang: HumanRealismLang): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  out = out.replace(/\bje\s+comprends\s+parfaitement\s+votre\s+frustration\b[\s.,!?…]*/gi, lang === "en" ? "I see. " : lang === "es" ? "Lo entiendo. " : "Je vois. ");
  out = out.replace(/\bje\s+comprends\s+parfaitement\b[\s.,!?…]*/gi, lang === "fr" ? "D’accord. " : lang === "es" ? "De acuerdo. " : "Alright. ");
  out = out.replace(/\bn['’']hésitez\s+pas\s+à\s+revenir\s+vers\s+nous\b[\s.,!?…]*/gi, lang === "en" ? "" : lang === "es" ? "" : "");
  out = out.replace(/\bfeel\s+free\s+to\s+reach\s+out\b[\s.,!?…]*/gi, "");
  out = out.replace(/\bno\s+dude\s+en\s+contactarnos\b[\s.,!?…]*/gi, "");

  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

/** Passe 2 — motifs « structure IA / politesse catalogue ». */
export function repairAdvancedHumanRealism(text: string, lang: HumanRealismLang): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  out = out.replace(/\bmerci\s+d['’']?avoir\s+contacté[^.!?…]*[.!?…]?/gi, "");
  out = out.replace(/\bthank\s+you\s+for\s+contacting[^.!?…]*[.!?…]?/gi, "");
  out = out.replace(/\bgracias\s+por\s+contactar[^.!?…]*[.!?…]?/gi, "");
  out = out.replace(/\b(it\s+is\s+worth\s+noting|il\s+convient\s+de\s+noter)\b[\s,:;-]*/gi, lang === "fr" ? "" : lang === "es" ? "" : "");
  out = out.replace(/\b(delighted\s+to\s+assist|ravi\s+de\s+vous\s+accompagner)\b[^.!?…]*[.!?…]?/gi, "");

  out = out.replace(/\s{2,}/g, " ").replace(/^\s*[.,;]\s*/g, "").trim();
  return out;
}

export function formatHumanRealismPromptBlock(lang: HumanRealismLang): string {
  if (lang === "en") {
    return [
      "HUMAN REALISM (level 7):",
      "- Avoid stacked corporate empathy + stacked praise + scripted closings.",
      "- Same human across the thread: stable voice, not “reset personality” each message.",
      "- Level 8: strip ChatGPT scaffolding (“thank you for contacting…”, “it is worth noting…”), avoid over-polite assistant openings.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "REALISMO HUMANO (niveles 7–8):",
      "- Evite empatía corporativa encadenada y cierres script.",
      "- Sin «gracias por contactar…» ni andamiaje ChatGPT.",
    ].join("\n");
  }
  return [
    "RÉALISME HUMAIN (niveau 7) :",
    "- Éviter l’empilement « empathie IA + enthousiasme marketing + fermeture catalogue ».",
    "- Phrases d’ouverture / fermeture variées (Bonsoir / D’accord / C’est noté / Je reste dispo) — pas toujours la même structure.",
    "- Même personne du début à la fin : continuité de voix, pas de reconfiguration de personnalité à chaque message.",
    "- Niveau 8 : bannir signatures service « merci d’avoir contacté… », « il convient de noter… », politesse assistant surchargée.",
  ].join("\n");
}
