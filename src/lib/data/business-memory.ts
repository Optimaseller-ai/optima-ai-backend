"use client";

import type { ProfileRow } from "@/lib/data/types";

export type MemoryStatus = "active" | "incomplete" | "missing";

export function computeMemoryStatus(profile: ProfileRow | null): { status: MemoryStatus; missing: string[] } {
  if (!profile) return { status: "missing", missing: ["business_name", "business_sector", "main_goal", "country", "city"] };

  const missing: string[] = [];
  if (!profile.business_name?.trim()) missing.push("business_name");
  // business_sector maps to `business_type` in DB
  if (!profile.business_type?.trim()) missing.push("business_sector");
  // main_goal maps to `goal` in DB (fallbacks are handled in useProfile normalization)
  if (!profile.goal?.trim()) missing.push("main_goal");
  if (!profile.country?.trim()) missing.push("country");
  if (!profile.city?.trim()) missing.push("city");

  return { status: missing.length === 0 ? "active" : "incomplete", missing };
}

export function formatBusinessContextForPrompt(profile: ProfileRow | null) {
  if (!profile) return null;
  const lines = [
    profile.business_name?.trim() ? `User business name: ${profile.business_name.trim()}` : null,
    profile.business_type?.trim() ? `Sector: ${profile.business_type.trim()}` : null,
    profile.country?.trim() ? `Country: ${profile.country.trim()}` : null,
    profile.city?.trim() ? `City: ${profile.city.trim()}` : null,
    profile.offer?.trim() ? `Offer: ${profile.offer.trim()}` : null,
    profile.goal?.trim() ? `Goal: ${profile.goal.trim()}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}
