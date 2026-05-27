export type BusinessProfile = {
  ownerName: string | null;
  businessName: string | null;
  businessType: string | null;
  country: string | null;
  city: string | null;
  contactPhone: string | null;
  mainGoal: string | null;
  brandTone: string | null;
  responseStyle: string | null;
  primaryLanguage: string | null;
  offer: string | null;
};

export function isWhoAmIIntent(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  return (
    /\bqui\s+sui[s]?\s+je\b/.test(normalized) ||
    /\bwho\s+am\s+i\b/.test(normalized) ||
    // Business identity (French)
    /\bquel\s+est\s+mon\s+business\b/.test(normalized) ||
    /\bquel\s+est\s+le\s+nom\s+de\s+mon\s+business\b/.test(normalized) ||
    /\bquel(le)?\s+est\s+mon\s+activite\b/.test(normalized) ||
    /\bquel(le)?\s+est\s+mon\s+metier\b/.test(normalized) ||
    // Offer identity (French)
    /\bque\s+je\s+vends\b/.test(normalized) ||
    /\bqu\s+est\s+ce\s+que\s+je\s+vends\b/.test(normalized) ||
    /\bqu\s+est\s+ce\s+que\s+je\s+propose\b/.test(normalized)
  );
}

export function formatWhoAmIResponse(profile: BusinessProfile) {
  const parts: string[] = [];

  if (profile.ownerName) parts.push(`Vous êtes ${profile.ownerName}.`);
  if (profile.businessName) {
    const location = profile.city ? ` à ${profile.city}` : "";
    parts.push(`Votre business s’appelle ${profile.businessName}${location}.`);
  } else if (profile.city) {
    parts.push(`Vous êtes basé(e) à ${profile.city}.`);
  }

  if (profile.businessType) parts.push(`Secteur/activité : ${profile.businessType}.`);
  if (profile.offer) parts.push(`Offre : ${profile.offer}.`);
  if (profile.mainGoal) parts.push(`Objectif : ${profile.mainGoal}.`);

  const hasAny =
    Boolean(profile.ownerName) ||
    Boolean(profile.businessName) ||
    Boolean(profile.city) ||
    Boolean(profile.businessType) ||
    Boolean(profile.offer) ||
    Boolean(profile.mainGoal);

  if (!hasAny) {
    return (
      "Je n’ai pas encore assez d’informations sur votre activité. " +
      "Dites-moi le nom du business, la ville, l’offre, le secteur et votre objectif principal."
    );
  }

  return parts.join("\n");
}
