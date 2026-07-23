/**
 * Companion-first simple dogfood — welcome, Reef shelf, Scene, Companion gauntlet.
 * Evidence: audit-shots/companion-first-simple-2026-07-22/
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = path.join(root, "audit-shots/companion-first-simple-2026-07-22");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

fs.mkdirSync(out, { recursive: true });

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  screenshots: [],
  defects: [],
  gaps: [],
};

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: false });
  results.screenshots.push(file);
}

function record(id, ok, detail, severity = "P1") {
  results.checks.push({ id, status: ok ? "pass" : "fail", detail, severity });
  if (!ok) results.defects.push({ id, detail, severity });
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
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, "01-welcome-companion-first");
  const welcome = await page.locator(".pearl-welcome[data-companion-first='true']");
  record("welcome-visible", await welcome.count() > 0, "welcome companion-first");
  const welcomeText = (await welcome.innerText().catch(() => "")).toLowerCase();
  record("welcome-teaches-companion", /companion pearl/.test(welcomeText) && /gauntlet|context pearls/.test(welcomeText), welcomeText.slice(0, 180));
  record("welcome-no-dual-teaching", !/two pearls competing|competing companions/.test(welcomeText), "no competing-companion copy");
  record("welcome-primary-cta", await page.getByRole("button", { name: /Click Companion → type → press GO/i }).count() > 0, "primary Next CTA");

  await page.locator(".pearl-welcome-dismiss").click({ force: true });
  await page.locator(".pearl-welcome").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  await shot(page, "02-reef-shelf");
  const reef = page.locator("[data-reef-home='true'][data-companion-first='true']");
  record("reef-shelf", await reef.count() > 0, "reef marked companion-first");
  const reefText = (await reef.innerText().catch(() => "")).toLowerCase();
  record("reef-shelf-copy", /shelf of context pearls|companion pearl/.test(reefText), reefText.slice(0, 200));
  record("reef-not-second-app", /not a second app|shelf/.test(reefText), "shelf framing");

  await page.locator(".companion-orb").click();
  await page.waitForTimeout(350);
  await shot(page, "03-companion-expanded");
  record("companion-expanded", await page.locator(".companion-orb-shell.expanded").count() > 0, "companion open");
  const legend = (await page.locator("[data-testid='gauntlet-legend']").innerText().catch(() => "")).toLowerCase();
  record("gauntlet-legend", /gauntlet|context pearls/.test(legend), legend);
  const sockets = await page.locator(".orb-gauntlet-socket").count();
  record("gauntlet-sockets", sockets === 5, `sockets=${sockets}`);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await page.locator(".companion-orb-shell.expanded").count()) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-collapse")));
    await page.waitForTimeout(200);
  }
  // Prefer companion intent so Scene opens without depending on reef card hit-targets.
  await page.locator(".companion-orb").click();
  await page.waitForTimeout(200);
  const navInput = page.locator(".companion-orb-shell.expanded input, .orb-ledger input").first();
  await navInput.fill("open a new scene");
  await page.keyboard.press("Enter");
  await page.locator("[data-semantic-anchor='scene-stage']").waitFor({ timeout: 10000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-collapse")));
  await page.waitForTimeout(250);
  await shot(page, "04-scene-empty-companion-first");
  const chrome = page.locator("[data-testid='pearl-scene-chrome']");
  const chromeText = (await chrome.innerText().catch(() => "")).toLowerCase();
  record("scene-chrome-companion", /open companion/.test(chromeText), chromeText.slice(0, 160));
  record("scene-output-secondary", /output frame/.test(chromeText) && !/open output frame.*open companion/i.test(chromeText), "Output Frame present but not primary teaching");
  const empty = (await page.locator("[data-testid='scene-empty']").innerText().catch(() => "")).toLowerCase();
  record("scene-empty-companion", /ask the companion|open companion/.test(empty), empty.slice(0, 160));

  await page.getByRole("button", { name: /^Create a context pearl$/i }).first().click({ force: true });
  await page.waitForTimeout(700);
  if (await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count() === 0) {
    await page.getByTestId("scene-place-pearl").click({ force: true });
    await page.waitForTimeout(700);
  }
  if (await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count() === 0) {
    await page.locator("[data-testid='scene-stage-surface']").dblclick({ force: true, position: { x: 420, y: 280 } });
    await page.waitForTimeout(700);
  }
  await shot(page, "05-context-pearl-on-scene");
  const pearls = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count();
  record("context-pearl-created", pearls > 0, `pearls=${pearls}`);

  await page.locator(".companion-orb").click();
  await page.waitForTimeout(200);
  const input = page.locator(".companion-orb-shell.expanded input, .orb-ledger input").first();
  await input.fill("wear this pearl");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1100);
  await shot(page, "06-wear-from-scene");
  const filled = await page.locator(".orb-gauntlet-socket.filled").count();
  const frameOpen = await page.locator("[data-output-frame='open']").count() > 0;
  record("wear-without-output-frame", filled >= 1 && !frameOpen, `filled=${filled}; frameOpen=${frameOpen}`);

  await page.keyboard.press("Escape");
  await page.getByTestId("scene-home").click({ force: true });
  await page.locator("[data-reef-home='true']").waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, "07-reef-return-shelf");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await shot(page, "08-reef-narrow-390");
  record("narrow-companion-present", await page.locator(".companion-orb").count() > 0, "390px companion");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("zoom", "2");
  });
  await page.waitForTimeout(200);
  await shot(page, "09-reef-zoom-200");
  await page.evaluate(() => {
    document.documentElement.style.removeProperty("zoom");
  });

  // Extension sidepanel static copy check (built HTML if present)
  const sidepanelSrc = fs.readFileSync(path.join(root, "extension/src/sidepanel/main.jsx"), "utf8");
  record("extension-shelf-copy", /Not rival companions/.test(sidepanelSrc), "sidepanel shelf teaches gauntlet equip");
  record("extension-companion-aria", /Open Companion actions/.test(sidepanelSrc), "companion aria");

  results.gaps.push(
    "Loaded Chrome extension page Pearl / sidepanel UI not exercised in this browser session (source + web dogfood only).",
    "Live model / credential paths not verified.",
  );
  if (consoleErrors.length) {
    results.gaps.push(`Console errors observed: ${consoleErrors.slice(0, 5).join(" | ")}`);
  }

  const ledger = [
    "# Companion-first simple audit — 2026-07-22",
    "",
    `Base: ${baseUrl}`,
    "",
    "## Checks",
    ...results.checks.map((c) => `- [${c.status === "pass" ? "x" : " "}] ${c.id} (${c.severity}) — ${c.detail}`),
    "",
    "## Screenshots",
    ...results.screenshots.map((f) => `- ${f}`),
    "",
    "## Gaps",
    ...results.gaps.map((g) => `- ${g}`),
    "",
    `## Defects: ${results.defects.length}`,
    ...results.defects.map((d) => `- ${d.severity} ${d.id}: ${d.detail}`),
  ].join("\n");
  fs.writeFileSync(path.join(out, "LEDGER.md"), ledger);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));

  await browser.close();
  const failed = results.defects.length;
  console.log(JSON.stringify({ ok: failed === 0, failed, shots: results.screenshots.length, out }, null, 2));
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
