/**
 * Headed proof: signed-out Buffett style+taste+lens create.
 * Usage: node scripts/repro-buffett-pearl-create.mjs
 * Optional: REPRO_UTTERANCE=... HEADED=0 AUDIT_URL=http://127.0.0.1:4173
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.AUDIT_PORT || 41843);
const baseUrl = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;
const OUT = path.join(ROOT, "tmp", "buffett-pearl-create");
const utterance = process.env.REPRO_UTTERANCE
  || "make me a pearl that reflects Warren Buffett's style and taste and lens of investing";

async function waitForServer(url, server, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server?.exitCode != null) throw new Error(`preview exited ${server.exitCode}`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status === 404) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`preview not ready: ${url}`);
}

fs.mkdirSync(OUT, { recursive: true });

let server = null;
if (!process.env.AUDIT_URL) {
  server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  await waitForServer(baseUrl, server);
}

const browser = await chromium.launch({ headless: process.env.HEADED === "0" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err?.message || err)));

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1200);

  // Fresh signed-out session (clear auth + prior pearls that confuse Reef labels).
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  for (const sel of [
    "[data-testid='welcome-talk']",
    "button:has-text('Talk')",
    "[data-testid='companion-open']",
    ".companion-orb",
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      break;
    }
  }

  const input = page.locator("[data-testid='companion-chat-input']").first();
  const go = page.locator("[data-testid='companion-go']").first();
  await input.waitFor({ state: "visible", timeout: 15_000 });
  for (let i = 0; i < 20; i += 1) {
    if (await input.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(250);
  }
  await input.click({ timeout: 5_000 });
  await input.fill("");
  await input.fill(utterance);
  // Ensure React controlled draft sees the value (fill alone can race).
  await input.evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, utterance);
  await page.waitForTimeout(200);
  const goEnabled = await go.isEnabled().catch(() => false);
  if (!goEnabled) {
    await input.focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" ");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(150);
  }
  await go.click({ timeout: 5_000 });
  // Wait for user echo or companion reply.
  for (let i = 0; i < 40; i += 1) {
    const snap = await page.locator("[data-testid='companion-chat'], .companion-panel").first()
      .innerText()
      .catch(() => "");
    if (/Buffett|Created pearl|Working|Interpreting|Applied|Blocked/i.test(snap)
      && !/^Companion[\s\S]*Type or speak/i.test(snap.replace(/\s+/g, " ").slice(0, 80))) {
      break;
    }
    if (/Buffett|Created pearl/i.test(snap)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1200);

  // If Studio auto-opened, capture then dismiss so Reef/chat remain inspectable.
  const studio = page.locator(".web-pearl-studio, [data-testid='pearl-studio']").first();
  if (await studio.isVisible().catch(() => false)) {
    await page.screenshot({ path: path.join(OUT, "buffett-studio.png"), fullPage: true });
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: path.join(OUT, "buffett-create.png"), fullPage: true });

  const chatText = await page.locator("[data-testid='companion-chat'], .companion-chat, [data-companion-chat]").first()
    .innerText()
    .catch(() => "");
  const bodyText = await page.locator("body").innerText();

  const submitGuardTrap = /Still working on your last command|\[submit-guard\]/i.test(chatText);
  const credentialsBlock = /Sign in required to use AI features|\[needs-credentials\]/i.test(chatText)
    && !/Created pearl|Buffett/i.test(chatText);
  const failed = /unknown-error|could not be completed safely/i.test(chatText)
    || submitGuardTrap
    || credentialsBlock;
  const created = /Created pearl|Buffett/i.test(chatText) || /Buffett/i.test(bodyText);
  const reefHit = await page.locator("[data-reef-pearl], [data-semantic-orb-id]")
    .filter({ hasText: /Buffett/i })
    .count();

  const storage = await page.evaluate(() => {
    try {
      const sceneRaw = localStorage.getItem("lens.scenes.v4") || localStorage.getItem("lens.unified-workspace.v1");
      const scenes = sceneRaw ? JSON.parse(sceneRaw)?.scenes || [] : [];
      const orbs = scenes.flatMap((s) => s.semanticOrbs || []);
      const pearlStore = JSON.parse(localStorage.getItem("pearlEntities.v1") || "{}");
      const entities = Object.values(pearlStore.entities || {});
      return {
        orbs: orbs.map((o) => ({
          id: o.id,
          name: o.name,
          moves: (o.moves || []).length,
          weights: (o.weights || o.organization?.weights || []).length,
          lenses: (o.lenses || []).length,
          systemPrompt: String(o.systemPrompt || "").slice(0, 280),
        })),
        entities: entities.map((e) => ({
          id: e.id,
          name: e.identity?.name || e.name,
          moves: (e.moves || []).length,
          weights: (e.weights || []).length,
          lenses: (e.lenses || []).length,
          systemPrompt: String(e.systemPrompt || "").slice(0, 280),
        })),
      };
    } catch {
      return { orbs: [], entities: [] };
    }
  });

  const layered = [...storage.orbs, ...storage.entities].some((o) => (
    /Buffett/i.test(o.name || "")
    && o.moves >= 1
    && o.weights >= 1
    && o.lenses >= 1
  )) || storage.orbs.some((o) => (
    /Buffett/i.test(o.name || "")
    && /## Moves|moat|margin of safety/i.test(o.systemPrompt || "")
  ));

  const report = {
    utterance,
    failed,
    created,
    reefHit,
    layered,
    submitGuardTrap,
    credentialsBlock,
    storage,
    chatSnippet: chatText.slice(0, 900),
    pageErrors: errors.slice(0, 5),
    screenshot: path.join(OUT, "buffett-create.png"),
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (failed || (!created && !layered)) {
    process.exitCode = 1;
  }
} finally {
  await browser.close().catch(() => {});
  if (server) {
    server.kill("SIGTERM");
  }
}
