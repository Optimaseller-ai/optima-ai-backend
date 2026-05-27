"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { useSubscription, isSubscriptionActive } from "@/lib/data/use-subscription";
import { authGetUserCoalesced, createOptionalSupabaseClient } from "@/lib/data/supabase";

export type UseUserPlanState = {
  user: User | null;
  isLoggedIn: boolean;
  isFree: boolean;
  isPro: boolean;
  loading: boolean;
};

export function useUserPlan(): UseUserPlanState {
  const sub = useSubscription();
  const supabase = React.useMemo(() => createOptionalSupabaseClient(), []);
  const [user, setUser] = React.useState<User | null>(null);
  const [authReady, setAuthReady] = React.useState(() => !supabase);

  React.useEffect(() => {
    if (!supabase) {
      return;
    }

    let canceled = false;
    void authGetUserCoalesced(supabase).then(({ data }) => {
      if (canceled) return;
      setUser(data.user ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Ensure subscription state follows auth changes without "flash" of guest CTAs.
      void sub.refresh();
      setAuthReady(true);
    });

    return () => {
      canceled = true;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const isLoggedIn = Boolean(user);
  const isPro = isLoggedIn && isSubscriptionActive(sub.subscription) && sub.subscription?.plan === "pro";
  const isFree = isLoggedIn && !isPro;
  const loading = !authReady || sub.loading;

  return { user, isLoggedIn, isFree, isPro, loading };
}
