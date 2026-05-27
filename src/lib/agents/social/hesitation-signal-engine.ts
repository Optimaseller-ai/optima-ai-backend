import {
  pickHesitationResponse,
  type HesitationPoolInput,
} from "./hesitation-response-pool";

export type HesitationReplyInput = HesitationPoolInput;

const HESITATION_ONLY =
  /^(hmm+|hum+|euh+|euhh+|hm+|m+h+|ah\s+bon|ah\s+ok|ah\s+d'accord|ah\s+daccord|ok\.\.\.|d'accord\.\.\.|dac\.\.\.|oui\.\.\.|yeah\.\.\.|uh+h*|erm+|heein|hein\s*\??)[\s!.?…]*$/i;

const HESITATION_LEAD =
  /^(hmm+|hum+|euh+|hm+|ah\s+bon|ah\s+ok|d'accord\.\.\.|ok\.\.\.|heein|hein)[\s,]*(.*)$/i;

export function isHesitationSignalMessage(message: string): boolean {
  const raw = String(message ?? "").trim();
  if (!raw || raw.length > 120) return false;
  const compact = raw.replace(/\s+/g, " ").trim();
  if (HESITATION_ONLY.test(compact)) return true;
  if (HESITATION_LEAD.test(compact) && compact.length < 60) {
    const rest = compact.replace(HESITATION_LEAD, "$2").trim();
    return !rest || rest.length < 12;
  }
  if (/\b(heein|hein\s*\??)\b/i.test(compact) && compact.length < 40) return true;
  return false;
}

/** Réponse d'écoute humaine — pool contextuel, jamais « D'accord » seul. */
export function buildHesitationReply(input: HesitationReplyInput): string {
  return pickHesitationResponse(input);
}

export { classifyHesitationSubSignal, isBannedHesitationReply } from "./hesitation-response-pool";
