import { useCallback, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase.js";
import { effectivePlan } from "./plans.js";

/**
 * Load catalog plans + the signed-in user's subscription for toolbar badge.
 * @param {{ session: import('@supabase/supabase-js').Session | null, sessionResolved: boolean }} auth
 */
export function useUserPlan({ session, sessionResolved }) {
  const [state, setState] = useState({
    loading: !sessionResolved,
    effective: null,
    error: false,
  });

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setState({ loading: false, effective: null, error: false });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setState({ loading: false, effective: null, error: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const { data: planRows, error: plansErr } = await supabase
        .from("plans")
        .select("id, name, description, price_cents, sort_order");
      if (plansErr) throw plansErr;

      let subRows = [];
      if (session?.user?.id) {
        const { data, error: subsErr } = await supabase
          .from("subscriptions")
          .select("plan_id, status, created_at")
          .eq("user_id", session.user.id);
        if (subsErr) throw subsErr;
        subRows = data || [];
      }

      setState({
        loading: false,
        effective: effectivePlan(subRows, planRows || []),
        error: false,
      });
    } catch (err) {
      console.warn("[lens] plan fetch failed:", err);
      setState({ loading: false, effective: null, error: true });
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!sessionResolved) return;
    reload();
  }, [sessionResolved, reload]);

  return { ...state, reload };
}
