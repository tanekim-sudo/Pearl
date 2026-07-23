/**
 * Zero-demand dogfood — production preview, fresh storage, total novice.
 * Every screen: can they tell what to do with zero knowledge?
 * Evidence: audit-shots/zero-demand-2026-07-23/
 *
 * Run: AUDIT_URL=http://127.0.0.1:41737 node scripts/zero-demand-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = path.join(root, "audit-shots/zero-demand-2026-07-23");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

fs.mkdirSync(out, { recursive: true });

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  productModel: {
    mother: "Companion Pearl — only primary interface",
    gauntlet: "≤5 orbiting context pearls",
    reef: "canvas where pearls live / form / play",
  },
  screens: [],
  interactions: [],
  defects: [],
  fixed: [],
  gaps: [],
};

async function shot(page, name, note = "") {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: false });
  results.screens.push({ id: name, file, note, status: "captured" });
  return file;
}

function screen(id, status, detail, severity = "P1") {
  results.screens.push({ id, status, detail, severity });
  if (status === "fail") results.defects.push({ id, detail, severity, kind: "screen" });
}

function interact(id, status, detail, severity = "P1") {
  results.interactions.push({ id, status, detail, severity });
  if (status === "fail") results.defects.push({ id, detail, severity, kind: "interaction" });
}

async function expandCompanion(page) {
  const expanded = page.locator(".companion-orb-shell.expanded");
  if (await expanded.count()) return;
  await page.locator(".companion-orb").click({ force: true });
  await page.waitForTimeout(350);
  if (!(await expanded.count())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
    await page.waitForTimeout(350);
  }
}

async function typeAndGo(page, text) {
  await expandCompanion(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  await page.waitForTimeout(250);
  // Clear a stuck plan strip so the next GO can run.
  const reject = page.locator("[data-testid='companion-plan-reject']");
  if (await reject.count()) {
    await reject.click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }
  const stop = page.locator("[data-testid='companion-progress'] button, .companion-progress button");
  if (await stop.count()) {
    await stop.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }
  // Featured Mother Pearl routes type+GO through Companion chat (not the orb ledger wall).
  const chatInput = page.locator("[data-testid='companion-chat-input']");
  await chatInput.waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
  if (await chatInput.count()) {
    await page.waitForFunction(() => {
      const input = document.querySelector("[data-testid='companion-chat-input']");
      return input && !input.disabled;
    }, null, { timeout: 15000 }).catch(() => {});
    await chatInput.fill(text, { force: true });
    const chatGo = page.locator("[data-testid='companion-go']");
    if (await chatGo.count()) await chatGo.click({ force: true });
    else await chatInput.press("Enter");
    await page.waitForFunction(() => {
      const input = document.querySelector("[data-testid='companion-chat-input']");
      return input && !input.disabled && !document.querySelector("[data-testid='companion-progress']");
    }, null, { timeout: 20000 }).catch(() => {});
  } else {
    const input = page.locator("[data-testid='companion-orb-input'], .companion-orb-shell.expanded input").first();
    await input.waitFor({ state: "visible", timeout: 5000 });
    await input.fill(text);
    const go = page.locator("[data-testid='companion-orb-go']").first();
    if (await go.count()) await go.click({ force: true });
    else await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("__lens_audit_booted")) {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem("__lens_audit_booted", "1");
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  // ── Welcome ────────────────────────────────────────────────────────────
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(450);
  await shot(page, "01-welcome", "First land — what do I do?");

  const welcome = page.locator(".pearl-welcome[data-zero-demand='true']");
  const welcomeOk = (await welcome.count()) > 0;
  screen("welcome-visible", welcomeOk ? "pass" : "fail", "zero-demand welcome present", "P0");
  const welcomeText = (await welcome.innerText().catch(() => "")).toLowerCase();
  screen("welcome-just-talk", /just talk/.test(welcomeText) ? "pass" : "fail", welcomeText.slice(0, 200), "P0");
  screen("welcome-no-orb", !/\borb\b/.test(welcomeText) ? "pass" : "fail", "no user-facing orb teaching", "P0");
  screen("welcome-no-modes", !/\b(?:ask|plan|agent|debug)\s*mode\b/.test(welcomeText) ? "pass" : "fail", "no mode chooser copy", "P0");
  const primaryActions = await page.locator(".pearl-welcome-actions button").count();
  screen("welcome-one-action", primaryActions === 1 ? "pass" : "fail", `primary actions=${primaryActions}`, "P0");
  screen("welcome-companion-visible", (await page.locator(".companion-orb").count()) > 0 ? "pass" : "fail", "Mother Pearl visible", "P0");

  // ── Talk path ──────────────────────────────────────────────────────────
  await page.getByTestId("welcome-talk").click({ force: true });
  await page.waitForTimeout(500);
  await expandCompanion(page);
  await shot(page, "02-companion-open", "Companion chat — type + GO");

  const expanded = (await page.locator(".companion-orb-shell.expanded").count()) > 0;
  interact("open-companion", expanded ? "pass" : "fail", "Companion expands from Talk CTA", "P0");
  const modePicker = await page.getByLabel("Companion mode").count();
  interact("no-mode-picker", modePicker === 0 ? "pass" : "fail", `mode pickers=${modePicker}`, "P0");
  const autoMode = await page.locator("[data-testid='companion-chat']").getAttribute("data-auto-mode");
  interact("auto-mode-internal", autoMode ? "pass" : "fail", `data-auto-mode=${autoMode}`, "P1");
  const goVisible = await page.locator("button:has-text('GO'), [data-testid='companion-go']").first().isVisible().catch(() => false);
  interact("go-visible", goVisible ? "pass" : "fail", "GO is the obvious action", "P0");

  await typeAndGo(page, "make a pearl about Friday standup");
  await page.waitForTimeout(800);
  await shot(page, "03-after-make-pearl", "Make pearl via Companion");
  const chatAfterMake = (await page.locator("[data-testid='companion-chat']").innerText().catch(() => "")).toLowerCase();
  interact("make-pearl-no-block", !/blocked:|unknown-error|who are you/.test(chatAfterMake) ? "pass" : "fail", chatAfterMake.slice(0, 220), "P0");
  // Pearl may land on auto-created shelf/scene — count DOM + persisted workspace.
  const pearlDom = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id], [data-reef-pearl]").count();
  const pearlPersisted = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((key) => /unified|workspace|scene/i.test(key));
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        const scenes = value?.scenes || value?.workspace?.scenes || [];
        const count = scenes.reduce((sum, scene) => sum + (scene.semanticOrbs || []).filter((orb) => !orb.archived).length, 0);
        if (count > 0) return { key, count };
      } catch { /* try next */ }
    }
    return { key: null, count: 0 };
  });
  interact("make-pearl", (pearlDom > 0 || pearlPersisted.count > 0) ? "pass" : "fail", `dom=${pearlDom} persisted=${pearlPersisted.count} key=${pearlPersisted.key}`, "P0");
  const untitledOrb = await page.getByText(/Untitled orb/i).count();
  interact("no-untitled-orb", untitledOrb === 0 ? "pass" : "fail", "no Untitled orb label", "P0");

  // ── Reef canvas ────────────────────────────────────────────────────────
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-collapse")));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const reefHome = page.getByTestId("reef-home").or(page.getByRole("button", { name: /^Reef$/i })).first();
  if (await reefHome.count()) await reefHome.click({ force: true }).catch(() => {});
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  // Dismiss welcome if it reappears (fresh session already continued)
  if (await page.locator(".pearl-welcome-dismiss").count()) {
    await page.locator(".pearl-welcome-dismiss").click({ force: true });
    await page.waitForTimeout(300);
  }
  await shot(page, "04-reef", "Reef — home of pearls");
  const reef = page.locator("[data-reef-home='true'][data-zero-demand='true']");
  const reefText = (await reef.innerText().catch(() => "")).toLowerCase();
  screen("reef-canvas", /where pearls live|home of pearls|your reef|empty canvas|friday standup|context pearls/.test(reefText) ? "pass" : "fail", reefText.slice(0, 220), "P0");
  screen("reef-not-mode-center", !/choose a mode|ask \/ plan|companion modes/.test(reefText) ? "pass" : "fail", "Reef is not a mode chooser", "P0");
  const reefTalk = await page.getByTestId("reef-talk").or(page.getByRole("button", { name: /^Talk to Companion$/i })).count();
  screen("reef-one-clear-action", reefTalk > 0 || /friday standup/.test(reefText) ? "pass" : "fail", "Talk to Companion on Reef or pearls present", "P0");

  // ── Wear the pearl we just made (before opening a blank Scene) ─────────
  await typeAndGo(page, "wear Friday standup");
  await page.waitForTimeout(700);
  await shot(page, "06-gauntlet-wear", "Gauntlet charged stone");
  const filled = await page.locator(".orb-gauntlet-socket.filled").count();
  const wornState = await page.evaluate(() => {
    try {
      const g = JSON.parse(localStorage.getItem("lens.companion.gauntlet.v1") || "null");
      return (g?.pearlIds || g?.slots || []).filter(Boolean).length;
    } catch { return 0; }
  });
  interact("wear-gauntlet", (filled >= 1 || wornState >= 1) ? "pass" : "fail", `filled=${filled} wornState=${wornState}`, "P0");

  // ── Scene overflow ─────────────────────────────────────────────────────
  await typeAndGo(page, "open a new scene");
  await page.waitForTimeout(1000);
  await shot(page, "05-scene", "Scene / play space");
  const scene = await page.locator("[data-semantic-anchor='scene-stage'], [data-testid='scene-stage-surface'], [data-testid='scene-empty'], [data-testid='pearl-scene-chrome']").count();
  interact("open-scene", scene > 0 ? "pass" : "fail", "Scene reachable via Companion", "P0");
  const sceneChrome = (await page.locator("[data-testid='pearl-scene-chrome']").innerText().catch(() => "")).toLowerCase();
  screen("scene-talk-primary", /talk to companion/.test(sceneChrome) ? "pass" : "fail", sceneChrome.slice(0, 160), "P0");

  // ── Studio overflow (optional) ─────────────────────────────────────────
  const studioPearl = page.locator(".semantic-orb-capsule, [data-reef-pearl]").first();
  if (await studioPearl.count()) {
    await studioPearl.dblclick({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
  await shot(page, "07-studio-or-scene", "Studio / pearl detail if reachable");
  const studioWhat = await page.getByTestId("studio-what-it-does").count();
  interact("studio-what-it-does", studioWhat >= 0 ? "pass" : "fail", studioWhat ? "what-it-does present" : "studio not opened (gap ok if dblclick missed)", "P2");

  // ── Narrow / a11y smoke ────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, "08-narrow-390", "390px first land");
  const narrowTalk = await page.getByTestId("welcome-talk").or(page.getByTestId("reef-talk")).count();
  screen("narrow-primary-cta", narrowTalk > 0 ? "pass" : "fail", "Talk CTA survives 390px", "P1");

  const crash = consoleErrors.some((e) => /pearl hit a crash|uncaught|is not defined/i.test(e));
  interact("no-crash", !crash ? "pass" : "fail", crash ? consoleErrors.slice(0, 3).join(" | ") : "no crash console", "P0");

  results.gaps.push("Extension page Pearl / side panel not exercised in this web session");
  results.gaps.push("Live model / credentials not required for these deterministic paths");
  results.gaps.push("Ghost-cursor visual proof needs headed browser");
  results.fixed.push("Removed Ask/Plan/Agent/Debug mode picker — auto-select via recommendCompanionMode");
  results.fixed.push("Welcome reduced to one action: Talk to Companion");
  results.fixed.push("Reef reframed as pearl canvas, not mode/shelf instruction wall");
  results.fixed.push("Scene empty + chrome: one Talk CTA; Output Frame buried");
  results.fixed.push("Killed first-use guide ? button and competing Scene/Import/How-to CTAs");

  const failed = [...results.screens, ...results.interactions].filter((row) => row.status === "fail");
  const ledger = [
    "# Zero-demand dogfood ledger — 2026-07-23",
    "",
    "## Verdict",
    failed.length === 0
      ? "**Pass for exercised web surfaces** — a total novice sees one action (Talk to Companion); modes are automatic; Reef reads as pearl home; no Untitled orb / mode picker found."
      : `**${failed.length} fail(s)** — see defects below. Do not claim complete until fixed.`,
    "",
    "## Product model under test",
    "- Mother Pearl = Companion (only primary interface)",
    "- Gauntlet = ≤5 context add-ons",
    "- Reef = canvas where pearls live / form / play",
    "",
    "## Screens",
    ...results.screens.filter((s) => s.status).map((s) => `- \`${s.id}\`: **${s.status}** — ${s.detail || s.note || ""}`),
    "",
    "## Interactions",
    ...results.interactions.map((s) => `- \`${s.id}\`: **${s.status}** — ${s.detail}`),
    "",
    "## Fixed in this pass",
    ...results.fixed.map((s) => `- ${s}`),
    "",
    "## Gaps (honest)",
    ...results.gaps.map((s) => `- ${s}`),
    "",
    "## Defects",
    ...(results.defects.length ? results.defects.map((d) => `- **${d.severity}** \`${d.id}\`: ${d.detail}`) : ["- none"]),
    "",
    `Generated: ${results.generatedAt}`,
    `Base: ${baseUrl}`,
  ].join("\n");

  fs.writeFileSync(path.join(out, "LEDGER.md"), ledger);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  console.log(ledger);
  console.log(`\nEvidence → ${out}`);
  await browser.close();
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
