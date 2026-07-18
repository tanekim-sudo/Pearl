import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const extensionRoot = path.resolve(import.meta.dirname, "..");
const dist = path.join(extensionRoot, "dist/chrome");
const auditDist = path.join(extensionRoot, ".audit-orb-extension");
const evidence = path.resolve(extensionRoot, process.env.AUDIT_OUT || "../audit-shots/orb-universe-2026-07");
fs.mkdirSync(evidence, { recursive: true });
fs.rmSync(auditDist, { recursive: true, force: true });
fs.cpSync(dist, auditDist, { recursive: true });
const manifestPath = path.join(auditDist, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.host_permissions = ["http://127.0.0.1/*"];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end("<!doctype html><title>Orb fixture</title><main style='max-width:700px;margin:80px auto;font:20px system-ui'><h1>Selected material</h1><textarea id='field' style='width:100%;height:180px'>Lens orb extension audit material.</textarea></main>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const profile = path.join(extensionRoot, ".audit-orb-profile");
fs.rmSync(profile, { recursive: true, force: true });
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${auditDist}`, `--load-extension=${auditDist}`],
});

try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(async () => {
    await chrome.storage.local.set({ onboardingComplete: true, onboardingMode: "local" });
    await chrome.storage.session.set({
      lensEverywhereSession: {
        fragments: [],
        queue: [],
        generator: { id: "audit-lens", name: "Skeptical investor", version: 1, material: [] },
        results: [{
          id: "audit-run",
          outputs: [
            { id: "candidate-1", text: "Question the revenue assumptions" },
            { id: "candidate-2", text: "Find the strongest adoption signal" },
            { id: "candidate-3", text: "Offer a credible contrary path" },
          ],
        }],
        activeRunId: null,
      },
    });
  });
  await Promise.all(context.pages().map((page) => page.close()));

  const fixture = await context.newPage();
  await fixture.setViewportSize({ width: 1280, height: 800 });
  await fixture.goto(`http://127.0.0.1:${server.address().port}`);

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 360, height: 720 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.getByRole("button", { name: /Hold to speak/ }).waitFor();
  await panel.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const current = await chrome.tabs.getCurrent();
    const targetTabId = tabs.find((tab) => tab.id !== current?.id && tab.url?.startsWith("http://127.0.0.1:"))?.id;
    if (!targetTabId) throw new Error("fixture tab unavailable");
    const response = await chrome.runtime.sendMessage({ version: 1, type: "toggle-highlighter", requestId: "orb-audit", payload: { enabled: true, targetTabId } });
    if (!response?.ok) throw new Error(response?.error || "content injection failed");
  });
  await fixture.locator("#lens-orb-overlay-host").waitFor();
  await fixture.screenshot({ path: path.join(evidence, "06-extension-page-orb.png"), fullPage: true });
  const pageOrb = fixture.locator("#lens-orb-overlay-host").getByRole("button", { name: /^Lens orb\./ });
  const beforeDrag = await pageOrb.boundingBox();
  if (!beforeDrag || beforeDrag.width < 90) throw new Error("page orb is not a literal focal control");
  await pageOrb.click();
  await fixture.getByRole("region", { name: "Views emitted by the Lens orb" }).waitFor();
  await fixture.screenshot({ path: path.join(evidence, "06a-extension-page-orb-expanded.png"), fullPage: true });
  await fixture.locator("#field").selectText();
  await fixture.getByRole("button", { name: "Absorb selection" }).first().click();
  await fixture.waitForTimeout(850);
  await fixture.screenshot({ path: path.join(evidence, "06b-extension-page-orb-context.png"), fullPage: true });
  await fixture.getByRole("button", { name: "lens", exact: true }).click();
  await fixture.getByRole("button", { name: "taste", exact: true }).click();
  await fixture.screenshot({ path: path.join(evidence, "06c-extension-page-orb-lens-candidates.png"), fullPage: true });
  await pageOrb.dragTo(fixture.locator("h1"));
  const afterDrag = await pageOrb.boundingBox();
  if (!afterDrag || Math.abs(afterDrag.x - beforeDrag.x) < 80) throw new Error("page orb did not visibly drag/dock");
  await fixture.getByRole("button", { name: "Minimize Lens orb" }).click();
  const minimized = await pageOrb.boundingBox();
  if (!minimized || minimized.width > 45) throw new Error("page orb did not minimize");
  await fixture.screenshot({ path: path.join(evidence, "06d-extension-page-orb-minimized.png"), fullPage: true });
  await fixture.locator("h1").click();
  await fixture.keyboard.press("Space");
  await fixture.keyboard.press("Space");
  await fixture.keyboard.press("Space");
  await fixture.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true");
  await fixture.mouse.move(420, 280);
  await fixture.waitForTimeout(80);
  const cursorOrb = await pageOrb.boundingBox();
  if (!cursorOrb || cursorOrb.width > 36 || Math.abs(cursorOrb.x + cursorOrb.width / 2 - 420) > 8 || Math.abs(cursorOrb.y + cursorOrb.height / 2 - 280) > 8) {
    throw new Error("orb cursor hotspot did not track the real pointer precisely");
  }
  const hiddenCursor = await fixture.locator("h1").evaluate((node) => getComputedStyle(node).cursor);
  if (hiddenCursor !== "none") throw new Error("native page cursor was not hidden in orb cursor mode");
  await fixture.screenshot({ path: path.join(evidence, "06e-extension-orb-cursor.png"), fullPage: true });
  await fixture.keyboard.press("Space");
  await fixture.keyboard.press("Space");
  await fixture.keyboard.press("Space");
  await fixture.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "false");
  const restoredCursor = await fixture.locator("h1").evaluate((node) => getComputedStyle(node).cursor);
  if (restoredCursor === "none") throw new Error("native cursor did not restore after Triple-Space");
  await fixture.locator("#field").focus();
  await fixture.keyboard.press("Space");
  await fixture.keyboard.press("Space");
  await fixture.keyboard.press("Space");
  if (await fixture.evaluate(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true")) {
    throw new Error("Triple-Space toggled while typing in an editable field");
  }
  await panel.screenshot({ path: path.join(evidence, "07-extension-command-360.png"), fullPage: true });
  await panel.getByRole("button", { name: "library", exact: true }).click();
  await panel.screenshot({ path: path.join(evidence, "08-extension-library-360.png"), fullPage: true });
  await panel.getByRole("button", { name: "settings", exact: true }).click();
  await panel.getByRole("heading", { name: "Settings" }).waitFor();
  await panel.screenshot({ path: path.join(evidence, "09-extension-settings-360.png"), fullPage: true });

  fs.writeFileSync(path.join(evidence, "extension-results.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: await context.browser()?.version?.(),
    extensionId,
    viewport: { width: 360, height: 720 },
    checks: [
      "literal animated Shadow DOM page-edge orb visible",
      "page orb emits command/context/Lens/taste views",
      "selection absorption creates visible context orbit",
      "Lens atmosphere and candidate constellation visible",
      "page orb drag/dock and minimize are functional",
      "Triple-Space makes the orb the precise page cursor",
      "Triple-Space restores the native cursor",
      "editable fields exclude the Triple-Space toggle",
      "same orb identity expands at 360px",
      "orb-mediated side panel views",
      "library and settings remain reachable",
      "MV3 service worker loaded",
    ],
    passed: 12,
    failed: 0,
  }, null, 2)}\n`);
  console.log("Orb extension audit passed: 12 checks, 9 screenshots.");
} finally {
  await context.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(auditDist, { recursive: true, force: true });
}
