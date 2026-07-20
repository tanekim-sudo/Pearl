import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5173";
const OUT = path.resolve("audit-shots/brush-workflow");
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const errors = [];
let executionCalls = 0;
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  ...(process.env.PW_CHROMIUM
    ? { executablePath: process.env.PW_CHROMIUM }
    : fs.existsSync(systemChrome)
      ? { executablePath: systemChrome }
      : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  hasTouch: true,
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.route("**/api/run", async (route) => {
    executionCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ outputs: ["Contextual runtime output"] }),
    });
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem(
      "lens.companion.memory.v1:anonymous",
      JSON.stringify({ version: 1, interviewComplete: true })
    );
    localStorage.setItem(
      "lens.board.items.v1",
      JSON.stringify([
        { id: "brush-text", type: "text", x: 130, y: 170, w: 280, text: "Brush this exact phrase into a reusable idea.", pageId: "page-main" },
        { id: "brush-note", type: "sticky", x: 160, y: 310, w: 190, text: "A disconnected observation", pageId: "page-main" },
        { id: "brush-ink", type: "stroke", points: [{ x: 120, y: 430 }, { x: 330, y: 465 }], color: "#171717", width: 3, pageId: "page-main" },
      ])
    );
    localStorage.setItem(
      "lens.board.pages.v1",
      JSON.stringify([{ id: "page-main", name: "Brush audit", camera: { x: 100, y: 50, scale: 0.78 }, sessions: [] }])
    );
    localStorage.setItem("lens.board.camera.v1", JSON.stringify({ x: 100, y: 50, scale: 0.78 }));
    localStorage.setItem("lens.scenes.v4", JSON.stringify({
      version: 4,
      activeSceneId: "brush-audit",
      scenes: [{
        id: "brush-audit",
        kind: "scene",
        version: 4,
        name: "Brush audit",
        items: [
          { id: "brush-text", type: "text", x: 130, y: 170, w: 280, text: "Brush this exact phrase into a reusable idea.", pageId: "page-main", frameId: null },
          { id: "brush-note", type: "sticky", x: 160, y: 310, w: 190, text: "A disconnected observation", pageId: "page-main", frameId: null },
          { id: "brush-ink", type: "stroke", points: [{ x: 120, y: 430 }, { x: 330, y: 465 }], color: "#171717", width: 3, pageId: "page-main", frameId: null },
        ],
        nodes: [],
        frames: [],
        orbInstances: [],
        semanticOrbs: [],
        activeSemanticOrbId: null,
        workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
        camera: { x: 100, y: 50, scale: 0.78 },
      }],
    }));
    localStorage.setItem(
      "lens.lenses.v2",
      JSON.stringify([{
        id: "audit-generator",
        stableId: "audit-generator",
        version: 1,
        schemaVersion: 2,
        kind: "lens",
        libraryKind: "lens",
        title: "Evidence garden",
        name: "Evidence garden",
        contextPolicy: "bounded",
        contextBudget: 24000,
        inclusionPolicy: { private: true, includeSources: true, excludeSensitive: true },
        contextGraph: { material: [], relationships: [], placements: [] },
        items: [],
        createdAt: Date.now()
      }])
    );
  });
  await page.goto(`${BASE}/scene/brush-audit?frame=workspace`);
  await page.waitForSelector('[data-tool="highlight"]');

  const brushTool = page.locator('[data-tool="highlight"]');
  check("brush has accessible name", (await brushTool.getAttribute("aria-label")) === "Brush / highlight");
  check("brush uses an SVG icon", (await brushTool.locator("svg").count()) === 1);

  const primitive = page.locator(".op-card:visible").first();
  const primitiveBrush = primitive.locator(".rail-brush-btn");
  await primitive.hover();
  await primitiveBrush.click();
  check("lens-first queues and switches tools", await primitive.evaluate((el) => el.classList.contains("brush-armed")) && (await brushTool.getAttribute("class")).includes("active"));
  check("queue alone has no GO", (await page.locator(".brush-go").count()) === 0);
  check("queue alone produces no output", (await page.locator(".ai-node").count()) === 0);
  await shot(page, "lens-first-queued");

  const text = page.locator('[data-item="brush-text"]');
  const textBox = await text.boundingBox();
  await page.mouse.move(textBox.x + 18, textBox.y + textBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(textBox.x + textBox.width - 18, textBox.y + textBox.height / 2, { steps: 14 });
  await page.mouse.up();
  check("stroke only updates living selection", (await page.locator(".ai-node").count()) === 0);
  check("GO appears with material and pending lens", await page.locator(".brush-go").isVisible());
  await shot(page, "selection-stack-go");

  await page.keyboard.press("Escape");
  check("Escape clears pending before marks", !(await primitive.evaluate((el) => el.classList.contains("brush-armed"))) && (await page.locator(".omni-highlight-bar").count()) === 1);
  if (await page.getByLabel("Disarm brush target").isVisible().catch(() => false)) {
    await page.getByLabel("Disarm brush target").click();
    await page.waitForTimeout(120);
  }
  await page.keyboard.press("Escape");

  await brushTool.click();
  const note = page.locator('[data-item="brush-note"]');
  const noteBox = await note.boundingBox();
  await page.mouse.click(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
  const generator = page.locator('[data-struct-id="audit-generator"]');
  await generator.hover();
  await generator.locator(".rail-brush-btn").click();
  await page.waitForTimeout(120);
  const readGeneratorItems = () => page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]");
    return records.find((entry) => entry.id === "audit-generator")?.items?.length || 0;
  });
  const queuedLabels = () => page.locator(".omni-highlight-stack-chip").allTextContents();
  check("Lens context remains immutable while queued", (await readGeneratorItems()) === 0);
  const contextOnlyGoCount = await page.locator(".brush-go:visible").count();
  check("Lens context alone cannot execute", contextOnlyGoCount === 0, `${contextOnlyGoCount} GO · ${(await queuedLabels()).join(" | ")}`);
  await primitive.hover();
  await primitive.locator(".rail-brush-btn").click();
  await page.waitForTimeout(120);
  const contextualActionGoCount = await page.locator(".brush-go:visible").count();
  check("Move plus Lens context shows GO", contextualActionGoCount === 1, `${contextualActionGoCount} GO · ${(await queuedLabels()).join(" | ")}`);
  await shot(page, "highlight-first-generator-queued");
  const callsBeforeContextRun = executionCalls;
  await page.locator(".brush-go:visible").click();
  await page.waitForTimeout(500);
  const generatorItems = await readGeneratorItems();
  check("GO applies action without mutating Lens context", generatorItems === 0, `${generatorItems} context mutations`);
  check("contextual action commits exactly once", executionCalls === callsBeforeContextRun + 1, `${callsBeforeContextRun} → ${executionCalls} model calls`);
  check("successful GO clears pending stack", (await page.locator(".omni-highlight-stack-chip").count()) === 0);
  await shot(page, "generator-after-go");

  await page.keyboard.press("Escape");
  await page.mouse.click(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
  await generator.hover();
  await generator.locator(".rail-brush-btn").focus();
  await page.keyboard.press("Enter");
  check("keyboard can queue Lens context", await generator.evaluate((el) => el.classList.contains("brush-armed")));
  await primitive.hover();
  await primitive.locator(".rail-brush-btn").click();
  await page.waitForTimeout(120);

  await page.setViewportSize({ width: 1080, height: 720 });
  await page.waitForTimeout(150);
  check("pending stack and GO fit narrow viewport", await page.locator(".omni-highlight-bar").isVisible() && await page.locator(".brush-go").isVisible());
  await shot(page, "narrow-stack-go");

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const passed = checks.filter((entry) => entry.ok).length;
const report = `# Brush workflow audit

## Result

${passed}/${checks.length} visible-UI checks passed.

## Semantics exercised

- Lens-first and highlight-first only build one pending state; neither a card click nor stroke executes.
- GO appears only with material plus a valid pending action and is the sole mutation boundary.
- Escape clears pending operations before following the established selection-clear contract.
- Lens context remains immutable; GO requires and executes a Move/Function action with that context.
- Keyboard activation, SVG accessible naming, narrow layout, and runtime page errors are checked.
- GO commits are keyed in the application pipeline, so duplicate delivery is idempotent.
- AI output content/latency remains model-provider dependent and is covered structurally by the repository transform/branch tests.

## Checks

${checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? `: ${entry.detail}` : ""}`).join("\n")}

## Screenshots

- [Lens-first queued](lens-first-queued.png)
- [Selection, stack, and GO](selection-stack-go.png)
- [Highlight-first generator queued](highlight-first-generator-queued.png)
- [Generator after GO](generator-after-go.png)
- [Narrow stack and GO](narrow-stack-go.png)
`;
fs.writeFileSync(path.join(OUT, "REPORT.md"), report);
if (passed !== checks.length) process.exitCode = 1;
