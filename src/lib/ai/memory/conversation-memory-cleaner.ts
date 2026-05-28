const ASSISTANT_ECHO_PATTERNS = [
  /^derni[eè]re\s+r[eé]ponse\s+agent/i,
  /^last\s+agent\s+reply/i,
  /^assistant\s*:/i,
];
const LOW_VALUE_ASSISTANT_MEMORY_RE =
  /^(derni[eè]re\s+r[eé]ponse\s+agent:\s*)?(ok|okay|d['’]?accord|oui|non|ca marche|ça marche)$/i;

function normKey(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function cleanMemoryFacts(input: {
  facts: string[];
  limit?: number;
  maxCharsPerFact?: number;
}): { facts: string[]; removedDuplicates: number; removedNoise: number } {
  const limit = Math.max(0, input.limit ?? 3);
  const maxChars = input.maxCharsPerFact ?? 180;
  const seen = new Set<string>();
  const out: string[] = [];
  let removedDuplicates = 0;
  let removedNoise = 0;

  for (const raw of Array.isArray(input.facts) ? input.facts : []) {
    let f = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (!f || f.length < 6) {
      removedNoise++;
      continue;
    }
    if (ASSISTANT_ECHO_PATTERNS.some((re) => re.test(f))) {
      if (LOW_VALUE_ASSISTANT_MEMORY_RE.test(f)) {
        removedNoise++;
        continue;
      }
      removedNoise++;
      continue;
    }
    if (LOW_VALUE_ASSISTANT_MEMORY_RE.test(f)) {
      removedNoise++;
      continue;
    }
    if (f.length > maxChars) f = `${f.slice(0, maxChars - 1).trimEnd()}…`;

    const key = normKey(f);
    if (seen.has(key)) {
      removedDuplicates++;
      continue;
    }
    seen.add(key);
    out.push(f);
  }

  // Prefer shorter actionable facts
  out.sort((a, b) => a.length - b.length);

  return {
    facts: out.slice(0, limit),
    removedDuplicates,
    removedNoise,
  };
}

export function cleanConversationMemoryArray(memory: string[] | undefined, limit = 8): string[] {
  const { facts } = cleanMemoryFacts({ facts: memory ?? [], limit, maxCharsPerFact: 220 });
  return facts;
}

export function summarizeRecentHistoryForPrompt(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  maxTurns = 6,
): string {
  return history
    .slice(-maxTurns)
    .map((m) => {
      const who = m.role === "user" ? "Prospect" : "Agent";
      const content = String(m.content ?? "").trim().slice(0, 180);
      return `${who}: ${content}`;
    })
    .join("\n");
}
