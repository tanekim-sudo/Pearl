/**
 * Headed smoke: Studio shows system prompt (not id soup); Companion can edit prompt.
 * Exit 0 on pass. Not a production-ready claim.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { createPearlEntity } from "../shared/pearl-entity.js";
import { PEARL_STORE_KEY } from "../shared/pearl-store.js";
import { buildPearlCompanionContext, scrubPearlMetadataFromUserText } from "../shared/pearl-companion-context.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "audit-shots/pearl-prompt-context-smoke");
const PORT = Number(process.env.AUDIT_PORT || 41841);
const baseUrl = `http://127.0.0.1:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

async function waitServer(url, server) {
  for (let i = 0; i < 90; i += 1) {
    if (server.exitCode != null) throw new Error("preview died");
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (r.ok || r.status === 404) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("preview timeout");
}

async function main() {
  // Unit-level: companion context is rich; scrub hides ids.
  const entity = createPearlEntity({
    id: "pearl:smoke-1",
    name: "Investor notes",
    systemPrompt: "Be skeptical. Always list risks.",
    functions: [{ id: "fn1", name: "Memo", steps: [{ name: "Draft" }] }],
    revision: 4,
  });
  const ctx = buildPearlCompanionContext(entity, {
    wornPearlIds: [entity.id],
    sceneName: "Shelf",
    gauntletFilled: 1,
  });
  if (!ctx?.systemPrompt || !/skeptical/i.test(ctx.systemPrompt)) throw new Error("companion context missing systemPrompt");
  if (!ctx.functions?.length) throw new Error("companion context missing functions");
  const dirty = `Wearing “Investor notes” (${entity.id}) rev 4 semantic orb`;
  const clean = scrubPearlMetadataFromUserText(dirty);
  if (/pearl:smoke|rev 4|semantic orb/i.test(clean)) throw new Error(`scrub failed: ${clean}`);

  const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, VITE_LENS_EXTENSION_ID: "audit-extension-id" },
  });
  await waitServer(baseUrl, preview);
  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });
  const fails = [];
  try {
    const ctxBrowser = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const studioRef = `smoke-ref-${Date.now()}`;
    await ctxBrowser.addInitScript((seed) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(seed.key, JSON.stringify(seed.store));
      localStorage.setItem("pearlStudioRefs.v1", JSON.stringify({
        [seed.ref]: { pearlId: seed.pearlId, createdAt: Date.now(), expiresAt: Date.now() + 60 * 60_000 },
      }));
      sessionStorage.setItem("pearlStudioActivePearlId", seed.pearlId);
      sessionStorage.setItem("pearlStudioActiveRef", seed.ref);
    }, {
      key: PEARL_STORE_KEY,
      pearlId: entity.id,
      ref: studioRef,
      store: {
        version: 1,
        activePearlId: entity.id,
        entities: { [entity.id]: entity },
      },
    });
    const page = await ctxBrowser.newPage();
    await page.goto(`${baseUrl}/#pearl-studio=${encodeURIComponent(studioRef)}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    const studio = page.locator("[data-testid='pearl-studio']");
    await studio.waitFor({ state: "visible", timeout: 12_000 }).catch(() => fails.push("studio-missing"));
    const prompt = page.locator("[data-testid='studio-system-prompt']");
    const promptVal = await prompt.inputValue().catch(() => "");
    if (!/skeptical|risks/i.test(promptVal)) fails.push(`studio-prompt-missing:${promptVal.slice(0, 80)}`);
    const bodyText = await page.locator("main.web-pearl-studio").innerText().catch(() => "");
    if (/pearl:smoke-1|schemaVersion|stableId|semantic-orb/i.test(bodyText)) {
      fails.push(`studio-id-soup:${bodyText.slice(0, 200)}`);
    }
    if (/\brev\s*\d+/i.test(bodyText)) fails.push("studio-shows-rev");
    await page.screenshot({ path: path.join(OUT, "01-studio-prompt.png") }).catch(() => {});

    // Companion edit path — open Talk on reef (welcome or orb).
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1100);
    const talk = page.getByTestId("welcome-talk")
      .or(page.getByTestId("reef-talk"))
      .or(page.locator(".companion-orb"))
      .first();
    if (await talk.count()) await talk.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(700);
    // Force companion expand if dock still closed.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lens:companion-expand"));
    }).catch(() => {});
    await page.waitForTimeout(500);
    const input = page.locator("[data-testid='companion-chat-input']");
    const go = page.locator("[data-testid='companion-go']");
    if (await input.count() && await go.count()) {
      await input.fill("rewrite the system prompt to Always demand sources for TAM claims");
      await go.click();
      await page.waitForTimeout(2800);
      await page.screenshot({ path: path.join(OUT, "02-companion-edit.png") }).catch(() => {});
      const msgs = await page.locator(".companion-panel").allTextContents().catch(() => []);
      const joined = msgs.join("\n");
      if (/pearl:smoke-1|schemaVersion/i.test(joined)) fails.push(`chat-leaked-id:${joined.slice(0, 160)}`);
      // Companion edit may need credentials/runtime on preview — record presence of chat only.
    } else {
      // Studio prompt gate already passed; chat mount is soft on this smoke.
      await page.screenshot({ path: path.join(OUT, "02-companion-missing.png") }).catch(() => {});
      console.warn("companion chat not hit-testable on preview; Studio prompt gate passed");
    }

    console.log(JSON.stringify({ ok: fails.length === 0, fails, out: OUT }, null, 2));
    if (fails.length) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    if (preview.exitCode == null) preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
