// Exploratory UI/UX sweep: capture human-paced first-run journeys for manual inspection.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const out = path.resolve(process.env.AUDIT_OUT || "audit-shots/uiux-sweep-2026-07/explore");
fs.mkdirSync(out, { recursive: true });
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workspaceChrome = path.resolve(".pw-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const executablePath = process.env.PW_CHROMIUM || (fs.existsSync(workspaceChrome) ? workspaceChrome : systemChrome);
const browser = await chromium.launch({ headless: true, executablePath });
const notes = [];

async function journey(name, viewport, run) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  let step = 0;
  const shot = async (label) => {
    step += 1;
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${name}-${String(step).padStart(2, "0")}-${label}.png`) });
  };
  try {
    await run(page, shot);
  } catch (error) {
    notes.push({ name, error: error.message });
    try { await page.screenshot({ path: path.join(out, `${name}-ERROR.png`) }); } catch {}
  }
  if (errors.length) notes.push({ name, consoleErrors: errors.slice(0, 10) });
  await context.close();
}

// 1. Fresh first-time user, desktop root
await journey("desktop-fresh", { width: 1600, height: 1000 }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await shot("landing");
  await page.locator(".companion-orb").click();
  await shot("pearl-clicked");
  await page.keyboard.press("Escape");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await page.waitForTimeout(300);
  await shot("cmdk-search");
  const box = page.getByRole("searchbox", { name: /Search every Pearl action/ });
  if (await box.count()) { await box.fill("scene"); await shot("cmdk-scene-results"); }
  await page.keyboard.press("Escape");
  // Try typing a command
  await page.locator(".companion-orb").click();
  const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
  await input.fill("open a new scene");
  await input.press("Enter");
  await page.waitForTimeout(800);
  await shot("after-open-scene-command");
});

// 2. Fresh library
await journey("desktop-library", { width: 1600, height: 1000 }, async (page, shot) => {
  await page.goto(`${baseUrl}/library`, { waitUntil: "networkidle" });
  await shot("library-empty");
  // emitted library view via companion
  await page.locator(".companion-orb").click();
  const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
  await input.fill("show my saved library");
  await input.press("Enter");
  await page.waitForTimeout(600);
  await shot("library-emitted");
});

// 3. Scene stage: empty state + orbs + studio
await journey("desktop-scene", { width: 1600, height: 1000 }, async (page, shot) => {
  await page.goto(`${baseUrl}/scene/sweep-scene`, { waitUntil: "networkidle" });
  await shot("scene-first-load");
  // The output frame may be visible; check what is default
  const frameVisible = await page.locator('[data-semantic-anchor="output-frame"]:not([hidden])').count();
  notes.push({ name: "desktop-scene", frameVisibleOnLoad: frameVisible });
  await page.locator(".orb-black-stage").dblclick({ position: { x: 800, y: 500 } }).catch(() => {});
  await shot("after-dblclick-create-orb");
  // click orb expecting inspector
  const capsule = page.locator(".semantic-orb-capsule .semantic-orb-button").first();
  if (await capsule.count()) { await capsule.click(); await shot("orb-inspector"); }
  // companion emitted scene controls
  await page.locator(".companion-orb").click();
  const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
  await input.fill("show me the scene controls");
  await input.press("Enter");
  await page.waitForTimeout(600);
  await shot("scene-controls-emitted");
});

// 4. 390px mobile root and scene
await journey("mobile-390", { width: 390, height: 844 }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await shot("landing");
  await page.locator(".companion-orb").click();
  await shot("pearl-clicked");
  await page.keyboard.press("Escape");
  await page.goto(`${baseUrl}/install`, { waitUntil: "networkidle" });
  await shot("install");
});

// 5. Studio via triple-click simulation (Shift+Enter keyboard path)
await journey("desktop-studio", { width: 1600, height: 1000 }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.locator(".companion-orb").focus();
  await page.keyboard.press("Shift+Enter");
  await page.waitForTimeout(1200);
  await shot("studio-after-shift-enter");
  notes.push({ name: "desktop-studio", pages: (await page.context().pages()).map((p) => p.url()) });
  const pages = page.context().pages();
  if (pages.length > 1) {
    const studio = pages[pages.length - 1];
    await studio.waitForLoadState("networkidle").catch(() => {});
    await studio.waitForTimeout(700);
    await studio.screenshot({ path: path.join(out, "desktop-studio-02-studio-window.png") });
  }
});

fs.writeFileSync(path.join(out, "notes.json"), JSON.stringify(notes, null, 2));
console.log("explore done", JSON.stringify(notes, null, 2));
await browser.close();
