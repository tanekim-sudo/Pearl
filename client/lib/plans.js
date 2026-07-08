// Pure plan-tier derivation from subscription rows and catalog plans.

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * @typedef {{ id: string, name: string, description?: string, price_cents: number, sort_order: number }} PlanRow
 * @typedef {{ plan_id: string, status: string, created_at: string }} SubscriptionRow
 * @typedef {{ kind: 'free' }} FreePlan
 * @typedef {{ kind: 'paid', plan: PlanRow }} PaidPlan
 * @typedef {{ kind: 'indeterminate' }} IndeterminatePlan
 */

/**
 * Resolve the user's effective plan from subscription rows.
 * No qualifying rows → Free. Unknown plan_id or unrecognized status → indeterminate
 * (never mislabel a paying user as Free).
 *
 * @param {SubscriptionRow[] | null | undefined} subscriptionRows
 * @param {PlanRow[] | null | undefined} plans
 * @returns {FreePlan | PaidPlan | IndeterminatePlan}
 */
export function effectivePlan(subscriptionRows, plans) {
  const rows = Array.isArray(subscriptionRows) ? subscriptionRows : [];
  const catalog = Array.isArray(plans) ? plans : [];
  const planById = new Map(catalog.map((p) => [p.id, p]));

  const qualifying = rows.filter((r) => ACTIVE_STATUSES.has(r.status));
  if (!qualifying.length) return { kind: "free" };

  const latest = qualifying.reduce((a, b) =>
    String(b.created_at || "") > String(a.created_at || "") ? b : a
  );

  if (!ACTIVE_STATUSES.has(latest.status)) return { kind: "indeterminate" };

  const plan = planById.get(latest.plan_id);
  if (!plan) return { kind: "indeterminate" };

  return { kind: "paid", plan };
}

/**
 * @param {PlanRow[] | null | undefined} plans
 * @returns {PlanRow[]}
 */
export function sortPlans(plans) {
  if (!Array.isArray(plans)) return [];
  return [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * @param {FreePlan | PaidPlan | IndeterminatePlan | null | undefined} effective
 * @returns {string | null} Badge label, or null when indeterminate / unresolved.
 */
export function planBadgeLabel(effective) {
  if (!effective || effective.kind === "indeterminate") return null;
  if (effective.kind === "free") return "Free";
  return effective.plan.name || effective.plan.id;
}

/**
 * @param {number} cents
 * @returns {string}
 */
export function formatPlanPrice(cents) {
  if (!cents) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/mo`;
}
