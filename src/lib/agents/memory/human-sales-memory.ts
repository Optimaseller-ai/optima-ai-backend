/**
 * REAL HUMAN SALES MEMORY — signaux persistés pour continuité commerciale humaine.
 */

export type HumanSalesMemory = {
  visitedStore?: boolean;
  visitCount?: number;
  lastVisitAt?: number;
  soughtPerson?: string;
  wantsToReturn?: boolean;
  mildFrustration?: boolean;
  lastEffortSummary?: string;
  updatedAt?: number;
};

export function mergeHumanSalesMemory(
  prev: HumanSalesMemory | undefined,
  args: {
    message: string;
    effortDetected?: boolean;
    effortSignals?: string[];
    soughtPerson?: string;
  },
): HumanSalesMemory {
  const m = String(args.message ?? "").trim().toLowerCase();
  const now = Date.now();
  const next: HumanSalesMemory = { ...prev, updatedAt: now };

  const visitMention =
    /\b(boutique|magasin|pass[eé]|pass[eé]e|venu|venue|d[eé]plac[eé]|d[eé]plac[eé]e|chez\s+vous)\b/i.test(m);
  if (visitMention || args.effortDetected) {
    next.visitedStore = true;
    next.visitCount = (prev?.visitCount ?? 0) + (visitMention ? 1 : 0);
    next.lastVisitAt = now;
  }

  if (args.soughtPerson) next.soughtPerson = args.soughtPerson;
  else {
    const boss = m.match(/\b(boss|yuri|responsable|g[eé]rant|patron)\s+([a-zà-ÿ]+)?/i);
    if (boss?.[0]) next.soughtPerson = boss[0].trim();
  }

  if (/\b(revenir|repasser|passer\s+demain|je\s+reviens|je\s+repasse)\b/i.test(m)) {
    next.wantsToReturn = true;
  }

  if (args.effortDetected || /\b(pas\s+trouv[eé]|d[eé][çc]u|decu|dommage|mince|frustr)\b/i.test(m)) {
    next.mildFrustration = true;
  }

  if (args.effortDetected) {
    next.lastEffortSummary = m.slice(0, 120);
  }

  return next;
}

export function formatHumanSalesMemoryLine(mem: HumanSalesMemory | undefined, lang: "fr" | "en" | "es"): string | null {
  if (!mem?.visitedStore) return null;
  if (lang === "en") {
    if (mem.soughtPerson) {
      return `Prospect already visited the store (looking for ${mem.soughtPerson}) — avoid useless trips, suggest a clear time slot.`;
    }
    return "Prospect already visited the store — acknowledge effort and suggest the best time to return.";
  }
  if (lang === "es") {
    return "El prospecto ya pasó por la tienda — evitar desplazamientos inútiles, proponer un horario claro.";
  }
  if (mem.soughtPerson) {
    return `Le prospect est déjà passé en boutique (cherche ${mem.soughtPerson}) — éviter un déplacement inutile, proposer un créneau clair.`;
  }
  return "Le prospect est déjà passé en boutique — reconnaître l'effort et proposer le meilleur moment pour revenir.";
}

export function buildHumanSalesMemoryCallback(
  mem: HumanSalesMemory | undefined,
  lang: "fr" | "en" | "es",
): string | null {
  if (!mem?.visitedStore || (mem.visitCount ?? 0) < 1) return null;
  if (lang === "en") {
    return "Since you already came to the store once, I'll try to save you another unnecessary trip 😊";
  }
  if (lang === "es") {
    return "Como ya pasó por la tienda, intentaré evitarle otro desplazamiento innecesario 😊";
  }
  return "Comme vous êtes déjà passé une fois à la boutique, je vais essayer de vous éviter un déplacement inutile 😊";
}
