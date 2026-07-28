/**
 * Headed repro: Space×3 cursor toggle failure modes on unpacked extension.
 * Writes evidence under audit-shots/extension-triple-space-repro-*
 */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const extensionRoot = path.resolve(import.meta.dirname, "..");
const dist = path.join(extensionRoot, "dist/chrome");
const auditDist = path.join(extensionRoot, ".audit-triple-space");
const stamp = new Date().toISOString().slice(0, 10);
const evidence = path.resolve(extensionRoot, `../audit-shots/extension-triple-space-repro-${stamp}`);
fs.mkdirSync(evidence, { recursive: true });
fs.rmSync(auditDist, { recursive: true, force: true });
if (!fs.existsSync(path.join(dist, "manifest.json"))) {
  console.error("Missing dist/chrome — run npm run build in extension/");
  process.exit(1);
}
fs.cpSync(dist, auditDist, { recursive: true });
const manifestPath = path.join(auditDist, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.host_permissions = ["http://127.0.0.1/*"];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const server = http.createServer((_req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(`<!doctype html><title>Triple-Space fixture</title>
<main style="max-width:700px;margin:80px auto;font:20px system-ui">
  <h1 id="heading">Selected material</h1>
  <p id="copy">Click the page, then try Space three times.</p>
  <button id="page-btn" type="button">Page button</button>
  <textarea id="field" style="width:100%;height:120px">editable</textarea>
</main>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const profile = path.join(extensionRoot, ".audit-triple-space-profile");
fs.rmSync(profile, { recursive: true, force: true });

const root = path.resolve(extensionRoot, "..");
const chromeCandidates = [
  process.env.PW_CHROMIUM,
  path.join(root, ".pw-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  path.join(extensionRoot, ".playwright-browsers/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  chromium.executablePath(),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error(`No Chrome binary among ${chromeCandidates.join(" | ")}`);
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  executablePath,
  args: [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--disable-extensions-except=${auditDist}`,
    `--load-extension=${auditDist}`,
  ],
});

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function pressTripleSpace(page, { delayMs = 80 } = {}) {
  await page.keyboard.press("Space");
  await page.waitForTimeout(delayMs);
  await page.keyboard.press("Space");
  await page.waitForTimeout(delayMs);
  await page.keyboard.press("Space");
}

async function cursorActive(page) {
  return page.evaluate(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true");
}

async function probeFocus(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const host = document.getElementById("lens-orb-overlay-host");
    const path = [];
    let node = el;
    for (let i = 0; i < 6 && node; i += 1) {
      path.push(`${node.nodeName}${node.id ? `#${node.id}` : ""}${node.className && typeof node.className === "string" ? `.${String(node.className).split(" ")[0]}` : ""}`);
      node = node.parentElement || (node.getRootNode?.() instanceof ShadowRoot ? node.getRootNode().host : null);
    }
    return {
      active: path.join(" > "),
      tag: el?.tagName || null,
      hostFocused: Boolean(host && (el === host || host.shadowRoot?.contains(el))),
      cursorAttr: document.documentElement.getAttribute("data-lens-orb-cursor-active"),
      sequenceAttr: document.documentElement.getAttribute("data-lens-orb-space-sequence"),
      pearlMounted: Boolean(host),
    };
  });
}

try {
  let worker = context.serviceWorkers()[0]
    || await context.waitForEvent("serviceworker", { timeout: 8_000 }).catch(() => null);
  if (!worker) {
    const extensionIdFromPath = crypto.createHash("sha256").update(auditDist).digest("hex").slice(0, 32)
      .replace(/[0-9a-f]/g, (value) => String.fromCharCode(97 + Number.parseInt(value, 16)));
    const bootstrap = await context.newPage();
    await bootstrap.goto(`chrome-extension://${extensionIdFromPath}/sidepanel.html`).catch(() => {});
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
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator("#lens-orb-overlay-host").waitFor({ timeout: 8_000 });
  await page.screenshot({ path: path.join(evidence, "01-cold-mount.png"), fullPage: true });
  record("cold-mount", true, "Mother Pearl present");

  // Case A: focus heading (audit path)
  await page.locator("#heading").click();
  let focus = await probeFocus(page);
  await pressTripleSpace(page, { delayMs: 80 });
  await page.waitForTimeout(120);
  let active = await cursorActive(page);
  await page.screenshot({ path: path.join(evidence, "02-space3-after-heading.png"), fullPage: true });
  record("space3-heading-fast", active, JSON.stringify(focus));
  if (active) {
    await pressTripleSpace(page, { delayMs: 80 });
    await page.waitForTimeout(120);
  }

  // Case B: focus Pearl button then Space×3 (likely user path)
  const orb = page.locator("#lens-orb-overlay-host").locator("button.orb, .orb").first();
  await orb.click({ force: true });
  await page.waitForTimeout(200);
  // close emission if open so we are not in input — click orb again or Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  // Focus the orb explicitly
  await page.evaluate(() => {
    const host = document.getElementById("lens-orb-overlay-host");
    const button = host?.shadowRoot?.querySelector("button.orb, .orb, button");
    button?.focus();
  });
  focus = await probeFocus(page);
  const beforePearl = await cursorActive(page);
  await pressTripleSpace(page, { delayMs: 80 });
  await page.waitForTimeout(150);
  active = await cursorActive(page);
  await page.screenshot({ path: path.join(evidence, "03-space3-pearl-focused.png"), fullPage: true });
  record("space3-pearl-focused", active !== beforePearl, `focus=${JSON.stringify(focus)} before=${beforePearl} after=${active}`);

  // Case C: slow human-paced Spaces (~350ms apart → first→third ~700ms > 650 window)
  await page.locator("#heading").click();
  if (await cursorActive(page)) {
    await pressTripleSpace(page, { delayMs: 80 });
    await page.waitForTimeout(100);
  }
  focus = await probeFocus(page);
  await pressTripleSpace(page, { delayMs: 350 });
  await page.waitForTimeout(150);
  active = await cursorActive(page);
  await page.screenshot({ path: path.join(evidence, "04-space3-slow-human.png"), fullPage: true });
  record("space3-slow-350ms", active, JSON.stringify(focus));
  if (active) {
    await pressTripleSpace(page, { delayMs: 80 });
    await page.waitForTimeout(100);
  }

  // Case D: editable still excluded
  await page.locator("#field").focus();
  await pressTripleSpace(page, { delayMs: 80 });
  await page.waitForTimeout(100);
  active = await cursorActive(page);
  record("space3-editable-excluded", !active, `active=${active}`);

  // Case E: page button focused
  await page.locator("#page-btn").focus();
  focus = await probeFocus(page);
  await pressTripleSpace(page, { delayMs: 80 });
  await page.waitForTimeout(100);
  active = await cursorActive(page);
  record("space3-page-button-excluded", !active, JSON.stringify(focus));

  // Case F: after single pearl click (panel open + input focused)
  await page.evaluate(() => {
    const host = document.getElementById("lens-orb-overlay-host");
    const button = host?.shadowRoot?.querySelector("button.orb, .orb, button");
    button?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    button?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
  });
  await page.waitForTimeout(250);
  focus = await probeFocus(page);
  await pressTripleSpace(page, { delayMs: 80 });
  await page.waitForTimeout(100);
  active = await cursorActive(page);
  await page.screenshot({ path: path.join(evidence, "05-space3-after-pearl-open.png"), fullPage: true });
  record("space3-after-pearl-open", active, JSON.stringify(focus));

  const ledger = {
    generatedAt: new Date().toISOString(),
    extensionId,
    results,
    failed: results.filter((row) => !row.ok).map((row) => row.id),
  };
  fs.writeFileSync(path.join(evidence, "REPORT.json"), `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(path.join(evidence, "LEDGER.md"), `# Triple-Space repro ${stamp}

## Results
${results.map((row) => `- ${row.ok ? "PASS" : "FAIL"} **${row.id}**: ${row.detail}`).join("\n")}

## Failed
${ledger.failed.length ? ledger.failed.map((id) => `- ${id}`).join("\n") : "(none)"}
`);
  console.log("\nEvidence:", evidence);
  console.log("Failed:", ledger.failed);
} finally {
  await context.close().catch(() => {});
  server.close();
}
