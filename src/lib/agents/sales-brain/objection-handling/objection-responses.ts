import type { ObjectionType } from "@/lib/ai/sales/types";
import type { ObjectionResponseHint } from "../types";

const RESPONSES: Record<
  ObjectionType,
  { guidanceFr: string[]; guidanceEn: string[]; exampleLineFr: string }
> = {
  PRICE: {
    guidanceFr: [
      "Reconnaître le budget sans défendre agressivement.",
      "Expliquer la valeur concrète incluse, proposer une alternative simple si besoin.",
    ],
    guidanceEn: ["Acknowledge budget calmly.", "Explain concrete value; one simpler option if needed."],
    exampleLineFr: "Oui Monsieur — sur ce modèle vous payez surtout pour la qualité X ; si vous voulez plus serré, on a aussi Y.",
  },
  DELIVERY: {
    guidanceFr: [
      "Rassurer sur le processus (contrôle avant envoi, suivi).",
      "Donner un délai crédible — pas de promesse floue.",
    ],
    guidanceEn: ["Reassure on process and tracking.", "Give a credible window."],
    exampleLineFr: "On vérifie bien avant départ — je vous confirme le créneau livraison dès que c’est validé de votre côté.",
  },
  TRUST: {
    guidanceFr: [
      "Preuve courte + geste vérifiable (pas ton « assistant »).",
      "Transparence sur ce que vous contrôlez avant expédition.",
    ],
    guidanceEn: ["Short proof + verifiable step.", "Transparent on what you control."],
    exampleLineFr: "C’est normal de demander — on vérifie toujours avant livraison, et je vous envoie la référence si vous voulez.",
  },
  COMPETITION: {
    guidanceFr: [
      "Comparer avec respect — différenciateur défendable (service local, vérif, rapidité).",
      "Ne pas dénigrer la concurrence.",
    ],
    guidanceEn: ["Respectful compare — one defendable differentiator.", "Never trash competitors."],
    exampleLineFr: "En ligne ça peut paraître moins cher — la différence ici c’est ce qu’on vérifie avant que ça parte.",
  },
  QUALITY: {
    guidanceFr: [
      "Fait concret (contrôle, origine, retour) — pas de slogans.",
    ],
    guidanceEn: ["Concrete quality fact — no buzzwords."],
    exampleLineFr: "C’est un modèle qu’on contrôle avant envoi — si vous voulez je vous détaille ce qu’on vérifie.",
  },
  NONE: {
    guidanceFr: [],
    guidanceEn: [],
    exampleLineFr: "",
  },
};

export function buildObjectionResponseHints(types: ObjectionType[]): ObjectionResponseHint[] {
  const unique = [...new Set(types.filter((t) => t !== "NONE"))];
  return unique.map((type) => {
    const r = RESPONSES[type];
    return {
      type,
      guidanceFr: r.guidanceFr,
      guidanceEn: r.guidanceEn,
      exampleLineFr: r.exampleLineFr || undefined,
    };
  });
}
