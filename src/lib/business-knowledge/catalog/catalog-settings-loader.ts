import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessFaqCategory,
  BusinessFaqEntry,
  BusinessKnowledgeSettingsRow,
  BusinessOperationalFacts,
  BusinessProfileSnapshot,
} from "../types";

export type { BusinessKnowledgeSettingsRow };

export function settingsRowToOperationalFacts(row: BusinessKnowledgeSettingsRow | null): BusinessOperationalFacts {
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

  return {
    contactsLine: row.contacts_line ?? undefined,
    openHoursWeekday: openHours || row.business_hours_weekday || undefined,
    weekendHoursNote: row.business_hours_weekend ?? undefined,
    deliveryZonesNotes: deliveryParts.length ? deliveryParts.join("\n") : undefined,
    servedCities: Array.isArray(row.served_cities) ? row.served_cities.filter(Boolean) : undefined,
    paymentsExtraNote: row.payment_notes ?? undefined,
    returnPolicySummary: row.return_policy_summary ?? undefined,
    savReturnHumanLine: savLine || undefined,
    salesStyleNote: row.sales_style_notes ?? undefined,
    commercialInstructions: row.commercial_instructions ?? undefined,
    companyImportantNotes: row.company_important_notes ?? undefined,
  };
}

export async function loadBusinessKnowledgeSettings(
  client: SupabaseClient,
  userId: string,
): Promise<BusinessKnowledgeSettingsRow | null> {
  const { data } = await client
    .from("business_knowledge_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as BusinessKnowledgeSettingsRow | null) ?? null;
}

export async function loadBusinessFaqEntries(client: SupabaseClient, userId: string): Promise<BusinessFaqEntry[]> {
  const { data } = await client
    .from("business_faq_entries")
    .select("id,category,question,answer,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(80);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    category: r.category as BusinessFaqCategory,
    question: String(r.question ?? ""),
    answer: String(r.answer ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  }));
}

export async function loadBusinessProfileSnapshot(
  client: SupabaseClient,
  userId: string,
  currencyFallback = "XOF",
): Promise<BusinessProfileSnapshot> {
  const { data: prof } = await client
    .from("profiles")
    .select("business_name,business_type,city,country,shop_name")
    .eq("id", userId)
    .maybeSingle();

  const p = prof as Record<string, unknown> | null;
  return {
    businessName: String(p?.business_name ?? p?.shop_name ?? "Entreprise"),
    sector: String(p?.business_type ?? "").trim() || undefined,
    city: String(p?.city ?? "").trim() || undefined,
    country: String(p?.country ?? "").trim() || undefined,
    currencyLabel: currencyFallback,
  };
}
