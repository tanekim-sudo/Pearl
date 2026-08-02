/**
 * Headed proof: compare+PDF does NOT append into systemPrompt; produces comparison;
 * Buffett create still has Moves·Weights·Lenses.
 *
 * Usage: node scripts/repro-compare-pdf-no-prompt-append.mjs
 * Optional: HEADED=0 AUDIT_URL=http://127.0.0.1:4173
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.AUDIT_PORT || 41847);
const baseUrl = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;
const OUT = path.join(ROOT, "tmp", "compare-pdf-no-append");
const WS_KEY = "lens.scenes.v4";
const CREATE = "make me a pearl that reflects Warren Buffett's style and taste and lens of investing";
const COMPARE = "explain the differences between my investor pearl and the Warren Buffett investor pearl and then give me a PDF output of the differences";

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

async function openCompanion(page) {
  for (const sel of [
    "[data-testid='welcome-talk']",
    "button:has-text('Talk')",
    "[data-testid='companion-open']",
    ".companion-orb",
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      break;
    }
  }
}

async function submitCompanion(page, utterance) {
  const input = page.locator("[data-testid='companion-chat-input']").first();
  const go = page.locator("[data-testid='companion-go']").first();
  await input.waitFor({ state: "visible", timeout: 15_000 });
  for (let i = 0; i < 40; i += 1) {
    if (await input.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(250);
  }
  await input.click({ timeout: 5_000 });
  await input.fill("");
  await input.fill(utterance);
  await page.evaluate((value) => {
    const el = document.querySelector("[data-testid='companion-chat-input']");
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, utterance);
  await page.waitForTimeout(250);
  if (!(await go.isEnabled().catch(() => false))) {
    await input.focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" ");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(150);
  }
  await go.click({ timeout: 8_000 });
  for (let i = 0; i < 50; i += 1) {
    await page.waitForTimeout(400);
    if (await go.isEnabled().catch(() => false)) break;
  }
  await page.waitForTimeout(600);
}

async function listOrbs(page) {
  return page.evaluate(() => {
    const keys = ["lens.scenes.v4", "lens.unified-workspace.v2", "pearlEntities.v1"];
    const orbs = [];
    const push = (o) => {
      if (!o?.id) return;
      if (orbs.some((e) => e.id === o.id)) return;
      orbs.push(o);
    };
    for (const k of keys) {
      try {
        const raw = JSON.parse(localStorage.getItem(k) || "null");
        if (!raw) continue;
        if (Array.isArray(raw.scenes)) {
          for (const scene of raw.scenes) {
            for (const orb of scene.semanticOrbs || []) push(orb);
          }
        }
        if (raw.entities && typeof raw.entities === "object") {
          for (const entity of Object.values(raw.entities)) push(entity);
        }
        if (Array.isArray(raw.semanticOrbs)) {
          for (const orb of raw.semanticOrbs) push(orb);
        }
      } catch { /* ignore */ }
    }
    return orbs.map((o) => ({
      id: o.id,
      name: o.name || o.identity?.name || "",
      moves: (o.moves || []).length || (o.functions?.[0]?.steps || []).length || 0,
      weights: (o.weights || []).length,
      lenses: (o.lenses || []).length,
      systemPrompt: String(o.systemPrompt || ""),
    }));
  });
}

