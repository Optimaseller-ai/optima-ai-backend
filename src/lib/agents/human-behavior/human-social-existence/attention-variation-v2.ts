import "server-only";

function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** L’attention n’est pas constante : légère variation déterministe (prompt + timing). */
export function computeAttentionVariationV2(args: { microSeed: string; turnCount: number }): {
  focus01: number;
  wanderHint: "steady" | "slight_drift" | "recenter";
} {
  const t = Math.max(0, args.turnCount);
  const r = hash01(`${args.microSeed}|attn|${t}`);
  const focus01 = 0.55 + r * 0.38;
  const wanderHint: "steady" | "slight_drift" | "recenter" =
    r < 0.33 ? "slight_drift" : r < 0.72 ? "steady" : "recenter";
  return { focus01, wanderHint };
}
