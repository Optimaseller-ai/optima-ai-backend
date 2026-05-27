import "server-only";

import { DateTime } from "luxon";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import {
  detectProspectExplicitFrenchGreeting,
  englishHonorificSmart,
  englishSalutationForLocalTime,
  frenchHonorificSmart,
  frenchSalutationForLocalTime,
  greetingSlotFromLocalHour,
  resolveFrenchOpeningPhrase,
  spanishHonorificSmart,
  spanishSalutationForLocalTime,
} from "@/lib/agents/memory/prospect-profile";
import { detectDominantLanguage, norm, type SellerLanguage } from "@/lib/agents/seller-language";
import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import { detectProspectSocialCues } from "@/lib/agents/human-behavior/emotions/social-cues";
import { prospectCriticizesAgentOrQuality } from "@/lib/agents/human-behavior/human-advisor-reply-filter";
import { detectSocialIntent, isGreetingOnlyMessage } from "@/lib/agents/human-behavior/social-intent-engine";
import { readConversationSocialV2 } from "@/lib/agents/memory/conversation-state-v2";

type Role = "user" | "assistant";

export type ConversationTension = "calm" | "warm" | "heated";

export type ConversationStateEngineSnapshot = {
  lang: SellerLanguage;
  /** Heure locale boutique (fuseau profil). */
  localWallClock: string;
  daySlot: "morning" | "afternoon" | "evening" | "night";
  defaultSalutationFr: string;
  defaultSalutationEn: string;
  defaultSalutationEs: string;
  prospectEmotion: ReturnType<typeof detectProspectEmotion>;
  socialCues: ReturnType<typeof detectProspectSocialCues>;
  tension: ConversationTension;
  greetingActive: boolean;
  currentSubjectHint: string;
  salutationCoherenceNoteFr: string;
  salutationCoherenceNoteEn: string;
  salutationCoherenceNoteEs: string;
  /** 10 derniers tours (extrait court par message). */
  recentWindowLines: string[];
  memoryDigestLines: string[];
  neverIgnoreUserFr: string;
  neverIgnoreUserEn: string;
  neverIgnoreUserEs: string;
  apologyDirectiveFr: string | null;
  apologyDirectiveEn: string | null;
  apologyDirectiveEs: string | null;
};

function businessNow(iana: string): DateTime {
  const zone = String(iana ?? "").trim() || "Africa/Douala";
  const dt = DateTime.now().setZone(zone);
  return dt.isValid ? dt : DateTime.now().setZone("Africa/Douala");
}

