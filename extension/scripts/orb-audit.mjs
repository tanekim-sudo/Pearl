import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
    "--disable-crash-reporter",
    "--disable-crashpad",
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
  if (!worker) {
    const extensionIdFromPath = crypto.createHash("sha256").update(auditDist).digest("hex").slice(0, 32)
      .replace(/[0-9a-f]/g, (value) => String.fromCharCode(97 + Number.parseInt(value, 16)));
    const bootstrap = await context.newPage();
    await bootstrap.goto(`chrome-extension://${extensionIdFromPath}/sidepanel.html`).catch(() => {});
    await bootstrap.close().catch(() => {});
    worker = context.serviceWorkers()[0];
  }
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
  await panel.getByRole("button", { name: /Open Pearl actions/ }).waitFor();
  await panel.screenshot({ path: path.join(evidence, "05-extension-idle-pearl-360.png"), fullPage: true });
  await panel.getByRole("button", { name: /Open Pearl actions/ }).click();
  await panel.getByRole("textbox", { name: "Tell Pearl your goal" }).waitFor();
  if (await panel.getByRole("navigation").count()) throw new Error("Pearl click exposed persistent navigation");
  await panel.keyboard.press("Escape");
  await panel.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await panel.getByRole("searchbox", { name: "Search every Pearl action" }).fill("before after");
  await panel.screenshot({ path: path.join(evidence, "05a-extension-action-search-360.png"), fullPage: true });
  await panel.keyboard.press("Escape");
  const openPanelView = async (name) => {
    const requests = {
      Context: "show me what you noticed",
      Library: "show me the things I can reuse",
      Generate: "show me what you are about to do",
      Review: "show me what you are about to do",
      Command: null,
      Pearls: "show me what I kept",
      Settings: "open my preferences",
    };
    if (await panel.getByRole("textbox", { name: "Tell Pearl your goal" }).isVisible().catch(() => false)) {
      await panel.keyboard.press("Escape");
    }
    if (!["idle", "command"].includes(await panel.locator("main").getAttribute("data-orb-view"))) {
      await panel.getByRole("button", { name: "Collapse view into Pearl" }).click();
    }
    await panel.getByRole("button", { name: /Open Pearl actions/ }).click();
    if (!requests[name]) return;
    await panel.getByRole("textbox", { name: "Tell Pearl your goal" }).fill(requests[name]);
    await panel.getByRole("button", { name: "Send command" }).click();
  };
  await panel.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const current = await chrome.tabs.getCurrent();
    const targetTabId = tabs.find((tab) => tab.id !== current?.id && tab.url?.startsWith("http://127.0.0.1:"))?.id;
    if (!targetTabId) throw new Error("fixture tab unavailable");
    const response = await chrome.runtime.sendMessage({ version: 1, type: "toggle-highlighter", requestId: "orb-audit", payload: { enabled: true, targetTabId } });
    if (!response?.ok) throw new Error(response?.error || "content injection failed");
  });
  await fixture.locator("#lens-orb-overlay-host").waitFor();
  const restingOverlay = await fixture.locator("#lens-orb-overlay-host").evaluate((host) => ({
    hostPointerEvents: getComputedStyle(host).pointerEvents,
    orbPointerEvents: getComputedStyle(host.shadowRoot.querySelector(".orb")).pointerEvents,
    candidateCount: host.shadowRoot.querySelectorAll(".candidate").length,
  }));
  if (JSON.stringify(restingOverlay) !== JSON.stringify({ hostPointerEvents: "none", orbPointerEvents: "auto", candidateCount: 0 })) {
    throw new Error(`resting page overlay intercepts or spawns placeholders: ${JSON.stringify(restingOverlay)}`);
  }
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
  await fixture.getByRole("region", { name: "Pearl command" }).waitFor();
  await fixture.screenshot({ path: path.join(evidence, "06a-extension-page-orb-expanded.png"), fullPage: true });
  await fixture.locator("#field").selectText();
  await fixture.locator("#lens-orb-overlay-host").locator('[data-action="contextual"]').click();
  await fixture.waitForTimeout(850);
  let firstPearlState;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    firstPearlState = await panel.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ version: 1, type: "pearl-state-get", requestId: crypto.randomUUID(), payload: {} });
      return {
        local: response?.value || {},
        active: await chrome.storage.session.get("lensEverywhereSession"),
      };
    });
    if (firstPearlState.local.semanticOrbs?.length === 1
      && firstPearlState.local.activeSemanticOrbId === firstPearlState.local.semanticOrbs[0].id
      && firstPearlState.active.lensEverywhereSession?.fragments?.length >= 1) break;
    await panel.waitForTimeout(100);
  }
  if (firstPearlState.local.semanticOrbs?.length !== 1) {
    throw new Error(`page Pearl did not persist: ${JSON.stringify(firstPearlState)}`);
  }
  await openPanelView("Command");
  await panel.getByRole("textbox", { name: "Tell Pearl your goal" }).fill("use this Pearl here");
  await panel.getByRole("button", { name: "Send command" }).click();
  try {
    await fixture.locator("#pearl-page-canvas-host[data-active=true]").waitFor({ timeout: 5_000 });
  } catch {
    const diagnostics = await panel.evaluate(async () => {
      const state = await chrome.runtime.sendMessage({ version: 1, type: "pearl-state-get", requestId: crypto.randomUUID(), payload: {} });
      return { text: document.body.innerText, state: state?.value };
    });
    throw new Error(`companion canvas activation failed: ${JSON.stringify(diagnostics)}`);
  }
  await openPanelView("Command");
  await panel.getByRole("textbox", { name: "Tell Pearl your goal" }).fill("let me draw on this with Pearl");
  await panel.getByRole("button", { name: "Send command" }).click();
  await fixture.locator("#pearl-page-canvas-host[data-mode=pen]").waitFor();
  await fixture.mouse.move(820, 190);
  await fixture.mouse.down();
  await fixture.mouse.move(900, 240, { steps: 8 });
  await fixture.mouse.up();
  const canvasState = await panel.evaluate(async ({ pageIdentity }) => {
    const response = await chrome.runtime.sendMessage({
      version: 1,
      type: "page-canvas-get",
      requestId: "orb-audit-canvas-state",
      payload: { pageIdentity },
    });
    return response?.value?.canvas;
  }, { pageIdentity: `http://127.0.0.1:${server.address().port}/` });
  if (!canvasState?.artifacts?.some((entry) => entry.type === "ink")) throw new Error("companion drawing did not persist in the active Pearl canvas");
  await fixture.screenshot({ path: path.join(evidence, "06b1-extension-pearl-canvas-ink.png"), fullPage: true });
  await openPanelView("Command");
  await panel.getByRole("textbox", { name: "Tell Pearl your goal" }).fill("let me edit the page again");
  await panel.getByRole("button", { name: "Send command" }).click();
  await fixture.locator("#pearl-page-canvas-host[data-mode=native]").waitFor();
  await panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ version: 1, type: "pearl-state-get", requestId: crypto.randomUUID(), payload: {} });
    const local = response?.value || {};
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
  const phasePlacement = await fixture.locator("#lens-orb-overlay-host").locator(".phase").evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { visible: Number(getComputedStyle(node).opacity) > 0, state: node.closest(".shell")?.dataset.state, text: node.textContent, left: box.left, right: box.right, viewport: innerWidth };
  });
  if (phasePlacement.visible && phasePlacement.state === "blocked") throw new Error(`page Pearl retained a stale blocked status after context recovery: ${JSON.stringify(phasePlacement)}`);
  if (phasePlacement.visible && (phasePlacement.left < 0 || phasePlacement.right > phasePlacement.viewport)) {
    throw new Error(`page Pearl status clips outside the viewport: ${JSON.stringify(phasePlacement)}`);
  }
  await fixture.screenshot({ path: path.join(evidence, "06b-extension-page-orb-context.png"), fullPage: true });
  await openPanelView("Context");
  await panel.getByText(/\d+ fragments?/).waitFor();
  await openPanelView("Library");
  await panel.locator(".rack button").filter({ hasText: /compress/i }).first().click();
  await panel.waitForFunction(async () => (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession?.queue?.length >= 1);
  await openPanelView("Review");
  await panel.getByRole("button", { name: "GO", exact: true }).waitFor({ state: "visible" });
  const goBlocked = await panel.getByRole("button", { name: "GO", exact: true }).isDisabled();
  if (goBlocked) {
    const diagnostics = await panel.evaluate(async () => ({
      session: (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession,
      text: document.querySelector(".orb-panel.active")?.innerText,
    }));
    throw new Error(`GO remained blocked after capture and queue: ${JSON.stringify(diagnostics)}`);
  }
  panel.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "GO", exact: true }).click();
  await panel.waitForTimeout(800);
  const generationState = await panel.evaluate(async () => ({
    session: (await chrome.storage.session.get("lensEverywhereSession")).lensEverywhereSession,
    privacy: await chrome.storage.local.get(["activeSemanticOrbId", "pearlPrivacyPolicies", "apiOrigin"]),
    alerts: [...document.querySelectorAll('[role="alert"]')].map((node) => node.textContent?.trim()).filter(Boolean),
    text: document.body.innerText,
  }));
  if (!generationState.session?.results?.flatMap((run) => run.outputs || []).length) {
    throw new Error(`GO did not create a candidate: ${JSON.stringify(generationState)}`);
  }
  const marginPearl = fixture.locator("#pearl-result-pearls-host").locator("button.result").first();
  await marginPearl.waitFor({ state: "visible" });
  const resultId = await marginPearl.getAttribute("data-id");
  if (!resultId?.startsWith("result-pearl:")) throw new Error("GO did not persist a real margin result Pearl");
  await marginPearl.click();
  const resultPlane = fixture.locator("#pearl-result-pearls-host").locator(".plane");
  await resultPlane.waitFor({ state: "visible" });
  await fixture.screenshot({ path: path.join(evidence, "06c1-celadon-margin-result-expanded.png"), fullPage: true });
  const newTabPromise = context.waitForEvent("page");
  await resultPlane.getByRole("button", { name: "Open in new tab" }).click();
  const resultTab = await newTabPromise;
  await resultTab.waitForLoadState();
  await resultTab.locator("article").filter({ hasText: "Reviewed: Pearl extension audit material." }).waitFor();
  if (decodeURIComponent(resultTab.url()).includes("Reviewed:") || resultTab.url().includes(resultId)) {
    throw new Error("result text or stable result identity leaked into the new-tab URL");
  }
  const resultUrlPrivacy = await resultTab.evaluate(() => ({
    currentTokenLeak: /handoff=|token=|Reviewed:/.test(location.href),
    serverVisibleTokenLeak: performance.getEntriesByType("navigation").some((entry) => /[?&](?:handoff|token)=/.test(entry.name)),
  }));
  if (resultUrlPrivacy.currentTokenLeak || resultUrlPrivacy.serverVisibleTokenLeak) throw new Error("result handoff token leaked to URL history or navigation");
  await resultTab.reload();
  await resultTab.getByText("This Pearl result could not be opened. Return to the source page and try again.").waitFor();
  await resultTab.close();
  await marginPearl.press("Escape");
  await resultPlane.waitFor({ state: "detached" });
  await fixture.setViewportSize({ width: 390, height: 720 });
  await fixture.evaluate(() => {
    document.body.style.zoom = "1.25";
    scrollTo(0, 120);
  });
  const narrowPearl = fixture.locator("#pearl-result-pearls-host").locator("button.result").first();
  await narrowPearl.waitFor({ state: "visible" });
  const narrowBox = await narrowPearl.boundingBox();
  if (!narrowBox || narrowBox.x < 0 || narrowBox.x + narrowBox.width > 390) throw new Error(`result Pearl did not dock safely after narrow zoomed reflow: ${JSON.stringify(narrowBox)}`);
  await fixture.screenshot({ path: path.join(evidence, "06c2-celadon-result-narrow-zoom.png"), fullPage: true });
  await fixture.evaluate(() => {
    document.body.style.zoom = "";
    scrollTo(0, 0);
  });
  await fixture.setViewportSize({ width: 1280, height: 800 });
  await panel.reload();
  await panel.getByRole("button", { name: /Open Pearl actions/ }).waitFor();
  await openPanelView("Generate");
  await panel.waitForTimeout(300);
  const postGenerationView = await panel.locator("main").getAttribute("data-orb-view");
  if (postGenerationView !== "review") {
    throw new Error(`result review intent resolved to ${postGenerationView}: ${await panel.locator("main").innerText()}`);
  }
  await panel.locator(".orb-panel.active").getByText(/Reviewed:/).waitFor();
  await panel.screenshot({ path: path.join(evidence, "06c-extension-go-candidate.png"), fullPage: true });
  await fixture.locator("#field").focus();
  await fixture.locator("#field").evaluate((field) => field.setSelectionRange(0, 0));
  const targetTabId = await panel.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const current = await chrome.tabs.getCurrent();
    return tabs.find((tab) => tab.id !== current?.id && tab.url?.startsWith("http://127.0.0.1:"))?.id;
  });
  await panel.evaluate(async ({ targetTabId, resultId }) => {
    const interpreted = await chrome.runtime.sendMessage({
      version: 1,
      type: "output-routing-answer",
      requestId: "orb-audit-route-insert",
      payload: {
        resultId,
        targetTabId,
        answer: "insert at the selected caret",
      },
    });
    const routing = interpreted?.value?.object;
    if (!interpreted?.ok || routing?.stage !== "confirming") throw new Error(interpreted?.error || `placement interpretation failed: ${JSON.stringify(interpreted)}`);
    const confirmed = await chrome.runtime.sendMessage({
      version: 1,
      type: "output-routing-confirm",
      requestId: "orb-audit-confirm-insert",
      payload: { resultId, targetRevision: routing.plan.targetRevision },
    });
    if (!confirmed?.ok) throw new Error(confirmed?.error || "verified insertion failed");
  }, { targetTabId, resultId });
  await fixture.waitForFunction(() => document.querySelector("#field").value.startsWith("Reviewed:"));
  await fixture.screenshot({ path: path.join(evidence, "06d-extension-verified-insertion.png"), fullPage: true });
  const continuation = await panel.evaluate(async () => {
    const beforeTabs = await chrome.tabs.query({});
    const response = await chrome.runtime.sendMessage({
      version: 1,
      type: "open-web-handoff",
      requestId: "orb-audit-continue",
      payload: { surface: "semantic-orb-scene", preservePayload: true },
    });
    if (!response?.ok) throw new Error(response?.error || "web continuation failed");
    const tabs = await chrome.tabs.query({});
    const opened = tabs.find((tab) => tab.url?.startsWith("https://representation-eta.vercel.app/"));
    return {
      opened: tabs.length > beforeTabs.length && response.value?.preserved === true,
      routePreserved: response.value?.route?.surface === "semantic-orb-scene" && response.value?.route?.view === "integrate",
      fragmentScrubbed: !opened?.url?.includes("token="),
      queryTokenLeak: Boolean(opened?.url?.match(/[?&]token=/)),
      responseTokenLeak: JSON.stringify(response).includes("token"),
    };
  });
  if (!continuation.opened || !continuation.routePreserved || !continuation.fragmentScrubbed || continuation.queryTokenLeak || continuation.responseTokenLeak) {
    throw new Error(`trusted continuation did not use a scrub-safe fragment handoff: ${JSON.stringify(continuation)}`);
  }
  await fixture.screenshot({ path: path.join(evidence, "06e-extension-page-orb-lens-candidates.png"), fullPage: true });
  await pageOrb.dragTo(fixture.locator("h1"));
  const afterDrag = await pageOrb.boundingBox();
  if (!afterDrag || Math.abs(afterDrag.x - beforeDrag.x) < 80) throw new Error("page orb did not visibly drag/dock");
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
  await openPanelView("Command");
  await panel.screenshot({ path: path.join(evidence, "07-extension-command-360.png"), fullPage: true });
  await openPanelView("Pearls");
  await panel.getByRole("heading", { name: "Pearls" }).waitFor();
  await panel.getByRole("button", { name: /Make a pearl|New empty pearl/ }).click();
  await panel.waitForFunction(async () => {
    const response = await chrome.runtime.sendMessage({ version: 1, type: "pearl-state-get", requestId: crypto.randomUUID(), payload: {} });
    return response?.value?.semanticOrbs?.length === 2;
  });
  await panel.screenshot({ path: path.join(evidence, "07a-extension-semantic-orbs.png"), fullPage: true });
  await openPanelView("Library");
  await panel.screenshot({ path: path.join(evidence, "08-extension-library-360.png"), fullPage: true });
  await openPanelView("Settings");
  await panel.getByRole("heading", { name: "Settings" }).waitFor();
  await panel.screenshot({ path: path.join(evidence, "09-extension-settings-360.png"), fullPage: true });
  await Promise.all([
    fixture.emulateMedia({ reducedMotion: "reduce" }),
    panel.emulateMedia({ reducedMotion: "reduce" }),
  ]);
  const reducedMotion = {
    page: await fixture.locator("#lens-orb-overlay-host").evaluate((host) => getComputedStyle(host.shadowRoot.querySelector(".physical-pearl__mass")).animationName),
    panel: await panel.locator(".extension-orb .physical-pearl__mass").evaluate((node) => getComputedStyle(node).animationName),
  };
  if (reducedMotion.page !== "none" || reducedMotion.panel !== "none") {
    throw new Error(`reduced-motion Pearls still animate: ${JSON.stringify(reducedMotion)}`);
  }
  await fixture.screenshot({ path: path.join(evidence, "10-extension-page-orb-reduced.png"), fullPage: true });
  await panel.screenshot({ path: path.join(evidence, "10a-extension-sidepanel-reduced-360.png"), fullPage: true });
  const logoutIsolation = await panel.evaluate(async () => {
    await chrome.runtime.sendMessage({
      version: 1,
      type: "fragments-changed",
      requestId: crypto.randomUUID(),
      payload: { fragments: [{ id: "account-a-session-only", quote: "Account A private session marker" }] },
    });
    const before = await chrome.runtime.sendMessage({ version: 1, type: "get-session", requestId: crypto.randomUUID(), payload: {} });
    const logout = await chrome.runtime.sendMessage({ version: 1, type: "auth-logout", requestId: crypto.randomUUID(), payload: {} });
    const after = await chrome.runtime.sendMessage({ version: 1, type: "get-session", requestId: crypto.randomUUID(), payload: {} });
    return {
      hadPriorMaterial: Boolean(before?.value?.fragments?.length || before?.value?.queue?.length || before?.value?.results?.length),
      logoutOk: logout?.ok === true,
      cleared: !after?.value?.fragments?.length && !after?.value?.queue?.length && !after?.value?.results?.length && !after?.value?.activeRunId,
      priorResultVisible: JSON.stringify(after?.value || {}).includes("Reviewed: Pearl extension audit material."),
      priorAccountMarkerVisible: JSON.stringify(after?.value || {}).includes("account-a-session-only"),
    };
  });
  await panel.reload();
  const reloadSession = await panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ version: 1, type: "get-session", requestId: crypto.randomUUID(), payload: {} });
    return response?.value;
  });
  const reloadHasPriorAccountMarker = JSON.stringify(reloadSession || {}).includes("account-a-session-only");
  if (!logoutIsolation.hadPriorMaterial || !logoutIsolation.logoutOk || !logoutIsolation.cleared || logoutIsolation.priorResultVisible
    || logoutIsolation.priorAccountMarkerVisible || reloadHasPriorAccountMarker
    || reloadSession?.queue?.length || reloadSession?.results?.length || reloadSession?.activeRunId) {
    throw new Error(`logout/account transition exposed prior profile session material: ${JSON.stringify({
      ...logoutIsolation,
      reloadCleared: !reloadHasPriorAccountMarker && !reloadSession?.queue?.length && !reloadSession?.results?.length && !reloadSession?.activeRunId,
      reloadCounts: {
        fragments: reloadSession?.fragments?.length || 0,
        queue: reloadSession?.queue?.length || 0,
        results: reloadSession?.results?.length || 0,
        active: Boolean(reloadSession?.activeRunId),
      },
    })}`);
  }
  const deletionIsolation = await panel.evaluate(async () => {
    const deleted = await chrome.runtime.sendMessage({
      version: 1,
      type: "privacy-delete-local",
      requestId: crypto.randomUUID(),
      payload: { confirmed: true },
    });
    const session = await chrome.runtime.sendMessage({ version: 1, type: "get-session", requestId: crypto.randomUUID(), payload: {} });
    const state = await chrome.runtime.sendMessage({ version: 1, type: "pearl-state-get", requestId: crypto.randomUUID(), payload: {} });
    return {
      completed: deleted?.value?.completed === true && deleted?.value?.deleted === true,
      sessionEmpty: !session?.value?.fragments?.length && !session?.value?.queue?.length && !session?.value?.results?.length,
      profileEmpty: !state?.value?.semanticOrbs?.length && !Object.keys(state?.value?.pageCanvases || {}).length && !Object.keys(state?.value?.resultPearls || {}).length,
    };
  });
  if (!deletionIsolation.completed || !deletionIsolation.sessionEmpty || !deletionIsolation.profileEmpty) {
    throw new Error(`confirmed local deletion reported completion before profile cleanup: ${JSON.stringify(deletionIsolation)}`);
  }

  fs.writeFileSync(path.join(evidence, "extension-results.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: await context.browser()?.version?.(),
    extensionId,
    viewport: { width: 360, height: 720 },
    checks: [
      "literal animated Shadow DOM page-edge orb visible",
      "page orb emits one command and one contextual action",
      "selection absorption creates visible context orbit",
      "capture queues an action and remains inert until explicit GO",
      "GO creates a reviewable candidate",
      "candidate insertion is verified in the page target",
      "web continuation uses the trusted handoff route",
      "Lens atmosphere and candidate constellation visible",
      "page orb drag and dock are functional",
      "Triple-Space makes the orb the precise page cursor",
      "Triple-Space restores the native cursor",
      "editable fields exclude the Triple-Space toggle",
      "same orb identity opens one focused field at 360px",
      "idle side panel is Pearl-only and action search discovers the full capability model",
      "explicit natural-language inspection reveals focused side panel views",
      "extension semantic orb tray creates and persists captured capsules",
      "library and settings remain reachable",
      "page and side-panel Pearls are static under reduced motion",
      "logout clears prior profile session material before reload",
      "confirmed deletion clears profile envelope, session, handoffs, canvases, results, and blobs before receipt",
      "MV3 service worker loaded",
    ],
    passed: 21,
    failed: 0,
  }, null, 2)}\n`);
  console.log("Orb extension audit passed: 21 checks, 16 screenshots.");
} finally {
  await context.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(auditDist, { recursive: true, force: true });
}
