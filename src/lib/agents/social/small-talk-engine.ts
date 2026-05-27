import {
  englishHonorificSmart,
  frenchHonorificSmart,
  spanishHonorificSmart,
} from "@/lib/agents/memory/prospect-profile";
import type { SocialSignalKind } from "./types";

export type SmallTalkInput = {
  signal: SocialSignalKind;
  message: string;
  agentName: string;
  businessName: string;
  prospectProfile?: import("@/lib/agents/memory/prospect-profile").ProspectProfile;
  allowEmoji?: boolean;
  lang: "fr" | "en" | "es";
};

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

const FORBIDDEN = /\b(je\s+vérifie|je\s+regarde|un\s+instant|let\s+me\s+check|one\s+moment)\b/i;

/** Small talk humain — INTERDIT hold / vérifie seul. */
export function buildSmallTalkReply(input: SmallTalkInput): string | null {
  const biz = input.businessName.trim() || "notre boutique";
  const seed = input.message + input.signal;
  const smile = input.allowEmoji ? " 🙂" : "";

  let line = "";

  if (input.lang === "en") {
    const honor = englishHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    switch (input.signal) {
      case "wellbeing":
        line = pick(
          [`Doing well, thanks${h}${smile}.`, `All good on my side${h} — you?`, `Fine, thanks${h}.`],
          seed,
        );
        break;
      case "personal_activity":
        line = pick(
          [
            `I'm here to help customers at ${biz} today.`,
            `I'm available to walk you through anything you need.`,
            `I'm on the shop side — happy to assist.`,
          ],
          seed,
        );
        break;
      case "thanks":
        line = pick([`You're welcome${h}${smile}.`, `With pleasure${h}.`, `Anytime${h}.`], seed);
        break;
      case "farewell_night":
        line = pick([`Good night${h}${smile}.`, `Have a good evening${h}.`], seed);
        break;
      case "farewell_day":
        line = pick([`Have a good day${h}${smile}.`, `Talk soon${h}.`], seed);
        break;
      case "casual_ack":
        line = pick([`Got it${h}${smile}.`, `Sure${h}.`, `OK${h}.`], seed);
        break;
      default:
        return null;
    }
  } else if (input.lang === "es") {
    const honor = spanishHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    switch (input.signal) {
      case "wellbeing":
        line = pick([`Bien, gracias${h}${smile}.`, `Todo bien por aquí${h}.`], seed);
        break;
      case "personal_activity":
        line = pick(
          [
            `Estoy disponible para acompañarle en ${biz} hoy.`,
            `Respondo a los clientes de ${biz} — dígame en qué le ayudo.`,
          ],
          seed,
        );
        break;
      case "thanks":
        line = pick([`Con gusto${h}${smile}.`, `De nada${h}.`], seed);
        break;
      case "farewell_night":
        line = pick([`Buenas noches${h}.`, `Que descanse${h}${smile}.`], seed);
        break;
      case "farewell_day":
        line = pick([`Buen día${h}.`, `Hasta pronto${h}${smile}.`], seed);
        break;
      case "casual_ack":
        line = pick([`Vale${h}.`, `De acuerdo${h}${smile}.`], seed);
        break;
      default:
        return null;
    }
  } else {
    const honor = frenchHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    switch (input.signal) {
      case "wellbeing":
      case "wellbeing_followup":
        line = pick(
          [
            `Ça va bien merci${h}${smile}.`,
            `Très bien merci${h} — et vous ?`,
            `Ma journée va bien merci${h}${smile} — et vous ?`,
          ],
          seed,
        );
        break;
      case "question_repeat":
        line = pick(
          [
            `Pardon si ce n'était pas clair${h}${smile} — ça va bien, et vous ?`,
            `Ah pardon${h}${smile} — ma journée va bien. Et vous ?`,
          ],
          seed,
        );
        break;
      case "personal_activity":
        line = pick(
          [
            `Je réponds aux messages pour ${biz} là${smile} — tranquille.`,
            `Je suis sur WhatsApp pour ${biz} aujourd'hui${smile}.`,
            `Là je gère les messages clients de ${biz}${smile}.`,
          ],
          seed,
        );
        break;
      case "thanks":
        line = pick([`Avec plaisir${h}${smile}.`, `Je vous en prie${h}.`, `De rien${h}.`], seed);
        break;
      case "farewell_night":
        line = pick([`Bonne nuit${h}${smile}.`, `Bonne soirée${h}.`], seed);
        break;
      case "farewell_day":
        line = pick([`Bonne journée${h}${smile}.`, `À bientôt${h}.`], seed);
        break;
      case "casual_ack":
        line = pick([`D'accord${h}${smile}.`, `Compris${h}.`, `Oui${h}.`], seed);
        break;
      default:
        return null;
    }
  }

  if (!line || FORBIDDEN.test(line)) {
    return input.lang === "en"
      ? "I'm here 🙂"
      : input.lang === "es"
        ? "Aquí estoy 🙂"
        : "Je suis là 🙂";
  }
  return line;
}
