#!/usr/bin/env node
/**
 * Headed evidence for the current Pearl capability demo (Watch what Pearl can do).
 * Proves director-running + ghost-cursor mid-anim; writes PNGs for human Read.
 *
 *   node scripts/pearl-capability-demo-stress.mjs
 *   SKIP_BUILD=1 AUDIT_URL=http://127.0.0.1:4179 node scripts/pearl-capability-demo-stress.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "audit-shots", "pearl-capability-demo");
const PORT = Number(process.env.AUDIT_PORT || 4179);
const BASE = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;

mkdirSync(OUT, { recursive: true });

async function waitForServer(url, server) {
  for (let i = 0; i < 80; i += 1) {
    if (server?.exitCode != null) throw new Error(`preview exited ${server.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview not ready: ${url}`);
}

async function main() {
  let server = null;
  if (!process.env.AUDIT_URL) {
    if (!process.env.SKIP_BUILD) {
      const build = spawn("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
      await new Promise((resolve, reject) => {
        build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build ${code}`))));
      });
    }
    server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT)], {
      cwd: ROOT,
      stdio: "pipe",
    });
    await waitForServer(BASE, server);
  }

  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    const play = page.locator('[data-testid="reef-play-demo"], [data-testid="reef-play-demo-intro"], [data-testid="welcome-play-demo"]').first();
    if (!(await play.count())) throw new Error("Play demo control missing");
    await play.click();

    let midAnim = false;
    let directorSeen = false;
    for (let i = 0; i < 160; i += 1) {
      const probe = await page.evaluate(() => {
        const body = String(document.body?.innerText || "");
        return {
          director: document.body.classList.contains("director-running"),
          cursor: Boolean(document.querySelector(".ghost-cursor")),
          caption: document.querySelector(".ghost-cursor-caption-text")?.textContent?.trim() || null,
          rich: /Demo ·|Worn into|Studio: Functions|Encode anything|Install Pearl|creating pearl|gauntlet/i.test(body)
            || Boolean(document.querySelector("[data-reef-pearl], .ghost-cursor-caption-text")),
        };
      });
      if (probe.director || probe.cursor) {
        directorSeen = true;
        if (!midAnim && (probe.rich || probe.caption || i > 12)) {
          midAnim = true;
          await page.screenshot({ path: path.join(OUT, "mid-anim.png"), fullPage: false });
          writeFileSync(path.join(OUT, "mid-anim.json"), JSON.stringify(probe, null, 2));
        }
      } else if (directorSeen && midAnim) {
        break;
      }
      await page.waitForTimeout(250);
    }
    await page.waitForFunction(() => !document.body.classList.contains("director-running"), null, { timeout: 60_000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, "after.png"), fullPage: false });
    await browser.close();

    const summary = {
      ok: directorSeen && midAnim,
      directorSeen,
      midAnim,
      out: OUT,
    };
    writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (!summary.ok) process.exitCode = 1;
  } finally {
    server?.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
