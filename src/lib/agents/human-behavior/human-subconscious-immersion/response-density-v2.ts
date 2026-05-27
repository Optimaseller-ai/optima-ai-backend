import "server-only";

export type ResponseDensityV2 = "ultra_short" | "normal" | "expanded";

export function inferResponseDensityV2(args: {
  userMessage: string;
  fatigue01: number;
  turnCount: number;
  atmosphereBias: "crisp" | "relaxed" | "hushed";
  microSeed: string;
}): ResponseDensityV2 {
  let h = 0;
  const s = `${args.microSeed}|density|${args.userMessage.length}|${args.turnCount}`;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  const r = (h % 10000) / 10000;

  const len = args.userMessage.trim().length;
  if (len < 18 && /^(ok|oui|merci|dac|thanks)/i.test(args.userMessage.trim())) return "ultra_short";
  if (args.fatigue01 > 0.55 || args.turnCount > 26) return r < 0.62 ? "ultra_short" : "normal";
  if (args.atmosphereBias === "hushed") return r < 0.55 ? "ultra_short" : "normal";
  if (args.atmosphereBias === "crisp" && len < 90) return r < 0.45 ? "ultra_short" : "normal";
  if (len > 220 || /\b(explique|d[eé]tail|pourquoi|compare)\b/i.test(args.userMessage)) {
    return r < 0.35 ? "normal" : "expanded";
  }
  return r < 0.22 ? "ultra_short" : r < 0.78 ? "normal" : "expanded";
}
