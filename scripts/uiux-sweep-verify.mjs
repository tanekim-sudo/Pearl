// Verification sweep for the discoverability/guide/welcome work: human-paced
// first-run journeys against the production build, with screenshots for
// manual inspection.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const out = path.resolve(process.env.AUDIT_OUT || "audit-shots/uiux-sweep-2026-07/verify");
fs.mkdirSync(out, { recursive: true });
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workspaceChrome = path.resolve(".pw-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const executablePath = process.env.PW_CHROMIUM || (fs.existsSync(workspaceChrome) ? workspaceChrome : systemChrome);
const browser = await chromium.launch({ headless: true, executablePath });
const notes = [];

async function journey(name, options, run) {
  const context = await browser.newContext({ colorScheme: "dark", ...options });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  let step = 0;
  const shot = async (label) => {
    step += 1;
    await page.waitForTimeout(400);
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

// 1. Fresh first-time user, desktop root: welcome → guide → try a command
await journey("welcome-desktop", { viewport: { width: 1600, height: 1000 } }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await shot("welcome");
  const welcome = page.locator(".pearl-welcome");
  if (!(await welcome.isVisible())) throw new Error("welcome overlay missing on fresh root");
  await page.getByRole("button", { name: "See how Pearl works" }).click();
  await shot("guide-open");
  const guide = page.locator(".pearl-guide-panel");
  if (!(await guide.isVisible())) throw new Error("guide panel did not open from welcome");
  notes.push({ name: "welcome-desktop", guideSections: await guide.locator("section").count() });
  await page.getByRole("button", { name: /Try “open a new scene”/ }).click();
  await page.waitForTimeout(900);
  await shot("after-try-open-scene");
  notes.push({ name: "welcome-desktop", urlAfterTry: page.url() });
  if (!/\/scene\//.test(page.url())) throw new Error("guide Try button did not open a scene");
  // Empty scene teaching actions
  const empty = page.locator(".orb-stage-empty");
  if (await empty.isVisible()) {
    await shot("empty-scene-actions");
    await page.locator(".orb-stage-empty-actions button", { hasText: "How Pearl works" }).click();
    await shot("guide-on-stage");
    await page.locator(".pearl-guide-panel header button").click();
  }
  // Reload root: welcome should be dismissed (dismissed via action) and guide button present
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await shot("root-after-return");
  notes.push({
    name: "welcome-desktop",
    welcomeAfterAction: await page.locator(".pearl-welcome").count(),
    guideButton: await page.locator(".pearl-guide-button").count(),
  });
});

// 2. Fresh root: dismiss persists across reload; help command opens guide
await journey("welcome-dismiss", { viewport: { width: 1600, height: 1000 } }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Not now — just explore" }).click();
  await shot("after-dismiss");
  await page.reload({ waitUntil: "networkidle" });
  await shot("after-reload");
  if (await page.locator(".pearl-welcome").count()) throw new Error("welcome returned after explicit dismissal");
  // "help" through the pearl opens the guide
  await page.locator(".companion-orb").click();
  await shot("pearl-expanded-quick-actions");
  const quick = await page.locator(".pearl-quick-actions button").allTextContents();
  notes.push({ name: "welcome-dismiss", quickActions: quick });
  const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
  await input.fill("how do I use Pearl?");
  await input.press("Enter");
  await page.waitForTimeout(700);
  await shot("guide-from-command");
  if (!(await page.locator(".pearl-guide-panel").isVisible())) throw new Error("'how do I use Pearl?' did not open guide");
  const record = await page.evaluate(() => localStorage.getItem("lens.pearl.guide.v1"));
  notes.push({ name: "welcome-dismiss", guideRecord: record });
});

// 3. Quick action "How Pearl works" from ledger + welcome hidden while expanded
await journey("quick-actions", { viewport: { width: 1600, height: 1000 } }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.locator(".companion-orb").click();
  await page.waitForTimeout(300);
  notes.push({ name: "quick-actions", welcomeWhileExpanded: await page.locator(".pearl-welcome").isVisible().catch(() => false) });
  await shot("expanded-hides-welcome");
  await page.locator(".pearl-quick-actions button", { hasText: "How Pearl works" }).click();
  await shot("guide-from-quick-action");
  if (!(await page.locator(".pearl-guide-panel").isVisible())) throw new Error("quick action did not open guide");
});

// 4. Empty library teaching actions
await journey("library-empty", { viewport: { width: 1600, height: 1000 } }, async (page, shot) => {
  await page.goto(`${baseUrl}/library`, { waitUntil: "networkidle" });
  await shot("library-empty");
  const actions = await page.locator(".orb-home-intro-actions button").allTextContents();
  notes.push({ name: "library-empty", introActions: actions });
  await page.locator(".orb-home-intro-actions button", { hasText: "How Pearl works" }).click();
  await shot("guide-from-library");
});

// 5. Mobile 390: welcome, guide, no horizontal overflow
await journey("mobile-390", { viewport: { width: 390, height: 844 } }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await shot("welcome-mobile");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  notes.push({ name: "mobile-390", horizontalOverflowPx: overflow });
  await page.getByRole("button", { name: "See how Pearl works" }).click();
  await shot("guide-mobile");
  await page.locator(".pearl-guide-panel header button").click();
  await page.locator(".companion-orb").click();
  await shot("expanded-mobile");
});

// 6. Reduced motion: welcome/guide render instantly with no animations
await journey("reduced-motion", { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" }, async (page, shot) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await shot("welcome-reduced");
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll(".pearl-welcome *, .pearl-welcome")].filter((node) => {
      const style = getComputedStyle(node);
      return style.animationName !== "none" && parseFloat(style.animationDuration) > 0.05;
    }).map((node) => node.className).slice(0, 8)
  );
  notes.push({ name: "reduced-motion", animatedWelcomeNodes: animated });
  await page.getByRole("button", { name: "See how Pearl works" }).click();
  await shot("guide-reduced");
  const animatedGuide = await page.evaluate(() =>
    [...document.querySelectorAll(".pearl-guide-panel, .pearl-guide-panel section")].filter((node) => {
      const style = getComputedStyle(node);
      return style.animationName !== "none" && parseFloat(style.animationDuration) > 0.05;
    }).length
  );
  notes.push({ name: "reduced-motion", animatedGuideNodes: animatedGuide });
});

fs.writeFileSync(path.join(out, "notes.json"), JSON.stringify(notes, null, 2));
console.log("verify sweep done", JSON.stringify(notes, null, 2));
await browser.close();
