"use client";

import { useSubscription } from "@/lib/data/use-subscription";

export function useQuota() {
  const { loading, subscription, error } = useSubscription();
  const limit = subscription?.quota_limit ?? 0;
  const used = subscription?.quota_used ?? 0;
  const remaining = Math.max(0, limit - used);
  const exhausted = Boolean(subscription) && remaining <= 0;

  return {
    loading,
    error,
    limit,
    used,
    remaining,
    plan: subscription?.plan ?? null,
    expires_at: null,
    exhausted,
  };
}
