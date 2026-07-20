import test from "node:test";
import assert from "node:assert/strict";

const session = {};
globalThis.chrome = {
  storage: {
    local: {
      get(keys, done) { done(keys == null ? {} : {}); },
      set(_values, done) { done(); },
      remove(_keys, done) { done(); },
    },
    session: {
      get(keys, done) {
        if (keys == null) done(structuredClone(session));
        else done(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => key in session).map((key) => [key, structuredClone(session[key])])));
      },
      set(values, done) { setTimeout(() => { Object.assign(session, structuredClone(values)); done(); }, 2); },
      remove(keys, done) { for (const key of keys) delete session[key]; done(); },
    },
  },
};

const { clearAllSession, readSession, writeSession } = await import("../src/background/session-store.js");

test("logout clearing invalidates pending writes and removes fragments, queue, results, and active runs", async () => {
  const pending = writeSession({
    fragments: [{ id: "private-a" }],
    queue: [{ id: "action-a" }],
    results: [{ id: "result-a" }],
    activeRunId: "run-a",
  });
  await clearAllSession();
  await pending;
  const cleared = await readSession();
  assert.deepEqual(cleared.fragments, []);
  assert.deepEqual(cleared.queue, []);
  assert.deepEqual(cleared.results, []);
  assert.equal(cleared.activeRunId, null);
});

test("a second account and reload cannot read or execute the prior session", async () => {
  await writeSession({ fragments: [{ id: "user-a" }], queue: [{ id: "execute-a" }], activeRunId: "run-a" });
  await clearAllSession();
  const userB = await readSession();
  assert.equal(userB.fragments.some((entry) => entry.id === "user-a"), false);
  assert.equal(userB.queue.some((entry) => entry.id === "execute-a"), false);
  assert.equal(userB.activeRunId, null);
  assert.deepEqual(session, {});
});
