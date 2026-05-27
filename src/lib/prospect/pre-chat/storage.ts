import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

const PREFIX = "optima_prechat_v1_";

export function preChatStorageKey(slug: string) {
  return `${PREFIX}${slug.trim().toLowerCase()}`;
}

export function readPreChatProfile(slug: string): SmartProspectProfile | null {
  const maybeWindow = (globalThis as unknown as { window?: { localStorage?: Storage } }).window;
  if (!maybeWindow?.localStorage) return null;
  try {
    const raw = maybeWindow.localStorage.getItem(preChatStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SmartProspectProfile;
    const hasContact = Boolean(parsed?.email?.trim() || parsed?.phone?.trim());
    if (!parsed?.name?.trim() || !hasContact) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePreChatProfile(slug: string, profile: SmartProspectProfile) {
  const maybeWindow = (globalThis as unknown as { window?: { localStorage?: Storage } }).window;
  if (!maybeWindow?.localStorage) return;
  try {
    maybeWindow.localStorage.setItem(preChatStorageKey(slug), JSON.stringify(profile));
  } catch {
    // quota
  }
}

export function isPreChatComplete(slug: string): boolean {
  return readPreChatProfile(slug) != null;
}
