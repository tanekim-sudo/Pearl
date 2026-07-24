/**
 * Quick headed visual smoke: cold → Talk → create → rename → reload.
 * Writes PNGs for mandatory Read-tool critique. Exit 1 on visual-integrity fails.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "audit-shots/pearl-clueless-stress-2026-07-24");
const PORT = 41833;
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
  const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, VITE_LENS_EXTENSION_ID: "audit-extension-id" },
  });
  await waitServer(baseUrl, preview);
  const chrome = process.env.PW_CHROMIUM
    || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : undefined);
  const browser = await chromium.launch({ headless: false, executablePath: chrome });
  const fails = [];
  try {
    for (const vp of [{ w: 1280, h: 800, tag: "d" }, { w: 390, h: 844, tag: "m" }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      await ctx.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
      const page = await ctx.newPage();
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `vfix-${vp.tag}-01-welcome.png`), timeout: 8000 }).catch(() => {});
      await page.getByTestId("welcome-talk").click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `vfix-${vp.tag}-02-chat.png`), timeout: 8000 }).catch(() => {});
      const input = page.locator("[data-testid='companion-chat-input']");
      const go = page.locator("[data-testid='companion-go']");
      await input.fill("make a pearl about my investor notes");
      await go.click();
      await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(OUT, `vfix-${vp.tag}-03-create.png`), timeout: 8000 }).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      // reopen chat
      const talk = page.getByTestId("welcome-talk").or(page.getByTestId("reef-talk")).or(page.locator(".companion-orb")).first();
      if (await talk.count()) await talk.click().catch(() => {});
      await page.waitForTimeout(500);
      if (await input.count() && await input.isEnabled().catch(() => false)) {
        await input.fill("change the name to Series A notes");
        await go.click();
        await page.waitForTimeout(2500);
      }
      await page.screenshot({ path: path.join(OUT, `vfix-${vp.tag}-04-renamed-shelf.png`), timeout: 8000 }).catch(() => {});
      const integrity = await page.evaluate(() => {
        const intro = document.querySelector(".orb-home-intro");
        const introVis = intro && getComputedStyle(intro).visibility !== "hidden" && Number(getComputedStyle(intro).opacity || 1) > 0.2;
        const chat = document.querySelector(".companion-panel.shell-dock");
        const chatOpen = chat && chat.getBoundingClientRect().width > 40;
        const talkBtn = document.querySelector("[data-testid='reef-talk']");
        const talkVis = talkBtn && getComputedStyle(talkBtn).visibility !== "hidden" && Number(getComputedStyle(talkBtn).opacity || 1) > 0.2;
        const titles = [...document.querySelectorAll(".reef-pearl b, [data-reef-pearl] b")].map((e) => e.textContent.trim());
        return { introVis, chatOpen, talkCompete: Boolean(chatOpen && talkVis && introVis), titles };
      });
      if (integrity.talkCompete) fails.push(`${vp.tag}: Talk competes with chat`);
      if (!integrity.titles.some((t) => /Series A|investor/i.test(t))) fails.push(`${vp.tag}: titled pearl not on shelf UI (${JSON.stringify(integrity.titles)})`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `vfix-${vp.tag}-05-reload.png`), timeout: 8000 }).catch(() => {});
      await ctx.close();
    }
  } finally {
    await browser.close();
    preview.kill("SIGTERM");
  }
  console.log(fails.length ? `FAIL\n${fails.join("\n")}` : "PASS visual smoke proxies");
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
