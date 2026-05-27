import "server-only";

import type { ProspectEmotion } from "./emotions/emotion-detector";
import type { ProspectTurnIntent } from "./response-orchestrator";
import type { SellerLanguage } from "@/lib/agents/seller-language";

/**
 * États « conseiller humain » (niveau 3) — pilotent le ton dans le prompt,
 * distincts de l’intention commerciale (SellerIntent).
 */
export type HumanAdvisorConversationState =
  | "accueil"
  | "ecoute"
  | "recherche_produit"
  | "attente"
  | "verification"
  | "proposition"
  | "hesitation"
  | "negociation"
  | "cloture"
  | "frustration"
  | "relance_douce";

export type InferHumanAdvisorStateInput = {
  message: string;
  prospectTurnIntent: ProspectTurnIntent;
  emotion: ProspectEmotion;
  followupAfterHold?: boolean;
  userTurnApprox?: number;
};

function normLower(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Infère l’état humain du tour (heuristique rapide, sans LLM).
 */
export function inferHumanAdvisorConversationState(input: InferHumanAdvisorStateInput): HumanAdvisorConversationState {
  const t = normLower(input.message);
  if (!t) return "ecoute";

  if (input.emotion === "anger" || input.emotion === "frustration") return "frustration";

  if (input.followupAfterHold) return "verification";

  if (/\b(ok|d['’]accord|dac|merci|parfait|super|👍|🙏)\b/i.test(t) && t.length < 48) return "attente";

  if (/\b(je\s+vérifie|je\s+regarde|un\s+instant|deux\s+minutes|attendez|stock|dispo|disponible)\b/i.test(t)) {
    return "verification";
  }

  if (/\b(hésit|pas\s+sûr|pas\s+sure|doute|peut[- ]?être|réfléchis|voir\s+plus\s+tard)\b/i.test(t)) return "hesitation";

  if (/\b(prix|remise|rabais|négoc|négoci|moins\s+cher|discount)\b/i.test(t)) return "negociation";

  if (/\b(je\s+prends|je\s+commande|je\s+valide|livraison|paiement|adresse)\b/i.test(t)) return "cloture";

  if (/\b(relance|vous\s+m['’']?avez\s+oublié|vous\s+revenez)\b/i.test(t)) return "relance_douce";

  switch (input.prospectTurnIntent) {
    case "salutation":
      return "accueil";
    case "question_personnelle":
      return "ecoute";
    case "simple_discussion":
      return "ecoute";
    case "demande_produit":
      return "recherche_produit";
    case "objection":
      return "hesitation";
    case "achat":
      return "cloture";
    case "plainte":
      return "frustration";
    case "confusion":
      return "ecoute";
    default:
      return "ecoute";
  }
}

export function formatHumanAdvisorStatePromptBlock(
  state: HumanAdvisorConversationState,
  lang: SellerLanguage,
): string | null {
  if (lang === "en") {
    const map: Record<HumanAdvisorConversationState, string[]> = {
      accueil: ["HUMAN STATE: greeting.", "- Very short, warm. No corporate assistant opener."],
      ecoute: ["HUMAN STATE: listening / small talk.", "- Natural, calm. No forced product pitch."],
      recherche_produit: ["HUMAN STATE: product search.", "- Concrete, brief. Reference prior preferences if any."],
      attente: ["HUMAN STATE: waiting / ack.", "- Mirror brevity. No new interrogation."],
      verification: ["HUMAN STATE: checking.", "- You may use short 'checking' lines; then deliver facts."],
      proposition: ["HUMAN STATE: offering.", "- One clear option; avoid stacking 3 pitches."],
      hesitation: ["HUMAN STATE: hesitation.", "- Reassure lightly, no pressure stack."],
      negociation: ["HUMAN STATE: negotiation.", "- Clear, respectful, no robotic discount script."],
      cloture: ["HUMAN STATE: closing.", "- Next step only, still human."],
      frustration: ["HUMAN STATE: friction.", "- Short, calm, dignified. No therapist tone."],
      relance_douce: ["HUMAN STATE: gentle follow-up.", "- Polite ping, not pushy."],
    };
    return map[state].join("\n");
  }
  if (lang === "es") {
    const map: Record<HumanAdvisorConversationState, string[]> = {
      accueil: ["ESTADO HUMANO: acogida.", "- Muy breve, cercano. Sin apertura tipo asistente."],
      ecoute: ["ESTADO HUMANO: escucha / charla.", "- Natural, calmado. Sin empujar venta."],
      recherche_produit: ["ESTADO HUMANO: búsqueda producto.", "- Concreto. Recuerde preferencias previas si hay."],
      attente: ["ESTADO HUMANO: espera / acuse.", "- Breve. Sin nuevo interrogatorio."],
      verification: ["ESTADO HUMANO: verificación.", "- Puede decir «estoy mirando»; luego datos."],
      proposition: ["ESTADO HUMANO: propuesta.", "- Una opción clara."],
      hesitation: ["ESTADO HUMANO: duda.", "- Tranquilizar sin presión."],
      negociation: ["ESTADO HUMANO: negociación.", "- Claro, respetuoso."],
      cloture: ["ESTADO HUMANO: cierre.", "- Un paso siguiente, humano."],
      frustration: ["ESTADO HUMANO: fricción.", "- Breve y calmado."],
      relance_douce: ["ESTADO HUMANO: suave seguimiento.", "- Cortés, no insistente."],
    };
    return map[state].join("\n");
  }
  const map: Record<HumanAdvisorConversationState, string[]> = {
    accueil: ["ÉTAT HUMAIN : accueil.", "- Très court, naturel. Pas d’ouverture type standard téléphonique."],
    ecoute: ["ÉTAT HUMAIN : écoute / conversation légère.", "- Calme, vrai. Pas de vente forcée à chaque phrase."],
    recherche_produit: ["ÉTAT HUMAIN : recherche produit.", "- Concret, bref. Réutiliser couleur / modèle déjà évoqués si pertinent."],
    attente: ["ÉTAT HUMAIN : attente / accusé.", "- Miroir court. Pas de nouvelle question inutile."],
    verification: ["ÉTAT HUMAIN : vérification.", "- Phrases type « je regarde » OK ; ensuite faits, pas re-blocage."],
    proposition: ["ÉTAT HUMAIN : proposition.", "- Une option nette, pas trois offres empilées."],
    hesitation: ["ÉTAT HUMAIN : hésitation.", "- Rassurer sans pression."],
    negociation: ["ÉTAT HUMAIN : négociation.", "- Clair, respectueux, pas script rabais robot."],
    cloture: ["ÉTAT HUMAIN : clôture.", "- Prochaine étape simple, toujours humain."],
    frustration: ["ÉTAT HUMAIN : frustration / tension.", "- Phrases très courtes, calmes, pas ton psy ni support banque."],
    relance_douce: ["ÉTAT HUMAIN : relance douce.", "- Petit ping poli, pas insistance."],
  };
  return map[state].join("\n");
}
