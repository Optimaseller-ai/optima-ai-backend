type ImperfectionInput = {
  text: string;
  seed: string;
  energy?: string;
  saturation01?: number;
  coldness01?: number;
  humor01?: number;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function seeded01(seed: string) {
  let h = 2166136261 >>> 0;
  const s = String(seed ?? "");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h % 10_000) / 10_000;
}

function maybeDropEndingPunct(text: string) {
  return text.replace(/[.!]$/g, "").trim();
}

function softenPerfectGrammar(text: string, r: number) {
  let out = text;
  // Tiny WhatsApp-ish tweaks, rare.
  if (r < 0.25) out = out.replace(/\bJe ne sais pas\b/g, "je sais pas");
  if (r < 0.18) out = out.replace(/\bce n['’]est pas\b/gi, "c'est pas");
  if (r < 0.12) out = out.replace(/\bne\s+pas\b/gi, "pas");
  return out;
}

export function applyHumanImperfections(input: ImperfectionInput): { text: string; applied: string[] } {
  let out = String(input.text ?? "").trim();
  if (!out) return { text: out, applied: [] };

  const sat = clamp01(input.saturation01 ?? 0);
  const cold = clamp01(input.coldness01 ?? 0);
  const humor = clamp01(input.humor01 ?? 0);

  // Base probability is low; increases slightly with humor, decreases with saturation (less “performing”).
  const base = 0.14;
  const p = clamp01(base + humor * 0.12 - sat * 0.08 - cold * 0.04);

  const r = seeded01(`${input.seed}|imperf|v1`);
  if (r > p) return { text: out, applied: [] };

  const applied: string[] = [];

  // 1) Micro-hesitation prefix (rare)
  const r1 = seeded01(`${input.seed}|hesitate`);
  if (r1 < 0.18 && out.length >= 8 && !/^(hmm|hum|euh|attends|attendez)\b/i.test(out)) {
    const prefixPool = sat >= 0.55 ? ["hmm", "ok", "attends"] : ["hmm", "euh", "attends", "je crois"];
    const pick = prefixPool[Math.floor(seeded01(`${input.seed}|hesitatePick`) * prefixPool.length)]!;
    out = `${pick} ${out}`.replace(/\s{2,}/g, " ").trim();
    applied.push("micro_hesitation");
  }

  // 2) Slightly less perfect punctuation/ending
  const r2 = seeded01(`${input.seed}|punct`);
  if (r2 < 0.22) {
    out = maybeDropEndingPunct(out);
    applied.push("punctuation_loosen");
  }

  // 3) Make structure less “balanced”: shorten a bit when long
  const r3 = seeded01(`${input.seed}|shorten`);
  if (r3 < 0.18 && out.length > 120) {
    out = out.split(/\n/)[0]!.trim();
    applied.push("structure_shorten");
  }

  // 4) Tiny grammar imperfections (very rare)
  const r4 = seeded01(`${input.seed}|grammar`);
  if (r4 < 0.12) {
    out = softenPerfectGrammar(out, r4);
    applied.push("light_grammar_imperf");
  }

  // 5) Energy variation: if busy/cold/saturated, strip emoji stacking
  if ((sat >= 0.55 || cold >= 0.55 || input.energy === "busy") && /[\p{Extended_Pictographic}]/u.test(out)) {
    const emojis = out.match(/[\p{Extended_Pictographic}]/gu) ?? [];
    if (emojis.length > 1) {
      let kept = 0;
      out = out.replace(/[\p{Extended_Pictographic}]/gu, (m) => {
        kept += 1;
        return kept === 1 ? m : "";
      });
      out = out.replace(/\s{2,}/g, " ").trim();
      applied.push("emoji_reduce");
    }
  }

  return { text: out.trim(), applied };
}

