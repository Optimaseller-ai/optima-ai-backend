import { isBareAcknowledgmentMessage } from "@/lib/chat/smart-read-simulation";
import { detectResponsePrimaryIntent } from "./coherence/response-intent";
import { detectProspectEmotion } from "./emotions/emotion-detector";
import { ANTI_AI_PHRASE_BLACKLIST } from "./anti-ai/phrase-blacklist";

/** Formulations commerciales / call-center à supprimer. */
export const COMMERCIAL_ROBOTIC_BLACKLIST: readonly string[] = [
  ...ANTI_AI_PHRASE_BLACKLIST,
  "Si vous avez besoin de quoi que ce soit",
  "Si vous avez besoin de",
  "Vous avez prévu de",
  "Vous avez une idée de",
  "Je reste à votre disposition",
  "Je reste disponible pour",
  "N'hésitez pas à",
  "N’hésitez pas à",
  "Comment puis-je vous aider",
  "Comment puis-je vous assister",
  "Et vous, vous avez",
  "Et vous, comment",
  "à me le dire",
  "Puis-je vous aider",
  "Avez-vous d'autres questions",
  "Avez-vous d’autres questions",
  "N'hésitez pas de me",
  "N’hésitez pas de me",
  "Je suis là pour vous accompagner",
  "conseillère chez",
  "conseiller chez",
  "Et vous, comment vous appelez",
];

export type HumanShortReplyMode = "micro" | "short" | "normal";

export type HumanShortReplyContext = {
  mode: HumanShortReplyMode;
  humanShortMode: boolean;
  conversationalOverload: boolean;
  maxWords: number;
  microIntent: MicroReplyIntent;
  rationale: string;
};

export type MicroReplyIntent =
  | "ack"
  | "thanks"
  | "time_confirm"
  | "hours_day"
  | "name_ask"
  | "none";

