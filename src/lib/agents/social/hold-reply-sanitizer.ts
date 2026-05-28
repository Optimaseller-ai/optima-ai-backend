import { detectSocialSignal } from "./social-signal-detector";
import { buildHumanGreetingReply } from "./human-greeting-engine";
import { buildSmallTalkReply } from "./small-talk-engine";
import { stripBlacklistedPhrases } from "@/lib/ai/validators/humanEnough";

const HOLD_ONLY =
  /^\s*(je\s+vérifie|je\s+verifie|je\s+regarde(\s+cela)?|un\s+instant|attendez|let\s+me\s+check|one\s+moment)[\s.!?]*$/i;

const HOLD_HEAVY =
  /\b(je\s+vérifie|je\s+verifie|un\s+instant\s+s'il|let\s+me\s+check)\b/i;
const COMPLAINT_OR_FRUSTRATION =
  /\b(plainte|probleme|probl[eè]me|de[çc]u|frustr|marche\s+pas|panne|pas\s+content|d[ée]ception)\b/i;

export function isHoldOnlyReply(text: string): boolean {
  return HOLD_ONLY.test(String(text ?? "").trim());
}

/** Remplace réponses « hold » seules par une réponse sociale humaine. */
export function sanitizeHoldReply(args: {
  text: string;
  lastUserMessage: string;
  agentName: string;
  businessName: string;
  businessIanaTimezone?: string;
  personaKey?: string | null;
  lang?: "fr" | "en" | "es";
  prospectProfile?: import("@/lib/agents/memory/prospect-profile").ProspectProfile;
  welcomeAlreadyDelivered?: boolean;
  allowEmoji?: boolean;
}): string {
  let out = String(args.text ?? "").trim();
  if (!out) return out;

  // Never inject templates / generic support phrasing.
  // Only remove globally blacklisted support phrases.
  const stripped = stripBlacklistedPhrases(out);
  if (stripped.removed.length) {
    console.log("[BLACKLIST_TRIGGER]", {
      removed: stripped.removed,
      context: "sanitize_hold",
    });
  }
  out = stripped.text || out;

  const lang = args.lang ?? "fr";
  const userMsg = String(args.lastUserMessage ?? "").trim();
  if (COMPLAINT_OR_FRUSTRATION.test(userMsg)) {
    // SAV priority: keep original human-empathy text, no commercial rewrite.
    return out;
  }
  const signal = detectSocialSignal(userMsg);

  const mustReplace = isHoldOnlyReply(out) || (out.length < 28 && HOLD_HEAVY.test(out) && signal !== "none");

  // Non-destructive rule: never replace an entire valid reply.
  if (!mustReplace) return out;
  return out;
}
