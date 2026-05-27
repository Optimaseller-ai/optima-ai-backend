import {
  englishHonorificSmart,
  frenchHonorificSmart,
  spanishHonorificSmart,
} from "@/lib/agents/memory/prospect-profile";

export type HesitationSubSignal =
  | "hesitation_soft"
  | "hesitation_confused"
  | "hesitation_surprised"
  | "hesitation_thinking";

export type HesitationPoolInput = {
  message: string;
  agentName?: string;
  businessName?: string;
  prospectProfile?: import("@/lib/agents/memory/prospect-profile").ProspectProfile;
  allowEmoji?: boolean;
  lang: "fr" | "en" | "es";
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

const ANTI_REPEAT_TURNS = 5;

/** Réponses interdites seules (1 mot ou ack robotique). */
const BANNED_STANDALONE =
  /^(d['']?accord|ok|okay|oui|yes|vale|dac|compris|sure|bien)\s*[.!?…🙂👍]*$/i;

const SOFT_LAST_ASSISTANT =
  /\b(je\s+vous\s+écoute|je\s+t['']?écoute|take\s+your\s+time|tómese\s+su\s+tiempo)\b/i;

const HESITATION_SOFT_ONLY = /^(hmm+|hum+|hm+|m+h+)[\s!.?…]*$/i;
const HESITATION_THINKING =
  /^(euh+|euhh+|ok\.\.\.|d'accord\.\.\.|dac\.\.\.|oui\.\.\.|yeah\.\.\.|erm+)[\s!.?…]*$/i;
const HESITATION_CONFUSED =
  /\b(heein|hein\s*\??|hein\s+la|quoi\s*\??|comment\s+ça|comment\s+ca|c'?est\s+quoi|pardon\s*\??|euh\s+quoi)\b/i;
const HESITATION_SURPRISED =
  /\b(ah\s+bon\s*\??|ah\s+ok\s*\??|ah\s+d'accord\s*\??|ah\s+daccord\s*\??|oh\s+vraiment|really\s*\??)\b/i;

const FR_POOL: Record<HesitationSubSignal, string[]> = {
  hesitation_soft: [
    "Je vois 🙂",
    "Hmm je comprends 🙂",
    "Prenez votre temps 🙂",
    "Je vous écoute 🙂",
    "Pas de souci 🙂",
    "Dites-moi 🙂",
    "Oui je vois un peu 🙂",
    "Haha je comprends 🙂",
  ],
  hesitation_thinking: [
    "Prenez votre temps 🙂",
    "Pas de souci prenez le temps 🙂",
    "Je suis là quand vous voulez 🙂",
    "Aucune urgence 🙂",
    "Hmm d'accord je vous écoute 🙂",
  ],
  hesitation_confused: [
    "Je peux vous expliquer 🙂",
    "Dites-moi ce qui n'est pas clair 🙂",
    "Je reformule si vous voulez 🙂",
    "Je vous éclaire avec plaisir 🙂",
    "On peut reprendre calmement 🙂",
  ],
  hesitation_surprised: [
    "Oui 🙂 ça arrive parfois.",
    "Ah d'accord je vois 🙂",
    "Oui je comprends le point 🙂",
    "Je vois ce que vous voulez dire 🙂",
    "Ah oui je comprends 🙂",
  ],
};

const EN_POOL: Record<HesitationSubSignal, string[]> = {
  hesitation_soft: [
    "I see 🙂",
    "Hmm I get it 🙂",
    "Take your time 🙂",
    "I'm listening 🙂",
    "No worries 🙂",
    "Go ahead 🙂",
    "Yeah I see 🙂",
    "Ha I understand 🙂",
  ],
  hesitation_thinking: [
    "Take your time 🙂",
    "No rush at all 🙂",
    "I'm here when you're ready 🙂",
    "No pressure 🙂",
    "Sure — I'm listening 🙂",
  ],
  hesitation_confused: [
    "I can explain 🙂",
    "Tell me what's unclear 🙂",
    "Happy to rephrase 🙂",
    "Let me clarify 🙂",
    "We can go step by step 🙂",
  ],
  hesitation_surprised: [
    "Yes 🙂 that happens sometimes.",
    "Ah I see what you mean 🙂",
    "Got it — fair point 🙂",
    "I hear you 🙂",
    "Ah yes I understand 🙂",
  ],
};

const ES_POOL: Record<HesitationSubSignal, string[]> = {
  hesitation_soft: [
    "Ya veo 🙂",
    "Hmm entiendo 🙂",
    "Tómese su tiempo 🙂",
    "Le escucho 🙂",
    "Sin problema 🙂",
    "Dígame 🙂",
    "Sí lo veo un poco 🙂",
    "Ja ja entiendo 🙂",
  ],
  hesitation_thinking: [
    "Tómese su tiempo 🙂",
    "Sin prisa 🙂",
    "Aquí estoy cuando quiera 🙂",
    "Sin presión 🙂",
    "Le escucho con calma 🙂",
  ],
  hesitation_confused: [
    "Puedo explicarle 🙂",
    "Dígame qué no está claro 🙂",
    "Se lo reformulo si quiere 🙂",
    "Le aclaro con gusto 🙂",
    "Vamos paso a paso 🙂",
  ],
  hesitation_surprised: [
    "Sí 🙂 a veces pasa.",
    "Ah ya veo 🙂",
    "Entiendo el punto 🙂",
    "Le comprendo 🙂",
    "Ah sí entiendo 🙂",
  ],
};

export function classifyHesitationSubSignal(message: string): HesitationSubSignal {
  const raw = String(message ?? "").trim();
  const compact = raw.replace(/\s+/g, " ");

  if (HESITATION_CONFUSED.test(compact)) return "hesitation_confused";
  if (HESITATION_SURPRISED.test(compact)) return "hesitation_surprised";
  if (HESITATION_THINKING.test(compact) || /^euh+/i.test(compact)) return "hesitation_thinking";
  if (HESITATION_SOFT_ONLY.test(compact)) return "hesitation_soft";

  if (/\b(hmm|hum|hm)\b/i.test(compact)) return "hesitation_soft";
  if (/\b(euh|erm|uh)\b/i.test(compact)) return "hesitation_thinking";
  return "hesitation_soft";
}

function normalizeReplyKey(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\s!.?…🙂👍]+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  const core = String(text ?? "")
    .replace(/[🙂👍.!?…]/g, "")
    .trim();
  if (!core) return 0;
  return core.split(/\s+/).filter(Boolean).length;
}

export function isBannedHesitationReply(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if (BANNED_STANDALONE.test(t)) return true;
  if (wordCount(t) < 2) return true;
  return false;
}

function poolForLang(lang: HesitationPoolInput["lang"]): Record<HesitationSubSignal, string[]> {
  if (lang === "en") return EN_POOL;
  if (lang === "es") return ES_POOL;
  return FR_POOL;
}

function honorSuffix(input: HesitationPoolInput): string {
  if (input.lang === "en") {
    const h = englishHonorificSmart(input.prospectProfile);
    return h ? ` ${h}` : "";
  }
  if (input.lang === "es") {
    const h = spanishHonorificSmart(input.prospectProfile);
    return h ? ` ${h}` : "";
  }
  const h = frenchHonorificSmart(input.prospectProfile);
  return h ? ` ${h}` : "";
}

function applyHonorific(line: string, suffix: string): string {
  if (!suffix) return line;
  const trimmed = line.replace(/[.!?…]+$/, "");
  const punct = line.match(/[.!?…]+$/)?.[0] ?? ".";
  return `${trimmed}${suffix}${punct}`;
}

function stripEmojiIfNeeded(line: string, allowEmoji: boolean): string {
  if (allowEmoji) return line;
  return line.replace(/\s*🙂\s*/g, " ").replace(/\s+/g, " ").trim();
}

function recentAssistantReplies(
  history: HesitationPoolInput["history"],
  maxTurns = ANTI_REPEAT_TURNS,
): string[] {
  if (!history?.length) return [];
  return history
    .filter((m) => m.role === "assistant")
    .slice(-maxTurns)
    .map((m) => normalizeReplyKey(m.content));
}

function lastAssistantMessage(history: HesitationPoolInput["history"]): string {
  if (!history?.length) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "assistant") return String(history[i]?.content ?? "");
  }
  return "";
}

function isTooSimilarToLast(line: string, lastAssistant: string): boolean {
  if (!lastAssistant.trim()) return false;
  const a = normalizeReplyKey(line);
  const b = normalizeReplyKey(lastAssistant);
  if (a === b) return true;
  if (a.length > 8 && b.includes(a.slice(0, Math.min(a.length, 18)))) return true;
  if (b.length > 8 && a.includes(b.slice(0, Math.min(b.length, 18)))) return true;
  return false;
}

function shouldSkipForSoftEcho(line: string, lastAssistant: string): boolean {
  if (!SOFT_LAST_ASSISTANT.test(lastAssistant)) return false;
  return SOFT_LAST_ASSISTANT.test(line);
}

function filterCandidates(
  candidates: string[],
  input: HesitationPoolInput,
  recentKeys: Set<string>,
  lastAssistant: string,
): string[] {
  const suffix = honorSuffix(input);
  const allowEmoji = input.allowEmoji !== false;

  return candidates
    .map((line) => stripEmojiIfNeeded(applyHonorific(line, suffix), allowEmoji))
    .filter((line) => {
      if (isBannedHesitationReply(line)) return false;
      const key = normalizeReplyKey(line);
      if (recentKeys.has(key)) return false;
      if (isTooSimilarToLast(line, lastAssistant)) return false;
      if (shouldSkipForSoftEcho(line, lastAssistant)) return false;
      return true;
    });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function fallbackLine(input: HesitationPoolInput, sub: HesitationSubSignal): string {
  const pool = poolForLang(input.lang)[sub];
  const suffix = honorSuffix(input);
  const allowEmoji = input.allowEmoji !== false;
  const line = pool[0] ?? "Je vous écoute 🙂";
  return stripEmojiIfNeeded(applyHonorific(line, suffix), allowEmoji);
}

/**
 * Micro-réponse hésitation — variation, anti-répétition, miroir émotionnel léger.
 */
export function pickHesitationResponse(input: HesitationPoolInput): string {
  const sub = classifyHesitationSubSignal(input.message);
  const basePool = [...poolForLang(input.lang)[sub]];
  const recentKeys = new Set(recentAssistantReplies(input.history));
  const lastAssistant = lastAssistantMessage(input.history);

  let filtered = filterCandidates(basePool, input, recentKeys, lastAssistant);

  if (!filtered.length) {
    const allSubs: HesitationSubSignal[] = [
      "hesitation_soft",
      "hesitation_thinking",
      "hesitation_confused",
      "hesitation_surprised",
    ];
    const merged = allSubs.flatMap((s) => poolForLang(input.lang)[s]);
    filtered = filterCandidates(merged, input, recentKeys, lastAssistant);
  }

  if (!filtered.length) {
    return fallbackLine(input, sub);
  }

  return pickRandom(filtered);
}
