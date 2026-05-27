/**
 * « Est-ce que ça ressemble à WhatsApp ? » — audit + réécriture légère.
 */

export type ConversationRealismLang = "fr" | "en" | "es";

export type ConversationRealismAudit = {
  whatsappScore: number;
  flags: string[];
};

function flag(a: ConversationRealismAudit, f: string) {
  a.flags.push(f);
  a.whatsappScore = Math.max(0, a.whatsappScore - 14);
}

export function auditConversationRealism(text: string): ConversationRealismAudit {
  const audit: ConversationRealismAudit = { whatsappScore: 100, flags: [] };
  const t = String(text ?? "").trim();
  if (!t) return audit;

  if (t.length > 520) flag(audit, "too_long_for_whatsapp");
  if (/^[-*•]\s|\n[-*•]\s/m.test(t)) flag(audit, "bullet_structure");
  if (/\b(en\s+premier\s+lieu|de\s+plus|par\s+ailleurs|furthermore|firstly|secondly)\b/i.test(t)) flag(audit, "essay_connectors");
  if (/\b(nous\s+vous\s+informons|veuillez\s+noter|please\s+be\s+advised|le\s+conseil\s+est\s+de)\b/i.test(t)) flag(audit, "corporate_voice");
  if ((t.match(/\?/g) ?? []).length >= 3) flag(audit, "question_stack");
  const sentences = t.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length >= 5) flag(audit, "too_many_sentences");

  return audit;
}

export function repairConversationRealism(text: string, lang: ConversationRealismLang): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  const audit = auditConversationRealism(out);
  if (audit.whatsappScore >= 72) return out;

  if (out.length > 480) {
    const parts = out.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    out = parts.slice(0, 3).join(" ");
  }
  out = out.replace(/^[-*•]\s+/gm, "");
  out = out.replace(/\b(en\s+premier\s+lieu|de\s+plus,)\s*/gi, "");
  out = out.replace(/\b(nous\s+vous\s+informons\s+que|veuillez\s+noter\s+que)\s*/gi, lang === "fr" ? "" : "");

  const qs = out.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (qs.length > 4) out = qs.slice(0, 4).join(" ");

  return out.replace(/\s{2,}/g, " ").trim();
}

export function formatConversationRealismPromptBlock(lang: ConversationRealismLang): string {
  if (lang === "en") {
    return [
      "WHATSAPP REALISM (level 9):",
      "- Every reply should feel thumb-typed on a phone: short beats, organic, not essay/FAQ.",
      "- No bullet lists, no numbered steps, no corporate advisory tone.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "REALISMO WHATSAPP:",
      "- Como mensaje móvil real: breve, orgánico, sin tono corporativo.",
    ].join("\n");
  }
  return [
    "RÉALISME WHATSAPP (niveau 9):",
    "- Chaque réponse = tapée au téléphone : courtes phrases, organique, pas encyclopédique.",
    "- Interdit listes à puces, structure ChatGPT, ton « nous vous informons ».",
  ].join("\n");
}
