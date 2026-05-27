import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBusinessTimezone } from "@/lib/agents/timing/business-timezone";
import type { ProfileRow } from "@/lib/data/types";
import type {
  BusinessFaqEntry,
  BusinessOperationalFacts,
  BusinessProfileSnapshot,
  ProfileIdentityForKnowledge,
} from "../types";
import type { BusinessKnowledgeSettingsRow } from "../catalog/catalog-settings-loader";
import {
  loadBusinessFaqEntries,
  loadBusinessKnowledgeSettings,
} from "../catalog/catalog-settings-loader";

export type BusinessKnowledgeProfileBundle = {
  profileSnapshot: BusinessProfileSnapshot;
  facts: BusinessOperationalFacts;
  faqEntries: BusinessFaqEntry[];
  settings: BusinessKnowledgeSettingsRow | null;
};

export function profileRowToIdentity(p: ProfileRow | null): ProfileIdentityForKnowledge {
  if (!p) return { businessName: "Entreprise" };
  const country = p.country?.trim() || undefined;
  const city = p.city?.trim() || undefined;
  const tz = resolveBusinessTimezone({ city, country });
  return {
    businessName: p.business_name?.trim() || "Entreprise",
    sector: p.business_type?.trim() || undefined,
    country,
    city,
    offer: p.offer?.trim() || undefined,
    goal: p.goal?.trim() || undefined,
    contactPhone: p.contact_phone?.trim() || undefined,
    timezoneLabel: tz.iana,
  };
}

export function profileRowToSnapshot(
  p: ProfileRow | null,
  currencyLabel = "FCFA / XOF",
): BusinessProfileSnapshot {
  const id = profileRowToIdentity(p);
  return {
    businessName: id.businessName,
    sector: id.sector,
    city: id.city,
    country: id.country,
    businessIanaTimezone: id.timezoneLabel,
    currencyLabel,
  };
}

function settingsToFacts(row: BusinessKnowledgeSettingsRow | null): BusinessOperationalFacts {
  if (!row) return {};

  const deliveryParts = [
    row.delivery_zones_notes,
    row.delivery_delay_notes ? `Délais : ${row.delivery_delay_notes}` : null,
    row.delivery_cost_notes ? `Coûts : ${row.delivery_cost_notes}` : null,
    row.delivery_methods ? `Modes : ${row.delivery_methods}` : null,
  ].filter(Boolean);

  const openHours = [row.business_hours_weekday, row.business_hours_weekend ? `Week-end : ${row.business_hours_weekend}` : null]
    .filter(Boolean)
    .join(" | ");

  const savLine = [row.sav_notes, row.warranty_notes ? `Garantie : ${row.warranty_notes}` : null].filter(Boolean).join(" | ");

  const extraCities = Array.isArray(row.served_cities) ? row.served_cities.filter(Boolean) : [];

  return {
    contactsLine: row.contacts_line ?? undefined,
    openHoursWeekday: openHours || row.business_hours_weekday || undefined,
    weekendHoursNote: row.business_hours_weekend ?? undefined,
    deliveryZonesNotes: deliveryParts.length ? deliveryParts.join("\n") : undefined,
    servedCities: extraCities.length ? extraCities : undefined,
    paymentsExtraNote: row.payment_notes ?? undefined,
    returnPolicySummary: row.return_policy_summary ?? undefined,
    savReturnHumanLine: savLine || undefined,
    salesStyleNote: row.sales_style_notes ?? undefined,
    commercialInstructions: row.commercial_instructions ?? undefined,
    companyImportantNotes: row.company_important_notes ?? undefined,
  };
}

/** Fusionne profil existant + extensions Knowledge (sans dupliquer identité). */
export function mergeProfileKnowledgeFacts(
  profile: ProfileRow | null,
  settingsFacts: BusinessOperationalFacts,
): BusinessOperationalFacts {
  const id = profileRowToIdentity(profile);
  const merged: BusinessOperationalFacts = { ...settingsFacts };

  if (id.contactPhone && !merged.contactsLine) {
    merged.contactsLine = id.contactPhone;
  }

  const locationBits = [id.city, id.country].filter(Boolean);
  if (locationBits.length && merged.deliveryZonesNotes) {
    merged.deliveryZonesNotes = `Siège / ville principale : ${locationBits.join(", ")}.\n${merged.deliveryZonesNotes}`;
  } else if (locationBits.length && !merged.deliveryZonesNotes) {
    merged.deliveryZonesNotes = `Zone principale : ${locationBits.join(", ")}.`;
  }

  return merged;
}

export async function loadBusinessKnowledgeProfile(
  client: SupabaseClient,
  userId: string,
  profileRow?: ProfileRow | null,
): Promise<BusinessKnowledgeProfileBundle> {
  let profile = profileRow;
  if (!profile) {
    const { data } = await client
      .from("profiles")
      .select(
        "id,full_name,business_name,business_type,goal,country,city,contact_phone,offer,email,created_at,updated_at",
      )
      .eq("id", userId)
      .maybeSingle();
    profile = (data as ProfileRow | null) ?? null;
  }

  const [settings, faqEntries] = await Promise.all([
    loadBusinessKnowledgeSettings(client, userId),
    loadBusinessFaqEntries(client, userId),
  ]);

  const currency = settings?.currency ?? "XOF";
  const profileSnapshot = profileRowToSnapshot(profile, currency === "XOF" ? "FCFA / XOF" : currency);
  const settingsFacts = settingsToFacts(settings);
  const facts = mergeProfileKnowledgeFacts(profile, settingsFacts);

  return {
    profileSnapshot,
    facts,
    faqEntries,
    settings,
  };
}
