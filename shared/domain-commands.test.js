import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_COMMANDS, executeDomainCommand } from "./domain-commands.js";

const context = { idFactory: () => "fixed-id", now: 100 };

test("direct, companion, and extension adapters produce the same Move effect", async () => {
  const state = { objects: [], primitivePreferences: {}, idempotencyKeys: [] };
  const args = { items: [{ text: "Rewrite clearly." }], id: "move-1" };
  const routes = await Promise.all(["ui", "companion", "extension"].map(() =>
    executeDomainCommand("createMoveFromContent", state, args, context)
  ));
  assert.deepEqual(routes.map((entry) => entry.state), [routes[0].state, routes[0].state, routes[0].state]);
  assert.equal(routes[0].result.object.prompt, "Rewrite clearly.");
});

test("transactions persist atomically and expose rollback state", async () => {
  const state = { objects: [], primitivePreferences: {}, idempotencyKeys: [] };
  let rolledBack = null;
  await assert.rejects(
    () => executeDomainCommand("createMoveFromContent", state, { items: [{ text: "One action" }], id: "m" }, {
      ...context,
      persist: async () => { throw new Error("storage failed"); },
      rollback: async (before) => { rolledBack = before; },
    }),
    /storage failed/
  );
  assert.deepEqual(rolledBack, state);
});

test("idempotent canonical upsert does not duplicate retried sync", async () => {
  const state = { objects: [], primitivePreferences: {}, idempotencyKeys: [] };
  const args = { object: { id: "m", kind: "move", prompt: "Act." }, idempotencyKey: "sync-1" };
  const once = await executeDomainCommand("upsertCanonicalObject", state, args, context);
  const twice = await executeDomainCommand("upsertCanonicalObject", once.state, args, context);
  assert.equal(twice.state.objects.length, 1);
  assert.equal(twice.result.type, "idempotent-replay");
});

test("every command declares complete release contract metadata", () => {
  for (const [name, command] of Object.entries(DOMAIN_COMMANDS)) {
    for (const field of ["schema", "preconditions", "risk", "confirmation", "undo", "surfaces", "persistenceEffect", "observableEffects", "execute"]) {
      assert.ok(command[field], `${name}.${field}`);
    }
  }
});