const NAME_ASK =
  /\b(tu\s+t['']?appelles?|vous\s+vous\s+appelez|comment\s+tu\s+t['']?appelles?|comment\s+vous\s+appelez|c'?est\s+qui|your\s+name|qui\s+êtes[- ]vous)\b/i;

const TIME_CONFIRM =
  /\b(oui\s+)?(\d{1,2}\s*h\s*\d{0,2}|\d{1,2}h\d{0,2}|à\s+\d{1,2}|vers\s+\d{1,2}|13h|14h|15h|16h|17h|18h)\b/i;

const HOURS_DAY =
  /\b(demain|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|aujourd'hui|aujourd\s*hui|samedi\s+prochain)\b/i;

const OPEN_HOURS_CONTEXT = /\b(ouvert|ouverte|ouverture|horaire|fermé|ferme|passer|venir)\b/i;

function countWords(text: string): number {
  const t = String(text ?? "")
    .replace(/[🙂👍.!?…,]/g, " ")
    .trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

export function detectMicroReplyIntent(message: string): MicroReplyIntent {
  const m = String(message ?? "").trim();
  if (!m) return "none";
  if (NAME_ASK.test(m)) return "name_ask";
  if (/^(merci|thanks|gracias|thank\s+you|thx|bcp|beaucoup)[\s!.?👍🙏]*$/i.test(m)) return "thanks";
  if (isBareAcknowledgmentMessage(m) || /^(ok|okay|dac|d['']?accord|oui|yes|vale|parfait|super|bien)[\s!.?👍]*$/i.test(m)) {
    return "ack";
  }
  if (TIME_CONFIRM.test(m)) return "time_confirm";
  if (HOURS_DAY.test(m) && (OPEN_HOURS_CONTEXT.test(m) || m.length < 28)) return "hours_day";
  return "none";
}

/** Prospect peu bavard + intention claire → pas de relance commerciale. */
export function detectConversationalOverloadRisk(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return false;
  if (m.length < 25) return true;
  if (m.length < 45 && detectMicroReplyIntent(m) !== "none") return true;
  if (isBareAcknowledgmentMessage(m)) return true;
  const intent = detectResponsePrimaryIntent(m);
  if (intent === "thanks" || intent === "greeting") return true;
  return false;
}

/**
 * HUMAN_SHORT_REPLY_MODE — messages courts, fil avancé, émotion neutre, pas de push vente.
 */
export function resolveHumanShortReplyContext(args: {
  message: string;
  turnCount?: number;
  frustrationLevel01?: number;
  needsSalesPush?: boolean;
}): HumanShortReplyContext {
  const msg = String(args.message ?? "").trim();
  const turnCount = args.turnCount ?? 0;
  const emotion = detectProspectEmotion(msg);
  const overload = detectConversationalOverloadRisk(msg);
  const microIntent = detectMicroReplyIntent(msg);
  const intent = detectResponsePrimaryIntent(msg);

  const neutralEmotion =
    emotion !== "anger" && emotion !== "frustration" && (args.frustrationLevel01 ?? 0) < 0.4;
  const advanced = turnCount >= 2;
  const shortMsg = msg.length < 25;
  const humanShortMode =
    shortMsg &&
    advanced &&
    neutralEmotion &&
    !args.needsSalesPush &&
    (overload || microIntent !== "none" || intent === "thanks");

  let mode: HumanShortReplyMode = "normal";
  if (humanShortMode || microIntent !== "none" || overload) {
    mode = shortMsg && (microIntent !== "none" || isBareAcknowledgmentMessage(msg)) ? "micro" : "short";
  }
  if (intent === "location" || intent === "thanks") mode = "micro";

  const maxWords = mode === "micro" ? 12 : mode === "short" ? 22 : 48;

  return {
    mode,
    humanShortMode,
    conversationalOverload: overload,
    maxWords,
    microIntent,
    rationale: humanShortMode
      ? "HUMAN_SHORT_REPLY_MODE"
      : overload
        ? "conversational_overload_guard"
        : "standard",
  };
}

export function tryBuildHumanMicroReply(args: {
  message: string;
  agentName: string;
  lang: "fr" | "en" | "es";
  allowEmoji?: boolean;
  businessName?: string;
}): string | null {
  const intent = detectMicroReplyIntent(args.message);
  const smile = args.allowEmoji !== false ? " 😊" : "";
  const name = args.agentName.trim() || (args.lang === "en" ? "Advisor" : "Conseiller");
  const seed = args.message + name;

  if (intent === "name_ask") {
    if (args.lang === "en") return `${name}${smile}`;
    if (args.lang === "es") return `${name}${smile}`;
    return `${name}${smile}`;
  }

  if (intent === "thanks") {
    if (args.lang === "en") return pick(["You're welcome.", "Anytime.", "My pleasure."], seed);
    if (args.lang === "es") return pick(["De nada.", "Con gusto.", "A la orden."], seed);
    return pick(["Avec plaisir.", "De rien.", "Je vous en prie."], seed);
  }

  if (intent === "ack") {
    if (args.lang === "en") return pick(["Perfect.", "Got it.", "Alright."], seed) + smile;
    if (args.lang === "es") return pick(["Perfecto.", "De acuerdo.", "Vale."], seed) + smile;
    return pick(["Parfait.", "D'accord.", "Compris."], seed) + smile;
  }

  if (intent === "time_confirm") {
    const timeHit = args.message.match(/\d{1,2}\s*h\s*\d{0,2}|\d{1,2}h\d{0,2}|\d{1,2}(?=\s*h)/i);
    const t = timeHit?.[0]?.replace(/\s+/g, "") ?? "";
    if (args.lang === "en") return t ? `Sounds good — ${t}.` : `Sounds good${smile}`;
    if (args.lang === "es") return t ? `Perfecto — ${t}.` : `Perfecto${smile}`;
    return t ? `D'accord, à ${t.replace(/h/i, "h")}${smile}` : `Parfait${smile}`;
  }

  if (intent === "hours_day") {
    if (args.lang === "en") return `Yes, we'll be open${smile}`;
    if (args.lang === "es") return `Sí, estaremos abiertos${smile}`;
    return `Oui nous serons ouverts${smile}`;
  }

  return null;
}

function stripRoboticSentences(text: string): string {
  let parts = String(text ?? "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  parts = parts.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return !COMMERCIAL_ROBOTIC_BLACKLIST.some((phrase) => lower.includes(phrase.toLowerCase()));
  });

  return parts.join(" ").trim();
}

function enforceMaxWords(text: string, maxWords: number): string {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(text ?? "").trim();
  const cut = words.slice(0, maxWords).join(" ");
  if (/[.!?…]$/.test(cut)) return cut;
  return `${cut}.`;
}

function enforceSingleSentenceBias(text: string, seed: string, mode: HumanShortReplyMode): string {
  let t = String(text ?? "").trim();
  if (!t) return t;
  const parts = t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return t;

  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const forceOne = mode === "micro" || (mode === "short" && h % 100 < 70);
  if (forceOne) return parts[0]!;
  if (h % 100 < 70) return parts.slice(0, 2).join(" ");
  return t;
}

function stripTrailingQuestionsAggressive(text: string, lastUserMessage: string, overload: boolean): string {
  const userHadQuestion = /\?/.test(String(lastUserMessage ?? ""));
  let t = String(text ?? "").trim();
  if (!t || userHadQuestion) return t;

  const parts = t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  if (overload) {
    const withoutQ = parts.filter((p) => !p.endsWith("?"));
    if (withoutQ.length) return withoutQ.join(" ").trim();
  }

  if (t.endsWith("?") && parts.length === 1) {
    const stripped = t.replace(/\?\s*$/, ".").trim();
    if (stripped.length >= 4) return stripped;
  }

  return t;
}

/** Score 0–1 — objectif > 0.85 sur WhatsApp court. */
export function computeHumanShortnessScore(args: {
  reply: string;
  lastUserMessage: string;
  mode: HumanShortReplyMode;
}): number {
  const reply = String(args.reply ?? "").trim();
  const user = String(args.lastUserMessage ?? "").trim();
  if (!reply) return 0;

  let score = 1;
  const replyWords = countWords(reply);
  const userWords = countWords(user);
  const userHadQuestion = /\?/.test(user);

  if (args.mode === "micro" && replyWords > 14) score -= 0.4;
  if (args.mode === "short" && replyWords > 24) score -= 0.3;
  if (userWords < 8 && replyWords > userWords * 3 + 6) score -= 0.25;

  for (const phrase of COMMERCIAL_ROBOTIC_BLACKLIST) {
    if (reply.toLowerCase().includes(phrase.toLowerCase())) {
      score -= 0.18;
      break;
    }
  }

  if (!userHadQuestion && reply.trim().endsWith("?")) score -= 0.22;

  const sentences = reply.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (!userHadQuestion && sentences.length > 2) score -= 0.15;

  return Math.max(0, Math.min(1, score));
}

export type HumanShortReplyPassResult = {
  text: string;
  shortnessScore: number;
  mode: HumanShortReplyMode;
  usedMicroTemplate: boolean;
  compressed: boolean;
};

/**
 * Passe finale anti sur-génération — blacklist, 1 phrase, pas de double question.
 */
export function applyHumanShortReplyPass(args: {
  text: string;
  lastUserMessage: string;
  agentName?: string;
  lang?: "fr" | "en" | "es";
  allowEmoji?: boolean;
  turnCount?: number;
  frustrationLevel01?: number;
  microSeed?: string;
}): HumanShortReplyPassResult {
  const ctx = resolveHumanShortReplyContext({
    message: args.lastUserMessage,
    turnCount: args.turnCount,
    frustrationLevel01: args.frustrationLevel01,
  });

  const microTemplate =
    ctx.mode === "micro"
      ? tryBuildHumanMicroReply({
          message: args.lastUserMessage,
          agentName: args.agentName ?? "Conseiller",
          lang: args.lang ?? "fr",
          allowEmoji: args.allowEmoji,
        })
      : null;

  let text = String(args.text ?? "").trim();
  let usedMicroTemplate = false;

  if (microTemplate && (ctx.humanShortMode || ctx.conversationalOverload)) {
    text = microTemplate;
    usedMicroTemplate = true;
  } else {
    text = stripRoboticSentences(text);
    text = stripTrailingQuestionsAggressive(text, args.lastUserMessage, ctx.conversationalOverload);
    text = enforceSingleSentenceBias(text, args.microSeed ?? args.lastUserMessage, ctx.mode);
    text = enforceMaxWords(text, ctx.maxWords);
    text = stripTrailingQuestionsAggressive(text, args.lastUserMessage, true);
  }

  let shortnessScore = computeHumanShortnessScore({
    reply: text,
    lastUserMessage: args.lastUserMessage,
    mode: ctx.mode,
  });

  if (shortnessScore < 0.85 && !usedMicroTemplate) {
    text = enforceSingleSentenceBias(text, args.microSeed ?? "retry", "micro");
    text = enforceMaxWords(text, Math.min(ctx.maxWords, 10));
    text = stripRoboticSentences(text);
    shortnessScore = computeHumanShortnessScore({
      reply: text,
      lastUserMessage: args.lastUserMessage,
      mode: "micro",
    });
  }

  return {
    text: text.trim(),
    shortnessScore,
    mode: ctx.mode,
    usedMicroTemplate,
    compressed: true,
  };
}

export function formatHumanShortReplyPromptBlock(ctx: HumanShortReplyContext, lang: "fr" | "en" | "es"): string {
  if (ctx.mode === "normal") return "";
  if (lang === "en") {
    return [
      "BREVITY (mandatory):",
      `- Mode: ${ctx.mode} — max ~${ctx.maxWords} words.`,
      "- One sentence in most cases. No closing sales question.",
      "- Forbidden: « anything else », « feel free », « how can I help », « were you planning to ».",
    ].join("\n");
  }
  return [
    "BRIÈVETÉ (obligatoire):",
    `- Mode : ${ctx.mode} — max ~${ctx.maxWords} mots.`,
    "- Une seule phrase dans la majorité des cas. Pas de question de relance en fin.",
    "- Interdit : « si vous avez besoin », « n'hésitez pas », « vous avez prévu », « comment puis-je », « et vous » en relance.",
  ].join("\n");
}
