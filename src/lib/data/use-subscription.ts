"use client";

import * as React from "react";
import { DateTime } from "luxon";
import type { SubscriptionPlan, SubscriptionRow } from "@/lib/data/types";
import { authGetSessionCoalesced, authGetUserCoalesced, createOptionalSupabaseClient } from "@/lib/data/supabase";

const DEFAULTS: Record<SubscriptionPlan, { quota_limit: number }> = {
  free: { quota_limit: 100 },
  pro: { quota_limit: 2000 },
};

export type UseSubscriptionState = {
  loading: boolean;
  userId: string | null;
  subscription: SubscriptionRow | null;
  error: string | null;
  refresh: () => Promise<void>;
};

function normalizeSub(row: Record<string, unknown>): SubscriptionRow {
  const plan: SubscriptionPlan = row.plan === "pro" ? "pro" : "free";
  return {
    user_id: String(row.user_id),
    plan,
    quota_limit: typeof row.quota_limit === "number" ? row.quota_limit : DEFAULTS[plan].quota_limit,
    quota_used: typeof row.quota_used === "number" ? row.quota_used : 0,
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    subscription_status: typeof row.subscription_status === "string" ? row.subscription_status : null,
    pro_since: typeof row.pro_since === "string" ? row.pro_since : null,
    payment_provider: typeof row.payment_provider === "string" ? row.payment_provider : null,
    payment_reference: typeof row.payment_reference === "string" ? row.payment_reference : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
  };
}

export function isSubscriptionActive(sub: SubscriptionRow | null) {
  if (!sub) return false;
  if (sub.plan !== "pro") return true;
  if (!sub.expires_at) return true;
  const dt = DateTime.fromISO(sub.expires_at);
  return dt.isValid ? dt.toUTC() > DateTime.utc() : true;
}

function extractSessionUserId(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== "object") return null;
  const session = (sessionData as { session?: unknown }).session;
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const id = (user as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

function extractAuthUserId(authData: unknown): string | null {
  if (!authData || typeof authData !== "object") return null;
  const user = (authData as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const id = (user as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

export function useSubscription(): UseSubscriptionState {
  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [subscription, setSubscription] = React.useState<SubscriptionRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const channelSuffix = React.useId();

  const refresh = React.useCallback(async () => {
    const supabase = createOptionalSupabaseClient();
    if (!supabase) {
      setLoading(false);
      setUserId(null);
      setSubscription(null);
      setError("Supabase non configuré.");
      return;
    }

    setLoading(true);
    try {
      // Fast-path: resolve a session locally (cookie/localStorage) before calling getUser().
      const { data: sessionData } = await authGetSessionCoalesced(supabase);
      const sessionUserId = extractSessionUserId(sessionData);

      const { data: auth } = await authGetUserCoalesced(supabase);
      const effectiveUserId = extractAuthUserId(auth) ?? sessionUserId;
      if (!effectiveUserId) {
        setUserId(null);
        setSubscription(null);
        setError(null);
        return;
      }
      setUserId(effectiveUserId);

      const { data: row, error: dbErr } = await supabase
        .from("subscriptions")
        .select(
          "user_id,plan,quota_limit,quota_used,expires_at,subscription_status,pro_since,payment_provider,payment_reference,created_at,updated_at",
        )
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (dbErr) throw dbErr;

      let next = row ? normalizeSub(row as Record<string, unknown>) : null;

      if (!row) {
        const payload = {
          user_id: effectiveUserId,
          plan: "free",
          quota_limit: DEFAULTS.free.quota_limit,
          quota_used: 0,
          expires_at: null,
          updated_at: new Date().toISOString(),
        };
        const { data: created, error: createErr } = await supabase
          .from("subscriptions")
          .upsert(payload, { onConflict: "user_id" })
          .select(
            "user_id,plan,quota_limit,quota_used,expires_at,subscription_status,pro_since,payment_provider,payment_reference,created_at,updated_at",
          )
          .maybeSingle();
        if (createErr) throw createErr;
        next = created ? normalizeSub(created as Record<string, unknown>) : null;
      }

      // Ensure quota_used reflects the current month (usage_monthly is source of truth).
      if (next) {
        const periodStart = DateTime.utc().startOf("month").toISODate();
        const { data: usage, error: usageErr } = await supabase
          .from("usage_monthly")
          .select("used")
          .eq("user_id", effectiveUserId)
          .eq("period_start", periodStart)
          .maybeSingle();
        if (usageErr) throw usageErr;
        const usedThisMonth = typeof usage?.used === "number" ? usage.used : 0;
        if (usedThisMonth !== next.quota_used) {
          next = { ...next, quota_used: usedThisMonth };
          await supabase
            .from("subscriptions")
            .update({ quota_used: usedThisMonth, updated_at: new Date().toISOString() })
            .eq("user_id", effectiveUserId);
        }
      }

      // Migrate legacy quotas to the new defaults automatically (best-effort).
      if (next && next.quota_limit !== DEFAULTS[next.plan].quota_limit) {
        next = { ...next, quota_limit: DEFAULTS[next.plan].quota_limit };
        await supabase
          .from("subscriptions")
          .update({ quota_limit: DEFAULTS[next.plan].quota_limit, updated_at: new Date().toISOString() })
          .eq("user_id", effectiveUserId);
      }

      setSubscription(next);
      setError(null);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
        setError((err as { message: string }).message);
      } else {
        setError("Erreur abonnement.");
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
      .channel(`subscriptions:${userId}:${channelSuffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = (payload.new ?? payload.old) as unknown;
          if (!next || typeof next !== "object") return;
          setSubscription(normalizeSub(next as Record<string, unknown>));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelSuffix, userId]);

  // Realtime: usage_monthly is the source of truth for "used this month".
  React.useEffect(() => {
    if (!userId) return;
    const supabase = createOptionalSupabaseClient();
    if (!supabase) return;

    const periodStart = DateTime.utc().startOf("month").toISODate();

    const channel = supabase
      .channel(`usage_monthly:${userId}:${periodStart}:${channelSuffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usage_monthly", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = (payload.new ?? payload.old) as unknown;
          if (!next || typeof next !== "object") return;
          const nextRow = next as Record<string, unknown>;
          if (String(nextRow.period_start ?? "") !== String(periodStart)) return;
          const usedThisMonth = typeof nextRow.used === "number" ? nextRow.used : 0;
          setSubscription((prev) => (prev ? { ...prev, quota_used: usedThisMonth } : prev));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelSuffix, userId]);

  return { loading, userId, subscription, error, refresh };
}
