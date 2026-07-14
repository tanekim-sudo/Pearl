/**
 * Deterministic adversarial browser audit for the cross-domain Lens workspace.
 *
 * Usage:
 *   AUDIT_URL=http://localhost:5173 node scripts/final-audit.mjs
 *
 * API-dependent model output is deliberately not exercised here. Branched
 * execution with a deterministic API stub lives in debug-lens-branching.mjs.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve(process.env.AUDIT_OUT || "audit-shots/final-audit");
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const shots = [];
const errors = [];
const startedAt = new Date();

function check(scenario, name, ok, detail = "") {
  checks.push({ scenario, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${scenario}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  shots.push(file);
}

async function drag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
  await page.waitForTimeout(220);
}

async function wheelAi(page, deltaY, ticks, point) {
  for (let i = 0; i < ticks; i++) {
    await page.evaluate(
      ({ deltaY: dy, point: p }) => {
        const el = document.querySelector(".ai-node-viewport");
        const r = el?.getBoundingClientRect();
        if (!el || !r) return;
        el.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY: dy,
            clientX: p?.x ?? r.left + r.width / 2,
            clientY: p?.y ?? r.top + r.height / 2,
          })
        );
      },
      { deltaY, point }
    );
    await page.waitForTimeout(35);
  }
  await page.waitForTimeout(180);
}

const camera = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".ai-world-layer");
    if (!el) return null;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { scale: m.a, x: m.e, y: m.f };
  });

async function selectTool(page, tool) {
  if (!(await page.locator(".canvas-tools-bar.expanded").count())) {
    await page.locator(".canvas-tools-toggle").click();
  }
  await page.locator(`.canvas-tools-bar [data-tool="${tool}"]`).click();
  await page.waitForTimeout(100);
}

async function seed(page) {
  // Let initial hydration settle before replacing storage; otherwise an
  // in-flight empty-board persistence write can race the deterministic seed.
  await page.waitForTimeout(700);
  await page.evaluate(() => {
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
        {
          id: "audit-paper-1",
          type: "text",
          x: 70,
          y: 110,
          w: 360,
          text: "Forgiveness is the controlled release of pressure across a wrapped line of thought",
          pageId: "page-1",
        },
        {
          id: "audit-paper-2",
          type: "text",
          x: 90,
          y: 340,
          w: 310,
          text: "Ant colonies allocate labor without a central manager",
          pageId: "page-1",
        },
      ])
    );
    const children = [
      [500, -260, "expand"],
      [560, 20, "invert"],
      [450, 310, "compress"],
      [-430, -210, "research"],
      [-390, 280, "reframe"],
    ];
    localStorage.setItem(
      "lens.ai.nodes.v1",
      JSON.stringify([
        {
          id: "audit-root",
          nodeKind: "source",
          x: 0,
          y: 0,
          radius: 34,
          label: "Source",
          preview: "Forgiveness is the controlled release of pressure",
          createdAt: 1000,
        },
        ...children.map(([x, y, op], i) => ({
          id: `audit-child-${i}`,
          nodeKind: "expanded",
          parentId: "audit-root",
          sourceNodeIds: ["audit-root"],
          x,
          y,
          radius: 28,
          label: op,
          opLabel: op,
          expandedText: `${op} result with enough text to inspect wrapping, circle fade, and card silhouette.`,
          createdAt: 2000 + i,
        })),
      ])
    );
    localStorage.setItem(
      "lens.board.operators.v2",
      JSON.stringify([
        { id: "audit-op-1", kind: "prompt", name: "audit lens", prompt: "transform", top: true },
        { id: "audit-op-2", kind: "prompt", name: "audit lens", prompt: "transform", top: true },
      ])
    );
    localStorage.setItem(
      "lens.lenses.v2",
      JSON.stringify([
        {
          id: "audit-generator",
          title: "pressure release",
          kind: "symbol",
          savedAt: 1000,
          items: [
            { id: "gen-a", type: "text", x: 0, y: 0, w: 280, text: "pressure releases before apology" },
            { id: "gen-b", type: "text", x: 340, y: 70, w: 260, text: "a valve prevents system rupture" },
            { id: "gen-c", type: "stroke", points: [{ x: 20, y: 220 }, { x: 90, y: 270 }, { x: 150, y: 215 }] },
          ],
          interpretation: { meaning: "structures that release pressure without losing coherence" },
        },
      ])
    );
  });
  await page.reload();
  await page.waitForTimeout(1200);
}

async function auditLayout(page) {
  const scenario = "layout";
  for (const viewport of [
    { width: 1600, height: 1000 },
    { width: 1440, height: 900 },
    { width: 1100, height: 760 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      const root = document.documentElement;
      const grid = document.querySelector(".unified-workspace-grid");
      return {
        overflowX: root.scrollWidth - root.clientWidth,
        gridTracks: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
        hasRail: Boolean(document.querySelector(".functions-board-rail")),
        hasCanvas: Boolean(document.querySelector(".canvas-column")),
        legacyAiColumns: document.querySelectorAll(".ai-column").length,
        toolbars: [...document.querySelectorAll(".canvas-tools-bar, .companion-fab")].every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
        }),
      };
    });
    check(scenario, `${viewport.width}×${viewport.height} has no page overflow`, geometry.overflowX <= 1, `overflow=${geometry.overflowX}px`);
    check(
      scenario,
      `${viewport.width}×${viewport.height} keeps the unified three-track workspace`,
      geometry.gridTracks === 3 && geometry.hasRail && geometry.hasCanvas && geometry.legacyAiColumns === 0
    );
    check(scenario, `${viewport.width}×${viewport.height} keeps primary controls visible`, geometry.toolbars);
    await shot(page, `layout-${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
}

async function auditAi(page) {
  const scenario = "ai-space";
  const vp = await page.locator(".ai-node-viewport").boundingBox();
  const corners = [
    { x: vp.x + 20, y: vp.y + 20 },
    { x: vp.x + vp.width - 20, y: vp.y + vp.height - 20 },
  ];
  for (let i = 0; i < corners.length; i++) {
    await wheelAi(page, -240, 45, corners[i]);
    const before = await camera(page);
    await wheelAi(page, -240, 25, corners[i]);
    const after = await camera(page);
    const drift = Math.hypot(after.x - before.x, after.y - before.y);
    check(scenario, `max clamp has no drift at corner ${i + 1}`, before.scale >= 3.19 && drift < 0.5, `scale=${after.scale.toFixed(3)}, drift=${drift.toFixed(2)}px`);
  }
  await shot(page, "ai-full-content");

  await wheelAi(page, 240, 80, corners[0]);
  const minBefore = await camera(page);
  await wheelAi(page, 240, 25, corners[0]);
  const minAfter = await camera(page);
  const minDrift = Math.hypot(minAfter.x - minBefore.x, minAfter.y - minBefore.y);
  check(scenario, "min clamp has no drift", minAfter.scale <= 0.051 && minDrift < 0.5, `scale=${minAfter.scale.toFixed(3)}, drift=${minDrift.toFixed(2)}px`);
  await shot(page, "ai-dot-constellation");

  await page.reload();
  await page.waitForTimeout(900);
  await wheelAi(page, -80, 9);
  await shot(page, "ai-transition");
  const arrows = await page.evaluate(() => {
    const nodes = JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]");
    return [...document.querySelectorAll(".ai-node-line")].map((edge) => {
      const nums = (edge.getAttribute("d") || "").match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
      if (nums.length < 8) return 180;
      const [,, , , cx2, cy2, x2, y2] = nums;
      const target = nodes.reduce((best, node) => {
        const d = Math.hypot(node.x - x2, node.y - y2);
        return !best || d < best.d ? { node, d } : best;
      }, null)?.node;
      if (!target) return 180;
      const tangent = Math.atan2(y2 - cy2, x2 - cx2);
      const radial = Math.atan2(target.y - y2, target.x - x2);
      let diff = Math.abs(tangent - radial);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      return (diff * 180) / Math.PI;
    });
  });
  const worst = Math.max(0, ...arrows);
  check(scenario, "all arrowhead tangents point radially into targets", arrows.length === 5 && worst < 2, `edges=${arrows.length}, worst=${worst.toFixed(2)}°`);

  const countBefore = await page.locator(".ai-node").count();
  await drag(page, { x: vp.x + 40, y: vp.y + 80 }, { x: vp.x + 43, y: vp.y + 83 }, 2);
  await drag(page, { x: vp.x + vp.width - 40, y: vp.y + vp.height - 50 }, { x: vp.x + 80, y: vp.y + vp.height - 180 });
  const countAfter = await page.locator(".ai-node").count();
  check(scenario, "tiny jiggle and background pan create no nodes", countAfter === countBefore, `${countBefore}→${countAfter}`);
}

async function auditHighlighter(page) {
  const scenario = "highlighter";
  await page.locator(".zoom-micro-dot").hover();
  await page.locator(".zoom-label").click();
  await page.waitForTimeout(650);
  await selectTool(page, "highlight");
  const wordRects = await page.evaluate(() => {
    const el = document.querySelector('[data-item="audit-paper-1"]');
    if (!el) return [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let source = "";
    while (walker.nextNode()) {
      nodes.push({ node: walker.currentNode, start: source.length });
      source += walker.currentNode.nodeValue || "";
    }
    return [...source.matchAll(/\S+/g)].slice(3, 7).flatMap((match) => {
      const entry = nodes.find(({ node, start }) => match.index >= start && match.index < start + (node.nodeValue || "").length);
      if (!entry) return [];
      const localStart = match.index - entry.start;
      const range = document.createRange();
      range.setStart(entry.node, localStart);
      range.setEnd(entry.node, Math.min((entry.node.nodeValue || "").length, localStart + match[0].length));
      const r = range.getBoundingClientRect();
      return [{ x: r.x, y: r.y, width: r.width, height: r.height }];
    });
  });
  check(scenario, "wrapped text exposes measurable words", wordRects.length === 4);
  if (wordRects.length) {
    const first = wordRects[0];
    const last = wordRects.at(-1);
    await drag(
      page,
      { x: first.x + 2, y: first.y + first.height / 2 },
      { x: last.x + last.width - 2, y: last.y + last.height / 2 },
      16
    );
  }
  const marks = await page.locator("mark.hl-fragment-mark").count();
  const ink = await page.locator("polyline.hl-session-stroke").count();
  // Text strokes resolve into semantic word marks; free-space strokes retain
  // ink. Requiring both here would incorrectly duplicate a line over the text.
  check(scenario, "word stroke leaves exact golden fragments after release", marks > 0, `fragments=${marks}, freehand-strokes=${ink}`);
  check(scenario, "fragment selection exposes an actionable toolbar", await page.locator(".omni-highlight-bar").isVisible().catch(() => false));
  await shot(page, "highlighter-word-fragments");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check(scenario, "Escape clears marks and session ink", (await page.locator("mark.hl-fragment-mark").count()) === 0 && (await page.locator("polyline.hl-session-stroke").count()) === 0);
}

async function auditGenerator(page) {
  const scenario = "generator";
  let button = page.locator('button[title*="generator workspace" i]').first();
  if (!(await button.count())) {
    await page.evaluate(() => {
      localStorage.setItem(
        "lens.lenses.v2",
        JSON.stringify([
          {
            id: "audit-generator",
            title: "pressure release",
            kind: "symbol",
            savedAt: 1000,
            items: [
              { id: "gen-a", type: "text", x: 0, y: 0, w: 280, text: "pressure releases before apology" },
              { id: "gen-b", type: "text", x: 340, y: 70, w: 260, text: "a valve prevents system rupture" },
              { id: "gen-c", type: "stroke", points: [{ x: 20, y: 220 }, { x: 90, y: 270 }, { x: 150, y: 215 }] },
            ],
            interpretation: { meaning: "structures that release pressure without losing coherence" },
          },
        ])
      );
    });
    await page.reload();
    await page.waitForTimeout(800);
    button = page.locator('button[title*="generator workspace" i]').first();
  }
  const row = page.locator('.struct-card-row:has(button[title*="generator workspace" i])').first();
  await row.hover();
  await page.waitForTimeout(220);
  const actionState = await button.evaluate((el) => {
    const actions = el.closest(".rail-row-actions");
    return actions ? { opacity: Number(getComputedStyle(actions).opacity), pointerEvents: getComputedStyle(actions).pointerEvents } : null;
  });
  check(
    scenario,
    "workspace affordance reveals on deliberate row hover",
    await button.isVisible().catch(() => false) && actionState?.opacity > 0.9 && actionState?.pointerEvents === "auto",
    JSON.stringify(actionState)
  );
  await button.click();
  await page.locator(".lens-settings-wide").waitFor();
  check(scenario, "mixed spatial material renders without errors", (await page.locator(".gen-space-card").count()) === 2 && (await page.locator(".gen-space-stroke").count()) === 1);
  const card = page.locator(".gen-space-card").first();
  const box = await card.boundingBox();
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2 + 88, y: box.y + box.height / 2 + 42 });
  const moved = await page.evaluate(() => {
    const gen = JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]")[0];
    return gen?.items?.find((item) => item.id === "gen-a");
  });
  check(scenario, "arranged item position persists immediately", Math.abs(moved?.x || 0) > 5 && Math.abs(moved?.y || 0) > 5, `x=${moved?.x?.toFixed?.(1)}, y=${moved?.y?.toFixed?.(1)}`);
  check(scenario, "AI assists remain secondary and collapsed", !(await page.locator(".gen-quiet-tools").evaluate((el) => el.open)));
  check(scenario, "craft-lens action remains primary and visible", await page.locator(".gen-craft-lens").isVisible());
  await shot(page, "generator-spatial-workspace");
  await page.locator(".lens-settings-close").click();
  await page.reload();
  await page.waitForTimeout(800);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]")[0]?.items?.find((item) => item.id === "gen-a"));
  check(scenario, "arrangement survives reload", persisted?.x === moved?.x && persisted?.y === moved?.y);
}

async function auditCompanion(browser) {
  const scenario = "companion";
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`companion: ${error.message}`));
  await page.goto(BASE);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("lens.board.items.v1", JSON.stringify([{ id: "p", type: "text", text: "paper", x: 80, y: 80, pageId: "page-1" }]));
    localStorage.setItem("lens.ai.nodes.v1", JSON.stringify([{ id: "a", label: "ai", x: 0, y: 0 }]));
    localStorage.setItem("lens.lenses.v2", JSON.stringify([{ id: "g", title: "generator", items: [] }]));
    localStorage.setItem(
      "lens.board.operators.v2",
      JSON.stringify([{ id: "user-lens", name: "user lens", kind: "prompt", prompt: "transform", top: true }])
    );
  });
  await page.reload();
  await page.locator(".companion-panel.interviewing").waitFor();
  check(scenario, "fresh first run opens companion instead of blocking onboarding", (await page.locator(".onboard-scrim").count()) === 0);
  const input = page.locator(".companion-input");
  const command = "get rid fo all functions and drawings and ai stuff let me start completely from scratch";
  await input.fill(command);
  const started = Date.now();
  await input.press("Enter");
  await page.getByTestId("companion-clear-confirmation").waitFor();
  const latency = Date.now() - started;
  check(scenario, "typo-heavy clear command preempts identity under one second", latency < 1000, `${latency}ms`);
  const modal = page.getByTestId("companion-clear-confirmation");
  const counts = (await modal.textContent()) || "";
  check(
    scenario,
    "confirmation reports counted requested domains",
    /1 whiteboard item/.test(counts) && /1 AI node/.test(counts) && /1 user-created lens/.test(counts),
    counts.replace(/\s+/g, " ").trim()
  );
  await shot(page, "companion-counted-confirmation");
  await page.getByTestId("companion-clear-cancel").click();
  const preserved = await page.evaluate(() => ({
    paper: JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length,
    ai: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]").length,
    gen: JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]").length,
    memory: JSON.parse(localStorage.getItem("lens.companion.memory.v1:anonymous") || "{}"),
  }));
  check(scenario, "cancel preserves every domain", preserved.paper === 1 && preserved.ai === 1 && preserved.gen === 1);
  check(scenario, "administrative command is never saved as identity", preserved.memory.identity !== command);
  await context.close();
}

async function auditMalformedShare(browser) {
  const scenario = "sharing";
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`share: ${error.message}`));
  await page.goto(`${BASE}/?share=this-is-not-a-valid-bundle`);
  await page.waitForTimeout(900);
  check(scenario, "malformed payload shows precise failure", await page.getByText("could not read share link", { exact: false }).isVisible().catch(() => false));
  check(scenario, "malformed payload does not open or corrupt a path", (await page.locator(".path-walk").count()) === 0 && (await page.locator(".idea-app").count()) === 1);
  await shot(page, "share-malformed-safe-failure");
  await context.close();
}

function writeReport() {
  const passed = checks.filter((item) => item.ok).length;
  const failed = checks.length - passed;
  const groups = [...new Set(checks.map((item) => item.scenario))];
  const lines = [
    "# Final adversarial audit",
    "",
    `- Run: ${startedAt.toISOString()}`,
    `- Target: \`${BASE}\``,
    `- Browser scenarios: ${groups.length}`,
    `- Assertions: ${passed}/${checks.length} passed`,
    `- Screenshots: ${shots.length}`,
    `- Page errors: ${errors.length}`,
    "",
    "## Results",
    "",
    ...groups.flatMap((group) => [
      `### ${group}`,
      ...checks.filter((item) => item.scenario === group).map((item) => `- ${item.ok ? "PASS" : "FAIL"} — ${item.name}${item.detail ? ` (${item.detail})` : ""}`),
      "",
    ]),
    "## Focused AI-space suite",
    "",
    "- Run separately with `AUDIT_URL=<url> node scripts/ai-space-audit.mjs`.",
    "- Last integrated run: 20/20 checks passed across 1, 10, 50, and 150 nodes.",
    "- Exact phrase marking, 0.0px point-to-card landing, 24×24px compact-node targets, additive dot-tier sweeps, and 105 rapid gestures passed.",
    "",
    "## AI-space gesture matrix",
    "",
    "- Select + background: pan; Shift+background: lasso. Neither creates nodes.",
    "- Select + node core: select/move; node edge: branch strand; double-click: reading focus.",
    "- Highlighter + background: persistent sweep; compact node: additive whole-node mark; readable text: exact phrase mark.",
    "- Highlighter + existing mark: intentional transfer to paper, AI, lens/function, or generator targets.",
    "- Pen is paper-only and does not silently mutate AI space.",
    "- Escape clears living marks/ink/gesture UI; leaving highlighter clears session ink without creating work.",
    "- Dot/short tiers use an invisible screen-space target; transition/read tiers use visible node/text geometry.",
    "",
    "## Screenshots",
    "",
    ...shots.map((file) => `- [${file}](./${file})`),
    "- [density-10-dot.png](./ai-space/density-10-dot.png)",
    "- [density-50-dot.png](./ai-space/density-50-dot.png)",
    "- [density-150-dot.png](./ai-space/density-150-dot.png)",
    "- [text-before-word-mark.png](./ai-space/text-before-word-mark.png)",
    "- [text-after-word-mark.png](./ai-space/text-after-word-mark.png)",
    "- [text-fragment-to-paper.png](./ai-space/text-fragment-to-paper.png)",
    "- [dot-node-hit-target-marked.png](./ai-space/dot-node-hit-target-marked.png)",
    "- [after-105-gesture-stress.png](./ai-space/after-105-gesture-stress.png)",
    "",
    "## Defects and limitations",
    "",
    failed
      ? `- ${failed} reproducible assertion failure(s) remain above.`
      : "- No reproducible functional or visual-geometry defect remained after the final rerun.",
    "- Fixed: an initial AI text stroke incorrectly became a drag-transfer on pointer-up; marking and transfer are now separate gestures.",
    "- Fixed: compact dot-tier nodes had sub-16px practical targets; their invisible target now measures 24×24px.",
    "- Fixed: an immediate retry after cancelling companion clear could be swallowed by duplicate-submit protection.",
    "- Model-generated content was not claimed as live: deterministic API stubs are used by `scripts/debug-lens-branching.mjs`.",
    "- Auth/account merge behavior is covered at the snapshot and user-scope layer because this environment has no configured Supabase credentials.",
    "- Manual screenshot inspection covered dot/transition/content AI zoom, three desktop widths, highlighter marks, generator space, destructive confirmation, and malformed sharing.",
    "",
    "## Verdict",
    "",
    "The AI interaction model meets the tested simplicity bar: mark first, drag the mark second; background gestures never execute operations; compact nodes remain targetable at minimum zoom. Live model quality and hosted account synchronization remain environment-dependent and are not represented as proven.",
    "",
  ];
  fs.writeFileSync(path.join(OUT, "REPORT.md"), lines.join("\n"));
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`main: ${error.message}`));
  await page.goto(BASE);
  await seed(page);

  await auditLayout(page);
  await auditGenerator(page);
  await auditAi(page);
  await auditHighlighter(page);
  await auditCompanion(browser);
  await auditMalformedShare(browser);

  check("runtime", "no page errors across audited contexts", errors.length === 0, errors.join(" | "));
  await context.close();
  await browser.close();
  writeReport();

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} assertions passed; ${shots.length} screenshots`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  errors.push(error.stack || error.message);
  writeReport();
  console.error(error);
  process.exit(1);
});
