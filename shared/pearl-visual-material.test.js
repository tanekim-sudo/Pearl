import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = async (file) => readFile(path.join(root, file), "utf8");

test("every literal Pearl renderer carries the shared optical depth layers", async () => {
  const renderers = [
    ["client/components/CompanionOrb.jsx", ["orb-nucleus", "orb-nacre", "orb-reflection", "orb-rim", "orb-pinlight"]],
    ["client/components/SemanticOrbLayer.jsx", ["semantic-orb-nucleus", "semantic-orb-nacre", "semantic-orb-reflection", "semantic-orb-rim", "semantic-orb-pinlight"]],
    ["client/components/OrbCursorLayer.jsx", ["orb-cursor-nucleus", "orb-cursor-nacre", "orb-cursor-reflection", "orb-cursor-rim", "orb-cursor-pinlight"]],
    ["extension/src/sidepanel/main.jsx", ["extension-orb-nucleus", "extension-orb-nacre", "extension-orb-reflection", "extension-orb-rim", "extension-orb-pinlight"]],
    ["extension/src/content/bridge.js", ['class="nucleus"', 'class="nacre"', 'class="reflection"', 'class="rim"', 'class="pinlight"']],
  ];

  for (const [file, layers] of renderers) {
    const text = await source(file);
    for (const layer of layers) assert.match(text, new RegExp(layer), `${file} is missing ${layer}`);
    assert.match(text, /#f2d9ce/i, `${file} is missing restrained rose nacre`);
    assert.match(text, /#d2e2da/i, `${file} is missing restrained celadon nacre`);
    assert.match(text, /#eadcb9/i, `${file} is missing restrained pale-gold nacre`);
  }
});

test("Pearl motion stays restrained and reduced-motion becomes static", async () => {
  const webCss = await source("client/orb-universe.css");
  const panelCss = await source("extension/src/sidepanel/sidepanel.css");
  const bridge = await source("extension/src/content/bridge.js");

  assert.match(webCss, /orb-respire 4s/);
  assert.match(webCss, /scale\(\.98\).+scale\(1\.02\)/s);
  assert.doesNotMatch(webCss, /@keyframes orb-order/);
  assert.match(panelCss, /\.extension-orb-pearl\{[^}]*animation:extension-pearl-breathe 4s/);
  assert.doesNotMatch(panelCss, /\.extension-orb-pearl\{[^}]*spin/);
  assert.match(webCss, /prefers-reduced-motion[\s\S]+orb-nucleus[\s\S]+transform: none !important/);
  assert.match(panelCss, /prefers-reduced-motion:reduce[\s\S]+extension-orb-nucleus[\s\S]+transform:none!important/);
  assert.match(bridge, /prefers-reduced-motion:reduce[\s\S]+\.nucleus,.nacre,.nacre-fold,.reflection\{transform:none!important/);
});

test("resting Pearls use compact circles without an outer glow", async () => {
  const webCss = await source("client/orb-universe.css");
  const panelCss = await source("extension/src/sidepanel/sidepanel.css");
  const bridge = await source("extension/src/content/bridge.js");

  assert.match(webCss, /--orb-size: 36px/);
  assert.match(webCss, /\.orb-cursor-layer[\s\S]+width: 28px[\s\S]+height: 28px/);
  assert.match(panelCss, /\.extension-orb\{left:0;top:0;width:36px;height:36px/);
  assert.match(bridge, /\.orb\{[^}]*width:36px;height:36px[^}]*border-radius:50%/);
  assert.doesNotMatch(webCss, /\.companion-orb\s*\{[^}]*drop-shadow/s);
  assert.match(webCss, /\.orb-shadow \{ fill: rgba\(0, 0, 0, \.16\); filter: blur\(1\.1px\); \}/);
});

test("physical Pearl layers lag with mass and page seams adapt without neon", async () => {
  const webCss = await source("client/orb-universe.css");
  const panelCss = await source("extension/src/sidepanel/sidepanel.css");
  const panel = await source("extension/src/sidepanel/main.jsx");
  const bridge = await source("extension/src/content/bridge.js");
  assert.match(panel, /extension-orb-nacre-fold/);
  assert.match(bridge, /class="nacre-fold"/);
  assert.match(webCss, /orb-pearl-mass 4s/);
  assert.match(panelCss, /extension-pearl-mass 4s/);
  assert.match(webCss, /rotate\(-\.12deg\)/);
  assert.match(panelCss, /extension-pearl-ember 8s/);
  assert.match(bridge, /--field-bg/);
  assert.match(bridge, /pageColor\[3\] === 0/);
  assert.doesNotMatch(bridge, /drop-shadow/);
});
