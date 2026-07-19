import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const evidence = path.resolve(process.env.AUDIT_OUT || "audit-shots/orb-universe-2026-07");
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const results = [];

async function shot(name, viewport, url, setup) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: name.includes("reduced") ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}${url}`, { waitUntil: "networkidle" });
  await setup?.(page);
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
  const snapshot = await page.locator("body").ariaSnapshot();
  const diagnostics = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const animations = document.getAnimations().map((animation) => ({
      name: animation.animationName || animation.effect?.target?.className || "transition",
      playState: animation.playState,
    }));
    return {
      colors: { foreground: body.color, background: body.backgroundColor },
      overflow: {
        horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      animationCount: animations.length,
      animations: animations.slice(0, 20),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      highContrast: matchMedia("(prefers-contrast: more)").matches,
    };
  });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      loadMs: Math.round(navigation?.loadEventEnd || 0),
      transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      longTasks: performance.getEntriesByType("longtask").length,
    };
  });
  results.push({ name, viewport, url: page.url(), title: await page.title(), errors, diagnostics, metrics, snapshot: snapshot.slice(0, 2000) });
  if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
  await context.close();
}

try {
  await shot("01-install-desktop", { width: 1600, height: 1000 }, "/", async (page) => {
    await page.evaluate(() => localStorage.removeItem("lens.orb-universe.continued.v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Your cognition/ }).waitFor();
    const orb = await page.locator(".companion-orb").boundingBox();
    if (!orb || orb.width < 110) throw new Error("install orb is not a focal interface");
  });
  await shot("02-library-laptop", { width: 1280, height: 800 }, "/library", async (page) => {
    await page.evaluate(() => localStorage.setItem("lens.orb-universe.continued.v1", "true"));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Your cognitive universe" }).waitFor();
    const orb = await page.locator(".companion-orb").boundingBox();
    if (!orb || orb.width < 110 || orb.x < 360 || orb.x > 820) throw new Error("home orb is not the spatial focal point");
    if (await page.locator(".orb-home-nav,.orb-library-grid").count()) throw new Error("legacy navigation/grid remains visible");
  });
  await shot("03-library-narrow", { width: 390, height: 844 }, "/library", async (page) => {
    await page.evaluate(() => localStorage.setItem("lens.orb-universe.continued.v1", "true"));
    await page.reload({ waitUntil: "networkidle" });
  });
  await shot("04-stage-desktop", { width: 1600, height: 1000 }, "/scene/audit-scene", async (page) => {
    await page.evaluate(() => {
      localStorage.removeItem("lens.orb.cursor.v1");
      document.documentElement.setAttribute("data-lens-orb-cursor-active", "false");
      localStorage.setItem("lens.scenes.v4", JSON.stringify({
        version: 4,
        activeSceneId: "audit-scene",
        scenes: [{
          id: "audit-scene",
          kind: "scene",
          version: 4,
          name: "Audit Scene",
          items: [{ id: "audit-material", type: "text", text: "A grounded Stage material", x: 120, y: 160, frameId: null }],
          nodes: [],
          frames: [],
          orbInstances: [],
          semanticOrbs: Array.from({ length: 20 }, (_, index) => ({
            version: 1,
            id: `audit-orb-${index + 1}`,
            kind: "semantic-orb",
            sceneId: "audit-scene",
            name: `Audit orb ${index + 1}`,
            placement: { x: -280 + index * 10, y: -120 + index * 6, radius: 24 },
            representation: { kind: index % 3 === 0 ? "lens" : "material", refs: [index % 3 === 0 ? "lens-audit" : "audit-material"], label: `Audit orb ${index + 1}`, snapshot: null },
            workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
            parentOrbId: null,
            childOrbIds: [],
            lineage: [],
            provenance: { source: "orb-universe-audit" },
            archived: false,
          })),
          activeSemanticOrbId: null,
          workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
          camera: { x: 0, y: 0, scale: 1 },
        }],
      }));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-semantic-anchor="scene-stage"]').first().waitFor();
    const orb = await page.locator('[data-semantic-anchor="primary-orb"] .companion-orb').boundingBox();
    if (!orb || orb.width < 110) throw new Error("Stage orb is not the primary manipulation handle");
    if (await page.locator(".orb-context-drawer").count()) throw new Error("legacy permanent Stage drawer remains");
    await page.locator(".semantic-orb-cluster").first().waitFor();
    await page.locator(".semantic-orb-cluster").first().click();
    await page.getByRole("button", { name: "New orb" }).first().click();
    await page.locator(".semantic-orb-capsule.active").waitFor();
    await page.waitForFunction(() => {
      const workspace = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
      const scene = workspace?.scenes?.find((entry) => entry.id === "audit-scene");
      return scene?.semanticOrbs?.length === 21 && Boolean(scene.activeSemanticOrbId);
    });
    const activeId = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.scenes.v4")).scenes[0].activeSemanticOrbId);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(`[data-semantic-orb-id="${activeId}"]`).waitFor();
    if (!(await page.locator(`[data-semantic-orb-id="${activeId}"] .semantic-orb-button`).getAttribute("aria-pressed"))) {
      throw new Error("active semantic orb did not survive reload");
    }
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true");
    await page.mouse.move(620, 420);
    const cursor = await page.locator(".orb-cursor-visual").boundingBox();
    if (!cursor || Math.abs(cursor.x + cursor.width / 2 - 620) > 8 || Math.abs(cursor.y + cursor.height / 2 - 420) > 8) {
      throw new Error("web orb cursor does not track the pointer hotspot");
    }
    const nativeCursor = await page.locator(".orb-black-stage").evaluate((node) => getComputedStyle(node).cursor);
    if (nativeCursor !== "none") throw new Error("web native cursor remains visible in orb cursor mode");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "false");
    await page.locator(".companion-orb").click();
    const command = page.getByRole("textbox", { name: "Tell the orb your goal" });
    await command.focus();
    await command.fill("before");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    if (await page.evaluate(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true")) {
      throw new Error("web Triple-Space toggled while editing an orb command");
    }
    if ((await command.inputValue()) !== "before   ") throw new Error("editable Triple-Space did not preserve typed spaces");
    await page.keyboard.press("Escape");
    await page.locator(".orb-black-stage").click({ position: { x: 80, y: 80 } });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('.orb-adaptive-views button[aria-pressed="true"]')?.textContent === "Gallery"
    );
    await page.getByRole("button", { name: "Add to orb context" }).click();
    await page.locator(".orb-context-object").waitFor();
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "Evidence Lens");
      transfer.setData("application/x-lens-object", JSON.stringify({ id: "lens-audit", kind: "lens", name: "Evidence Lens", strength: .75 }));
      document.querySelector(".companion-orb-shell").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.locator(".orb-lens-atmosphere").waitFor();
    const beforeDrop = await page.locator(".orb-stage-materials article").count();
    await page.locator(".orb-context-object").dragTo(page.locator(".orb-black-stage"), { targetPosition: { x: 980, y: 620 } });
    await page.waitForFunction((count) => document.querySelectorAll(".orb-stage-materials article").length > count, beforeDrop);
    await page.getByRole("button", { name: "Table", exact: true }).click();
    await page.locator(".orb-stage-table").waitFor();
  });
  await shot("05-install-reduced-motion", { width: 1280, height: 800 }, "/install", async (page) => {
    const animation = await page.locator(".orb-rays").first().evaluate((node) => getComputedStyle(node).animationName);
    if (animation !== "none") throw new Error(`reduced-motion orb still animates: ${animation}`);
  });
  fs.writeFileSync(path.join(evidence, "web-results.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: browser.version(),
    checks: results,
    passed: results.length,
    failed: 0,
  }, null, 2)}\n`);
  console.log(`Orb web audit passed: ${results.length} route/viewport states.`);
} finally {
  await browser.close();
}
