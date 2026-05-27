import { DateTime } from "luxon";

export type ProspectCivility = "monsieur" | "madame" | "mademoiselle" | "unknown";

export type ProspectTonePreference = "formal" | "neutral" | "warm" | "unknown";

export type ProspectInferredGender = "male" | "female" | "unknown";

export type ProspectProfile = {
  /** Prénom ou nom court si connu */
  displayName: string | null;
  civility: ProspectCivility;
  /** Genre inféré (prénom / style) — utiliser titres seulement si genderConfidence >= 80 */
  inferredGender?: ProspectInferredGender;
  /** 0–100 ; civilité explicite « je suis monsieur » → 100 */
  genderConfidence?: number;
  /** fr | en | unknown */
  languageHint: "fr" | "en" | "unknown";
  /** Formulations / habitudes notées (ex. canal de contact préféré) */
  habits: string[];
  tonePreference: ProspectTonePreference;
  /** Phrases utilisateur marquantes (résumés courts) */
  historySnippets: string[];
  updatedAt: number;
};

export const emptyProspectProfile = (): ProspectProfile => ({
  displayName: null,
  civility: "unknown",
  inferredGender: "unknown",
  genderConfidence: 0,
  languageHint: "unknown",
  habits: [],
  tonePreference: "unknown",
  historySnippets: [],
  updatedAt: 0,
});

function norm(s: string) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type ProspectProfileMergeResult = {
  profile: ProspectProfile;
  changed: { civility?: boolean; displayName?: boolean; habits?: boolean; languageHint?: boolean };
};

function dedupePush(arr: string[], value: string, max: number) {
  const v = value.trim();
  if (!v) return;
  const next = [v, ...arr.filter((x) => norm(x) !== norm(v))];
  arr.length = 0;
  arr.push(...next.slice(0, max));
}

function detectCivility(text: string): ProspectCivility | null {
  const t = norm(text);
  if (/\bje\s+suis\s+monsieur\b/.test(t)) return "monsieur";
  if (/\bje\s+suis\s+madame\b/.test(t)) return "madame";
  if (/\bje\s+suis\s+mademoiselle\b/.test(t)) return "mademoiselle";
  if (/\bc\s*est\s+monsieur\b/.test(t) || /\bj\s*appelle\s+monsieur\b/.test(t)) return "monsieur";
  if (/\bc\s*est\s+madame\b/.test(t) || /\bj\s*appelle\s+madame\b/.test(t)) return "madame";
  if (/\bmonsieur\b/.test(t) && /(appelez[- ]moi|c\s*est|je\s+suis)\b/.test(t)) return "monsieur";
  if (/\bmadame\b/.test(t) && /(appelez[- ]moi|c\s*est|je\s+suis)\b/.test(t)) return "madame";
  return null;
}

