"use client";

import * as React from "react";
import type { GenerationRow } from "@/lib/data/types";
import { authGetUserCoalesced, createOptionalSupabaseClient } from "@/lib/data/supabase";

export function useRecentGenerations(limit = 6) {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<GenerationRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const channelSuffix = React.useMemo(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }, []);

  const refresh = React.useCallback(async () => {
    const supabase = createOptionalSupabaseClient();
    if (!supabase) {
      setLoading(false);
      setError("Supabase non configuré.");
      setItems([]);
      setUserId(null);
      return;
    }
    setLoading(true);
    try {
      const { data: auth } = await authGetUserCoalesced(supabase);
      if (!auth.user) {
        setItems([]);
        setUserId(null);
        setError(null);
        return;
      }
      setUserId(auth.user.id);

      const { data, error: dbErr } = await supabase
        .from("generations")
        .select("id,user_id,mode,input,output,created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (dbErr) throw dbErr;
      setItems((data ?? []) as any);
      setError(null);
    } catch (err: any) {
      setError(typeof err?.message === "string" ? err.message : "Erreur historique.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createOptionalSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`generations:${userId}:${channelSuffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "generations", filter: `user_id=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelSuffix, refresh, userId]);

  return { loading, items, error, refresh };
}
