import "server-only";

/** Interdit : terminer systématiquement par une question (effet IA / call-center). */
export function capTrailingQuestions(reply: string, lastUserMessage: string, microSeed?: string): string {
  const userHadQuestion = /\?/.test(String(lastUserMessage ?? ""));
  let t = String(reply ?? "").trim();
  if (!t) return t;

  const parts = t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  let qCount = parts.filter((p) => p.endsWith("?")).length;

  if (!userHadQuestion && parts.length > 1) {
    for (let i = parts.length - 1; i > 0 && qCount > 1; i--) {
      if (parts[i]!.endsWith("?")) {
        parts.splice(i, 1);
        qCount -= 1;
      }
    }
    t = parts.join(" ").trim();
  }

  if (!userHadQuestion && t.endsWith("?")) {
    let h = 0;
    const s = microSeed ?? t;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const onlyOneChunk = !/[.!?…]/.test(t.slice(0, -1));
    if (onlyOneChunk && (h % 100) < 42) {
      const candidate = t.replace(/\?\s*$/, ".").trim();
      if (candidate.length >= 8 && !/^[\s.!?…]+$/u.test(candidate)) {
        t = candidate;
      }
    }
  }

  return t;
}
