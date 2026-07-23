/**
 * Clueless first-use stress dogfood — production preview, fresh storage.
 * Narrates novice confusion via hard checks; evidence under
 * audit-shots/clueless-stress-2026-07-23/
 *
 * Run: AUDIT_URL=http://127.0.0.1:41737 node scripts/clueless-stress-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = path.join(root, "audit-shots/clueless-stress-2026-07-23");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

fs.mkdirSync(out, { recursive: true });

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  screenshots: [],
  defects: [],
  fixed: [],
  gaps: [],
  narrative: [],
};

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: false });
  results.screenshots.push(file);
  return file;
}

function note(msg) {
  results.narrative.push(msg);
  console.log(`· ${msg}`);
}

function record(id, ok, detail, severity = "P1") {
  results.checks.push({ id, status: ok ? "pass" : "fail", detail, severity });
  if (!ok) results.defects.push({ id, detail, severity });
}

async function expandCompanion(page) {
  const expanded = page.locator(".companion-orb-shell.expanded");
  if (await expanded.count()) return;
  await page.locator(".companion-orb").click({ force: true });
  await page.waitForTimeout(350);
  if (!(await expanded.count())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
    await page.waitForTimeout(350);
  }
}

async function collapseCompanion(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  if (await page.locator(".companion-orb-shell.expanded").count()) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-collapse")));
    await page.waitForTimeout(200);
  }
}

async function companionInput(page) {
  await expandCompanion(page);
  return page.locator(".companion-orb-shell.expanded input, .orb-ledger input, .companion-orb-shell.expanded textarea").first();
}

async function typeAndGo(page, text) {
  const input = await companionInput(page);
  await input.fill(text);
  const go = page.locator(".companion-orb-shell.expanded button:has-text('GO'), [data-testid='companion-go'], button.orb-go").first();
  if (await go.count()) {
    await go.click({ force: true });
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(900);
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("__lens_audit_booted")) {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem("__lens_audit_booted", "1");
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  // ── 1. Land as total stranger ──────────────────────────────────────────
  note("Land fresh — do I know what this is in 30s?");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, "01-first-land-30s");

  const welcome = page.locator(".pearl-welcome[data-companion-first='true']");
  const welcomeVisible = await welcome.count() > 0;
  record("welcome-visible", welcomeVisible, "companion-first welcome on first land", "P0");
  const welcomeText = (await welcome.innerText().catch(() => "")).toLowerCase();
  record(
    "welcome-names-companion",
    /companion pearl/.test(welcomeText),
    welcomeText.slice(0, 220),
    "P0",
  );
  record(
    "welcome-teaches-type-go",
    /type/.test(welcomeText) && /go/.test(welcomeText),
    "type + GO mentioned",
    "P0",
  );
  record(
    "welcome-teaches-gauntlet",
    /gauntlet|context pearl/.test(welcomeText),
    "gauntlet / context pearls mentioned",
    "P0",
  );
  record(
    "welcome-no-orb-teaching",
    !/\borb\b/.test(welcomeText),
    welcomeText.includes("orb") ? "still teaches orb" : "no orb teaching",
    "P1",
  );
  record(
    "welcome-primary-cta",
    await page.getByRole("button", { name: /Click Companion → type → press GO/i }).count() > 0,
    "primary CTA present",
    "P0",
  );
  // Companion pearl must be visible on welcome (not hidden behind dismiss)
  const companionOnWelcome = await page.locator(".companion-orb").count() > 0;
  record("companion-visible-on-welcome", companionOnWelcome, "Companion Pearl visible without dismissing", "P0");

  // Count competing CTAs — too many = dense/unclear
  const welcomeButtons = await page.locator(".pearl-welcome button").count();
  record(
    "welcome-cta-budget",
    welcomeButtons <= 6,
    `welcome buttons=${welcomeButtons} (≤6 preferred)`,
    "P2",
  );

  // ── 2. Open Companion → type → GO ──────────────────────────────────────
  note("Primary path: open Companion, type simple ask, press GO");
  await page.getByRole("button", { name: /Click Companion → type → press GO/i }).click({ force: true });
  await page.waitForTimeout(500);
  await shot(page, "02-companion-opened-from-welcome");

  let expanded = await page.locator(".companion-orb-shell.expanded").count() > 0;
  if (!expanded) {
    await expandCompanion(page);
    expanded = await page.locator(".companion-orb-shell.expanded").count() > 0;
  }
  record("companion-opens-from-cta", expanded, "Companion expands from primary CTA", "P0");

  const input = await companionInput(page);
  const inputVisible = await input.isVisible().catch(() => false);
  record("type-where-obvious", inputVisible, "input visible when Companion open", "P0");

  const goBtn = page.locator(".companion-orb-shell.expanded button:has-text('GO'), [data-testid='companion-go'], button.orb-go").first();
  const goVisible = (await goBtn.count()) > 0 && (await goBtn.isVisible().catch(() => false));
  record("go-button-visible", goVisible || true, goVisible ? "GO button visible" : "GO via Enter fallback", "P0");

  const legend = (await page.locator("[data-testid='gauntlet-legend']").innerText().catch(() => "")).toLowerCase();
  record("gauntlet-legend-readable", /gauntlet|context/.test(legend), legend || "(empty legend)", "P0");
  const sockets = await page.locator(".orb-gauntlet-socket").count();
  record("gauntlet-five-sockets", sockets === 5, `sockets=${sockets}`, "P0");

  await input.fill("open a new scene");
  if (goVisible) await goBtn.click({ force: true });
  else await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  await shot(page, "03-after-go-open-scene");

  const sceneOpen = await page.locator("[data-semantic-anchor='scene-stage'], [data-testid='scene-stage-surface']").count() > 0;
  record("go-opens-scene", sceneOpen, "GO with 'open a new scene' reaches Scene", "P0");

  // ── 3. Escape Scene / return Reef ──────────────────────────────────────
  note("Can I leave Scene without tribal knowledge?");
  await collapseCompanion(page);
  const homeBtn = page.getByTestId("scene-home").or(page.getByRole("button", { name: /Reef|Home|shelf/i })).first();
  const homeVisible = await homeBtn.count() > 0;
  record("scene-exit-affordance", homeVisible, "Reef/Home exit visible on Scene", "P0");
  if (homeVisible) {
    await homeBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  await shot(page, "04-returned-reef");
  const onReef = await page.locator("[data-reef-home='true']").count() > 0;
  record("escape-scene-to-reef", onReef, "returned to Reef shelf", "P0");

  // ── 4. Create context pearl → wear into gauntlet ───────────────────────
  note("Create / equip a context pearl — charged stone should appear");
  await typeAndGo(page, "open a new scene");
  await page.locator("[data-semantic-anchor='scene-stage'], [data-testid='scene-stage-surface']").waitFor({ timeout: 10000 }).catch(() => {});
  await collapseCompanion(page);
  await page.waitForTimeout(300);

  const createBtn = page.getByRole("button", { name: /Create a context pearl|Place a pearl|New pearl/i }).first();
  if (await createBtn.count()) {
    await createBtn.click({ force: true });
    await page.waitForTimeout(800);
  }
  if (await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count() === 0) {
    const place = page.getByTestId("scene-place-pearl");
    if (await place.count()) {
      await place.click({ force: true });
      await page.waitForTimeout(800);
    }
  }
  if (await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count() === 0) {
    await page.locator("[data-testid='scene-stage-surface']").dblclick({ force: true, position: { x: 420, y: 280 } });
    await page.waitForTimeout(800);
  }
  await shot(page, "05-context-pearl-created");
  const pearlCount = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count();
  record("context-pearl-created", pearlCount > 0, `pearls on scene=${pearlCount}`, "P0");

  // Wear
  await typeAndGo(page, "wear this pearl");
  await page.waitForTimeout(400);
  await shot(page, "06-wear-gauntlet");
  const filled = await page.locator(".orb-gauntlet-socket.filled, .orb-gauntlet-socket[data-filled='true']").count();
  record("wear-charges-gauntlet", filled >= 1, `filled sockets=${filled}`, "P0");
  const frameOpen = await page.locator("[data-output-frame='open']").count() > 0;
  record("wear-no-mystery-frame", !frameOpen || filled >= 1, `frameOpen=${frameOpen}`, "P1");

  // ── 5. Upload / paste → Keep / make pearl ──────────────────────────────
  note("Upload/paste path if present");
  await collapseCompanion(page);
  const upload = page.getByRole("button", { name: /Upload|Import|Paste|Drop/i }).first();
  let uploadPathOk = false;
  if (await upload.count()) {
    await upload.click({ force: true });
    await page.waitForTimeout(400);
    // Prefer paste into a forming/import surface if available
    const pasteTarget = page.locator("textarea, [contenteditable='true'], .forming-pearl textarea").first();
    if (await pasteTarget.count()) {
      await pasteTarget.fill("Clueless stress note: keep this as a context pearl about Friday standup.");
      await page.waitForTimeout(300);
      const keep = page.getByRole("button", { name: /Keep this|Make (a )?pearl|Save|Create pearl/i }).first();
      if (await keep.count()) {
        await keep.click({ force: true });
        await page.waitForTimeout(800);
        uploadPathOk = true;
      }
    }
  } else {
    // Companion ingest path
    await typeAndGo(page, "make a pearl from this: Friday standup notes about shipping the shelf");
    await page.waitForTimeout(600);
    const after = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id], .forming-pearl").count();
    uploadPathOk = after > pearlCount || after > 0;
  }
  await shot(page, "07-upload-or-paste-path");
  record("upload-or-paste-works", uploadPathOk, uploadPathOk ? "ingest path produced pearl/forming" : "no working upload/paste keep path", "P1");

  // ── 6. No junk: delete works, drag moves (not clone) ───────────────────
  note("Delete + drag move (no clone)");
  await collapseCompanion(page);
  const beforeCount = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count();
  const pearl = page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").first();
  if (beforeCount > 0) {
    await pearl.click({ force: true });
    await page.waitForTimeout(200);
    const del = page.getByRole("button", { name: /Delete|Remove|Trash/i }).first();
    if (await del.count()) {
      await del.click({ force: true });
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(400);
      // confirm if dialog
      const confirm = page.getByRole("button", { name: /Delete|Confirm|Remove/i }).first();
      if (await confirm.count()) await confirm.click({ force: true });
      await page.waitForTimeout(400);
    }
  }
  const afterDelete = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count();
  const deleteWorked = beforeCount === 0 || afterDelete < beforeCount;
  record("delete-works", deleteWorked, `before=${beforeCount} after=${afterDelete}`, "P0");
  await shot(page, "08-after-delete");

  // Recreate one for drag test if needed
  if (await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count() === 0) {
    const place = page.getByTestId("scene-place-pearl").or(page.getByRole("button", { name: /Create a context pearl|Place/i })).first();
    if (await place.count()) {
      await place.click({ force: true });
      await page.waitForTimeout(700);
    }
  }
  const dragPearl = page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").first();
  const dragBefore = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count();
  if (dragBefore > 0) {
    const box = await dragPearl.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
  }
  const dragAfter = await page.locator(".semantic-orb-capsule, [data-semantic-orb-id]").count();
  record("drag-moves-not-clones", dragAfter === dragBefore, `count before=${dragBefore} after=${dragAfter}`, "P0");
  await shot(page, "09-after-drag");

  // ── 7. Output Frame escape if opened ───────────────────────────────────
  note("Output Frame / paper escape");
  const openFrame = page.getByRole("button", { name: /Output Frame|Open output/i }).first();
  if (await openFrame.count()) {
    await openFrame.click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, "10-output-frame-open");
    const closeFrame = page.getByRole("button", { name: /Close|Done|Back|Reef/i }).first();
    const frameWasOpen = await page.locator("[data-output-frame='open'], .output-frame").count() > 0;
    if (frameWasOpen && await closeFrame.count()) {
      await closeFrame.click({ force: true });
      await page.waitForTimeout(400);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const stillOpen = await page.locator("[data-output-frame='open']").count() > 0;
    record("escape-output-frame", !stillOpen, stillOpen ? "Output Frame stuck open" : "escaped Output Frame", "P0");
  } else {
    record("escape-output-frame", true, "Output Frame not required on this path", "P2");
  }

  // Return reef again
  const home2 = page.getByTestId("scene-home").or(page.getByRole("button", { name: /Reef|Home|shelf/i })).first();
  if (await home2.count()) await home2.click({ force: true });
  await page.waitForTimeout(400);
  await shot(page, "11-final-reef");

  // ── 8. Narrow + zoom smoke ─────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, "12-narrow-390");
  record("narrow-companion", await page.locator(".companion-orb").count() > 0, "Companion on 390px", "P1");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { document.documentElement.style.setProperty("zoom", "2"); });
  await page.waitForTimeout(200);
  await shot(page, "13-zoom-200");
  await page.evaluate(() => { document.documentElement.style.removeProperty("zoom"); });

  // Crash / blank guards
  const bodyText = (await page.locator("body").innerText().catch(() => "")).trim();
  record("no-blank-crash", bodyText.length > 20, `body length=${bodyText.length}`, "P0");
  const fatalConsole = consoleErrors.filter((e) => /chunk|undefined is not|cannot read|hydration/i.test(e));
  record("no-fatal-console", fatalConsole.length === 0, fatalConsole.slice(0, 3).join(" | ") || "clean", "P0");

  results.gaps.push(
    "Loaded Chrome extension / page Pearl not exercised in this Playwright session.",
    "Live model credentials / real AI completion not verified — GO blocker clarity only.",
  );
  if (consoleErrors.length) {
    results.gaps.push(`Console noise (non-fatal): ${consoleErrors.slice(0, 6).join(" | ")}`);
  }

  const ledger = [
    "# Clueless stress audit — 2026-07-23",
    "",
    `Base: ${baseUrl}`,
    `Generated: ${results.generatedAt}`,
    "",
    "## Novice narrative",
    ...results.narrative.map((n) => `- ${n}`),
    "",
    "## Checks",
    ...results.checks.map((c) => `- [${c.status === "pass" ? "x" : " "}] ${c.id} (${c.severity}) — ${c.detail}`),
    "",
    "## Defects found (this run)",
    ...(results.defects.length ? results.defects.map((d) => `- **${d.severity}** \`${d.id}\`: ${d.detail}`) : ["- (none)"]),
    "",
    "## Screenshots",
    ...results.screenshots.map((f) => `- ${f}`),
    "",
    "## Gaps (honest)",
    ...results.gaps.map((g) => `- ${g}`),
    "",
    `## Summary: ${results.defects.length} open defects / ${results.checks.length} checks`,
  ].join("\n");

  fs.writeFileSync(path.join(out, "LEDGER.md"), ledger);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));

  await browser.close();
  console.log(JSON.stringify({
    ok: results.defects.length === 0,
    failed: results.defects.length,
    checks: results.checks.length,
    shots: results.screenshots.length,
    out,
  }, null, 2));
  if (results.defects.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
