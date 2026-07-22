import test from "node:test";
import assert from "node:assert/strict";
import { buildPearlStudioHref, openPearlStudioDocument } from "./pearl-studio-navigation.js";

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

test("openPearlStudioDocument prefers a popup tab when available", () => {
  const calls = [];
  const popup = { closed: false };
  const result = openPearlStudioDocument("ref-popup", {
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
  assert.deepEqual(calls[0], { href: result.href, target: "_blank", features: "noopener" });
  assert.equal(calls.includes("reload"), false);
});

test("openPearlStudioDocument reloads when popups are blocked so Studio can remount", () => {
  const session = new Map();
  const calls = [];
  const result = openPearlStudioDocument("ref-blocked", {
    open: () => null,
    reload: () => calls.push("reload"),
    replaceState: (_s, _t, href) => calls.push(["replace", href]),
    session: {
      setItem(key, value) { session.set(key, value); },
    },
    locationRef: { pathname: "/scene/a", search: "" },
  });
  assert.equal(result.mode, "reload");
  assert.equal(session.get("pearlStudioActiveRef"), "ref-blocked");
  assert.deepEqual(calls[0], ["replace", "/scene/a#pearl-studio=ref-blocked"]);
  assert.equal(calls[1], "reload");
});
