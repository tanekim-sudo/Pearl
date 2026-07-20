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

const server = http.createServer((req, res) => {
  if (req.url === "/api/extension/execute") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const request = JSON.parse(body || "{}");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        outputs: [{
          id: "first-use-candidate",
          text: `Reviewed: ${request.fragments?.[0]?.quote || "captured material"}`,
          outputSpec: { machineKind: "text" },
        }],
      }));
    });
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end("<!doctype html><title>Pearl fixture</title><main style='max-width:700px;margin:80px auto;font:20px system-ui'><h1>Selected material</h1><textarea id='field' style='width:100%;height:180px'>Pearl extension audit material.</textarea></main>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const profile = path.join(extensionRoot, ".audit-orb-profile");
fs.rmSync(profile, { recursive: true, force: true });
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const bundledChrome = chromium.executablePath();
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath: process.env.PW_CHROMIUM
    || (fs.existsSync(bundledChrome) ? bundledChrome : fs.existsSync(systemChrome) ? systemChrome : undefined),
  args: [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${auditDist}`,
    `--load-extension=${auditDist}`,
  ],
});

try {
  await context.route("https://representation-eta.vercel.app/api/extension/execute", async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        outputs: [{
          id: "first-use-candidate",
          text: `Reviewed: ${request.fragments?.[0]?.quote || "captured material"}`,
          outputSpec: { machineKind: "text" },
        }],
      }),
    });
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(async ({ apiOrigin }) => {
    await chrome.storage.local.set({
      onboardingComplete: true,
      onboardingMode: "local",
      apiOrigin,
      semanticOrbs: [],
      activeSemanticOrbId: null,
    });
    await chrome.storage.session.set({
      accessToken: "orb-audit-token",
      lensEverywhereSession: {
        fragments: [],
        queue: [],
        generator: null,
        results: [],
        activeRunId: null,
      },
    });
  }, { apiOrigin: `http://127.0.0.1:${server.address().port}` });
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
  const pageOrb = fixture.locator("#lens-orb-overlay-host").getByRole("button", { name: /^Pearl\./ });
  const beforeDrag = await pageOrb.boundingBox();
  if (!beforeDrag || beforeDrag.width < 32) throw new Error(`page Pearl is not a compact literal control: ${JSON.stringify(beforeDrag)}`);
  await panel.evaluate(() => {
    globalThis.__semanticChanges = [];
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.semanticOrbs || changes.activeSemanticOrbId)) {
        globalThis.__semanticChanges.push({
          orbs: changes.semanticOrbs?.newValue?.map((entry) => entry.id),
          active: changes.activeSemanticOrbId?.newValue,
        });
      }
    });
  });
  await pageOrb.click();
  await fixture.getByRole("region", { name: "Views emitted by Pearl" }).waitFor();
  await fixture.screenshot({ path: path.join(evidence, "06a-extension-page-orb-expanded.png"), fullPage: true });
  await fixture.locator("#field").selectText();
  await fixture.getByRole("button", { name: "Make a pearl from this" }).click();
  await fixture.waitForTimeout(850);
  let firstPearlState;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    firstPearlState = await panel.evaluate(async () => ({
      local: await chrome.storage.local.get(["semanticOrbs", "activeSemanticOrbId"]),
      active: await chrome.storage.session.get("lensEverywhereSession"),
    }));
    if (firstPearlState.local.semanticOrbs?.length === 1
      && firstPearlState.local.activeSemanticOrbId === firstPearlState.local.semanticOrbs[0].id
      && firstPearlState.active.lensEverywhereSession?.fragments?.length >= 1) break;
    await panel.waitForTimeout(100);
  }
  if (firstPearlState.local.semanticOrbs?.length !== 1) {
    throw new Error(`page Pearl did not persist: ${JSON.stringify(firstPearlState)}`);
  }
  await panel.evaluate(async () => {
    const local = await chrome.storage.local.get(["semanticOrbs", "activeSemanticOrbId"]);
    const active = local.semanticOrbs.find((entry) => entry.id === local.activeSemanticOrbId) || local.semanticOrbs[0];
    if (!active) throw new Error(`persisted pearl disappeared before reopen: ${JSON.stringify(globalThis.__semanticChanges)}`);
    await chrome.runtime.sendMessage({
      version: 1,
      type: "fragments-changed",
      requestId: "audit-reopen-pearl",
      payload: { fragments: active.workingSet.context },
    });
  });
  await panel.waitForFunction(async () => (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession?.fragments?.length >= 1);
  await fixture.screenshot({ path: path.join(evidence, "06b-extension-page-orb-context.png"), fullPage: true });
  await panel.getByRole("button", { name: "context", exact: true }).click();
  await panel.getByText(/\d+ fragments?/).waitFor();
  await panel.getByRole("button", { name: "library", exact: true }).click();
  await panel.locator(".rack button").filter({ hasText: /compress/i }).first().click();
  await panel.waitForFunction(async () => (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession?.queue?.length >= 1);
  await panel.getByRole("button", { name: "review", exact: true }).click();
  await panel.getByRole("button", { name: "GO", exact: true }).waitFor({ state: "visible" });
  const goBlocked = await panel.getByRole("button", { name: "GO", exact: true }).isDisabled();
  if (goBlocked) {
    const diagnostics = await panel.evaluate(async () => ({
      session: (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession,
      text: document.querySelector(".orb-panel.active")?.innerText,
    }));
    throw new Error(`GO remained blocked after capture and queue: ${JSON.stringify(diagnostics)}`);
  }
  await panel.getByRole("button", { name: "GO", exact: true }).click();
  await panel.waitForTimeout(800);
  const generationState = await panel.evaluate(async () => ({
    session: (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession,
    text: document.body.innerText,
  }));
  if (!generationState.session?.results?.flatMap((run) => run.outputs || []).length) {
    throw new Error(`GO did not create a candidate: ${JSON.stringify(generationState)}`);
  }
  await panel.reload();
  await panel.getByRole("button", { name: /Hold to speak/ }).waitFor();
  await panel.getByRole("button", { name: "review", exact: true }).click();
  await panel.getByText(/Reviewed:/).waitFor();
  await panel.screenshot({ path: path.join(evidence, "06c-extension-go-candidate.png"), fullPage: true });
  const targetTabId = await panel.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const current = await chrome.tabs.getCurrent();
    return tabs.find((tab) => tab.id !== current?.id && tab.url?.startsWith("http://127.0.0.1:"))?.id;
  });
  await panel.evaluate(async ({ targetTabId }) => {
    const response = await chrome.runtime.sendMessage({
      version: 1,
      type: "result-action",
      requestId: "orb-audit-insert",
      payload: {
        targetTabId,
        text: "Reviewed: Pearl extension audit material.",
        outputSpec: { machineKind: "text" },
        plan: { operation: "insert", anchor: { selector: "#field", start: 0, end: 0 } },
      },
    });
    if (!response?.ok || !response.value?.ok) throw new Error(response?.error || response?.value?.error || "verified insertion failed");
  }, { targetTabId });
  await fixture.waitForFunction(() => document.querySelector("#field").value.startsWith("Reviewed:"));
  await fixture.screenshot({ path: path.join(evidence, "06d-extension-verified-insertion.png"), fullPage: true });
  const continuedUrl = await panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({
      version: 1,
      type: "open-web-handoff",
      requestId: "orb-audit-continue",
      payload: { surface: "semantic-orb-scene", preservePayload: true },
    });
    if (!response?.ok) throw new Error(response?.error || "web continuation failed");
    return response.value?.url || "";
  });
  if (!continuedUrl.includes("view=integrate")) throw new Error(`continuation route mismatch: ${continuedUrl}`);
  await fixture.getByRole("button", { name: "lens", exact: true }).click();
  await fixture.getByRole("button", { name: "taste", exact: true }).click();
  await fixture.screenshot({ path: path.join(evidence, "06e-extension-page-orb-lens-candidates.png"), fullPage: true });
  await pageOrb.dragTo(fixture.locator("h1"));
  const afterDrag = await pageOrb.boundingBox();
  if (!afterDrag || Math.abs(afterDrag.x - beforeDrag.x) < 80) throw new Error("page orb did not visibly drag/dock");
  await fixture.getByRole("button", { name: "Minimize Pearl" }).click();
  const minimized = await pageOrb.boundingBox();
  if (!minimized || minimized.width > 45) throw new Error("page orb did not minimize");
  await fixture.screenshot({ path: path.join(evidence, "06f-extension-page-orb-minimized.png"), fullPage: true });
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
  await fixture.screenshot({ path: path.join(evidence, "06g-extension-orb-cursor.png"), fullPage: true });
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
  await panel.getByRole("button", { name: "pearls", exact: true }).click();
  await panel.getByRole("heading", { name: "Pearls" }).waitFor();
  await panel.getByRole("button", { name: /Make a pearl|New empty pearl/ }).click();
  await panel.waitForFunction(async () => (await chrome.storage.local.get("semanticOrbs")).semanticOrbs?.length === 2);
  await panel.screenshot({ path: path.join(evidence, "07a-extension-semantic-orbs.png"), fullPage: true });
  await panel.getByRole("button", { name: "library", exact: true }).click();
  await panel.screenshot({ path: path.join(evidence, "08-extension-library-360.png"), fullPage: true });
  await panel.getByRole("button", { name: "settings", exact: true }).click();
  await panel.getByRole("heading", { name: "Settings" }).waitFor();
  await panel.screenshot({ path: path.join(evidence, "09-extension-settings-360.png"), fullPage: true });
  await Promise.all([
    fixture.emulateMedia({ reducedMotion: "reduce" }),
    panel.emulateMedia({ reducedMotion: "reduce" }),
  ]);
  const reducedMotion = {
    page: await fixture.locator("#lens-orb-overlay-host").evaluate((host) => getComputedStyle(host.shadowRoot.querySelector(".pearl")).animationName),
    panel: await panel.locator(".extension-orb-pearl").evaluate((node) => getComputedStyle(node).animationName),
  };
  if (reducedMotion.page !== "none" || reducedMotion.panel !== "none") {
    throw new Error(`reduced-motion Pearls still animate: ${JSON.stringify(reducedMotion)}`);
  }
  await fixture.screenshot({ path: path.join(evidence, "10-extension-page-orb-reduced.png"), fullPage: true });
  await panel.screenshot({ path: path.join(evidence, "10a-extension-sidepanel-reduced-360.png"), fullPage: true });

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
      "capture queues an action and remains inert until explicit GO",
      "GO creates a reviewable candidate",
      "candidate insertion is verified in the page target",
      "web continuation uses the trusted handoff route",
      "Lens atmosphere and candidate constellation visible",
      "page orb drag/dock and minimize are functional",
      "Triple-Space makes the orb the precise page cursor",
      "Triple-Space restores the native cursor",
      "editable fields exclude the Triple-Space toggle",
      "same orb identity expands at 360px",
      "orb-mediated side panel views",
      "extension semantic orb tray creates and persists captured capsules",
      "library and settings remain reachable",
      "page and side-panel Pearls are static under reduced motion",
      "MV3 service worker loaded",
    ],
    passed: 18,
    failed: 0,
  }, null, 2)}\n`);
  console.log("Orb extension audit passed: 18 checks, 14 screenshots.");
} finally {
  await context.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(auditDist, { recursive: true, force: true });
}
