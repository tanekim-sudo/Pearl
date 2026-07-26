import test from "node:test";
import assert from "node:assert/strict";
import { buildPearlStudioHref, flushPearlPrivacyBeforeStudio, openPearlStudioDocument } from "./pearl-studio-navigation.js";

test("buildPearlStudioHref encodes the local studio reference", () => {
  assert.equal(
    buildPearlStudioHref("ref-1", { pathname: "/scene/demo", search: "" }),
    "/scene/demo#pearl-studio=ref-1",
  );
  assert.equal(
    buildPearlStudioHref("a/b", { pathname: "/", search: "?x=1" }),
    "/?x=1#pearl-studio=a%2Fb",
  );
});

test("flushPearlPrivacyBeforeStudio awaits vault flush", async () => {
  let flushed = false;
  await flushPearlPrivacyBeforeStudio({
    privacy: {
      async flush() { flushed = true; },
    },
  });
  assert.equal(flushed, true);
});

test("openPearlStudioDocument defaults to same-window reload for clueless UX", async () => {
  const calls = [];
  const result = await openPearlStudioDocument("ref-same", {
    privacy: { async flush() {} },
    open: () => {
      calls.push("opened-popup");
      return { closed: false };
    },
    reload: () => calls.push("reload"),
    replaceState: (_s, _t, href) => calls.push(["replace", href]),
    session: { setItem: () => calls.push("session") },
    locationRef: { pathname: "/scene/a", search: "" },
    pearlId: "pearl-1",
  });
  assert.equal(result.mode, "reload");
  assert.equal(calls.includes("opened-popup"), false);
  assert.ok(calls.includes("reload"));
});

test("openPearlStudioDocument can still open a popup when preferSameWindow is false", async () => {
  const calls = [];
  const popup = { closed: false };
  const result = await openPearlStudioDocument("ref-popup", {
    preferSameWindow: false,
    privacy: { async flush() {} },
    open: (href, target, features) => {
      calls.push({ href, target, features });
      return popup;
    },
    reload: () => calls.push("reload"),
    replaceState: () => calls.push("replace"),
    session: { setItem: () => calls.push("session") },
    locationRef: { pathname: "/scene/a", search: "" },
  });
  assert.equal(result.mode, "popup");
  assert.equal(result.href, "/scene/a#pearl-studio=ref-popup");
  assert.equal(calls.includes("reload"), false);
});

test("openPearlStudioDocument reloads when popups are blocked", async () => {
  const session = new Map();
  const calls = [];
  const result = await openPearlStudioDocument("ref-blocked", {
    preferSameWindow: false,
    privacy: { async flush() {} },
    open: () => null,
    reload: () => calls.push("reload"),
    replaceState: (_s, _t, href) => calls.push(["replace", href]),
    session: {
      setItem(key, value) { session.set(key, value); },
    },
    locationRef: { pathname: "/scene/a", search: "" },
    pearlId: "pearl-blocked",
  });
  assert.equal(result.mode, "reload");
  assert.equal(session.get("pearlStudioActiveRef"), "ref-blocked");
  assert.equal(session.get("pearlStudioActivePearlId"), "pearl-blocked");
  assert.deepEqual(calls[0], ["replace", "/scene/a#pearl-studio=ref-blocked"]);
  assert.equal(calls[1], "reload");
});

test("openPearlStudioDocument can refuse reload for director-safe tours", async () => {
  const calls = [];
  const result = await openPearlStudioDocument("ref-director", {
    preferSameWindow: false,
    allowReloadFallback: false,
    privacy: { async flush() {} },
    open: () => null,
    reload: () => calls.push("reload"),
    replaceState: () => calls.push("replace"),
    session: { setItem: () => {} },
    locationRef: { pathname: "/", search: "" },
  });
  assert.equal(result.mode, "blocked");
  assert.equal(calls.includes("reload"), false);
});
