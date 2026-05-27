import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createAdminClient() {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing Supabase env. Set SUPABASE_URL.");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env. Set SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAdminClientSafe() {
  try {
    return createAdminClient();
  } catch (e) {
    console.error("createAdminClientSafe: admin client unavailable:", e);
    return null;
  }
}
