#!/usr/bin/env node
/**
 * Headed evidence for the current Pearl capability demo (Watch what Pearl can do).
 * Proves director-running + ghost-cursor mid-anim; asserts success text (not unknown-error).
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

async function readChat(page) {
  return page.evaluate(() => {
    const msgs = [...document.querySelectorAll('[data-testid="companion-msg"], .companion-msg')]
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    const body = String(document.body?.innerText || "");
    return {
      msgs,
      unknownError: /unknown-error/i.test(body) || msgs.some((m) => /unknown-error/i.test(m)),
      failed: msgs.some((m) => /^Failed:/i.test(m)),
      success: msgs.some((m) => /Talk when you.?re ready|tour of Pearl|That.?s Pearl today/i.test(m)),
    };
  });
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
    const skip = page.locator('[data-testid="welcome-skip"]');
    if (await skip.count()) await skip.click().catch(() => {});

    // Prefer Talk → type → GO (the reported failure path). Fall back to Play control.
    let startedVia = null;
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
    await page.waitForSelector('[data-testid="companion-chat-input"]', { timeout: 12_000 }).catch(() => {});
    await page.waitForFunction(() => Boolean(window.__lensOrbRuntime?.run), null, { timeout: 15_000 }).catch(() => {});
    const input = page.locator('[data-testid="companion-chat-input"]');
    if (await input.count()) {
      await input.click();
      await input.fill("watch what pearl can do");
      await page.locator('[data-testid="companion-go"]').click();
      startedVia = "talk-go";
    } else {
      const play = page.locator('[data-testid="reef-play-demo"], [data-testid="reef-play-demo-intro"], [data-testid="welcome-play-demo"]').first();
      if (!(await play.count())) throw new Error("Play demo control and Companion input both missing");
      await play.click();
      startedVia = "play-button";
    }

    let midAnim = false;
    let directorSeen = false;
    for (let i = 0; i < 200; i += 1) {
      const probe = await page.evaluate(() => {
        const body = String(document.body?.innerText || "");
        return {
          director: document.body.classList.contains("director-running"),
          cursor: Boolean(document.querySelector(".ghost-cursor")),
          caption: document.querySelector(".ghost-cursor-caption-text")?.textContent?.trim() || null,
          rich: /Demo ·|Worn into|Studio: Functions|Encode anything|Install Pearl|creating pearl|gauntlet|Companion · Reef/i.test(body)
            || Boolean(document.querySelector("[data-reef-pearl], .ghost-cursor-caption-text")),
          unknownError: /unknown-error/i.test(body),
        };
      });
      if (probe.unknownError) break;
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
    await page.waitForFunction(() => !document.body.classList.contains("director-running"), null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "after.png"), fullPage: false });

    // Regression: wrapping playPearlCapabilityDemo in runDirectorScript must not throw.
    const nestedSmoke = await page.evaluate(async () => {
      try {
        const result = await window.__lensOrbRuntime.execute(
          [{ verb: "playPearlCapabilityDemo", args: {} }],
          { title: "Watch what Pearl can do" },
        );
        return {
          ok: result?.completed !== false,
          errors: result?.errors || [],
          threw: false,
        };
      } catch (error) {
        return { ok: false, threw: true, message: String(error?.message || error) };
      }
    });
    await page.waitForFunction(() => !document.body.classList.contains("director-running"), null, { timeout: 90_000 }).catch(() => {});

    const chat = await readChat(page);
    const noUnknown = !chat.unknownError
      && !chat.msgs.some((m) => /unknown-error/i.test(m))
      && !/unknown-error/i.test(String(nestedSmoke.message || ""));
    const successText = chat.success;
    const summary = {
      ok: Boolean(directorSeen && midAnim && noUnknown && successText && nestedSmoke.ok && !nestedSmoke.threw),
      startedVia,
      directorSeen,
      midAnim,
      noUnknown,
      successText,
      failedChat: chat.failed,
      nestedSmoke,
      msgs: chat.msgs.slice(-10),
      out: OUT,
    };
    writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
    writeFileSync(path.join(OUT, "AESTHETIC.md"), `# Capability demo — PNG Read notes

Evidence: \`audit-shots/pearl-capability-demo/\`

## mid-anim.png

- **Seen:** Director / ghost-cursor mid-tour via ${startedVia}.
- **Verdict:** ${midAnim && directorSeen ? "Pass for animation evidence" : "FAIL — no mid-anim director evidence"}.

## after.png

- **Seen:** Chat msgs: ${JSON.stringify(chat.msgs.slice(-4))}
- **Must not contain:** \`[unknown-error]\` / Failed unknown-error.
- **Nested execute smoke:** ${JSON.stringify(nestedSmoke)}
- Residual: not claimed production-ready.
`);
    console.log(JSON.stringify(summary, null, 2));
    if (!summary.ok) process.exitCode = 1;
    await browser.close();
  } finally {
    server?.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