function pickOne<T>(items: T[], seed: string): T {
  const s = seed || "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

export function isProspectGreetingMessage(message: string): boolean {
  const m = norm(message)
    .toLowerCase()
    .replace(/[.!?…]+$/g, "")
    .trim();
  return (
    /^(bonjour|bonsoir|bjr|bsr|salut|cc|coucou|hello|hi|hey|good morning|good evening|good afternoon)\b/i.test(m) ||
    /^(bonne\s+après[\s-]?midi|bonne\s+apres[\s-]?midi|bon\s+matin)\b/i.test(m) ||
    /^(hola|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|qué\s+tal|que\s+tal)\b/i.test(m)
  );
}

function estimateTension(
  emotion: ReturnType<typeof detectProspectEmotion>,
  cues: ReturnType<typeof detectProspectSocialCues>,
): ConversationTension {
  if (emotion === "anger" || emotion === "frustration" || cues.frustrationWithAgent) return "heated";
  if (emotion === "enthusiasm" || emotion === "curiosity" || cues.buyingSignal) return "warm";
  return "calm";
}

function subjectHintFromUserMessage(message: string): string {
  const t = norm(message).slice(0, 120);
  return t || "(vide)";
}

function buildRecentWindow(
  history: Array<{ role: Role; content: string }>,
  message: string,
  maxTurns: number,
): string[] {
  const turns = [...history, { role: "user" as const, content: message }];
  const tail = turns.slice(-maxTurns);
  return tail.map((m, i) => {
    const label = m.role === "user" ? "Prospect" : "Conseiller";
    const excerpt = norm(m.content).slice(0, 160);
    return `${i + 1}. ${label}: ${excerpt}`;
  });
}

export type ConversationStateEngineInput = {
  message: string;
  history: Array<{ role: Role; content: string }>;
  conversationState?: SellerBehaviorConversationState;
  businessIanaTimezone?: string;
  businessName: string;
  agentName: string;
};

/**
 * Vue structurée : humeur, tension, sujet, salutation, fenêtre courte, directives de cohérence.
 */
export function buildConversationStateEngineSnapshot(input: ConversationStateEngineInput): ConversationStateEngineSnapshot {
  const recentChat = [...input.history, { role: "user" as const, content: input.message }];
  const lang = detectDominantLanguage({
    message: input.message,
    previous: input.conversationState?.language,
    history: recentChat,
  });
  const iana = String(input.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const nowLocal = businessNow(iana);
  const hour = nowLocal.hour;
  const minute = nowLocal.minute;
  const daySlot = greetingSlotFromLocalHour(hour, minute);
  const salFr = frenchSalutationForLocalTime(nowLocal);
  const salEn = englishSalutationForLocalTime(nowLocal);
  const salEs = spanishSalutationForLocalTime(nowLocal);
  const emotion = detectProspectEmotion(input.message);
  const socialCues = detectProspectSocialCues(input.message);
  const tension = estimateTension(emotion, socialCues);
  const greetingActive = isProspectGreetingMessage(input.message);
  const explicitFr = lang === "fr" ? detectProspectExplicitFrenchGreeting(input.message) : null;
  const resolvedFr = explicitFr ? resolveFrenchOpeningPhrase({ nowLocal, explicitKind: explicitFr }) : null;

  const salutationCoherenceNoteFr =
    daySlot === "night"
      ? `Créneau NUIT (00h00–04h59) : ne jamais dire « bonne après-midi » ni « bon après-midi ». Salutation de référence : « ${salFr.phraseFr} ».`
      : `Créneau ${daySlot} : salutation de référence « ${salFr.phraseFr} » (alignée sur l’horloge locale boutique).`;

  const salutationCoherenceNoteEn =
    daySlot === "night"
      ? `NIGHT slot (00:00–04:59): never say “good afternoon”. Preferred opening: “${salEn.phraseEn}”.`
      : `Slot ${daySlot}: preferred opening “${salEn.phraseEn}”.`;

  const salutationCoherenceNoteEs =
    daySlot === "night"
      ? `Tramo NOCHE (00:00–04:59): no usar “buenas tardes”. Apertura preferida: «${salEs.phraseEs}».`
      : `Tramo ${daySlot}: apertura preferida «${salEs.phraseEs}».`;

  const recentWindowLines = buildRecentWindow(input.history, input.message, 10);
  const memoryDigestLines = (input.conversationState?.memory ?? []).map(String).filter(Boolean).slice(0, 10);

  const criticism = prospectCriticizesAgentOrQuality(input.message);
  const apologyDirectiveFr = criticism
    ? "PRIORITÉ : le prospect signale des erreurs ou l’incohérence du conseiller — reconnaître avec tact (« vous avez raison », « merci pour votre retour »), puis répondre au fond. Interdit : enchaîner sur une question d’aide générique seule."
    : null;
  const apologyDirectiveEn = criticism
    ? "PRIORITY: the prospect challenges mistakes or robotic answers — acknowledge briefly and sincerely, then address the substance. Forbidden: generic “how can I help” alone."
    : null;
  const apologyDirectiveEs = criticism
    ? "PRIORIDAD: el prospecto señala errores o respuestas rígidas — reconocer con tacto y brevedad, luego responder al fondo. Prohibido: solo «¿en qué puedo ayudarle?» genérico."
    : null;

  return {
    lang,
    localWallClock: nowLocal.toFormat("HH:mm"),
    daySlot,
    defaultSalutationFr: resolvedFr?.phraseFr ?? salFr.phraseFr,
    defaultSalutationEn: salEn.phraseEn,
    defaultSalutationEs: salEs.phraseEs,
    prospectEmotion: emotion,
    socialCues,
    tension,
    greetingActive,
    currentSubjectHint: subjectHintFromUserMessage(input.message),
    salutationCoherenceNoteFr,
    salutationCoherenceNoteEn,
    salutationCoherenceNoteEs,
    recentWindowLines,
    memoryDigestLines,
    neverIgnoreUserFr:
      "Règle absolue : répondre d’abord au sens concret du dernier message (prix, reproche, salutation, question). Pas de changement de sujet brutal.",
    neverIgnoreUserEn:
      "Absolute rule: answer the concrete intent of the last message first (price, complaint, greeting, question). No abrupt topic pivot.",
    neverIgnoreUserEs:
      "Regla absoluta: responda primero la intención concreta del último mensaje (precio, queja, saludo, pregunta). Sin cambios bruscos de tema.",
    apologyDirectiveFr,
    apologyDirectiveEn,
    apologyDirectiveEs,
  };
}

export function formatConversationStateEnginePromptBlock(snap: ConversationStateEngineSnapshot): string {
  const lines: string[] = [];
  const sal =
    snap.lang === "fr" ? snap.defaultSalutationFr : snap.lang === "en" ? snap.defaultSalutationEn : snap.defaultSalutationEs;
  const coherence =
    snap.lang === "fr"
      ? snap.salutationCoherenceNoteFr
      : snap.lang === "en"
        ? snap.salutationCoherenceNoteEn
        : snap.salutationCoherenceNoteEs;
  const neverIgnore =
    snap.lang === "fr" ? snap.neverIgnoreUserFr : snap.lang === "en" ? snap.neverIgnoreUserEn : snap.neverIgnoreUserEs;
  const apology =
    snap.lang === "fr" ? snap.apologyDirectiveFr : snap.lang === "en" ? snap.apologyDirectiveEn : snap.apologyDirectiveEs;
  lines.push("━━ CONVERSATION STATE ENGINE (V2) ━━");
  lines.push(`- Langue dominante: ${snap.lang}`);
  lines.push(`- Heure locale boutique: ${snap.localWallClock} (${snap.daySlot})`);
  lines.push(`- Salutation calibrée: ${sal}`);
  lines.push(`- Émotion prospect (heuristique): ${snap.prospectEmotion}`);
  lines.push(
    `- Signaux sociaux: frustrationAgent=${snap.socialCues.frustrationWithAgent}, confusion=${snap.socialCues.confusion}, sarcasme≈${snap.socialCues.sarcasmLikely}, satisfaction=${snap.socialCues.satisfaction}, achat=${snap.socialCues.buyingSignal}`,
  );
  lines.push(`- Tension conversationnelle: ${snap.tension}`);
  lines.push(`- Salutation active ce tour: ${snap.greetingActive ? "oui" : "non"}`);
  lines.push(`- Sujet / extrait message: ${snap.currentSubjectHint}`);
  lines.push("");
  lines.push(coherence);
  lines.push("");
  lines.push(neverIgnore);
  if (apology) {
    lines.push("");
    lines.push(String(apology));
  }
  lines.push("");
  lines.push("Fenêtre mémoire courte (10 derniers tours):");
  lines.push(snap.recentWindowLines.length ? snap.recentWindowLines.join("\n") : "(vide)");
  if (snap.memoryDigestLines.length) {
    lines.push("");
    lines.push("Mémoire vendeur (extraits):");
    lines.push(snap.memoryDigestLines.map((l) => `- ${l}`).join("\n"));
  }
  return lines.join("\n");
}

export type GreetingQuickReplyProfile = {
  agentName: string;
  businessName: string;
  sector?: string;
  businessIanaTimezone?: string;
};

export type GreetingQuickReplyCtx = {
  message: string;
  history: Array<{ role: Role; content: string }>;
  conversationState?: SellerBehaviorConversationState;
};

/**
 * Salutations humaines — jamais « Bien reçu », « Noté », « Que recherchez-vous » en réponse à bonjour/bonsoir.
 */
export function tryHumanizedGreetingQuickReply(
  profile: GreetingQuickReplyProfile,
  ctx: GreetingQuickReplyCtx,
): string | null {
  const message = norm(ctx.message);
  if (!isGreetingOnlyMessage(ctx.message)) return null;

  const hasAssistantBefore = ctx.history.some((m) => m.role === "assistant");
  const socialV2 = readConversationSocialV2(ctx.conversationState);
  const turnCount = ctx.conversationState?.stats?.turn_count ?? 0;
  const social = detectSocialIntent(ctx.message, {
    agentName: profile.agentName,
    turnCount,
    welcomeAlreadyDelivered: socialV2.welcomeDelivered === true || hasAssistantBefore,
  });
  if (social.kind !== "simple_greeting") return null;
  if (social.blockWelcomeReplay && hasAssistantBefore) {
    const langEarly = detectDominantLanguage({
      message,
      previous: ctx.conversationState?.language,
      history: [...ctx.history, { role: "user" as const, content: ctx.message }],
    });
    const pp0 = ctx.conversationState?.prospectProfile;
    const hFr0 = frenchHonorificSmart(pp0);
    if (langEarly === "en") return pickOne(["Hey — good to hear from you.", "Hi.", "Hello."], message);
    if (langEarly === "es") return pickOne(["Hola.", "Buenas.", "Le escucho."], message);
    return pickOne(
      hFr0 ? [`Bonjour ${hFr0}.`, `Salut ${hFr0}.`, "Bonjour."] : ["Bonjour.", "Salut.", "Oui, bonjour."],
      message,
    );
  }
  const recentChat = [...ctx.history, { role: "user" as const, content: ctx.message }];
  const lang = detectDominantLanguage({ message, previous: ctx.conversationState?.language, history: recentChat });
  const iana = String(profile.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const nowLocal = businessNow(iana);
  const salFr = frenchSalutationForLocalTime(nowLocal);
  const salEn = englishSalutationForLocalTime(nowLocal);
  const salEs = spanishSalutationForLocalTime(nowLocal);
  const explicitFr = lang === "fr" ? detectProspectExplicitFrenchGreeting(message) : null;
  const resolvedFr = explicitFr ? resolveFrenchOpeningPhrase({ nowLocal, explicitKind: explicitFr }) : null;
  const dayPartFr = resolvedFr?.phraseFr ?? salFr.phraseFr;
  const dayPartEn = salEn.phraseEn;
  const dayPartEs = salEs.phraseEs;
  const pp = ctx.conversationState?.prospectProfile;
  const honorFr = frenchHonorificSmart(pp);
  const honorEn = englishHonorificSmart(pp);
  const honorEs = spanishHonorificSmart(pp);

  const sector = String(profile.sector ?? "").toLowerCase();
  let orientFr = "Nous avons plusieurs articles intéressants en ce moment — dites-moi ce qui vous ferait plaisir.";
  let orientEn = "We’ve got several strong options right now — tell me what you’re after.";
  let orientEs = "Tenemos varias opciones interesantes ahora — dígame qué le interesa.";
  if (/chauss|sport|textil|mode|vetement|vêtement/i.test(sector)) {
    orientFr = "Vous cherchez plutôt chaussures, accessoires ou autre chose dans ce rayon ?";
    orientEn = "Are you mainly looking for shoes, accessories, or something else in that range?";
    orientEs = "¿Busca zapatos, accesorios u otra cosa de ese departamento?";
  } else if (/élect|electron|info|tel|tech|informat|phone|mobile/i.test(sector)) {
    orientFr = "Vous cherchez plutôt téléphones, accessoires ou matériel électronique ?";
    orientEn = "Are you looking for phones, accessories, or other electronics?";
    orientEs = "¿Busca teléfonos, accesorios u otro equipo electrónico?";
  }

  if (!hasAssistantBefore) {
    const frLine =
      honorFr != null
        ? ([
            `${dayPartFr} ${honorFr}, bienvenue chez ${profile.businessName}.\n${orientFr}`,
            `${dayPartFr} ${honorFr}.\n${orientFr}`,
            `Bonjour et bienvenue chez ${profile.businessName}.\n${orientFr}`,
          ] as const)
        : ([
            `${dayPartFr}, bienvenue chez ${profile.businessName}.\n${orientFr}`,
            `${dayPartFr}.\n${orientFr}`,
            `Bonjour et bienvenue chez ${profile.businessName}.\n${orientFr}`,
          ] as const);

    const enLine =
      honorEn != null
        ? ([
            `${dayPartEn} ${honorEn}, welcome to ${profile.businessName}.\n${orientEn}`,
            `${dayPartEn} ${honorEn}.\n${orientEn}`,
            `Hello and welcome to ${profile.businessName}.\n${orientEn}`,
          ] as const)
        : ([
            `${dayPartEn}, welcome to ${profile.businessName}.\n${orientEn}`,
            `${dayPartEn}.\n${orientEn}`,
            `Hello and welcome to ${profile.businessName}.\n${orientEn}`,
          ] as const);

    const esLine =
      honorEs != null
        ? ([
            `${dayPartEs} ${honorEs}, bienvenido a ${profile.businessName}.\n${orientEs}`,
            `${dayPartEs} ${honorEs}.\n${orientEs}`,
            `Hola y bienvenido a ${profile.businessName}.\n${orientEs}`,
          ] as const)
        : ([
            `${dayPartEs}, bienvenido a ${profile.businessName}.\n${orientEs}`,
            `${dayPartEs}.\n${orientEs}`,
            `Hola y bienvenido a ${profile.businessName}.\n${orientEs}`,
          ] as const);

    const variants = lang === "en" ? [...enLine] : lang === "es" ? [...esLine] : [...frLine];
    return pickOne(variants, message + profile.agentName + profile.businessName);
  }

  const noWelcome = socialV2.welcomeDelivered === true || hasAssistantBefore || turnCount >= 2;

  const shortFr =
    honorFr != null
      ? [
          `${dayPartFr} ${honorFr}, content de vous lire.`,
          `${dayPartFr} ${honorFr}.`,
          `${dayPartFr}, merci de votre message.`,
          `Merci ${honorFr}, ${dayPartFr}.`,
        ]
      : noWelcome
        ? [`${dayPartFr}, merci de votre message.`, `${dayPartFr}. Je vous écoute.`, `${dayPartFr}.`]
        : [
            `${dayPartFr}, merci de votre message.`,
            `${dayPartFr}, bienvenue chez ${profile.businessName}.`,
            `${dayPartFr}. Je vous écoute.`,
          ];

  const shortEn =
    honorEn != null
      ? [
          `${dayPartEn} ${honorEn}, good to hear from you.`,
          `${dayPartEn} ${honorEn}.`,
          `${dayPartEn}, thanks for your message.`,
          `Thanks ${honorEn}, ${dayPartEn}.`,
        ]
      : noWelcome
        ? [`${dayPartEn}, thanks for your message.`, `${dayPartEn}. I'm listening.`, `${dayPartEn}.`]
        : [
            `${dayPartEn}, thanks for your message.`,
            `${dayPartEn}, welcome to ${profile.businessName}.`,
            `${dayPartEn}. I'm listening.`,
          ];

  const shortEs =
    honorEs != null
      ? [
          `${dayPartEs} ${honorEs}, encantado de leerle.`,
          `${dayPartEs} ${honorEs}.`,
          `${dayPartEs}, gracias por su mensaje.`,
          `Gracias ${honorEs}, ${dayPartEs}.`,
        ]
      : noWelcome
        ? [`${dayPartEs}, gracias por su mensaje.`, `${dayPartEs}. Le escucho.`, `${dayPartEs}.`]
        : [
            `${dayPartEs}, gracias por su mensaje.`,
            `${dayPartEs}, bienvenido a ${profile.businessName}.`,
            `${dayPartEs}. Le escucho.`,
          ];

  const short = lang === "en" ? shortEn : lang === "es" ? shortEs : shortFr;
  return pickOne(short, message + profile.agentName);
}
