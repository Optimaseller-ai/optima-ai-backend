import type { ProspectInferredGender, ProspectProfile } from "./prospect-profile";

/** Listes courtes FR — heuristique conservatrice (pas de titre sans confiance). */
const FEMALE_NAMES = new Set(
  `marie,sophie,julie,camille,léa,lea,chloe,chloé,sarah,emma,laura,claire,isabelle,nathalie,valérie,valerie,céline,celine,
  sandrine,patricia,vanessa,cynthia,grace,grâce,mireille,nadia,amélie,amelie,helene,hélène,naomi,diane,ashley,estelle,carine`.split(
    /[\s,]+/,
  ).filter(Boolean),
);

const MALE_NAMES = new Set(
  `jean,pierre,paul,jacques,marc,lucas,kevin,thomas,nicolas,david,jordan,axel,emmanuel,lionel,antoine,françois,
  francois,olivier,stephane,stéphane,philippe,maxime,benjamin,sébastien,sebastien,bryan,brice,steve,junior,cedric`.split(/[\s,]+/).filter(Boolean),
);

function normToken(s: string) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function firstTokenFromName(displayName: string): string | null {
  const t = String(displayName ?? "").trim().split(/[\s,.]+/).filter(Boolean)[0];
  return t ? normToken(t) : null;
}

/**
 * Infère genre + confiance 0–100 à partir du texte et du prénom déjà extrait.
 * Règle produit : ne pas dépasser 79% sur seule heuristique prénom (il faut >80 pour titre).
 */
export function inferProspectGenderSignals(message: string, profile: ProspectProfile | undefined): {
  inferredGender: ProspectInferredGender;
  genderConfidence: number;
} {
  const msg = String(message ?? "").toLowerCase();

  // Déjà explicitement monsieur/madame dans le profil — traité ailleurs (civility).
  if (profile?.civility === "monsieur") return { inferredGender: "male", genderConfidence: 100 };
  if (profile?.civility === "madame" || profile?.civility === "mademoiselle") {
    return { inferredGender: "female", genderConfidence: 100 };
  }

  // Indices textuels forts
  if (/\bje\s+suis\s+(un\s+)?homme\b/.test(msg) || /\bmonsieur\b.*\b(appelez|c'est|je\s+suis)\b/.test(msg)) {
    return { inferredGender: "male", genderConfidence: 92 };
  }
  if (/\bje\s+suis\s+une\s+femme\b/.test(msg) || /\bmadame\b.*\b(appelez|c'est|je\s+suis)\b/.test(msg)) {
    return { inferredGender: "female", genderConfidence: 92 };
  }

  const display = profile?.displayName;
  if (display) {
    const token = firstTokenFromName(display);
    if (token) {
      if (FEMALE_NAMES.has(token)) return { inferredGender: "female", genderConfidence: 72 };
      if (MALE_NAMES.has(token)) return { inferredGender: "male", genderConfidence: 72 };
    }
  }

  // Première phrase du message : "Lucas ici" peu fiable — on ignore.

  return { inferredGender: "unknown", genderConfidence: 0 };
}

export function conversationalToneFromMessage(message: string): "formal" | "neutral" | "warm" | "unknown" {
  const m = String(message ?? "").toLowerCase();
  if (/\b(veuillez|cordialement|madame|monsieur|s'il vous plaît|svp)\b/.test(m)) return "formal";
  if (/\b(salut|cc|coucou|mdr|lol)\b/.test(m)) return "warm";
  if (m.length > 12) return "neutral";
  return "unknown";
}