function detectDisplayName(text: string): string | null {
  const raw = String(text ?? "").trim();
  const m =
    raw.match(/\bje\s+m['’]appelle\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]{1,32})\b/i) ||
    raw.match(/\bc['’]est\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]{1,32})\b/i) ||
    raw.match(/\bappelez[- ]moi\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]{1,32})\b/i);
  if (!m?.[1]) return null;
  const name = m[1].trim().split(/\s+/).slice(0, 2).join(" ");
  if (name.length < 2) return null;
  if (/^(monsieur|madame|mademoiselle)$/i.test(name)) return null;
  return name.slice(0, 48);
}

function detectLanguageHint(text: string): "fr" | "en" | null {
  const t = norm(text);
  if (/\b(hello|hi|hey|good morning|good evening|sir|madam)\b/.test(t)) return "en";
  if (/\b(bonjour|bonsoir|monsieur|madame|merci|svp)\b/.test(t)) return "fr";
  return null;
}

function detectHabits(text: string): string[] {
  const t = norm(text);
  const out: string[] = [];
  if (/\b(par\s+message|messagerie|écris|envoyez[- ]moi|dm|inbox)\b/i.test(t)) out.push("Préfère être contacté par messagerie mobile.");
  if (/appel|appelez|téléphone|telephone|appellez moi/.test(t)) out.push("Demande d’appel vocal.");
  if (/plut[oô]t\s+le\s+matin|le\s+matin\s+c’est\s+mieux|prefer.*morning/i.test(text)) out.push("Disponible plutôt le matin.");
  if (/plut[oô]t\s+le\s+soir|apr[eè]s\s+18|after\s+6/i.test(text)) out.push("Disponible plutôt en fin de journée.");
  if (/\b(j'aime|j’adore|j\s+aime)\s+(le\s+)?noir|plut[oô]t\s+noir|toujours\s+en\s+noir\b/i.test(t)) out.push("Affection marquée pour le noir.");
  if (/\b(pas\s+trop\s+cher|petit\s+budget|budget\s+serré|pas\s+cher|pas\s+chère|raisonnable\s+côté\s+prix)\b/i.test(t)) {
    out.push("Recherche prix modeste / budget serré.");
  }
  if (/\b(je\s+compare|je\s+hésite\s+entre|vous\s+avez\s+quoi\s+d['’']?autre)\b/i.test(t)) out.push("Compare beaucoup / hésite entre modèles.");
  if (/\b(méfiant|pas\s+confiance|faut\s+que\s+je\s+sois\s+sûr)\b/i.test(t)) out.push("Plutôt méfiant, demande de garanties / preuves.");
  if (/\b(livraison\s+rapide|vite\s+livré|rapidement|en\s+urgence)\b/i.test(t)) out.push("Priorité délai / rapidité.");
  return out;
}

function detectTonePreference(text: string): ProspectTonePreference | null {
  const t = norm(text);
  if (/vouvoiement|vous\s+vouvoyez|restez\s+formel/.test(t)) return "formal";
  if (/soyez\s+direct|allez\s+droit|sans\s+blabla|straight\s+to/.test(t)) return "neutral";
  if (/chaleureux|sympa|friendly|warm/.test(t)) return "warm";
  return null;
}

/**
 * Met à jour le profil prospect à partir d’un message (civilité durable, prénom, etc.).
 */
export function mergeProspectProfileFromUserMessage(
  prev: ProspectProfile | undefined,
  message: string,
): ProspectProfileMergeResult {
  const base = prev ?? emptyProspectProfile();
  const changed: ProspectProfileMergeResult["changed"] = {};
  let civility = base.civility;
  let displayName = base.displayName;
  let languageHint = base.languageHint;
  let tonePreference = base.tonePreference;
  const habits = [...(base.habits ?? [])];
  const historySnippets = [...(base.historySnippets ?? [])];

  const c = detectCivility(message);
  if (c && c !== base.civility) {
    civility = c;
    changed.civility = true;
  }

  const n = detectDisplayName(message);
  if (n && norm(n) !== norm(displayName ?? "")) {
    displayName = n;
    changed.displayName = true;
  }

  const lh = detectLanguageHint(message);
  if (lh && lh !== base.languageHint) {
    languageHint = lh;
    changed.languageHint = true;
  }

  const tp = detectTonePreference(message);
  if (tp && tp !== "unknown") {
    tonePreference = tp;
  }

  const newHabits = detectHabits(message);
  for (const h of newHabits) {
    const before = habits.length;
    dedupePush(habits, h, 8);
    if (habits.length !== before) changed.habits = true;
  }

  const snippet = message.trim().slice(0, 120).replace(/\s+/g, " ");
  if (snippet.length >= 24) dedupePush(historySnippets, snippet, 6);

  const profile: ProspectProfile = {
    ...base,
    displayName,
    civility,
    languageHint,
    habits,
    tonePreference,
    historySnippets,
    updatedAt: Date.now(),
  };

  return { profile, changed };
}

export type GreetingSlot = "morning" | "afternoon" | "evening" | "night";

/**
 * Période locale boutique (profil business / fuseau IANA).
 * Matin 05h–11h59 ; après-midi 12h–17h59 ; soir 18h–23h59 ; nuit 00h–04h59.
 */
export function greetingSlotFromLocalHour(hour: number, minute: number): GreetingSlot {
  const t = hour + minute / 60;
  if (t >= 5 && t < 12) return "morning";
  if (t >= 12 && t < 18) return "afternoon";
  if (t >= 18 && t <= 24) return "evening";
  return "night";
}

export type FrenchSalutation = {
  /** Forme principale selon l’horloge locale boutique (voir aussi `resolveFrenchOpeningPhrase` pour le contexte prospect). */
  phraseFr: string;
  /** Variante après-midi possible */
  alternateFr?: string;
  slot: GreetingSlot;
};

export function frenchSalutationForLocalTime(dt: DateTime): FrenchSalutation {
  const hour = dt.hour;
  const minute = dt.minute;
  const slot = greetingSlotFromLocalHour(hour, minute);
  if (slot === "morning") return { phraseFr: "Bonjour", slot };
  if (slot === "afternoon") {
    const useBonApresMidi = hour >= 15;
    return useBonApresMidi
      ? { phraseFr: "Bon après-midi", alternateFr: "Bonjour", slot }
      : { phraseFr: "Bonjour", alternateFr: "Bon après-midi", slot };
  }
  if (slot === "evening") return { phraseFr: "Bonsoir", slot };
  /* nuit 00h00–04h59 : éviter « bonne après-midi » / « bon après-midi » ; ton conseiller présent même tard. */
  return { phraseFr: "Bonjour", slot };
}

/** Ce que le prospect exprime comme salutation explicite (message analysé tel quel). */
export type ProspectExplicitFrenchGreetingKind =
  | "bonne_apres_midi"
  | "bon_matin"
  | "bonjour"
  | "bonsoir"
  | "salut_like"
  | null;

/**
 * Détecte une salutation française explicite (priorité aux formules composées : bonne après-midi, bon matin).
 */
export function detectProspectExplicitFrenchGreeting(message: string): ProspectExplicitFrenchGreetingKind {
  const raw = String(message ?? "").trim();
  if (!raw) return null;
  const m = norm(raw);

  if (/\b(bonne\s+après[\s-]?midi|bonne\s+apres[\s-]?midi|bon\s+après[\s-]?midi|bon\s+aprem)\b/i.test(raw)) {
    return "bonne_apres_midi";
  }
  if (/\b(bon\s+matin)\b/i.test(raw)) return "bon_matin";
  if (/^(bonjour)\b/i.test(m)) return "bonjour";
  if (/^(bonsoir)\b/i.test(m)) return "bonsoir";
  if (/^(salut|coucou|cc)\b/i.test(m)) return "salut_like";

  return null;
}

export type FrenchOpeningResolution = {
  /** Formule d’accroche à privilégier en tête de réponse (sans civilité). */
  phraseFr: string;
  /** mirror_explicit : reprendre la formule du prospect ; local_soft : heure boutique sans rabrouer. */
  strategy: "mirror_explicit" | "local_soft";
};

/**
 * Cohérence salutation / heure locale : ne jamais contredire brutalement une formule précise (ex. bonne après-midi).
 */
export function resolveFrenchOpeningPhrase(args: {
  nowLocal: DateTime;
  explicitKind: ProspectExplicitFrenchGreetingKind;
}): FrenchOpeningResolution | null {
  const { nowLocal, explicitKind } = args;
  if (!explicitKind) return null;

  const slot = greetingSlotFromLocalHour(nowLocal.hour, nowLocal.minute);
  const localSal = frenchSalutationForLocalTime(nowLocal);

  if (explicitKind === "bonne_apres_midi") {
    return { phraseFr: "Bonne après-midi", strategy: "mirror_explicit" };
  }

  if (explicitKind === "bon_matin") {
    if (slot === "morning") return { phraseFr: "Bonjour", strategy: "mirror_explicit" };
    return { phraseFr: localSal.phraseFr, strategy: "local_soft" };
  }

  if (explicitKind === "bonjour") {
    if (slot === "evening" || slot === "night") return { phraseFr: localSal.phraseFr, strategy: "local_soft" };
    return { phraseFr: "Bonjour", strategy: "mirror_explicit" };
  }

  if (explicitKind === "bonsoir") {
    if (slot === "morning" || slot === "afternoon") return { phraseFr: localSal.phraseFr, strategy: "local_soft" };
    return { phraseFr: "Bonsoir", strategy: "mirror_explicit" };
  }

  // salut_like / informel → toujours salutation pro selon l’horloge boutique (pas de « salut » côté vendeur).
  return { phraseFr: localSal.phraseFr, strategy: "local_soft" };
}

export function englishSalutationForLocalTime(dt: DateTime): { phraseEn: string; slot: GreetingSlot } {
  const hour = dt.hour;
  const minute = dt.minute;
  const slot = greetingSlotFromLocalHour(hour, minute);
  if (slot === "morning") return { phraseEn: "Good morning", slot };
  if (slot === "afternoon") return { phraseEn: "Good afternoon", slot };
  if (slot === "evening") return { phraseEn: "Good evening", slot };
  return { phraseEn: "Hello", slot };
}

export function spanishSalutationForLocalTime(dt: DateTime): { phraseEs: string; slot: GreetingSlot } {
  const hour = dt.hour;
  const minute = dt.minute;
  const slot = greetingSlotFromLocalHour(hour, minute);
  if (slot === "morning") return { phraseEs: "Buenos días", slot };
  if (slot === "afternoon") return { phraseEs: "Buenas tardes", slot };
  if (slot === "evening") return { phraseEs: "Buenas noches", slot };
  return { phraseEs: "Hola", slot };
}

export function frenchHonorific(pp: ProspectProfile | undefined): "Monsieur" | "Madame" | "Mademoiselle" | null {
  const c = pp?.civility ?? "unknown";
  if (c === "monsieur") return "Monsieur";
  if (c === "madame") return "Madame";
  if (c === "mademoiselle") return "Mademoiselle";
  return null;
}

/** Titres Monsieur / Madame uniquement si civilité explicite OU confiance >= 80 %. Sinon neutre (pas de titre). */
export function frenchHonorificSmart(pp: ProspectProfile | undefined): "Monsieur" | "Madame" | "Mademoiselle" | null {
  if (!pp) return null;
  const explicit = frenchHonorific(pp);
  if (explicit) return explicit;
  const conf = pp.genderConfidence ?? 0;
  if (conf < 80) return null;
  if (pp.inferredGender === "male") return "Monsieur";
  if (pp.inferredGender === "female") return "Madame";
  return null;
}

/** Équivalent anglais — mêmes règles que {@link frenchHonorificSmart}. */
export function englishHonorificSmart(pp: ProspectProfile | undefined): "sir" | "madam" | null {
  if (!pp) return null;
  if (pp.civility === "monsieur") return "sir";
  if (pp.civility === "madame" || pp.civility === "mademoiselle") return "madam";
  if ((pp.genderConfidence ?? 0) < 80) return null;
  if (pp.inferredGender === "male") return "sir";
  if (pp.inferredGender === "female") return "madam";
  return null;
}

/** Señor / señora — mêmes règles de confiance que l’anglais. */
export function spanishHonorificSmart(pp: ProspectProfile | undefined): "Señor" | "Señora" | null {
  if (!pp) return null;
  if (pp.civility === "monsieur") return "Señor";
  if (pp.civility === "madame" || pp.civility === "mademoiselle") return "Señora";
  if ((pp.genderConfidence ?? 0) < 80) return null;
  if (pp.inferredGender === "male") return "Señor";
  if (pp.inferredGender === "female") return "Señora";
  return null;
}

export function formatProspectProfilePromptBlock(pp: ProspectProfile | undefined, lang: "fr" | "en" | "es"): string | null {
  if (!pp) return null;
  const lines: string[] = [];
  if (lang === "es") {
    if (pp.displayName) lines.push(`Nombre o presentación del prospecto: ${pp.displayName}.`);
    if (pp.civility !== "unknown") lines.push(`Tratamiento preferido (referencia interna): ${pp.civility}.`);
    if (pp.languageHint !== "unknown") lines.push(`Hábito de idioma: ${pp.languageHint}.`);
    if (pp.tonePreference !== "unknown") lines.push(`Preferencia de tono: ${pp.tonePreference}.`);
    if (pp.habits.length) lines.push(`Hábitos anotados:\n- ${pp.habits.join("\n- ")}`);
    if (pp.historySnippets.length) lines.push(`Frases recientes (no copiar literalmente):\n- ${pp.historySnippets.slice(0, 3).join("\n- ")}`);
  } else if (lang === "en") {
    if (pp.displayName) lines.push(`Prospect first name or how they introduced themselves: ${pp.displayName}.`);
    if (pp.civility !== "unknown") lines.push(`Preferred title: ${pp.civility}.`);
    if (pp.languageHint !== "unknown") lines.push(`Language habit: ${pp.languageHint}.`);
    if (pp.tonePreference !== "unknown") lines.push(`Tone preference: ${pp.tonePreference}.`);
    if (pp.habits.length) lines.push(`Noted habits:\n- ${pp.habits.join("\n- ")}`);
    if (pp.historySnippets.length) lines.push(`Recent phrasing (do not quote verbatim):\n- ${pp.historySnippets.slice(0, 3).join("\n- ")}`);
  } else {
    if (pp.displayName) lines.push(`Prénom / présentation: ${pp.displayName}.`);
    if (pp.civility !== "unknown") {
      lines.push(`Civilité retenue: ${pp.civility} — utiliser Monsieur/Madame en conséquence.`);
    } else if ((pp.genderConfidence ?? 0) >= 80 && pp.inferredGender && pp.inferredGender !== "unknown") {
      lines.push(
        `Genre probable (${pp.genderConfidence}%): ${pp.inferredGender} — vous pouvez utiliser le titre adapté avec retenue.`,
      );
    } else {
      lines.push(
        `Civilité non certaine — préférer formulations neutres (« Bonjour et bienvenue », « Bonsoir et bienvenue chez … ») sans Monsieur/Madame forcé.`,
      );
    }
    if (pp.languageHint !== "unknown") lines.push(`Langue d’habitude: ${pp.languageHint}.`);
    if (pp.tonePreference !== "unknown") lines.push(`Ton préféré: ${pp.tonePreference}.`);
    if (pp.habits.length) lines.push(`Habitudes notées:\n- ${pp.habits.join("\n- ")}`);
    if (pp.historySnippets.length) lines.push(`Formulations récentes (ne pas citer mot pour mot):\n- ${pp.historySnippets.slice(0, 3).join("\n- ")}`);
  }
  return lines.length ? lines.join("\n") : null;
}
