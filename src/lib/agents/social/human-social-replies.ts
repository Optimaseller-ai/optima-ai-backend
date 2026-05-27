import {
  englishHonorificSmart,
  frenchHonorificSmart,
  spanishHonorificSmart,
} from "@/lib/agents/memory/prospect-profile";
import { getCommercialAgentById, resolveCommercialAgentKey } from "@/lib/agents/personality/commercial-agents";
import { getAgentPersonalityProfile } from "@/lib/agents/personality/persona-prompts";
import type { GreetingReplyInput } from "./human-greeting-engine";

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

/** Reprend la salutation du prospect (bonsoir reste bonsoir, pas « bon après-midi »). */
function mirrorSalutationFr(message: string): "Bonsoir" | "Bonjour" | "Salut" {
  const m = String(message ?? "").toLowerCase();
  if (/\b(bonsoir|bsr)\b/.test(m)) return "Bonsoir";
  if (/\b(salut|coucou|cc|hey|hi)\b/.test(m)) return "Salut";
  return "Bonjour";
}

/**
 * Salutations chaleureuses — ton conseillère boutique, pas template IA.
 */
export function buildHumanSocialGreetingReply(input: GreetingReplyInput): string {
  const personaId = resolveCommercialAgentKey(input.personaKey) ?? "grace";
  const profile = getAgentPersonalityProfile(personaId);
  const agentDef = getCommercialAgentById(personaId);
  const displayName = profile?.displayName ?? input.agentName;
  const advisorFr = agentDef?.gender === "female" ? "conseillère" : "conseiller";
  const biz = input.businessName.trim() || "notre boutique";
  const seed = input.message + displayName + biz;
  const emoji = input.allowEmoji ? " 🙂" : "";
  const wave = input.allowEmoji ? " 👋" : "";

  if (input.lang === "en") {
    const honor = englishHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    const evening = /\b(evening|good evening|night)\b/i.test(input.message);
    const lead = evening ? "Good evening" : "Hello";
    if (!input.welcomeAlreadyDelivered) {
      return pick(
        [
          `${lead}${h}${wave}\nHow are you doing?`,
          `${lead}${h} — welcome to ${biz}${wave}`,
          `Hi${h}${emoji}\nI'm ${displayName} from ${biz}, here if you need anything.`,
        ],
        seed,
      );
    }
    return pick(
      [
        `${lead}${h}${emoji}\nGood to hear from you.`,
        `${lead}${h} — I'm here when you're ready.`,
        `Hi${h}${emoji}\nTell me what you need.`,
      ],
      seed,
    );
  }

  if (input.lang === "es") {
    const honor = spanishHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    const evening = /\b(noche|tarde|buenas)\b/i.test(input.message);
    const lead = evening ? "Buenas tardes" : "Hola";
    if (!input.welcomeAlreadyDelivered) {
      return pick(
        [
          `${lead}${h}${wave}\n¿Cómo está?`,
          `${lead}${h} — bienvenido a ${biz}${wave}`,
          `Hola${h}${emoji}\nSoy ${displayName}, de ${biz}. Cuénteme en qué le ayudo.`,
        ],
        seed,
      );
    }
    return pick(
      [`${lead}${h}${emoji}\nMe alegra leerle.`, `${lead}${h} — estoy disponible.`, `Hola${h}${emoji}\nDígame.`],
      seed,
    );
  }

  const honor = frenchHonorificSmart(input.prospectProfile);
  const honorSuffix = honor ? ` ${honor}` : "";
  const salute = mirrorSalutationFr(input.message);

  if (!input.welcomeAlreadyDelivered) {
    return pick(
      [
        `${salute}${honorSuffix}${emoji}\nComment allez-vous ?`,
        `${salute} et bienvenue chez ${biz}${wave}`,
        `${salute}${honorSuffix}${emoji}\nJe suis ${displayName}, ${advisorFr} chez ${biz} — je suis là si vous avez besoin d'aide.`,
        `${salute}${honorSuffix}${wave}\nContente de vous lire — dites-moi ce qu'il vous faut quand vous voulez.`,
      ],
      seed,
    );
  }

  return pick(
    [
      `${salute}${honorSuffix}${emoji}\nContent de vous lire.`,
      `${salute}${honorSuffix} — je suis disponible si vous avez une question.`,
      `${salute}${honorSuffix}${emoji}\nJe vous écoute, prenez votre temps.`,
    ],
    seed,
  );
}
