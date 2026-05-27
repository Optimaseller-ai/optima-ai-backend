/**
 * Profil prospect pré-chat — lead léger (pas CRM lourd).
 */

export type LeadTemperature = "cold" | "warm" | "hot" | "ready_to_buy";

export type SmartProspectProfile = {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  businessName?: string | null;
  primaryNeed: string;
  budget?: string | null;
  interestLevel?: "cold" | "warm" | "hot";
  preferredProducts?: string[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string; ts?: string }>;
  leadTemperature: LeadTemperature;
  lastInteraction?: number;
  timezone?: string | null;
  language?: "fr" | "en" | "es";
  notes?: string[];
  createdAt?: number;
  updatedAt?: number;
};

export const emptySmartProspectProfile = (): SmartProspectProfile => ({
  name: "",
  primaryNeed: "",
  leadTemperature: "cold",
  preferredProducts: [],
  conversationHistory: [],
  notes: [],
  language: "fr",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export function normalizeContact(raw: string): { email: string | null; phone: string | null } {
  const v = String(raw ?? "").trim();
  if (!v) return { email: null, phone: null };
  if (/@/.test(v)) return { email: v.toLowerCase(), phone: null };
  const digits = v.replace(/[^\d+]/g, "");
  if (digits.length >= 8) return { email: null, phone: digits };
  return { email: null, phone: null };
}

export function mergeSmartProspectProfile(
  base: SmartProspectProfile | undefined,
  patch: Partial<SmartProspectProfile>,
): SmartProspectProfile {
  const prev = base ?? emptySmartProspectProfile();
  return {
    ...prev,
    ...patch,
    preferredProducts: patch.preferredProducts ?? prev.preferredProducts ?? [],
    notes: patch.notes ?? prev.notes ?? [],
    updatedAt: Date.now(),
  };
}
