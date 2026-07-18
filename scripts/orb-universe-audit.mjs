import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const evidence = path.resolve(process.env.AUDIT_OUT || "audit-shots/orb-universe-2026-07");
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
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
    await page.locator('[data-semantic-anchor="scene-stage"]').first().waitFor();
    const orb = await page.locator('[data-semantic-anchor="primary-orb"] .companion-orb').boundingBox();
    if (!orb || orb.width < 110) throw new Error("Stage orb is not the primary manipulation handle");
    if (await page.locator(".orb-context-drawer").count()) throw new Error("legacy permanent Stage drawer remains");
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
