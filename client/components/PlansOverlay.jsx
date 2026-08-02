import React, { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "../lib/supabase.js";
import {
  effectivePlan,
  sortPlans,
  planBadgeLabel,
  formatPlanPrice,
} from "../lib/plans.js";
import { describeAccountsUnavailable } from "../lib/account-setup.js";

export default function PlansOverlay({ session, onClose }) {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError(describeAccountsUnavailable().message);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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

      setPlans(sortPlans(planRows || []));
      setSubscriptions(subRows);
      setLoading(false);
    } catch (err) {
      console.warn("[lens] plans fetch failed:", err);
      setError("Could not load plans. Check your connection and try again.");
      setSubscriptions(null);
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const effective = subscriptions === null && !loading && !error
    ? null
    : effectivePlan(subscriptions, plans);
  const currentLabel = planBadgeLabel(effective);
  const signedIn = Boolean(session?.user);

  function handleKeyDown(e) {
    e.stopPropagation();
    if (e.key === "Escape") onClose();
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      rootRef.current?.querySelectorAll("button, a[href]") ?? []
    ).filter((el) => !el.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className="modal-scrim plans-scrim"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Plans"
    >
      <div className="modal plans-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Plans</h3>
        <p className="plans-intro">
          {signedIn
            ? currentLabel
              ? `You're on the ${currentLabel} plan.`
              : "Your plan could not be loaded."
            : "Sign in to see your current plan. Everyone can use Lens for free."}
        </p>

        {error && (
          <div className="plans-error-block">
            <p className="auth-error">{error}</p>
            <button type="button" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {loading && !error && <p className="plans-loading">Loading plans…</p>}

        {!loading && !error && (
          <div className="plans-grid">
            {plans.map((plan) => {
              const isCurrent =
                signedIn &&
                currentLabel &&
                ((effective?.kind === "free" && plan.id === "free") ||
                  (effective?.kind === "paid" && effective.plan.id === plan.id));
              return (
                <article
                  key={plan.id}
                  className={"plans-card" + (isCurrent ? " plans-card-current" : "")}
                >
                  <div className="plans-card-head">
                    <h4>{plan.name}</h4>
                    <span className="plans-price">{formatPlanPrice(plan.price_cents)}</span>
                  </div>
                  {plan.description && <p className="plans-desc">{plan.description}</p>}
                  {isCurrent ? (
                    <span className="plans-current-badge">Current plan</span>
                  ) : plan.id === "pro" ? (
                    <button type="button" className="plans-upgrade" disabled title="Coming soon">
                      Upgrade — coming soon
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        <div className="modal-foot">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
