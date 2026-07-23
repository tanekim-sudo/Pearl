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

test("openPearlStudioDocument prefers a popup tab when available", async () => {
  const calls = [];
  const popup = { closed: false };
  let flushed = false;
  const result = await openPearlStudioDocument("ref-popup", {
    privacy: { async flush() { flushed = true; } },
    open: (href, target, features) => {
      calls.push({ href, target, features });
      return popup;
    },
    reload: () => calls.push("reload"),
    replaceState: () => calls.push("replace"),
    session: { setItem: () => calls.push("session") },
    locationRef: { pathname: "/scene/a", search: "" },
  });
  assert.equal(flushed, true);
  assert.equal(result.mode, "popup");
  assert.equal(result.href, "/scene/a#pearl-studio=ref-popup");
  assert.ok(calls.includes("session"));
  assert.deepEqual(
    calls.find((entry) => entry && entry.target === "_blank"),
    { href: result.href, target: "_blank", features: "noopener" },
  );
  assert.equal(calls.includes("reload"), false);
});

test("openPearlStudioDocument reloads when popups are blocked so Studio can remount", async () => {
  const session = new Map();
  const calls = [];
  const result = await openPearlStudioDocument("ref-blocked", {
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

test("openPearlStudioDocument reloads when popup window is already closed", async () => {
  const calls = [];
  const result = await openPearlStudioDocument("ref-closed", {
    privacy: { async flush() {} },
    open: () => ({ closed: true }),
    reload: () => calls.push("reload"),
    replaceState: () => calls.push("replace"),
    session: { setItem: () => {} },
    locationRef: { pathname: "/", search: "" },
  });
  assert.equal(result.mode, "reload");
  assert.ok(calls.includes("reload"));
});
