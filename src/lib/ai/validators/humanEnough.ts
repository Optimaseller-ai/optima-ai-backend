const GLOBAL_SUPPORT_BLACKLIST = [
  "je vous écoute",
  "prenez votre temps",
  "je suis disponible",
  "je peux vous aider",
  "quel article vous intéresse",
  "n'hésitez pas",
  "n’hésitez pas",
  "comment puis-je",
  "je reste à disposition",
  "je reste disponible",
  "si vous avez une question",
  "si vous avez besoin",
] as const;

function norm(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findBlacklistedPhrases(text: string): string[] {
  const t = norm(text);
  const hits: string[] = [];
  for (const p of GLOBAL_SUPPORT_BLACKLIST) {
    if (t.includes(p)) hits.push(p);
  }
  return hits;
}

export function isHumanEnough(text: string): { ok: true } | { ok: false; reason: string; hits?: string[] } {
  const t = String(text ?? "").trim();
  if (!t) return { ok: false, reason: "empty" };
  const hits = findBlacklistedPhrases(t);
  if (hits.length) return { ok: false, reason: "blacklist_hit", hits };
  // WhatsApp-ish: short-to-medium; allow 1 emoji; avoid corporate signatures.
  if (t.length < 2) return { ok: false, reason: "too_short" };
  if (t.length > 700) return { ok: false, reason: "too_long" };
  if (/^bonjour\s*!?\s*$/i.test(t)) return { ok: true };
  return { ok: true };
}

export function stripBlacklistedPhrases(text: string): { text: string; removed: string[] } {
  let out = String(text ?? "");
  const removed: string[] = [];
  for (const p of GLOBAL_SUPPORT_BLACKLIST) {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (re.test(out)) {
      out = out.replace(re, "").replace(/\s{2,}/g, " ");
      removed.push(p);
    }
  }
  out = out.replace(/\s+\./g, ".").replace(/\s+\!/g, "!").replace(/\s+\?/g, "?").trim();
  return { text: out.trim(), removed };
}

