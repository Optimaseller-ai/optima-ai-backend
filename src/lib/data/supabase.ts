"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

let cachedClient: ReturnType<typeof createClient> | null = null;
let inFlightGetUser: Promise<{ data: { user: User | null } }> | null = null;
let inFlightGetSession: Promise<{ data: { session: Session | null } }> | null = null;

export function createOptionalSupabaseClient() {
  try {
    if (!cachedClient) cachedClient = createClient();
    return cachedClient;
  } catch {
    return null;
  }
}

// Coalesce concurrent getUser() calls to avoid @supabase/gotrue-js lock contention
// (common in React Strict Mode, or when multiple hooks call getUser on mount).
export async function authGetUserCoalesced(supabase: { auth: { getUser: () => Promise<{ data: { user: User | null } }> } }) {
  if (!inFlightGetUser) {
    inFlightGetUser = supabase.auth
      .getUser()
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        inFlightGetUser = null;
      });
  }
  return inFlightGetUser;
}

export async function authGetSessionCoalesced(supabase: { auth: { getSession: () => Promise<{ data: { session: Session | null } }> } }) {
  if (!inFlightGetSession) {
    inFlightGetSession = supabase.auth
      .getSession()
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        inFlightGetSession = null;
      });
  }
  return inFlightGetSession;
}
