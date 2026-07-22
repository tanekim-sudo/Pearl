/**
 * Real-user first-use dogfood for the website (production preview).
 * Captures evidence under audit-shots/web-workability-2026-07-22/
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = path.join(root, "audit-shots/web-workability-2026-07-22");
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
};

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: true });
  results.screenshots.push(file);
}

function record(id, ok, detail) {
  results.checks.push({ id, ok, detail });
  if (!ok) results.defects.push({ id, detail, severity: "P0" });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // Journey 1: open the site — what do I do?
  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await shot(page, "01-first-open-reef");
  const reef = await page.locator("[data-reef-home='true']").count();
  const reefChrome = await page.locator("[data-testid='reef-chrome']").count();
  const nextStep = await page.locator("[data-testid='reef-next-step']").count();
  const paperOnHome = await page.locator("[data-semantic-anchor='output-frame']").count();
  const companion = await page.locator("[data-semantic-anchor='primary-orb']").count();
  const gauntletLabel = await page.locator("[data-testid='gauntlet-legend']").count();
  const bodyText = await page.locator("body").innerText();
  record("home-is-reef", reef > 0, `reef=${reef}`);
  record("reef-chrome-spells-next", reefChrome > 0 && (/Next:/i.test(bodyText) || nextStep > 0), `chrome=${reefChrome} next=${nextStep} hasNext=${/Next:/i.test(bodyText)}`);
  record("no-auto-paper-on-home", paperOnHome === 0, `outputFrameHosts=${paperOnHome}`);
  record("companion-visible", companion > 0, `companion=${companion}`);
  record("gauntlet-labeled", gauntletLabel > 0, `legend=${gauntletLabel}`);

  // Dismiss welcome so home chrome is fully interactive, then open a workspace.
  const skip = page.locator(".pearl-welcome-dismiss");
  if (await skip.count()) {
    await skip.click({ force: true });
    await page.locator(".pearl-welcome").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(300);
  await shot(page, "01b-reef-after-welcome");

  // Journey 2: create / open a pearl via workspace CTA
  const newScene = page.locator(".orb-recent-orbit").getByRole("button", { name: /Create a pearl workspace|New Scene/i }).first();
  await newScene.click({ force: true });
  await page.waitForTimeout(700);
  await shot(page, "02-new-scene-empty");
  const stage = await page.locator("[data-semantic-anchor='scene-stage']").count();
  const chrome = await page.locator("[data-testid='pearl-scene-chrome']").count();
  const autoFrame = await page.locator("[data-semantic-anchor='output-frame']").count();
  const emptyTeach = await page.locator("[data-testid='scene-empty']").count();
  const sceneCopy = await page.locator("[data-testid='pearl-scene-chrome']").innerText();
  record("scene-opens", stage > 0, `stage=${stage}`);
  record("scene-chrome-visible", chrome > 0 && /Next:/i.test(sceneCopy), `chrome=${chrome}`);
  record("no-auto-output-frame-on-scene", autoFrame === 0, `frame=${autoFrame}`);
  record("empty-state-teaches", emptyTeach > 0, `empty=${emptyTeach}`);

  // Journey 3: place a pearl, then delete it (create activates the pearl — don't toggle it off)
  await page.getByTestId("scene-place-pearl").click();
  await page.waitForTimeout(700);
  await shot(page, "03-pearl-placed");
  const beforeDelete = await page.locator(".semantic-orb-capsule").count();
  record("pearl-created", beforeDelete >= 1, `pearls=${beforeDelete}`);
  await page.locator(".semantic-orb-delete").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".semantic-orb-delete").click({ force: true });
  await page.getByTestId("confirm-delete-pearl").click({ force: true });
  await page.waitForTimeout(700);
  await shot(page, "04-pearl-deleted");
  const afterDelete = await page.locator(".semantic-orb-capsule").count();
  record("delete-removes-pearl", afterDelete < beforeDelete || afterDelete === 0, `before=${beforeDelete} after=${afterDelete}`);

  // Journey 4: page canvas only from intentional chrome; Esc returns to workspace
  await page.getByTestId("scene-toggle-frame").click();
  await page.waitForTimeout(500);
  await shot(page, "05-output-frame-intentional");
  const frameOpen = await page.locator("[data-semantic-anchor='output-frame']").count();
  const frameLabel = await page.locator("[data-testid='output-frame-label']").count();
  const chromeOnFrame = await page.locator("[data-testid='pearl-scene-chrome']").count();
  const homeBtn = await page.getByTestId("scene-home").count();
  record("frame-opens-from-chrome", frameOpen > 0, `frame=${frameOpen}`);
  record("frame-labeled", frameLabel > 0, `label=${frameLabel}`);
  record("frame-keeps-chrome", chromeOnFrame > 0 && homeBtn > 0, `chrome=${chromeOnFrame} home=${homeBtn}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await shot(page, "06-esc-closes-frame");
  const frameAfterEsc = await page.locator("[data-semantic-anchor='output-frame']").count();
  record("esc-closes-output-frame", frameAfterEsc === 0, `frame=${frameAfterEsc}`);

  // Journey 5: go home
  await page.getByTestId("scene-home").click();
  await page.waitForTimeout(500);
  await shot(page, "07-back-to-reef");
  const reefAgain = await page.locator("[data-reef-home='true']").count();
  record("reef-escape-hatch", reefAgain > 0, `reef=${reefAgain}`);

  // Journey 6: drag moves (unit-proven) — materialize one item via evaluate + move via drop API
  await page.evaluate(() => {
    const id = "scene-workability-drag";
    const scene = {
      version: 4,
      id,
      kind: "scene",
      name: "Drag Scene",
      world: { background: "black", unbounded: true },
      frames: [],
      items: [{ id: "mat-1", type: "text", text: "movable note", x: -40, y: -20, sceneId: id }],
      nodes: [],
      orbInstances: [],
      semanticOrbs: [],
      activeSemanticOrbId: null,
      camera: { x: 80, y: 56, scale: 0.72 },
      workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
      metadata: { createdFrom: "workability-audit" },
    };
    localStorage.setItem("lens.scenes.v4", JSON.stringify({
      version: 4,
      activeSceneId: id,
      scenes: [scene],
    }));
  });
  await page.goto(`${baseUrl}/scene/scene-workability-drag`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "08-scene-with-material");
  const material = page.locator("[data-material-id='mat-1']");
  await material.waitFor({ state: "visible", timeout: 5000 });
  const boxBefore = await material.boundingBox();
  const stageBox = await page.locator(".orb-black-stage").boundingBox();
  await material.dragTo(page.locator(".orb-black-stage"), {
    targetPosition: { x: (stageBox?.width || 800) * 0.7, y: (stageBox?.height || 600) * 0.55 },
  });
  await page.waitForTimeout(500);
  await shot(page, "09-after-drag-move");
  const materialCount = await page.locator("[data-material-id]").count();
  const boxAfter = await material.boundingBox();
  const moved = boxBefore && boxAfter
    && (Math.abs(boxAfter.x - boxBefore.x) > 8 || Math.abs(boxAfter.y - boxBefore.y) > 8);
  record("drag-does-not-clone", materialCount === 1, `materials=${materialCount}`);
  record("drag-moves-material", Boolean(moved), `before=${JSON.stringify(boxBefore)} after=${JSON.stringify(boxAfter)}`);

  await material.click();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(300);
  await shot(page, "10-material-deleted");
  const afterMaterialDelete = await page.locator("[data-material-id='mat-1']").count();
  record("delete-removes-material", afterMaterialDelete === 0, `count=${afterMaterialDelete}`);

  record("no-console-errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | ") || "none");

  await browser.close();
  fs.writeFileSync(path.join(out, "audit-results.json"), JSON.stringify(results, null, 2));
  const failed = results.checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ out, passed: results.checks.length - failed.length, failed: failed.length, failedIds: failed.map((f) => f.id) }, null, 2));
  assert.equal(failed.length, 0, `workability defects: ${failed.map((f) => f.id).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
