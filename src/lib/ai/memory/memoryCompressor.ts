export function compressMemoryFacts(input: {
  facts: string[];
  limit?: number;
}): { facts: string[]; dropped: number } {
  const limit = Math.max(0, input.limit ?? 3);
  const seen = new Set<string>();

  const cleaned = (Array.isArray(input.facts) ? input.facts : [])
    .map((f) => String(f ?? "").trim())
    .filter(Boolean)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter((f) => f.length >= 6);

  const unique: string[] = [];
  for (const f of cleaned) {
    const key = f.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(f);
  }

  // Prefer short/actionable facts.
  unique.sort((a, b) => a.length - b.length);

  const facts = unique.slice(0, limit);
  return { facts, dropped: Math.max(0, unique.length - facts.length) };
}