async function seedInvestor(page) {
  await page.evaluate((key) => {
    const investor = {
      id: "pearl:repro-investor",
      name: "My investor pearl",
      systemPrompt: "You are an investor pearl.\nWrite memos with risks.\n## Moves\n1. Draft memo\n## Weights\n- Evidence\n## Lenses\n- Skeptical investor",
      moves: [{ id: "m1", name: "Draft memo", description: "Write the memo" }],
      weights: [{ name: "Evidence", priority: 90, note: "Facts" }],
      lenses: [{ id: "l1", name: "Skeptical investor", description: "Question TAM" }],
    };
    const ws = JSON.parse(localStorage.getItem(key) || "{}") || {};
    const scene = (Array.isArray(ws.scenes) && ws.scenes[0]) || {
      id: "scene:repro",
      name: "Repro",
      semanticOrbs: [],
      activeSemanticOrbId: null,
    };
    const others = (scene.semanticOrbs || []).filter((o) => o.id !== investor.id);
    scene.semanticOrbs = [...others, investor];
    scene.activeSemanticOrbId = investor.id;
    ws.version = ws.version || 4;
    ws.scenes = [scene, ...(Array.isArray(ws.scenes) ? ws.scenes.slice(1) : [])];
    ws.activeSemanticOrbId = investor.id;
    localStorage.setItem(key, JSON.stringify(ws));
    const store = JSON.parse(localStorage.getItem("pearlEntities.v1") || "{}") || { version: 1, entities: {} };
    store.entities = { ...(store.entities || {}), [investor.id]: { ...investor, kind: "semantic", revision: 1 } };
    store.activePearlId = investor.id;
    localStorage.setItem("pearlEntities.v1", JSON.stringify(store));
  }, WS_KEY);
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

const report = {
  create: CREATE,
  compare: COMPARE,
  failed: false,
  buffettLayers: null,
  investorPresent: false,
  pearlCount: 0,
  compareRouted: false,
  systemPromptMutated: null,
  chatHasCompare: false,
  chatBlockedAskMode: false,
  downloadTriggered: false,
  pageErrors: errors,
  screenshot: path.join(OUT, "compare-pdf.png"),
};

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await openCompanion(page);

  await seedInvestor(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await openCompanion(page);

  await submitCompanion(page, CREATE);
  // Re-assert investor if create replaced the scene catalog.
  await seedInvestor(page);

  const orbsAfterCreate = await listOrbs(page);
  report.pearlCount = orbsAfterCreate.length;
  report.investorPresent = orbsAfterCreate.some((o) => /investor/i.test(o.name));
  report.buffettLayers = orbsAfterCreate.find((o) => /buffett/i.test(o.name)) || null;

  const beforeCompare = Object.fromEntries(orbsAfterCreate.map((o) => [o.id, o.systemPrompt]));

  page.on("download", () => { report.downloadTriggered = true; });
  await submitCompanion(page, COMPARE);
  await page.waitForTimeout(1_500);

  const orbsAfterCompare = await listOrbs(page);
  const chat = await page.evaluate(() => document.body?.innerText || "");
  const prompts = Object.fromEntries(orbsAfterCompare.map((o) => [o.id, o.systemPrompt]));

  const mutated = Object.entries(prompts).some(([id, prompt]) => {
    const prior = beforeCompare[id] || "";
    if (prompt === prior) return false;
    return /User refinement:|Source request:|give me a PDF|differences between/i.test(prompt);
  });
  report.systemPromptMutated = mutated;
  report.chatBlockedAskMode = /Ask mode inspected/i.test(chat);
  report.chatHasCompare = /Compared|Layer differences|Only in|Downloaded|Moves:|Weights:/i.test(chat)
    && !report.chatBlockedAskMode
    && !/Name or wear two distinct pearls/i.test(chat);
  report.compareRouted = report.chatHasCompare && !mutated;
  report.chatSnippet = chat.slice(0, 2500);

  await page.screenshot({ path: report.screenshot, fullPage: true });

  if (!report.buffettLayers || report.buffettLayers.moves < 1 || report.buffettLayers.weights < 1 || report.buffettLayers.lenses < 1) {
    report.failed = true;
    report.reason = "Buffett create missing M/W/L";
  } else if (!report.investorPresent) {
    report.failed = true;
    report.reason = "Investor pearl missing for compare";
  } else if (mutated) {
    report.failed = true;
    report.reason = "systemPrompt mutated with compare/PDF chat";
  } else if (report.chatBlockedAskMode) {
    report.failed = true;
    report.reason = "Ask-mode short-circuit blocked compare";
  } else if (!report.chatHasCompare) {
    report.failed = true;
    report.reason = "no comparison output in chat";
  }
} catch (err) {
  report.failed = true;
  report.reason = String(err?.message || err);
} finally {
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close().catch(() => {});
  if (server) server.kill("SIGTERM");
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
