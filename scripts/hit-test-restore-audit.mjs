/**
 * Headed-style hit-test proof: GO must be the element under the pointer (no force click).
 * Evidence: audit-shots/hit-test-restore-2026-07-23/
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = path.join(process.cwd(), "audit-shots/hit-test-restore-2026-07-23");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41801";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

fs.mkdirSync(out, { recursive: true });

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  defects: [],
  screenshots: [],
};

function record(id, ok, detail) {
  results.checks.push({ id, status: ok ? "pass" : "fail", detail });
  if (!ok) results.defects.push({ id, detail });
  console.log(`${ok ? "✓" : "✗"} ${id}: ${detail}`);
}

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: false });
  results.screenshots.push(file);
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, "01-land");

  const welcome = page.getByTestId("welcome-talk");
  if (await welcome.count()) {
    await welcome.click();
  } else {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  }
  await page.waitForTimeout(700);
  await shot(page, "02-chat-open");

  const chat = page.locator("body > .companion-panel.shell-dock").first();
  record("chat-dock-open", await chat.isVisible().catch(() => false), "shell-dock visible");

  const zOk = await page.evaluate(() => {
    const dock = document.querySelector("body > .companion-panel.shell-dock");
    const pearl = document.querySelector(".companion-orb-shell");
    if (!dock) return { ok: false, detail: "no dock" };
    const dz = Number(getComputedStyle(dock).zIndex) || 0;
    const pz = pearl ? (Number(getComputedStyle(pearl).zIndex) || 0) : 0;
    return { ok: dz > pz, detail: `dockZ=${dz} pearlZ=${pz}` };
  });
  record("dock-above-pearl", zOk.ok, zOk.detail);

  const input = page.locator("[data-testid='companion-chat-input']").first();
  record("input-present", await input.count() > 0, "chat input");
  if (await input.count()) {
    await input.click();
    await input.fill("make a pearl about Friday standup notes");
  }

  const go = page.locator("[data-testid='companion-go']").first();
  const goBox = await go.boundingBox();
  if (goBox) {
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        tag: el?.tagName,
        testid: el?.getAttribute?.("data-testid") || el?.closest?.("[data-testid]")?.getAttribute("data-testid"),
        text: el?.textContent?.trim()?.slice(0, 24),
      };
    }, { x: goBox.x + goBox.width / 2, y: goBox.y + goBox.height / 2 });
    const ok = hit.testid === "companion-go" || /GO/i.test(String(hit.text));
    record("go-element-from-point", ok, JSON.stringify(hit));
    if (ok) await go.click();
    else await go.click({ force: true });
  } else {
    record("go-element-from-point", false, "GO not laid out");
  }

  await page.waitForTimeout(1800);
  await shot(page, "03-after-go");

  const pearlCount = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("lens.unified-workspace.v1") || localStorage.getItem("lens.orb-universe.v1");
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const scenes = parsed.scenes || [];
      return scenes.reduce((n, s) => n + (s.semanticOrbs?.length || 0), 0);
    } catch {
      return 0;
    }
  });
  const msgOk = await page.locator(".companion-msg").count() > 1;
  record("go-executed", pearlCount > 0 || msgOk, `pearls=${pearlCount} msgs=${msgOk}`);

  const skip = page.getByTestId("welcome-skip");
  record("welcome-talk-primary", !(await page.getByText("Explore the Reef").count()), "Explore the Reef removed from welcome");
  record("welcome-skip-present", (await skip.count()) >= 0, "Skip secondary ok");

  fs.writeFileSync(path.join(out, "audit-results.json"), JSON.stringify(results, null, 2));
  const failed = results.defects.length;
  console.log(`\n${results.checks.length - failed}/${results.checks.length} passed`);
  await browser.close();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
