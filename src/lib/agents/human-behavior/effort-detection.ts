export type EffortSignal = "visit" | "wait" | "failure" | "not_found" | "closed";

export type EffortDetectionResult = {
  effort_detected: boolean;
  signals: EffortSignal[];
  soughtPerson?: string;
  visitedStore: boolean;
};

const VISIT =
  /\b(boutique|magasin|point\s+de\s+vente|chez\s+vous|sur\s+place|pass[eé]|pass[eé]e|je\s+suis\s+pass[eé]|je\s+suis\s+pass[eé]e|j['']?[eé]tais\s+pass[eé]|j['']?[eé]tais\s+pass[eé]e|je\s+suis\s+venu|je\s+suis\s+venue|j['']?[eé]tais\s+venu|d[eé]plac[eé]|d[eé]plac[eé]e|je\s+suis\s+all[eé]|je\s+suis\s+all[eé]e)\b/i;
const WAIT = /\b(attendu|attendue|j['']?ai\s+attendu|longtemps|file\s+d['']?attente)\b/i;
const NOT_FOUND =
   /\b(pas\s+trouv[eé]|pas\s+trouv[eé]e|introuvable|personne|personne\s+n['']?[eé]tait|il\s+n['']?y\s+avait\s+personne|absent|absente)\b/i;
const CLOSED = /\b(ferm[eé]|ferm[eé]e|ferm[eé]s|ferm[eé]es|portes?\s+ferm[eé]es?)\b/i;

export function detectProspectEffort(message: string): EffortDetectionResult {
  const m = String(message ?? "").trim();
  const signals: EffortSignal[] = [];
  if (!m) return { effort_detected: false, signals, visitedStore: false };

  const visitedStore = VISIT.test(m);
  if (visitedStore) signals.push("visit");
  if (WAIT.test(m)) signals.push("wait");
  if (NOT_FOUND.test(m)) signals.push("not_found");
  if (CLOSED.test(m)) signals.push("closed");
  if (NOT_FOUND.test(m) || CLOSED.test(m) || WAIT.test(m)) signals.push("failure");

  const soughtPerson = m.match(
    /\b(?:boss|responsable|g[eé]rant|g[eé]rante|patron|patronne|yuri)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+)?/i,
  )?.[0];

  const effort_detected =
    visitedStore && (signals.includes("not_found") || signals.includes("closed") || signals.includes("wait"));

  return {
    effort_detected,
    signals: [...new Set(signals)],
    soughtPerson: soughtPerson?.trim(),
    visitedStore,
  };
}

export function buildEffortAwareReply(args: {
  detection: EffortDetectionResult;
  lang: "fr" | "en" | "es";
  businessName?: string;
  hasBusinessHours?: boolean;
}): string | null {
  if (!args.detection.effort_detected) return null;

  const person = args.detection.soughtPerson;
  const { lang } = args;

  if (lang === "en") {
    const who = person ? ` ${person}` : " the person you were looking for";
    const follow = args.hasBusinessHours
      ? " Want me to suggest the best time to come back so you don't waste another trip?"
      : " Want me to check the best time for you to come back?";
    return `Oh no 😕 thanks for going to the store.${who} was probably away at that moment.${follow}`;
  }
  if (lang === "es") {
    const who = person ? ` (${person})` : "";
    const follow = args.hasBusinessHours
      ? " ¿Le indico el mejor momento para volver y evitar otro desplazamiento?"
      : " ¿Quiere que le indique el mejor momento para volver?";
    return `Vaya 😕 gracias por pasar por la tienda.${who} Seguramente no estaba en ese momento.${follow}`;
  }

  const whoFr = person
    ? ` ${person.charAt(0).toUpperCase() + person.slice(1)}`
    : " Le responsable";
  const followFr = args.hasBusinessHours
    ? " Vous voulez que je vous indique le meilleur moment pour passer afin d'éviter un autre déplacement inutile ?"
    : " Vous voulez que je demande au responsable le meilleur créneau pour vous ?";
  return `Ah mince 😕 merci d'être passé à la boutique.${whoFr} était sûrement absent à ce moment-là.${followFr}`;
}
