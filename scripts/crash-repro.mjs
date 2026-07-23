/**
 * Reproduce RootErrorBoundary / action crashes on production preview.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = path.join(process.cwd(), "audit-shots/clueless-stress-2026-07-23");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41739";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

fs.mkdirSync(out, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push({ type: "pageerror", message: String(err), stack: err.stack }));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ type: "console", message: msg.text() });
  });

  async function shot(name) {
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
  }

  async function crashVisible() {
    const text = await page.locator("body").innerText();
    return /Pearl hit a crash|This workspace crashed|stopped unexpectedly/i.test(text);
  }

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await shot("crash-01-land");
  console.log("land crash?", await crashVisible());

  // Dismiss welcome
  const dismiss = page.locator(".pearl-welcome-dismiss");
  if (await dismiss.count()) await dismiss.click({ force: true });
  await page.waitForTimeout(400);
  await shot("crash-02-after-welcome");
  console.log("after welcome crash?", await crashVisible());

  // Open companion
  await page.locator(".companion-orb").click({ force: true });
  await page.waitForTimeout(500);
  await shot("crash-03-companion-click");
  console.log("companion click crash?", await crashVisible(), "errors", errors.length);

  // Try expand event + chat
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  await page.waitForTimeout(400);
  await shot("crash-04-expand-event");
  console.log("expand crash?", await crashVisible());

  // Type into companion orb ledger if present
  const input = page.locator(".orb-ledger input, [data-testid='companion-chat-input'], .companion-input").first();
  if (await input.count()) {
    await input.fill("open a new scene");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    await shot("crash-05-go-open-scene");
    console.log("GO open scene crash?", await crashVisible());
    console.log("body snippet:", (await page.locator("body").innerText()).slice(0, 400));
  } else {
    console.log("NO INPUT FOUND");
    await shot("crash-05-no-input");
  }

  // Try create pearl
  if (!(await crashVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
    await page.waitForTimeout(300);
    const input2 = page.locator(".orb-ledger input, [data-testid='companion-chat-input'], .companion-input").first();
    if (await input2.count()) {
      await input2.fill("make a pearl about Friday standup");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      await shot("crash-06-make-pearl");
      console.log("make pearl crash?", await crashVisible());
      console.log("body snippet:", (await page.locator("body").innerText()).slice(0, 500));
    }
  }

  // Try wear
  if (!(await crashVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
    await page.waitForTimeout(300);
    const input3 = page.locator(".orb-ledger input, [data-testid='companion-chat-input'], .companion-input").first();
    if (await input3.count()) {
      await input3.fill("wear this pearl");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      await shot("crash-07-wear");
      console.log("wear crash?", await crashVisible());
    }
  }

  fs.writeFileSync(path.join(out, "crash-errors.json"), JSON.stringify({ baseUrl, errors, crashed: await crashVisible() }, null, 2));
  console.log(JSON.stringify({ errors: errors.slice(0, 20), crashed: await crashVisible() }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
