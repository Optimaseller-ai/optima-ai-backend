const CTA_PHRASES = [
  "dis-moi ce qui t'intéresse",
  "dis moi ce qui t'intéresse",
  "dis-moi ce qui vous intéresse",
  "dis moi ce qui vous intéresse",
  "je peux aussi",
  "te donner des infos",
  "des infos",
  "infos sur",
  "je peux vous aider",
  "je peux vous aider",
  "je peux vous présenter",
  "nos produits",
  "catalogue",
  "commande",
  "article",
  "prix",
  "dispo",
  "disponible",
  "ce qui vous intéresse",
  "que recherchez-vous",
  "cherchez-vous",
  "infos produits",
  "nos services",
];

const STRUCTURE_HINTS = ["Voici", "En résumé", "Instruction finale", "Objectif", "FAQ", "—", "\n- "];
const SUPPORT_HINTS = [
  "je suis là",
  "je suis là pour vous aider",
  "je vous écoute",
  "prenez votre temps",
  "n'hésitez pas",
  "n'hésite pas",
  "comment puis-je",
  "je reste à disposition",
  "je reste disponible",
];

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function computeBotRiskScore(input: {
  reply: string;
  lang: "fr" | "en" | "es";
}): { botRisk: number; hits: string[] } {
  const text = norm(input.reply);
  let score = 0;
  const hits: string[] = [];

  const has = (p: string) => {
    const pn = norm(p);
    if (!pn) return false;
    if (text.includes(pn)) {
      hits.push(pn);
      return true;
    }
    return false;
  };

  for (const p of CTA_PHRASES) {
    if (has(p)) score += 0.18;
  }
  for (const p of SUPPORT_HINTS) {
    if (has(p)) score += 0.15;
  }

  const qCount = (input.reply.match(/[?！]/g) ?? []).length;
  if (qCount >= 2) score += 0.12;
  if (qCount === 1) score += 0.06;

  if (input.reply.length >= 260) score += 0.12;
  if (input.reply.length >= 420) score += 0.22;

  // Structure: bullet-like or explicit headings
  for (const h of STRUCTURE_HINTS) {
    if (text.includes(norm(h))) {
      score += 0.08;
      hits.push(norm(h));
    }
  }

  // Cap
  score = Math.max(0, Math.min(1, score));
  return { botRisk: score, hits: Array.from(new Set(hits)).slice(0, 12) };
}

export function stripSocialCommercialBlacklistedPhrases(input: { reply: string; lang: "fr" | "en" | "es" }): {
  text: string;
  removed: string[];
} {
  let out = String(input.reply ?? "");
  const removed: string[] = [];
  for (const p of CTA_PHRASES) {
    const pn = String(p);
    const re = new RegExp(pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (re.test(out)) {
      out = out.replace(re, "");
      removed.push(pn);
    }
  }
  // Normalize spaces after removals
  out = out.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").replace(/\s+\!/g, "!").replace(/\s+\?/g, "?").trim();
  return { text: out, removed: Array.from(new Set(removed)) };
}

