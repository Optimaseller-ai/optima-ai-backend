import "server-only";

import type { AntiAiV3Lang } from "../anti-ai/anti-ai-v3";

/** WhatsApp-first : réduit formulations « assistant » résiduelles. */
export function runResponseNaturalizerV5(
  text: string,
  lang: AntiAiV3Lang,
  opts?: { shortenIfNegative?: boolean },
): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/^\s*[-*•]{2,}\s*/gm, "- ");
  out = out.replace(/\b(absolutely|certainly|definitely)\b[,]?\s+/gi, "");
  out = out.replace(/\bje\s+vous\s+comprends\s+parfaitement\b/gi, lang === "fr" ? "Je vois." : "Got it.");
  if (opts?.shortenIfNegative && out.length > 260) {
    const parts = out.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) out = parts.slice(0, 2).join(" ");
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}
