import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createSemanticOrb, semanticOrbFromMaterial, sensiblePearlName } from "./semantic-orbs.js";
import { resolveDropIntent } from "./drop-intent-resolver.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("new pearls default to a sensible name, never Untitled/orb", () => {
  const blank = createSemanticOrb({ id: "pearl-blank" }, { now: Date.parse("2026-07-23T12:00:00Z") });
  assert.match(blank.name, /^New pearl · /);
  assert.doesNotMatch(blank.name, /untitled|orb/i);
  const fromMaterial = semanticOrbFromMaterial({ id: "mat-1", text: "" }, {
    id: "pearl-mat",
    now: Date.parse("2026-07-23T12:00:00Z"),
  });
  assert.match(fromMaterial.name, /^New pearl · /);
  assert.equal(sensiblePearlName("Friday standup"), "Friday standup");
  assert.equal(sensiblePearlName("Untitled orb"), sensiblePearlName(""));
});

test("drop-intent chooser labels teach pearl, not orb", () => {
  const resolved = resolveDropIntent(
    { id: "a", kind: "semantic-orb", representation: { kind: "material" } },
    { id: "b", kind: "semantic-orb" },
  );
  const labels = resolved.intents.map((entry) => entry.preview).join(" ");
  assert.match(labels, /pearl/i);
  assert.doesNotMatch(labels, /\borb\b/i);
});

test("Reef/Scene presentation no longer teaches white orb or auto-opens Output Frame on result-pearl", () => {
  const shell = read("client/components/OrbUniverseShell.jsx");
  assert.doesNotMatch(shell, /white orb/i);
  assert.doesNotMatch(shell, /Untitled orb/);
  assert.doesNotMatch(shell, /Cognitive library/);
  assert.doesNotMatch(shell, /Open page canvas/);
  assert.match(shell, /Talk to Companion/);
  assert.match(shell, /companionSurfaceOk/);
  assert.match(shell, /data-zero-demand="true"/);
  assert.doesNotMatch(shell, /companion-mode-bar|Ask · inspect only|Agent · execute/);
  // Handoff must wait for explicit Continue — no auto continueExtensionWork effect.
  assert.doesNotMatch(
    shell,
    /route\.handoff !== "result-pearl"[\s\S]{0,120}continueExtensionWork\(\)/,
  );
  assert.match(shell, /never auto-materialize a Scene or open Output Frame without intent/);
  // Continue lands on Scene workspace, not ?frame=workspace.
  assert.match(shell, /setOutputFrameOpen\(false\);\s*navigate\(`\/scene\/\$\{encodeURIComponent\(id\)\}`\)/);
});

test("companion-first model: mother Companion + ≤5 context pearls, Reef is home canvas", () => {
  const shell = read("client/components/OrbUniverseShell.jsx");
  const guide = read("client/lib/pearl-guide.js");
  const chat = read("client/components/CompanionChat.jsx");
  const panel = read("extension/src/sidepanel/main.jsx");
  const reef = read("client/lib/reef-home.js");
  assert.match(shell, /data-companion-first="true"/);
  assert.match(shell, /Reef · where pearls live|home of pearls/i);
  assert.match(shell, /findWorkspacePearl/);
  assert.match(guide, /Begin with the Companion/);
  assert.match(guide, /not rival companions/);
  assert.match(panel, /Not rival companions/);
  assert.match(reef, /findWorkspacePearl/);
  assert.match(chat, /data-auto-mode/);
  assert.doesNotMatch(chat, /aria-label="Companion mode"/);
  assert.doesNotMatch(shell, /Pearl keeps reusable ideas/);
  assert.doesNotMatch(shell, /Ask the companion/);
});

test("extension shelf confirms delete pearl, not orb", () => {
  const panel = read("extension/src/sidepanel/main.jsx");
  assert.match(panel, /Delete this pearl\?/);
  assert.doesNotMatch(panel, /Delete this orb\?/);
  assert.match(panel, /aria-label="Pearl name"/);
  assert.match(panel, /aria-label="Pearl settings"/);
  assert.doesNotMatch(panel, /Untitled orb/);
  assert.doesNotMatch(panel, />●</);
});

test("companion capability purposes and examples present pearls, not orbs", () => {
  const caps = read("client/lib/companion-capabilities.js");
  assert.doesNotMatch(caps, /semantic orb/i);
  assert.doesNotMatch(caps, /into the orb context/);
  assert.doesNotMatch(caps, /Picasso studies orb/);
  assert.match(caps, /Picasso studies pearl/);
  assert.match(caps, /Open a saved pearl on the Pearl shelf/);
});
