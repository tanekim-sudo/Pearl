import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:5173";
const out = path.resolve(process.env.AUDIT_OUT || "audit-shots/pearl-material-2026-07");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const scene = {
  version: 4,
  activeSceneId: "pearl-material-audit",
  scenes: [{
    id: "pearl-material-audit",
    kind: "scene",
    version: 4,
    name: "Pearl Material Audit",
    items: Array.from({ length: 8 }, (_, index) => ({
      id: `material-${index}`,
      type: "text",
      text: [
        "Nacre records light in thin translucent layers.",
        "The page remains legible while Pearl reflects its surrounding surface.",
        "A precise point light gives the object weight without an outer glow.",
      ][index % 3],
      x: 160 + (index % 4) * 245,
      y: 150 + Math.floor(index / 4) * 230,
      frameId: null,
    })),
    nodes: [],
    frames: [],
    orbInstances: [],
    semanticOrbs: Array.from({ length: 5 }, (_, index) => ({
      version: 1,
      id: `pearl-${index}`,
      kind: "semantic-orb",
      sceneId: "pearl-material-audit",
      name: `Material pearl ${index + 1}`,
      placement: { x: -250 + index * 125, y: -115 + (index % 2) * 95, radius: 24 },
      representation: { kind: "material", refs: [`material-${index}`], label: `Material pearl ${index + 1}` },
      workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
      parentOrbId: null,
      childOrbIds: [],
      lineage: [],
      provenance: { source: "pearl-material-audit" },
      archived: false,
    })),
    activeSemanticOrbId: "pearl-2",
    workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
    camera: { x: 0, y: 0, scale: 1 },
  }],
};

async function capture(name, viewport, reducedMotion) {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript((workspace) => {
    localStorage.setItem("lens.scenes.v4", JSON.stringify(workspace));
    localStorage.removeItem("lens.orb.placement.v1");
  }, scene);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/scene/pearl-material-audit`, { waitUntil: "networkidle" });
  await page.locator('[data-semantic-anchor="primary-orb"] .companion-orb').waitFor();
  await page.locator(".semantic-orb-capsule").first().waitFor();
  const sizes = await page.evaluate(() => ({
    primary: document.querySelector(".companion-orb")?.getBoundingClientRect().width,
    semantic: document.querySelector(".semantic-orb-button")?.getBoundingClientRect().width,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    animations: document.getAnimations().filter((entry) => entry.playState === "running").map((entry) => entry.animationName),
  }));
  if (sizes.primary < 28 || sizes.primary > 36 || sizes.semantic !== 36) {
    throw new Error(`${name} Pearl geometry mismatch: ${JSON.stringify(sizes)}`);
  }
  if (reducedMotion === "reduce" && sizes.animations.some((animation) => /orb|pearl/i.test(animation))) {
    throw new Error(`${name} reduced-motion Pearl is animated: ${JSON.stringify(sizes.animations)}`);
  }
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  results.push({ name, viewport, ...sizes });
  await context.close();
}

try {
  await capture("web-dark-text-default", { width: 1280, height: 800 }, "no-preference");
  await capture("web-dark-text-reduced-narrow", { width: 390, height: 844 }, "reduce");
  fs.writeFileSync(path.join(out, "pearl-material-results.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: browser.version(),
    checks: results,
  }, null, 2)}\n`);
  console.log(`Pearl material audit passed: ${results.length} screenshots.`);
} finally {
  await browser.close();
}
