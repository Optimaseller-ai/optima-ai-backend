"use client";

import * as React from "react";
import type { ProfileRow } from "@/lib/data/types";
import { authGetUserCoalesced, createOptionalSupabaseClient } from "@/lib/data/supabase";

const SELECT =
  "id,full_name,business_name,business_type,goal,country,city,whatsapp,offer,email,created_at,updated_at,first_name,shop_name,main_goal,whatsapp_number,offer_description";

function normalizeProfileRow(row: Record<string, unknown>): ProfileRow {
  const fullName =
    typeof row.full_name === "string"
      ? row.full_name
      : typeof row.first_name === "string"
        ? row.first_name
        : null;
  const businessName =
    typeof row.business_name === "string"
      ? row.business_name
      : typeof row.shop_name === "string"
        ? row.shop_name
        : null;
  const goal =
    typeof row.goal === "string"
      ? row.goal
      : typeof row.main_goal === "string"
        ? row.main_goal
        : null;
  const contact_phone =
    typeof row.whatsapp === "string"
      ? row.whatsapp
      : typeof row.whatsapp_number === "string"
        ? row.whatsapp_number
        : null;
  const offer =
    typeof row.offer === "string"
      ? row.offer
      : typeof row.offer_description === "string"
        ? row.offer_description
        : null;

  return {
    id: String(row.id),
    full_name: fullName,
    business_name: businessName,
    business_type: typeof row.business_type === "string" ? row.business_type : null,
    goal,
    country: typeof row.country === "string" ? row.country : null,
    city: typeof row.city === "string" ? row.city : null,
    contact_phone,
    offer,
    email: typeof row.email === "string" ? row.email : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
  };
}

export type UseProfileState = {
  loading: boolean;
  userId: string | null;
  profile: ProfileRow | null;
  error: string | null;
  upsert: (patch: Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useProfile(): UseProfileState {
  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const channelSuffix = React.useId();

  const refresh = React.useCallback(async () => {
    const supabase = createOptionalSupabaseClient();
    if (!supabase) {
      setLoading(false);
      setUserId(null);
      setProfile(null);
      setError("Supabase non configuré.");
      return;
    }

    setLoading(true);
    try {
      const { data: auth } = await authGetUserCoalesced(supabase);
      if (!auth.user) {
        setUserId(null);
        setProfile(null);
        setError(null);
        return;
      }

      setUserId(auth.user.id);

      const { data: row, error: dbErr } = await supabase.from("profiles").select(SELECT).eq("id", auth.user.id).maybeSingle();
      if (dbErr) throw dbErr;

      if (!row) {
        setProfile(null);
        setError(null);
        return;
      }

      setProfile(normalizeProfileRow(row as Record<string, unknown>));
      setError(null);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
        setError((err as { message: string }).message);
      } else {
        setError("Erreur profile.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let canceled = false;
    void Promise.resolve().then(async () => {
      if (canceled) return;
      await refresh();
    });
    return () => {
      canceled = true;
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createOptionalSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`profiles:${userId}:${channelSuffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new ?? payload.old) as unknown;
          if (!next || typeof next !== "object") return;
          setProfile(normalizeProfileRow(next as Record<string, unknown>));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelSuffix, userId]);

  const upsert = React.useCallback(
    async (patch: Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>) => {
      const supabase = createOptionalSupabaseClient();
      if (!supabase) throw new Error("Supabase non configuré.");

      const { data: auth } = await authGetUserCoalesced(supabase);
      if (!auth.user) throw new Error("Connexion requise.");

      const payload: Record<string, unknown> = {
        id: auth.user.id,
        updated_at: new Date().toISOString(),
      };

      if (patch.full_name !== undefined) payload.full_name = patch.full_name?.trim() ? patch.full_name : null;
      if (patch.business_name !== undefined) payload.business_name = patch.business_name?.trim() ? patch.business_name : null;
      if (patch.business_type !== undefined) payload.business_type = patch.business_type?.trim() ? patch.business_type : null;
      if (patch.goal !== undefined) payload.goal = patch.goal?.trim() ? patch.goal : null;
      if (patch.country !== undefined) payload.country = patch.country?.trim() ? patch.country : null;
      if (patch.city !== undefined) payload.city = patch.city?.trim() ? patch.city : null;
      if (patch.contact_phone !== undefined) payload.whatsapp = patch.contact_phone?.trim() ? patch.contact_phone : null;
      if (patch.offer !== undefined) payload.offer = patch.offer?.trim() ? patch.offer : null;
      if (patch.email !== undefined) payload.email = patch.email?.trim() ? patch.email : null;

      // Backward compatibility (old columns)
      if (patch.full_name !== undefined) {
        const firstName = (patch.full_name ?? "").trim().split(/\s+/)[0] ?? "";
        payload.first_name = firstName || null;
      }
      if (patch.business_name !== undefined) payload.shop_name = patch.business_name?.trim() ? patch.business_name : null;
      if (patch.goal !== undefined) payload.main_goal = patch.goal?.trim() ? patch.goal : null;
      if (patch.contact_phone !== undefined) payload.whatsapp_number = patch.contact_phone?.trim() ? patch.contact_phone : null;
      if (patch.offer !== undefined) payload.offer_description = patch.offer?.trim() ? patch.offer : null;

      const { error: upsertErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (upsertErr) throw upsertErr;

      setError(null);
    },
    [],
  );

  return { loading, userId, profile, error, upsert, refresh };
}

