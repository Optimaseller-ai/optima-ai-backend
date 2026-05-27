/** Patterns ChatGPT / IA visibles — post-traitement personnalité. */
const STRUCTURED_AI = [
  /\b(voici (?:une |les )?(?:liste|points|options))\b/gi,
  /\b(il est important de noter)\b/gi,
  /\b(n'hésitez pas à)\b/gi,
  /\b(je reste à votre disposition)\b/gi,
  /\b(n'hésitez pas)\b/gi,
  /\b(as an ai|en tant qu'ia)\b/gi,
  /^(\s*[-•*]\s+.+(\n|$)){3,}/m,
];

const SYNTAX_REPEAT = /\b(je peux vous|je suis en mesure de|n'hésitez pas)\b/gi;

export function reduceAiDetectionPatterns(text: string): { text: string; hits: number } {
  let out = String(text ?? "").trim();
  let hits = 0;

  for (const re of STRUCTURED_AI) {
    if (re.test(out)) {
      hits += 1;
      out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
    }
  }

  const syntaxMatches = out.match(SYNTAX_REPEAT) ?? [];
  if (syntaxMatches.length >= 2) {
    out = out.replace(SYNTAX_REPEAT, " ");
    hits += 1;
  }

  // Casser structure « 1. 2. 3. » en flux naturel
  out = out.replace(/^\s*\d+[\.)]\s*/gm, "").replace(/\n{2,}/g, "\n").trim();

  return { text: out, hits };
}
