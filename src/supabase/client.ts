import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../config/env.js";
import WebSocket from "ws";

let admin: SupabaseClient | null | undefined;

/** Supabase admin — persistence (conversations archivées, profils, produits). */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;

  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    admin = null;
    console.warn("[OPTIMA_AI_BACKEND] Supabase not configured");
    return null;
  }

  admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      // Supabase expects a WebSocket constructor; `ws` is compatible at runtime.
      transport: WebSocket as any,
    },
  });
  return admin;
}
