import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (file) => readFile(path.join(root, file), "utf8");

test("web and extension import one Pearl interface token system", async () => {
  const [tokens, webEntry, extensionEntry] = await Promise.all([
    source("shared/pearl-interface-tokens.css"),
    source("client/main.jsx"),
    source("extension/src/sidepanel/main.jsx"),
  ]);
  for (const token of [
    "--pearl-ui-space-1",
    "--pearl-ui-control",
    "--pearl-ui-radius",
    "--pearl-ui-font-xs",
    "--pearl-ui-line-strong",
  ]) assert.match(tokens, new RegExp(token));
  assert.match(webEntry, /shared\/pearl-interface-tokens\.css/);
  assert.match(extensionEntry, /shared\/pearl-interface-tokens\.css/);
});

test("emitted interfaces use sharp separators and accessible controls", async () => {
  const [web, panel, overlay] = await Promise.all([
    source("client/orb-universe.css"),
    source("extension/src/sidepanel/sidepanel.css"),
    source("extension/src/content/bridge.js"),
  ]);
  assert.match(web, /Pearl interface system/);
  assert.match(web, /\.orb-stage-emission[\s\S]+border-left: 1px solid var\(--pearl-ui-line-strong\)/);
  assert.match(panel, /Shared instrument UI/);
  assert.match(panel, /\.extension-pearl-halo\{[\s\S]+border-left:1px solid var\(--pearl-ui-line-strong\)/);
  assert.match(overlay, /\.emission\{[^}]*border-radius:0[^}]*box-shadow:none/);
  assert.match(overlay, /\.emission button,.emission input\{min-height:40px/);
});

test("idle web removes marketing chrome while preserving Pearl material", async () => {
  const [web, shell, physical] = await Promise.all([
    source("client/orb-universe.css"),
    source("client/components/OrbUniverseShell.jsx"),
    source("shared/physical-pearl.js"),
  ]);
  assert.doesNotMatch(web, /\.orb-home-intro,\s*\.orb-home-prompt\s*\{\s*display:\s*none/);
  assert.match(shell, /const firstUse = isRoot && scenes\.length === 0/);
  assert.doesNotMatch(shell, /className="orb-continuation-pearl"/);
  assert.match(physical, /physical-pearl-breath 6\.4s/);
});
