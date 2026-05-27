import { DateTime } from "luxon";

export type BusinessTimezoneResolution = {
  /** IANA zone (ex. Africa/Douala) */
  iana: string;
  /** Pays / ville normalisés pour affichage côté prompt */
  displayCountry: string | null;
  displayCity: string | null;
  source: "city_country" | "country" | "fallback";
};

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normKey(s: string | null | undefined) {
  return stripDiacritics(String(s ?? "").toLowerCase())
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pays (nom ou code ISO2) → fuseau principal */
const COUNTRY_TO_IANA: Record<string, string> = {
  cm: "Africa/Douala",
  cameroun: "Africa/Douala",
  cameroon: "Africa/Douala",

  ci: "Africa/Abidjan",
  "cote d ivoire": "Africa/Abidjan",
  "cote divoire": "Africa/Abidjan",
  "côte d ivoire": "Africa/Abidjan",
  "côte divoire": "Africa/Abidjan",
  ivoire: "Africa/Abidjan",

  sn: "Africa/Dakar",
  senegal: "Africa/Dakar",
  sénégal: "Africa/Dakar",

  ml: "Africa/Bamako",
  mali: "Africa/Bamako",

  bf: "Africa/Ouagadougou",
  "burkina faso": "Africa/Ouagadougou",
  burkina: "Africa/Ouagadougou",

  ne: "Africa/Niamey",
  niger: "Africa/Niamey",

  tg: "Africa/Lome",
  togo: "Africa/Lome",

  bj: "Africa/Porto-Novo",
  benin: "Africa/Porto-Novo",
  bénin: "Africa/Porto-Novo",

  gn: "Africa/Conakry",
  guinee: "Africa/Conakry",
  guinée: "Africa/Conakry",

  ga: "Africa/Libreville",
  gabon: "Africa/Libreville",

  cg: "Africa/Brazzaville",
  congo: "Africa/Brazzaville",

  cd: "Africa/Kinshasa",
  rdc: "Africa/Kinshasa",
  drc: "Africa/Kinshasa",

  ng: "Africa/Lagos",
  nigeria: "Africa/Lagos",

  ma: "Africa/Casablanca",
  maroc: "Africa/Casablanca",
  morocco: "Africa/Casablanca",

  tn: "Africa/Tunis",
  tunisie: "Africa/Tunis",
  tunisia: "Africa/Tunis",

  dz: "Africa/Algiers",
  algerie: "Africa/Algiers",
  algérie: "Africa/Algiers",
  algeria: "Africa/Algiers",

  fr: "Europe/Paris",
  france: "Europe/Paris",

  be: "Europe/Brussels",
  belgique: "Europe/Brussels",
  belgium: "Europe/Brussels",

  ch: "Europe/Zurich",
  suisse: "Europe/Zurich",
  switzerland: "Europe/Zurich",

  ca: "America/Toronto",
  canada: "America/Toronto",

  us: "America/New_York",
  usa: "America/New_York",
  "united states": "America/New_York",
};

/** Ville → fuseau (prioritaire sur le pays si correspondance unique) */
const CITY_TO_IANA: Record<string, string> = {
  douala: "Africa/Douala",
  yaounde: "Africa/Douala",
  yaoundé: "Africa/Douala",
  garoua: "Africa/Douala",
  bafoussam: "Africa/Douala",

  abidjan: "Africa/Abidjan",
  "yamoussoukro abidjan": "Africa/Abidjan",

  dakar: "Africa/Dakar",
  thies: "Africa/Dakar",

  bamako: "Africa/Bamako",
  ouagadougou: "Africa/Ouagadougou",
  niamey: "Africa/Niamey",
  lome: "Africa/Lome",
  cotonou: "Africa/Porto-Novo",
  conakry: "Africa/Conakry",
  libreville: "Africa/Libreville",
  brazzaville: "Africa/Brazzaville",
  kinshasa: "Africa/Kinshasa",
  lubumbashi: "Africa/Lubumbashi",
  lagos: "Africa/Lagos",
  casablanca: "Africa/Casablanca",
  rabat: "Africa/Casablanca",
  tunis: "Africa/Tunis",
  alger: "Africa/Algiers",
  algiers: "Africa/Algiers",

  paris: "Europe/Paris",
  lyon: "Europe/Paris",
  marseille: "Europe/Paris",
  bruxelles: "Europe/Brussels",
  brussels: "Europe/Brussels",
  geneve: "Europe/Zurich",
  genève: "Europe/Zurich",
  zurich: "Europe/Zurich",
};

function validateIana(iana: string): boolean {
  const dt = DateTime.now().setZone(iana);
  return dt.isValid;
}

function resolveCountryKey(country: string | null | undefined): string | null {
  const k = normKey(country);
  if (!k) return null;
  if (k.length === 2 && /^[a-z]{2}$/.test(k)) return k;
  const direct = COUNTRY_TO_IANA[k];
  if (direct) return k;
  return k;
}

/**
 * Déduit le fuseau IANA à partir du profil business (ville + pays).
 * Ex. Douala + Cameroun → Africa/Douala
 */
export function resolveBusinessTimezone(args: {
  city?: string | null;
  country?: string | null;
}): BusinessTimezoneResolution {
  const displayCity = typeof args.city === "string" && args.city.trim() ? args.city.trim() : null;
  const displayCountry = typeof args.country === "string" && args.country.trim() ? args.country.trim() : null;

  const cityKey = normKey(displayCity);
  if (cityKey) {
    const cityIana = CITY_TO_IANA[cityKey];
    if (cityIana && validateIana(cityIana)) {
      return { iana: cityIana, displayCity, displayCountry, source: "city_country" };
    }
    const cityParts = cityKey.split(" ");
    for (const part of cityParts) {
      const partIana = CITY_TO_IANA[part];
      if (partIana && validateIana(partIana)) {
        return { iana: partIana, displayCity, displayCountry, source: "city_country" };
      }
    }
  }

  const countryKey = resolveCountryKey(displayCountry);
  if (countryKey) {
    const iana = COUNTRY_TO_IANA[countryKey];
    if (iana && validateIana(iana)) {
      return { iana, displayCity, displayCountry, source: "country" };
    }
  }

  const fallback = "Africa/Douala";
  return { iana: fallback, displayCity, displayCountry, source: "fallback" };
}

export function formatBusinessLocalDateTime(args: { iana: string; now?: Date }) {
  const dt = DateTime.fromJSDate(args.now ?? new Date(), { zone: "utc" }).setZone(args.iana);
  if (!dt.isValid) return null;
  return {
    isoLocal: dt.toISO({ suppressMilliseconds: true }) ?? dt.toFormat("yyyy-LL-dd'T'HH:mm"),
    wallClock: dt.toFormat("cccc dd LLL yyyy, HH:mm"),
    hour: dt.hour,
    minute: dt.minute,
    weekdayFr: dt.setLocale("fr").toFormat("cccc"),
  };
}
