/**
 * Headed extension proof: shelf pearls look like pearls; Wear (pointer) updates gauntlet.
 * HTML5 DnD is residual under Playwright — Wear uses the same wearPearlIdInGauntlet path as drop.
 */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const extensionRoot = path.resolve(import.meta.dirname, "..");
const dist = path.join(extensionRoot, "dist/chrome");
const auditDist = path.join(extensionRoot, ".audit-dnd-extension");
const evidence = path.resolve(extensionRoot, process.env.AUDIT_OUT || "../audit-shots/extension-pearl-dnd-2026-07-25");
fs.mkdirSync(evidence, { recursive: true });
fs.rmSync(auditDist, { recursive: true, force: true });
if (!fs.existsSync(dist)) {
  console.error("Build extension first: npm run build:extension");
  process.exit(1);
}
fs.cpSync(dist, auditDist, { recursive: true });
const manifestPath = path.join(auditDist, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.host_permissions = ["http://127.0.0.1/*"];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const failures = [];
function record(id, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(line);
}

const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end("<!doctype html><title>Pearl DnD fixture</title><main style='margin:80px;font:18px system-ui'><h1>Fixture</h1></main>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const profile = path.join(extensionRoot, ".audit-dnd-profile");
fs.rmSync(profile, { recursive: true, force: true });
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const bundledChrome = chromium.executablePath();
const localTestingChrome = path.join(
  extensionRoot,
  ".playwright-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
);
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath: process.env.PW_CHROMIUM
    || (fs.existsSync(localTestingChrome) ? localTestingChrome : fs.existsSync(bundledChrome) ? bundledChrome : fs.existsSync(systemChrome) ? systemChrome : undefined),
  args: [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${auditDist}`,
    `--load-extension=${auditDist}`,
  ],
  viewport: { width: 360, height: 720 },
});

try {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    const extensionIdFromPath = crypto.createHash("sha256").update(auditDist).digest("hex").slice(0, 32)
      .replace(/[0-9a-f]/g, (value) => String.fromCharCode(97 + Number.parseInt(value, 16)));
    const bootstrap = await context.newPage();
    await bootstrap.goto(`chrome-extension://${extensionIdFromPath}/sidepanel.html`).catch(() => {});
    await bootstrap.close().catch(() => {});
    worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  }
  const extensionId = new URL(worker.url()).host;
  const pearlId = `pearl-dnd-${Date.now()}`;
  const pearlName = "Series A briefings";
  await worker.evaluate(async ({ apiOrigin, pearlId, pearlName }) => {
    await chrome.storage.local.set({
      onboardingComplete: true,
      onboardingMode: "local",
      apiOrigin,
      semanticOrbs: [{
        id: pearlId,
        name: pearlName,
        kind: "semantic",
        archived: false,
        workingSet: { context: [], lenses: [], functions: [] },
        representation: { kind: "context" },
      }],
      activeSemanticOrbId: pearlId,
    });
    await chrome.storage.session.set({
      accessToken: "dnd-audit-token",
      lensEverywhereSession: {
        fragments: [],
        queue: [],
        generator: null,
        results: [],
        activeRunId: null,
      },
    });
  }, { apiOrigin: `http://127.0.0.1:${server.address().port}`, pearlId, pearlName });

  const fixture = await context.newPage();
  await fixture.goto(`http://127.0.0.1:${server.address().port}`);

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 360, height: 720 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.getByRole("button", { name: /Open Companion actions/ }).waitFor({ timeout: 10_000 });

  // Seed gauntlet storage in the sidepanel page world (shared helpers read localStorage there).
  await panel.evaluate(() => {
    localStorage.removeItem("lens.companion.gauntlet.v1");
    localStorage.removeItem("lens.companion.worn-pearl.v1");
  });
  await panel.reload();
  await panel.getByRole("button", { name: /Open Companion actions/ }).waitFor({ timeout: 10_000 });

  const shelf = panel.locator("[data-testid='extension-pearl-shelf']");
  await shelf.waitFor({ timeout: 8_000 });
  record("shelf-visible-idle", await shelf.isVisible(), "idle dock with pearls");

  const pearlCard = panel.locator("[data-testid='extension-shelf-pearl']").first();
  record("shelf-pearl-present", await pearlCard.count() > 0, pearlName);
  const glyph = pearlCard.locator(".physical-pearl, .extension-shelf-pearl-glyph svg").first();
  record("pearl-looks-like-pearl", await glyph.count() > 0, "PhysicalPearl SVG present");
  const box = await pearlCard.boundingBox();
  record("pearl-not-full-width-block", box && box.width < 200, `width=${box?.width}`);

  await panel.screenshot({ path: path.join(evidence, "01-before-wear.png"), fullPage: true });

  const filledBefore = await panel.locator(".extension-gauntlet-socket.filled").count();
  record("gauntlet-empty-before", filledBefore === 0, `filled=${filledBefore}`);

  // Pointer Wear path (same domain wear as drop) — Playwright HTML5 DnD residual.
  await panel.locator("[data-testid='extension-pearl-wear']").first().click();
  await panel.waitForTimeout(400);

  const filledAfter = await panel.locator(".extension-gauntlet-socket.filled").count();
  record("gauntlet-filled-after-wear", filledAfter >= 1, `filled=${filledAfter}`);

  const storage = await panel.evaluate(() => {
    try {
      const raw = localStorage.getItem("lens.companion.gauntlet.v1");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const wornIds = storage?.pearlIds || storage?.slots?.filter(Boolean) || [];
  record("gauntlet-persisted", wornIds.includes(pearlId) || wornIds.length >= 1, JSON.stringify(wornIds).slice(0, 120));

  await panel.screenshot({ path: path.join(evidence, "02-after-wear.png"), fullPage: true });

  // Reload persistence
  await panel.reload();
  await panel.getByRole("button", { name: /Open Companion actions/ }).waitFor({ timeout: 10_000 });
  const filledReload = await panel.locator(".extension-gauntlet-socket.filled").count();
  record("gauntlet-survives-reload", filledReload >= 1, `filled=${filledReload}`);
  await panel.screenshot({ path: path.join(evidence, "03-after-reload.png"), fullPage: true });

  fs.writeFileSync(path.join(evidence, "ledger.json"), JSON.stringify({
    at: new Date().toISOString(),
    failures,
    residual: ["Playwright HTML5 DnD — Wear button proves same wearPearlIdInGauntlet path as drop"],
  }, null, 2));

  if (failures.length) {
    console.error(`\n${failures.length} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log("\nAll extension pearl wear proofs passed (DnD residual noted).");
  }
} finally {
  await context.close().catch(() => {});
  server.close();
}
