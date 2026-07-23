import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PHYSICAL_PEARL_CSS,
  PHYSICAL_PEARL_SIZES,
  normalizePhysicalPearl,
  physicalPearlMarkup,
} from "./physical-pearl.js";
import { inspectPearlVisualContract, pearlSurroundingFromColor } from "./pearl-visual-contract.js";

const root = path.resolve(import.meta.dirname, "..");
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("shared physical renderer contains every required optical layer", () => {
  const markup = physicalPearlMarkup({ id: "contract-pearl", variant: "result", state: "new", size: 32 });
  for (const layer of ["contact", "body", "subsurface--far", "core", "nucleus", "ring--outer", "ring--inner", "subsurface--near", "caustic", "depth", "nacre", "environment", "reflection", "rim", "specular", "pinlight"]) {
    assert.match(markup, new RegExp(`physical-pearl__${layer}`), `missing ${layer} optical layer`);
  }
  assert.match(PHYSICAL_PEARL_CSS, /physical-pearl-core-breath/);
  assert.match(PHYSICAL_PEARL_CSS, /data-pearl-variant=primary/);
  assert.match(markup, /data-pearl-variant="result"/);
  assert.match(markup, /data-pearl-state="new"/);
  assert.doesNotMatch(PHYSICAL_PEARL_CSS, /outer-glow|box-shadow\s*:/i);
  assert.doesNotMatch(PHYSICAL_PEARL_CSS, /spin|rotate\(\s*(?:[1-9]\d*|-\d+)deg/i);
  assert.match(PHYSICAL_PEARL_CSS, /scale\(\.98\)/);
  assert.match(PHYSICAL_PEARL_CSS, /scale\(1\.02\)/);
  assert.match(PHYSICAL_PEARL_CSS, /prefers-reduced-motion/);
});

test("actual-pixel variants retain depth within visual and performance contracts", () => {
  for (const variant of ["primary", "semantic", "result", "worker", "candidate", "cursor", "recipient", "canvas-anchor"]) {
    for (const surrounding of ["light", "dark", "colored", "text-heavy"]) {
      const audit = inspectPearlVisualContract({ variant, surrounding, size: variant === "cursor" ? 18 : 34 });
      assert.equal(audit.valid, true, `${variant}/${surrounding}: ${JSON.stringify(audit)}`);
    }
  }
  assert.equal(pearlSurroundingFromColor({ r: 245, g: 244, b: 240 }), "light");
  assert.equal(pearlSurroundingFromColor({ r: 15, g: 18, b: 17 }), "dark");
  assert.equal(pearlSurroundingFromColor({ r: 38, g: 88, b: 126 }), "colored");
});

test("cursor is a precision-sized state of the same renderer", () => {
  const cursor = normalizePhysicalPearl({ variant: "cursor", size: 90 });
  assert.equal(cursor.size, PHYSICAL_PEARL_SIZES.cursor);
  const markup = physicalPearlMarkup(cursor);
  assert.match(markup, /physical-pearl__hotspot/);
  assert.match(markup, /width="18"/);
});

test("primary web and extension Pearl surfaces use the shared renderer", () => {
  const files = [
    "client/components/CompanionOrb.jsx",
    "client/components/SemanticOrbLayer.jsx",
    "client/components/OrbCursorLayer.jsx",
    "extension/src/content/bridge.js",
    "extension/src/content/result-pearls.js",
    "extension/src/sidepanel/main.jsx",
    "extension/src/result/main.js",
  ];
  for (const file of files) {
    const value = source(file);
    assert.match(value, /PhysicalPearl|physicalPearlMarkup/, `${file} bypasses the shared physical renderer`);
    assert.doesNotMatch(value, /background:\s*#fff(?:fff?)?\b[^;]*border-radius:\s*50%/i, `${file} contains a plain white Pearl fallback`);
  }
});

test("cursor mode never leaves a draggable duplicate companion", () => {
  const companion = source("client/components/CompanionOrb.jsx");
  const universe = source("client/components/OrbUniverseShell.jsx");
  const bridge = source("extension/src/content/bridge.js");
  assert.match(companion, /if \(cursorMode\) return null/);
  assert.match(universe, /\{!cursorMode && <CompanionOrb/);
  assert.match(bridge, /host\.style\.pointerEvents = value \? "none"/);
  assert.match(bridge, /cursorMotion\.x - 9/);
  assert.doesNotMatch(bridge, /\.shell\.cursor-mode[^}]*width:2[8-9]px/);
});
