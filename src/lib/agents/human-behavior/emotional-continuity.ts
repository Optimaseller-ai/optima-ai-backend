import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { inferEmotionalRhythmPhase } from "./emotional-rhythm";

export function formatEmotionalContinuityBlock(
  state: SellerBehaviorConversationState | undefined,
  message: string,
  turnCount: number,
  fatigue01: number,
  lang: "fr" | "en" | "es",
): string | null {
  const phase = inferEmotionalRhythmPhase({ message, turnCount, fatigue01, state });
  const past = state?.prospectEmotionalMemory?.kind;
  if (!past && phase === "opening") return null;

  if (lang === "en") {
    return [
      "EMOTIONAL CONTINUITY:",
      past ? `- Past episode noted: ${past} — don’t reset tone coldly.` : null,
      `- Current rhythm: ${phase} — no abrupt cheer if they were upset recently.`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (lang === "es") {
    return `CONTINUIDAD EMOCIONAL: fase ${phase}${past ? `, episodio ${past}` : ""}.`;
  }
  return [
    "CONTINUITÉ ÉMOTIONNELLE :",
    past ? `- Épisode passé : ${past} — ne pas repartir sur un ton froid.` : null,
    `- Rythme actuel : ${phase} — pas d’enthousiasme brutal si frustration récente.`,
  ]
    .filter(Boolean)
    .join("\n");
}
