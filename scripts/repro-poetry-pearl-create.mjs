/**
 * Focused headed repro: Talk→GO style-simile / purpose poetry creates.
 * Usage: node scripts/repro-poetry-pearl-create.mjs
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.AUDIT_PORT || 41833);
const baseUrl = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;
const utterance = process.env.REPRO_UTTERANCE
  || "make me a poetry pearl like sylvia plaths thought process";

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

  const talk = page.getByTestId("welcome-talk").first();
  if (await talk.isVisible().catch(() => false)) {
    await talk.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }

  const input = page.locator("[data-testid='companion-chat-input']").first();
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(utterance);
  const go = page.getByTestId("companion-go").first();
  await go.click({ timeout: 5000 });
  await page.waitForTimeout(3500);

  const chatText = await page.locator("[data-testid='companion-chat']").first()
    .innerText()
    .catch(() => "");
  const bodyText = await page.locator("body").innerText();
  const failed = /unknown-error|could not be completed safely/i.test(chatText)
    || /\[unknown-error\]/i.test(bodyText);
  const created = /Created pearl|poetry/i.test(chatText) || /poetry|sylvia|plath/i.test(bodyText);
  const reefHit = await page.locator("[data-reef-pearl], [data-semantic-orb-id]")
    .filter({ hasText: /poetry|sylvia|plath|inspiration/i })
    .count();
  const storage = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("lens.scenes.v4") || localStorage.getItem("lens.unified-workspace.v1");
      const parsed = raw ? JSON.parse(raw) : null;
      const scenes = parsed?.scenes || [];
      const orbs = scenes.flatMap((s) => s.semanticOrbs || []);
      return orbs.map((o) => ({
        id: o.id,
        name: o.name,
        systemPrompt: String(o.systemPrompt || "").slice(0, 200),
      }));
    } catch {
      return [];
    }
  });
  const stored = storage.some((o) => (
    /poetry|sylvia|plath|inspiration/i.test(o.name)
    || /sylvia|plath|poetry/i.test(o.systemPrompt)
  ));

  console.log(JSON.stringify({
    utterance,
    failed,
    created,
    reefHit,
    stored,
    storage,
    chatSnippet: chatText.slice(0, 700),
    pageErrors: errors.slice(0, 5),
  }, null, 2));

  if (failed || (!created && !stored)) {
    process.exitCode = 1;
  }
} finally {
  await browser.close().catch(() => {});
  if (server) {
    server.kill("SIGTERM");
  }
}
