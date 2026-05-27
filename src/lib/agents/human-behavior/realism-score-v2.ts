import "server-only";

/**
 * Score réalisme conversationnel v2 — ton IA, structure, politesse, répétitions, perfection.
 */

export type RealismV2Lang = "fr" | "en" | "es";

export type RealismV2Audit = { score: number; flags: string[] };

function flag(audit: RealismV2Audit, f: string, penalty = 11) {
  audit.flags.push(f);
  audit.score = Math.max(0, audit.score - penalty);
}

export function auditRealismV2(text: string): RealismV2Audit {
  const audit: RealismV2Audit = { score: 100, flags: [] };
  const t = String(text ?? "").trim();
  if (!t) return audit;

  if (/\b(je\s+suis\s+l[àà]\s+pour\s+vous\s+aider|how\s+can\s+i\s+assist|en\s+qu[eé]\s+puis[- ]je\s+vous\s+aider)\b/i.test(t)) flag(audit, "assistant_opener");
  if (/\b(avec\s+grand\s+plaisir|it\s+would\s+be\s+my\s+pleasure|ser[aá]\s+un\s+placer)\b/i.test(t)) flag(audit, "excess_politeness");
  if ((t.match(/\?/g) ?? []).length >= 3) flag(audit, "question_stack");
  if (/\b(premi[eè]rement|deuxi[eè]mement|en\s+conclusion|firstly|secondly|in\s+conclusion)\b/i.test(t)) flag(audit, "essay_structure");
  if (/\b(je\s+comprends|i\s+understand|entiendo)\b.*\b(je\s+comprends|i\s+understand|entiendo)\b/i.test(t)) flag(audit, "empathy_repeat");
  if (t.length > 380 && !/\n/.test(t)) flag(audit, "perfect_wall");
  if (/\b(excellent|parfait|formidable)\b.*\b(choix|décision|option)\b/i.test(t)) flag(audit, "marketing_perfect");
  if (/^(\d+[\.\)]\s|-\s)/m.test(t)) flag(audit, "numbered_list");

  return audit;
}

export function repairRealismV2(text: string, lang: RealismV2Lang): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  out = out.replace(/\b(je\s+suis\s+l[àà]\s+pour\s+vous\s+aider|how\s+can\s+i\s+assist\s+you)\b[\s.,!?…]*/gi, "");
  out = out.replace(/\ben\s+qu[eé]\s+puis[- ]je\s+vous\s+aider\b[\s?]*/gi, "");
  out = out.replace(/\b(avec\s+grand\s+plaisir|it\s+would\s+be\s+my\s+pleasure)\b[\s.,!?…]*/gi, lang === "fr" ? "D’accord. " : "Alright. ");
  out = out.replace(/\b(premi[eè]rement|deuxi[eè]mement|troisi[eè]mement)[,:]?\s*/gi, "");
  out = out.replace(/\b(firstly|secondly|thirdly)[,:]?\s*/gi, "");
  out = out.replace(/\b(en\s+conclusion|in\s+conclusion)[,:]?\s*/gi, "");
  out = out.replace(/^\d+[\.\)]\s+/gm, "");
  out = out.replace(/\b(je\s+comprends)\b(\s*[.,]?\s*)+\1\b/gi, "Je vois.");

  if (out.length > 420) {
    const parts = out.split(/(?<=[.!?…])\s+/).filter(Boolean);
    let acc = "";
    for (const p of parts) {
      const next = acc ? `${acc} ${p}` : p;
      if (next.length > 380) break;
      acc = next;
    }
    if (acc.length >= 24) out = acc.trim();
  }

  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

export function formatRealismScoreV2PromptBlock(lang: RealismV2Lang): string {
  if (lang === "en") {
    return "REALISM V2: no assistant openers, no essay structure, no stacked questions, no perfect marketing walls.";
  }
  if (lang === "es") {
    return "REALISMO V2: sin aperturas de asistente, sin estructura ensayo, sin muros perfectos.";
  }
  return "RÉALISME V2 : zéro ouverture assistant, zéro structure dissertation, zéro politesse empilée, zéro mur parfait.";
}
