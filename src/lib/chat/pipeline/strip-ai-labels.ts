const LABEL_PREFIX =
  /^(?:vanessa|assistant|ai|bot|agent|conseiller|vendeur|seller|optima)\s*:\s*/i;

export function stripAiSpeakerLabels(text: string, agentName?: string | null): string {
  let t = String(text ?? "").trim();
  if (!t) return "";

  // Repeated passes for stacked labels
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t.replace(LABEL_PREFIX, "").trim();
    if (agentName) {
      const nameRe = new RegExp(`^${escapeRegExp(agentName.trim())}\\s*:\\s*`, "i");
      t = t.replace(nameRe, "").trim();
    }
    if (t === before) break;
  }

  // Mid-text "Assistant:" artifacts
  t = t.replace(/\s*(?:Assistant|AI|Bot)\s*:\s*/gi, " ");

  return t.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
