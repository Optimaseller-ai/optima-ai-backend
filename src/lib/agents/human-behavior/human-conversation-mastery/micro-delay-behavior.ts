import "server-only";

import type { ConversationEnergy } from "./conversation-energy";
import type { ConversationResponseMode } from "./conversation-priority-engine";

export type MicroDelayBoost = {
  readPauseExtraMs: number;
  typingExtraMs: number;
  preSendMicroPauseMs: number;
  note: string;
};

/**
 * Petits décalages supplémentaires pour un rythme crédible (niveau 14).
 */
export function computeMicroDelayBehavior(args: {
  conversationMode: ConversationResponseMode;
  energy: ConversationEnergy;
  replyCharCount: number;
  microSeed?: string;
}): MicroDelayBoost {
  let readPauseExtraMs = 0;
  let typingExtraMs = 0;
  let preSendMicroPauseMs = 0;

  if (args.conversationMode === "micro") {
    readPauseExtraMs = 200 + (args.replyCharCount % 5) * 40;
    typingExtraMs = 180;
    preSendMicroPauseMs = 120;
  } else if (args.conversationMode === "rich") {
    readPauseExtraMs = 450;
    typingExtraMs = 320;
    preSendMicroPauseMs = 200;
  } else {
    readPauseExtraMs = 280;
    typingExtraMs = 220;
    preSendMicroPauseMs = 140;
  }

  if (args.energy === "low") {
    readPauseExtraMs += 120;
    typingExtraMs += 90;
  }
  if (args.energy === "alert") {
    readPauseExtraMs -= 80;
    typingExtraMs -= 60;
  }

  readPauseExtraMs = Math.max(0, readPauseExtraMs);
  typingExtraMs = Math.max(80, typingExtraMs);
  preSendMicroPauseMs = Math.max(0, preSendMicroPauseMs);

  let h = 0;
  const s = args.microSeed ?? `${args.conversationMode}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  preSendMicroPauseMs += (h % 5) * 35;

  return {
    readPauseExtraMs,
    typingExtraMs,
    preSendMicroPauseMs,
    note: `L14 micro-delay mode=${args.conversationMode} energy=${args.energy}`,
  };
}
