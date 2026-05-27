import type { OrchestratorActionKind } from "../types";
import type { SmartSilenceDecision } from "./smart-silence-engine";

export type HumanRhythmPlan = {
  showTyping: boolean;
  typingDurationMs: number;
  markSeen: boolean;
  allowMultiBubble: boolean;
  verificationPhraseOk: boolean;
  hints: string[];
};

export function planHumanRhythm(args: {
  action: OrchestratorActionKind;
  silence: SmartSilenceDecision;
  replyLengthEstimate: "short" | "medium";
  isHoldReply: boolean;
}): HumanRhythmPlan {
  const hints: string[] = [];
  let typingDurationMs = args.replyLengthEstimate === "short" ? 1200 : 2200;

  if (args.silence.shouldPause) {
    typingDurationMs = Math.max(typingDurationMs, args.silence.pauseMs);
    hints.push("Pause avant frappe — ne pas répondre en moins de 1,5 s sur message tendu.");
  }

  if (args.isHoldReply) {
    hints.push("Message « je vérifie » — une bulle courte, pas de vente.");
    return {
      showTyping: true,
      typingDurationMs: 1800,
      markSeen: true,
      allowMultiBubble: false,
      verificationPhraseOk: true,
      hints,
    };
  }

  if (args.action === "recommend_product") {
    hints.push("Recommandation : 1 produit nommé, 1 bénéfice — pas de liste.");
  }

  if (args.action === "hold_silence") {
    hints.push("Silence intelligent actif — réponse différée côté UX si possible.");
  }

  return {
    showTyping: args.action !== "hold_silence",
    typingDurationMs,
    markSeen: true,
    allowMultiBubble: args.replyLengthEstimate === "medium" && !args.isHoldReply,
    verificationPhraseOk: true,
    hints,
  };
}
