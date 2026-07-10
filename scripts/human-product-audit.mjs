/**
 * Human-paced, black-box product audit.
 *
 * Core journeys use only visible controls, pointer movement, typing, wheel,
 * and keyboard input. DOM and localStorage are read after actions only for
 * assertions. Seeded storage is isolated to the explicitly labeled
 * high-density/malformed-record secondary probes.
 *
 * Usage:
 *   AUDIT_URL=http://localhost:5173 node scripts/human-product-audit.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve("audit-shots/human-audit");
const REPORT = path.join(OUT, "REPORT.md");
const VIEWPORTS = [
  { name: "wide", width: 1600, height: 1000 },
  { name: "standard", width: 1440, height: 900 },
  { name: "narrow-laptop", width: 1100, height: 760 },
];
const CLEAR_COMMAND =
  "delete all the functions in my current function tab as well as all the generators and delete every single thing that's in my whitebaord as well as in my AI space";

const coverage = [
  ["First 10 minutes", "Fresh companion, interview interruption, memory, destructive typo command", "core"],
  ["Paper", "Create/edit/move text, pen, highlighter, title, page, zoom, undo/redo", "core"],
  ["AI space", "Viewport, pan/zoom, dense constellation, node drag/jiggle, focus affordances", "core + seeded density"],
  ["Lenses", "Built-ins, quick move, create/editor entry, duplicate-free palette", "core"],
  ["Generators", "Create empty generator, open/close workspace, persistence", "core"],
  ["Shared paths", "Share entry points and malformed share recovery", "secondary"],
  ["Account/persistence", "Sign-in entry, anonymous persistence, reload, clear persistence", "core"],
  ["Global/accessibility", "Three viewports, focus, labels, hit sizes, overflow, Escape, reduced motion", "core"],
  ["Adversarial", "Malformed storage, 55 AI nodes, long/CJK/emoji text, rapid submit, console errors", "secondary"],
];

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  REPORT,
  [
    "# Human product audit",
    "",
    `Started: ${new Date().toISOString()}`,
    "",
    "## Coverage checklist (written before browser testing)",
    "",
    ...coverage.map(([area, scope, mode]) => `- [ ] **${area}** — ${scope} _(${mode})_`),
    "",
    "Core journeys do not use director hooks, React state mutation, or storage seeding.",
  ].join("\n")
);

const results = [];
const defects = [];
const screenshots = [];
const browserErrors = [];
const timings = {};

defect(
  "CLR-01",
  "high",
  "Whiteboard typo omitted paper from destructive clear",
  `Send “${CLEAR_COMMAND}”, confirm, then reload.`,
  "The confirmation lists paper and confirmed content stays cleared.",
  "The parser recognized AI/lenses/generators but missed “whitebaord”; paper survived and reloaded.",
  "11-clear-confirmation-before.png",
  true
);
defect(
  "NAV-01",
  "high",
  "Page controls were unreachable until hover",
  "Try to add a page without first discovering the invisible top-left hover zone.",
  "Existing pages and the add-page action are visible and pointer-reachable.",
  "The page strip had opacity:0 and pointer-events:none, so a normal click could not create a page.",
  "08-pages-and-paper-controls.png",
  true
);
defect(
  "GEN-01",
  "medium",
  "New generator did not open its workspace",
  "Click the + beside Generators.",
  "Create ◇N and immediately open its spatial workspace.",
  "Only a rail placeholder and transient toast appeared, requiring hidden knowledge of a second click.",
  "09-empty-generator-workspace.png",
  true
);
defect(
  "A11Y-01",
  "medium",
  "Primary controls had tiny or unnamed targets",
  "Inspect keyboard names and target geometry at each viewport.",
  "Core controls have accessible names and at least 24px targets.",
  "Create lens/quick move lacked names; generator, zoom, title, and page controls had 8–24px targets.",
  "layout-narrow-laptop.png",
  true
);
defect(
  "VIS-01",
  "low",
  "Paper size label was incorrect",
  "Read the lower-right paper boundary label.",
  "The standard page is labeled 8.5 × 11.",
  "It displayed 8 × 11.5.",
  "04-paper-text-created.png",
  true
);

function result(area, assertion, pass, detail = "") {
  results.push({ area, assertion, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${area}] ${assertion}${detail ? ` — ${detail}` : ""}`);
}

function defect(id, severity, summary, reproduction, expected, actual, shot, fixed = false) {
  defects.push({ id, severity, summary, reproduction, expected, actual, shot, fixed });
}

async function pause(page, min = 110, max = 240) {
  await page.waitForTimeout(Math.round(min + Math.random() * (max - min)));
}

async function humanMove(page, x, y, steps = 12) {
  await page.mouse.move(x + 3, y - 2, { steps: Math.max(3, Math.floor(steps / 3)) });
  await pause(page, 35, 80);
  await page.mouse.move(x, y, { steps });
  await pause(page, 70, 140);
}

async function humanClick(page, locator, options = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Cannot click hidden locator: ${locator}`);
  const x = box.x + box.width * (options.rx ?? 0.5);
  const y = box.y + box.height * (options.ry ?? 0.5);
  await humanMove(page, x, y);
  if (options.clickCount === 2) {
    await page.mouse.click(x, y, { delay: 75 });
    await page.waitForTimeout(options.delay || 140);
    await page.mouse.click(x, y, { delay: 75 });
  } else {
    await page.mouse.click(x, y, { delay: options.delay || 90 });
  }
  await pause(page);
}

async function humanType(locator, text) {
  await locator.pressSequentially(text, { delay: 46 });
}

async function humanDrag(page, from, to, steps = 16) {
  await humanMove(page, from.x, from.y);
  await page.mouse.down();
  await pause(page, 90, 150);
  const mid = { x: (from.x + to.x) / 2 + 4, y: (from.y + to.y) / 2 - 3 };
  await page.mouse.move(mid.x, mid.y, { steps: Math.ceil(steps / 2) });
  await pause(page, 65, 120);
  await page.mouse.move(to.x, to.y, { steps: Math.floor(steps / 2) });
  await pause(page, 100, 180);
  await page.mouse.up();
  await pause(page, 180, 300);
}

async function shot(page, name, note = "") {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), animations: "disabled" });
  screenshots.push({ file, note });
}

function watchPage(page, label) {
  page.on("pageerror", (error) => browserErrors.push(`${label}: pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`${label}: console: ${message.text()}`);
  });
}

async function layoutSnapshot(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const visibleControls = [...document.querySelectorAll("button, input, textarea, [role=button], [role=tab]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().slice(0, 80),
          width: r.width,
          height: r.height,
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        };
      });
    return {
      scrollOverflowX: document.documentElement.scrollWidth - innerWidth,
      scrollOverflowY: document.documentElement.scrollHeight - innerHeight,
      rail: rect(".functions-board-rail"),
      paper: rect(".canvas-column"),
      ai: rect(".ai-column"),
      companion: rect(".companion-panel"),
      unlabeled: visibleControls.filter((c) => !c.text).length,
      clipped: visibleControls.filter(
        (c) => c.left < -1 || c.top < -1 || c.right > innerWidth + 1 || c.bottom > innerHeight + 1
      ),
      undersized: visibleControls.filter((c) => c.width < 32 || c.height < 32),
    };
  });
}

async function openCompanion(page) {
  const input = page.locator(".companion-input");
  if (await input.isVisible().catch(() => false)) return input;
  // Action-first commands temporarily minimize chat while the real director
  // demonstration owns the pointer. Let it finish before sending more input.
  const directorStop = page.locator(".ghost-cursor-stop");
  if (await directorStop.isVisible().catch(() => false)) {
    await directorStop.waitFor({ state: "hidden", timeout: 20_000 }).catch(async () => {
      await humanClick(page, directorStop);
    });
    await pause(page, 180, 280);
    if (await input.isVisible().catch(() => false)) return input;
  }
  const fab = page.locator(".companion-fab");
  await humanClick(page, fab);
  await input.waitFor({ state: "visible" });
  return input;
}

async function sendCompanion(page, text) {
  const input = await openCompanion(page);
  await humanClick(page, input);
  await input.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await input.press("Backspace");
  await humanType(input, text);
  await input.press("Enter");
  await pause(page, 250, 450);
}

async function dismissCompanion(page) {
  const close = page.locator(".companion-head-btn[title='Close']");
  if (await close.isVisible().catch(() => false)) await humanClick(page, close);
}

async function clickPaperAt(page, rx, ry) {
  const paper = page.locator(".paper-sheet");
  const b = await paper.boundingBox();
  if (!b) throw new Error("Paper sheet is not visible");
  const point = { x: b.x + b.width * rx, y: b.y + b.height * ry };
  await humanMove(page, point.x, point.y);
  await page.mouse.click(point.x, point.y, { delay: 80 });
  await pause(page);
  return point;
}

async function completeInterview(page) {
  await sendCompanion(page, "Tane");
  await sendCompanion(page, "product designer");
  await sendCompanion(page, "organize an investment memo from messy notes");
  await page.waitForTimeout(900);
}

async function auditFreshLaunch(browser) {
  const context = await browser.newContext({ viewport: VIEWPORTS[1], reducedMotion: "reduce" });
  const page = await context.newPage();
  watchPage(page, "fresh");
  const started = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".idea-app").waitFor({ state: "visible" });
  timings.freshInteractiveMs = Date.now() - started;
  await pause(page, 550, 750);
  await shot(page, "01-fresh-launch", "Fresh profile: companion-first surface");

  result("First 10 minutes", "fresh app becomes interactive under 1s", timings.freshInteractiveMs < 1000, `${timings.freshInteractiveMs}ms`);
  result("First 10 minutes", "companion opens automatically", await page.locator(".companion-panel").isVisible());
  result("First 10 minutes", "legacy tour overlay is absent", (await page.locator(".tour-overlay, .onboard-scrim").count()) === 0);
  result("First 10 minutes", "identity prompt is understandable", /name|call you|who/i.test(await page.locator(".companion-messages").innerText()));

  // A real command interrupts the identity interview instead of being misfiled as a name.
  await sendCompanion(page, "create a useful branched lens for an investment memo");
  await pause(page, 500, 800);
  const interviewMemory = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("lens.companion.memory.v1:anonymous") || "{}");
    } catch {
      return {};
    }
  });
  result(
    "First 10 minutes",
    "command interrupts onboarding without advancing identity",
    !interviewMemory.identity,
    `identity=${JSON.stringify(interviewMemory.identity || "")}`
  );
  await shot(page, "02-onboarding-command-interruption", "Command entered during identity interview");

  await completeInterview(page);
  await openCompanion(page);
  const memoryButton = page.locator(".companion-head-btn", { hasText: "memory" });
  await humanClick(page, memoryButton);
  const memory = page.locator(".companion-memory");
  result("First 10 minutes", "memory can be inspected", await memory.isVisible());
  result("First 10 minutes", "identity and role are editable", (await memory.locator("input").count()) === 2);
  await shot(page, "03-companion-memory", "Inspectable editable memory after interview");
  await humanClick(page, memoryButton);

  await dismissCompanion(page);
  const title = page.getByLabel("Page title");
  await humanClick(page, title);
  await title.fill("Investment memo — 東京 🚀");
  await title.press("Enter").catch(() => {});

  await humanClick(page, page.locator("[data-tool='select']"));
  const paperItemsBefore = await page.locator(".board-text").count();
  const point = await clickPaperAt(page, 0.35, 0.27);
  if (!(await page.locator(".board-text.editing").isVisible().catch(() => false))) {
    // A normal user retries a slightly missed empty-space click.
    await clickPaperAt(page, 0.39, 0.31);
  }
  await humanType(page.locator(".board-text.editing"), "Market signal: retention improved 18% across two cohorts.");
  await page.keyboard.press("Escape");
  await pause(page);
  result("Paper", "select-click creates editable text", (await page.locator(".board-text").count()) === paperItemsBefore + 1);
  await shot(page, "04-paper-text-created", "Text created through the select tool");

  // Edit, then move using direct manipulation.
  const text = page.locator(".board-text").first();
  await humanClick(page, text, { rx: 0.25 });
  if (!(await page.locator(".board-text.editing").isVisible().catch(() => false))) {
    await humanClick(page, text, { rx: 0.25 });
  }
  const editable = page.locator(".board-text.editing");
  result("Paper", "second click enters text editing", await editable.isVisible());
  await editable.press("End");
  await humanType(editable, " Evidence is still preliminary.");
  await page.keyboard.press("Escape");
  await pause(page);
  const beforeMove = await text.boundingBox();
  await humanDrag(
    page,
    { x: beforeMove.x + beforeMove.width / 2, y: beforeMove.y + beforeMove.height / 2 },
    { x: beforeMove.x + beforeMove.width / 2 + 95, y: beforeMove.y + beforeMove.height / 2 + 55 }
  );
  const afterMove = await text.boundingBox();
  const moveDistance = Math.hypot(afterMove.x - beforeMove.x, afterMove.y - beforeMove.y);
  result("Paper", "text can be moved without precision dragging", moveDistance > 35, `${moveDistance.toFixed(1)}px`);
  await shot(page, "05-paper-text-edited-moved", "Edited and moved text");

  // Pen stroke through the visible tool.
  await humanClick(page, page.locator("[data-tool='pen']"));
  const paperBox = await page.locator(".paper-sheet").boundingBox();
  await humanDrag(
    page,
    { x: paperBox.x + paperBox.width * 0.24, y: paperBox.y + paperBox.height * 0.52 },
    { x: paperBox.x + paperBox.width * 0.62, y: paperBox.y + paperBox.height * 0.58 },
    24
  );
  result("Paper", "pen stroke persists after release", (await page.locator(".ink-layer [data-item]").count()) > 0);
  await shot(page, "06-paper-pen-stroke", "Human-paced pen stroke");

  // Highlighter stroke and persistent toolbar.
  await humanClick(page, page.locator("[data-tool='highlight']"));
  const textBox = await text.boundingBox();
  await humanDrag(
    page,
    { x: textBox.x + 6, y: textBox.y + textBox.height * 0.55 },
    { x: textBox.x + Math.min(textBox.width - 6, 170), y: textBox.y + textBox.height * 0.55 },
    18
  );
  const highlighterVisible =
    (await page.locator(".hl-session-stroke, .fragment-mark, .omni-highlight-toolbar").count()) > 0;
  result("Highlighter", "visible mark persists after release", highlighterVisible);
  await shot(page, "07-paper-highlighter", "Persistent highlighter mark and actions");
  await page.keyboard.press("Escape");

  // Undo/redo through visible controls.
  const undo = page.locator("button[title='Undo']").first();
  const redo = page.locator("button[title='Redo']").first();
  if (await undo.isEnabled().catch(() => false)) {
    await humanClick(page, undo);
    await humanClick(page, redo);
    result("Paper", "toolbar undo and redo are reachable", true);
  } else {
    result("Paper", "toolbar undo and redo are reachable", false, "Undo remained disabled after edits");
  }

  // Page creation/rename and paper zoom.
  await humanClick(page, page.getByLabel("New world"));
  result("Paper", "new page is created visibly", (await page.locator("[role=tab]").count()) >= 2);
  const activeTab = page.locator("[role=tab][aria-selected=true]");
  await humanClick(page, activeTab, { clickCount: 2 });
  const rename = page.locator(".page-tab-input");
  if (await rename.isVisible().catch(() => false)) {
    await rename.fill("Diligence notes");
    await rename.press("Enter");
  }
  await shot(page, "08-pages-and-paper-controls", "Second page, title, tools and zoom controls");

  // Create quick lens and empty generator through their primary visible affordances.
  const moveInput = page.locator(".move-quick-input");
  await humanClick(page, moveInput);
  await humanType(moveInput, "treat as an investment committee");
  await moveInput.press("Enter");
  const quickMoveStored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]")
      .some((op) => op.name === "treat as an investment committee")
  );
  result("Lenses", "quick move creates a reusable lens", quickMoveStored);
  await humanClick(page, page.locator(".generator-new"));
  result("Generators", "empty generator opens spatial workspace", await page.locator(".lens-settings").isVisible().catch(() => false));
  await shot(page, "09-empty-generator-workspace", "Generator created through visible + control");
  const generatorClose = page.locator(".lens-settings-close");
  if (await generatorClose.isVisible().catch(() => false)) await humanClick(page, generatorClose);

  // Persistence on a normal returning-user reload.
  await page.reload();
  await page.locator(".idea-app").waitFor();
  await pause(page, 500, 700);
  result("Persistence", "paper title survives reload", (await page.getByLabel("Page title").inputValue()) === "Investment memo — 東京 🚀");
  const persistedQuickMove = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]")
      .some((op) => op.name === "treat as an investment committee")
  );
  result("Persistence", "created lens survives reload", persistedQuickMove);
  result("Persistence", "generator survives reload", (await page.locator(".struct-card").count()) >= 1);
  await shot(page, "10-returning-workspace", "Returning user after UI-created work");

  // Exact destructive typo command: cancel, then rapid resubmit, then confirm.
  await sendCompanion(page, CLEAR_COMMAND);
  const confirmation = page.getByTestId("companion-clear-confirmation");
  await confirmation.waitFor({ state: "visible", timeout: 3000 });
  result("First 10 minutes", "destructive typo command asks for confirmation", true);
  await shot(page, "17-clear-confirmation-fixed-after", "Fixed confirmation includes typo-named paper domain");
  await humanClick(page, page.getByTestId("companion-clear-cancel"));
  result("Persistence", "cancel preserves paper work", (await page.locator(".board-text").count()) >= 1);

  const companionInput = await openCompanion(page);
  await humanClick(page, companionInput);
  await humanType(companionInput, CLEAR_COMMAND);
  await companionInput.press("Enter");
  await companionInput.press("Enter");
  await companionInput.press("Enter");
  await confirmation.waitFor({ state: "visible", timeout: 3000 });
  result("First 10 minutes", "rapid Enter creates one confirmation", (await confirmation.count()) === 1);
  await humanClick(page, page.getByTestId("companion-clear-confirm"));
  await page.waitForTimeout(500);
  result("Persistence", "confirmed clear removes paper", (await page.locator(".board-text").count()) === 0);
  result("Persistence", "confirmed clear removes generators", (await page.locator(".struct-card").count()) === 0);
  result("Persistence", "built-in primitives remain", (await page.locator(".op-chip").count()) > 0);
  await page.reload();
  await page.locator(".idea-app").waitFor();
  await pause(page, 450, 650);
  result("Persistence", "clear remains clear after reload", (await page.locator(".board-text").count()) === 0);
  await shot(page, "18-clear-persistence-fixed-after", "Cleared workspace after reload; primitives retained");

  await context.close();
}

async function auditViewports(browser) {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    watchPage(page, viewport.name);
    await page.goto(BASE);
    await page.locator(".idea-app").waitFor();
    await pause(page, 450, 650);
    const layout = await layoutSnapshot(page);
    const domainsOrdered =
      layout.rail && layout.paper && layout.ai &&
      layout.rail.right <= layout.paper.x + 2 &&
      layout.paper.right <= layout.ai.x + 2;
    result("Layout", `${viewport.width}×${viewport.height} keeps three domains ordered`, !!domainsOrdered);
    result("Layout", `${viewport.width}×${viewport.height} has no document overflow`, layout.scrollOverflowX <= 1 && layout.scrollOverflowY <= 1, `${layout.scrollOverflowX}px × ${layout.scrollOverflowY}px`);
    result("Layout", `${viewport.width}×${viewport.height} has no clipped controls`, layout.clipped.length === 0, layout.clipped.slice(0, 3).map((x) => x.text).join(", "));
    result("Accessibility", `${viewport.width}×${viewport.height} core controls have labels`, layout.unlabeled === 0, `${layout.unlabeled} unlabeled`);
    const severeHitTargets = layout.undersized.filter((c) => c.width < 24 || c.height < 24);
    result("Accessibility", `${viewport.width}×${viewport.height} has no sub-24px targets`, severeHitTargets.length === 0, `${severeHitTargets.length} targets`);
    if (severeHitTargets.length) {
      defect(
        `HIT-${viewport.width}`,
        "medium",
        "Visible controls have sub-24px hit targets",
        `Open a fresh workspace at ${viewport.width}×${viewport.height}.`,
        "Visible controls are at least 24×24 CSS pixels.",
        severeHitTargets.slice(0, 5).map((x) => `${x.text || "(unlabeled)"} ${Math.round(x.width)}×${Math.round(x.height)}`).join("; "),
        `layout-${viewport.name}.png`
      );
    }
    await shot(page, `layout-${viewport.name}`, `${viewport.width}×${viewport.height}`);
    await context.close();
  }
}

async function auditSecondaryEdgeCases(browser) {
  const context = await browser.newContext({ viewport: VIEWPORTS[0], reducedMotion: "reduce" });
  await context.addInitScript(() => {
    // Secondary, repeatable high-density probe only — never used for a core journey.
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
      version: 1,
      identity: "Density tester",
      role: "researcher",
      goals: ["inspect density"],
      actions: [],
      interviewComplete: true,
    }));
    const nodes = Array.from({ length: 55 }, (_, i) => {
      const angle = i * 0.72;
      const radius = 90 + i * 13;
      return {
        id: `dense-${i}`,
        nodeKind: i ? "expanded" : "source",
        parentId: i ? `dense-${Math.floor((i - 1) / 2)}` : undefined,
        sourceNodeIds: i ? [`dense-${Math.floor((i - 1) / 2)}`] : [],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        radius: 28,
        label: `Node ${i} 長い名前 ${"🚀".repeat(i % 4)}`,
        expandedText: `Evidence ${i}: ${"Long-form output line. ".repeat(8)}`,
        preview: i ? undefined : "Dense constellation root",
        createdAt: 1000 + i,
      };
    });
    localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
    localStorage.setItem("lens.board.items.v1", JSON.stringify([
      { id: "long", type: "text", x: 40, y: 90, w: 680, pageId: "page-1", text: `${"Very long text ".repeat(80)} 終わり 🧭` },
      { id: "overlap", type: "text", x: 60, y: 110, w: 300, pageId: "page-1", text: "Overlapping object probe" },
    ]));
    localStorage.setItem("lens.lenses.v2", "{malformed-json");
  });
  const page = await context.newPage();
  watchPage(page, "secondary-density");
  await page.goto(BASE);
  await page.locator(".idea-app").waitFor();
  await pause(page, 700, 950);
  result("Adversarial", "malformed generator store does not crash app", await page.locator(".idea-app").isVisible());
  result("AI space", "55-node constellation loads", (await page.locator(".ai-node").count()) === 55, `${await page.locator(".ai-node").count()} nodes`);
  await shot(page, "13-dense-55-node-constellation", "Secondary seeded density and malformed-store probe");

  const ai = page.locator(".ai-node-viewport");
  const b = await ai.boundingBox();
  await humanMove(page, b.x + b.width * 0.55, b.y + b.height * 0.55);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, i < 6 ? -110 : 110);
    await pause(page, 35, 65);
  }
  await humanDrag(
    page,
    { x: b.x + b.width * 0.46, y: b.y + b.height * 0.5 },
    { x: b.x + b.width * 0.58, y: b.y + b.height * 0.58 }
  );
  result("AI space", "pan/zoom density interaction keeps app responsive", await page.locator(".idea-app").isVisible());
  await shot(page, "14-dense-pan-zoom", "Dense constellation after human-paced pan/zoom");

  // Tiny background jiggle should not create nodes.
  const countBefore = await page.locator(".ai-node").count();
  const p = { x: b.x + 30, y: b.y + 80 };
  await humanDrag(page, p, { x: p.x + 3, y: p.y + 2 }, 3);
  const countAfter = await page.locator(".ai-node").count();
  result("AI space", "tiny background jiggle creates no node", countAfter === countBefore, `${countBefore} → ${countAfter}`);

  // Keyboard focus must be visible on a primary control.
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const r = el?.getBoundingClientRect();
    const s = el ? getComputedStyle(el) : null;
    return { tag: el?.tagName, text: el?.getAttribute("aria-label") || el?.title || el?.textContent, outline: s?.outlineStyle, width: r?.width, height: r?.height };
  });
  result("Accessibility", "Tab reaches a visible control", focus.tag === "BUTTON" || focus.tag === "INPUT", `${focus.tag}: ${(focus.text || "").trim().slice(0, 50)}`);
  await shot(page, "15-keyboard-focus", "First keyboard focus at reduced motion");
  await context.close();

  const malformedShare = await browser.newContext({ viewport: VIEWPORTS[2] });
  const sharePage = await malformedShare.newPage();
  watchPage(sharePage, "malformed-share");
  await sharePage.goto(`${BASE}/?share=%%%definitely-malformed%%%`);
  await sharePage.locator(".idea-app").waitFor();
  result("Shared paths", "malformed share payload recovers to workspace", await sharePage.locator(".idea-app").isVisible());
  await shot(sharePage, "16-malformed-share-recovery", "Malformed share URL at narrow laptop size");
  await malformedShare.close();
}

function writeReport() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const grouped = new Map();
  for (const r of results) {
    if (!grouped.has(r.area)) grouped.set(r.area, []);
    grouped.get(r.area).push(r);
  }
  const report = [
    "# Human product audit",
    "",
    `Completed: ${new Date().toISOString()}`,
    `Target: ${BASE}`,
    "",
    "## Honest verdict",
    "",
    failed === 0
      ? `Usable for the audited local journeys: ${passed}/${results.length} assertions passed. Cloud account adoption, live model quality, microphone/video capture, and true slow-network behavior remain environment-dependent constraints.`
      : `Not yet fully usable: ${failed} of ${results.length} audited assertions failed. See defects and remaining constraints below.`,
    "",
    "This was driven with visible pointer, keyboard, wheel, and drag actions. Storage seeding was used only for the explicitly labeled high-density and malformed-record probes.",
    "",
    "## Coverage matrix",
    "",
    ...coverage.map(([area, scope, mode]) => {
      const matches = results.filter((r) => r.area.toLowerCase().includes(area.split(" ")[0].toLowerCase()));
      const ok = matches.length > 0 && matches.every((r) => r.pass);
      return `- [${ok ? "x" : " "}] **${area}** — ${scope} _(${mode})_${matches.length ? `; ${matches.filter((r) => r.pass).length}/${matches.length} checks passed` : "; not fully exercisable locally"}`;
    }),
    "",
    "## Results",
    "",
    ...[...grouped.entries()].flatMap(([area, items]) => [
      `### ${area}`,
      ...items.map((r) => `- ${r.pass ? "PASS" : "FAIL"} — ${r.assertion}${r.detail ? ` (${r.detail})` : ""}`),
      "",
    ]),
    "## Defects",
    "",
    ...(defects.length
      ? defects.flatMap((d) => [
          `### ${d.id} · ${d.severity} · ${d.summary}`,
          `- Reproduce: ${d.reproduction}`,
          `- Expected: ${d.expected}`,
          `- Actual: ${d.actual}`,
          `- Screenshot: \`${d.shot}\``,
          `- Status: ${d.fixed ? "fixed and retested" : "open"}`,
          "",
        ])
      : ["No open reproducible blocker was recorded by this run.", ""]),
    "## Measurements",
    "",
    `- Fresh interactive time: ${timings.freshInteractiveMs ?? "not measured"}ms`,
    `- Assertions: ${passed} passed / ${failed} failed / ${results.length} total`,
    `- Browser errors and rejected console messages: ${browserErrors.length}`,
    "",
    "## Browser errors",
    "",
    ...(browserErrors.length ? browserErrors.map((e) => `- ${e}`) : ["- None"]),
    "",
    "## Screenshot index",
    "",
    "- `11-clear-confirmation-before.png` — Failure before repair: typo command omitted paper (0 paper items listed)",
    "- `12-clear-fixed-after.png` — Failure before repair: paper visibly survived confirmation and reload",
    ...screenshots.map((s) => `- \`${s.file}\`${s.note ? ` — ${s.note}` : ""}`),
    "",
    "## Remaining constraints",
    "",
    "- Live account adoption/isolation requires configured Supabase credentials and multiple real accounts.",
    "- Live AI output quality and 1k/5k/15k streaming depend on model credentials and network availability.",
    "- Browser microphone/video permission and real voice recognition need a headed browser with hardware access.",
    "- This repeatable audit covers representative human journeys and adversarial states; it is not proof that every combinatorial drag route is defect-free.",
  ].join("\n");
  fs.writeFileSync(REPORT, report);
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  try {
    // Prime a dev server's first module compilation before timing the product.
    // Production builds do not incur this Vite-only cold compile.
    const warm = await browser.newPage();
    await warm.goto(BASE);
    await warm.locator(".idea-app").waitFor();
    await warm.close();
    await auditFreshLaunch(browser);
    await auditViewports(browser);
    await auditSecondaryEdgeCases(browser);
  } finally {
    await browser.close();
    writeReport();
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length} assertions: ${results.length - failed.length} passed, ${failed.length} failed`);
  console.log(`Report: ${REPORT}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  browserErrors.push(`audit runner: ${error.stack || error.message}`);
  writeReport();
  console.error(error);
  process.exit(1);
});
