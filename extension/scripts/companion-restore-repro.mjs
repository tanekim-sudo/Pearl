import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const extensionRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(extensionRoot, "..");
const dist = path.join(extensionRoot, "dist/chrome");
const auditDist = path.join(extensionRoot, ".audit-repro-extension");
const evidence = path.join(root, "audit-shots/extension-companion-restore-2026-07-25");
fs.mkdirSync(evidence, { recursive: true });
fs.rmSync(auditDist, { recursive: true, force: true });
fs.cpSync(dist, auditDist, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(auditDist, "manifest.json"), "utf8"));
fs.writeFileSync(path.join(evidence, "00-shipped-manifest.json"), JSON.stringify(manifest, null, 2));

const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end("<!doctype html><title>Repro</title><main style='margin:80px'><h1>Page</h1><p>hello</p><textarea id='field'>edit</textarea></main>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const profile = path.join(extensionRoot, ".audit-repro-profile");
fs.rmSync(profile, { recursive: true, force: true });
const chrome = process.env.PW_CHROMIUM
  || path.join(root, ".pw-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath: chrome,
  args: [
    "--disable-gpu",
    `--disable-extensions-except=${auditDist}`,
    `--load-extension=${auditDist}`,
  ],
});
const failures = [];
try {
  let worker = context.serviceWorkers()[0]
    || await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => null);
  if (!worker) {
    const idGuess = crypto.createHash("sha256").update(auditDist).digest("hex").slice(0, 32)
      .replace(/[0-9a-f]/g, (value) => String.fromCharCode(97 + Number.parseInt(value, 16)));
    const bootstrap = await context.newPage();
    await bootstrap.goto(`chrome-extension://${idGuess}/sidepanel.html`).catch(() => {});
    await bootstrap.close().catch(() => {});
    worker = context.serviceWorkers()[0]
      || await context.waitForEvent("serviceworker", { timeout: 10_000 });
  }
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(async () => {
    await chrome.storage.local.set({ onboardingComplete: true, onboardingMode: "local" });
  });
  await Promise.all(context.pages().map((page) => page.close().catch(() => {})));
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForTimeout(800);
  const autoMount = await page.locator("#lens-orb-overlay-host").count();
  await page.screenshot({ path: path.join(evidence, "01-cold-load-no-click.png"), fullPage: true });
  if (autoMount === 0) failures.push("COLD_LOAD: page Pearl not mounted without user gesture / host grant");

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.waitForTimeout(500);
  const injectResult = await panel.evaluate(async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const target = tabs.find((tab) => tab.url?.startsWith("http://127.0.0.1:"));
      if (!target) return { ok: false, error: "no tab" };
      return chrome.runtime.sendMessage({
        version: 1,
        type: "toggle-highlighter",
        requestId: "repro",
        payload: { enabled: true, targetTabId: target.id },
      });
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
  });
  await page.waitForTimeout(500);
  const afterPanel = await page.locator("#lens-orb-overlay-host").count();
  fs.writeFileSync(path.join(evidence, "02-inject-via-sidepanel.json"), JSON.stringify({ injectResult, afterPanel }, null, 2));
  if (!injectResult?.ok) failures.push(`SIDEPANEL_INJECT_FAILED: ${JSON.stringify(injectResult)}`);
  if (afterPanel === 0) failures.push("AFTER_SIDEPANEL: still no page Pearl");

  const actionInject = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const target = tabs.find((tab) => tab.url?.startsWith("http://127.0.0.1:"));
    if (!target) return { ok: false, error: "no tab" };
    try {
      await chrome.scripting.executeScript({
        target: { tabId: target.id, allFrames: false },
        files: ["assets/content.js"],
      });
      return { ok: true, tabId: target.id };
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
  });
  await page.waitForTimeout(400);
  const afterScript = await page.locator("#lens-orb-overlay-host").count();
  fs.writeFileSync(path.join(evidence, "03-executeScript.json"), JSON.stringify({ actionInject, afterScript }, null, 2));
  if (!actionInject.ok) failures.push(`EXECUTESCRIPT_WITHOUT_HOST: ${JSON.stringify(actionInject)}`);
  if (afterScript === 0) failures.push("AFTER_EXECUTESCRIPT: Pearl still missing");

  if (afterScript > 0) {
    await page.screenshot({ path: path.join(evidence, "04-mounted.png"), fullPage: true });
    const hold = await page.evaluate(async () => {
      const host = document.getElementById("lens-orb-overlay-host");
      const orb = host.shadowRoot.querySelector(".orb");
      const before = host.shadowRoot.querySelector(".shell").dataset.state;
      orb.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10,
      }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      const during = host.shadowRoot.querySelector(".shell").dataset.state;
      const phase = host.shadowRoot.querySelector(".phase")?.textContent;
      orb.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10,
      }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const after = host.shadowRoot.querySelector(".shell").dataset.state;
      return {
        before,
        during,
        after,
        phase,
        hasSpeech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      };
    });
    fs.writeFileSync(path.join(evidence, "05-hold.json"), JSON.stringify(hold, null, 2));
    if (hold.during !== "listening") failures.push(`HOLD_NO_LISTENING: ${JSON.stringify(hold)}`);
  }

  const contentSrc = fs.readFileSync(path.join(auditDist, "assets/content.js"), "utf8");
  const hasSpeechInBundle = /SpeechRecognition|webkitSpeechRecognition|createCompanionVoiceSession/.test(contentSrc);
  fs.writeFileSync(path.join(evidence, "06-bundle-voice.json"), JSON.stringify({
    hasSpeechInBundle,
    len: contentSrc.length,
  }, null, 2));
  if (!hasSpeechInBundle) failures.push("BUNDLE: hold-to-talk SpeechRecognition path absent from content.js");

  const hasContentScripts = Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0;
  if (!hasContentScripts) {
    failures.push("MANIFEST: no content_scripts — Companion never auto-mounts on page load");
  }

  const sw = fs.readFileSync(path.join(extensionRoot, "src/background/service-worker.js"), "utf8");
  const panelSrc = fs.readFileSync(path.join(extensionRoot, "src/sidepanel/main.jsx"), "utf8");
  const intentLocal = /storage\.set\("local",\s*\{\s*pendingPearlIntent/.test(sw);
  const intentSessionRead = /storage\.get\("session",\s*\[[^\]]*pendingPearlIntent/.test(panelSrc);
  if (intentLocal && intentSessionRead) {
    failures.push("INTENT_STORAGE_MISMATCH: SW writes pendingPearlIntent to local; sidepanel reads session");
  }

  fs.writeFileSync(path.join(evidence, "REPORT.json"), JSON.stringify({ failures, port, extensionId }, null, 2));
  console.log(JSON.stringify({ failures, port, extensionId }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await context.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(auditDist, { recursive: true, force: true });
}
