import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  effectivePlan,
  sortPlans,
  planBadgeLabel,
  formatPlanPrice,
} from "./plans.js";

const PLANS = [
  { id: "free", name: "Free", price_cents: 0, sort_order: 0 },
  { id: "pro", name: "Pro", price_cents: 800, sort_order: 1 },
];

describe("effectivePlan", () => {
  it("no rows → Free", () => {
    assert.deepEqual(effectivePlan([], PLANS), { kind: "free" });
    assert.deepEqual(effectivePlan(null, PLANS), { kind: "free" });
  });

  it("one active row → that plan", () => {
    const result = effectivePlan(
      [{ plan_id: "pro", status: "active", created_at: "2026-01-01T00:00:00Z" }],
      PLANS
    );
    assert.equal(result.kind, "paid");
    assert.equal(result.plan.id, "pro");
  });

  it("trialing row → that plan", () => {
    const result = effectivePlan(
      [{ plan_id: "pro", status: "trialing", created_at: "2026-01-01T00:00:00Z" }],
      PLANS
    );
    assert.equal(result.kind, "paid");
    assert.equal(result.plan.id, "pro");
  });

  it("only canceled/past_due rows → Free", () => {
    assert.deepEqual(
      effectivePlan(
        [
          { plan_id: "pro", status: "canceled", created_at: "2026-01-01T00:00:00Z" },
          { plan_id: "pro", status: "past_due", created_at: "2026-02-01T00:00:00Z" },
        ],
        PLANS
      ),
      { kind: "free" }
    );
  });

  it("two active rows → most recent created_at wins", () => {
    const result = effectivePlan(
      [
        { plan_id: "free", status: "active", created_at: "2026-01-01T00:00:00Z" },
        { plan_id: "pro", status: "active", created_at: "2026-06-01T00:00:00Z" },
      ],
      PLANS
    );
    assert.equal(result.kind, "paid");
    assert.equal(result.plan.id, "pro");
  });

  it("unknown plan_id → indeterminate", () => {
    assert.deepEqual(
      effectivePlan(
        [{ plan_id: "enterprise", status: "active", created_at: "2026-01-01T00:00:00Z" }],
        PLANS
      ),
      { kind: "indeterminate" }
    );
  });

  it("unrecognized status → indeterminate when it would otherwise qualify", () => {
    assert.deepEqual(
      effectivePlan(
        [{ plan_id: "pro", status: "paused", created_at: "2026-01-01T00:00:00Z" }],
        PLANS
      ),
      { kind: "free" }
    );
  });
});

describe("sortPlans", () => {
  it("orders by sort_order", () => {
    const sorted = sortPlans([
      { id: "pro", sort_order: 1 },
      { id: "free", sort_order: 0 },
    ]);
    assert.deepEqual(sorted.map((p) => p.id), ["free", "pro"]);
  });
});

describe("planBadgeLabel", () => {
  it("returns labels for free and paid", () => {
    assert.equal(planBadgeLabel({ kind: "free" }), "Free");
    assert.equal(planBadgeLabel({ kind: "paid", plan: { id: "pro", name: "Pro" } }), "Pro");
    assert.equal(planBadgeLabel({ kind: "indeterminate" }), null);
    assert.equal(planBadgeLabel(null), null);
  });
});

describe("formatPlanPrice", () => {
  it("formats cents", () => {
    assert.equal(formatPlanPrice(0), "Free");
    assert.equal(formatPlanPrice(800), "$8/mo");
  });
});
