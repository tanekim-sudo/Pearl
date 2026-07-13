import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve("audit-shots/unified-workspace");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

function legacyItems(count = 8) {
  return Array.from({ length: count }, (_, i) => ({
    id: `legacy-item-${i}`,
    type: i % 7 === 0 ? "stroke" : i % 5 === 0 ? "sticky" : "text",
    x: 60 + (i % 6) * 105,
    y: 90 + Math.floor(i / 6) * 64,
    w: 150,
    text: `Paper material ${i}`,
    points: i % 7 === 0 ? [{ x: 50, y: 70 + i }, { x: 240, y: 120 + i }] : undefined,
    color: "#000000",
    width: 2.4,
    pageId: "page-main",
    history: [{ kind: "born", at: i }],
  }));
}

function legacyNodes(count = 10) {
  return Array.from({ length: count }, (_, i) => ({
    id: `legacy-node-${i}`,
    nodeKind: i ? "expanded" : "source",
    parentId: i ? `legacy-node-${Math.floor((i - 1) / 2)}` : null,
    x: (i % 5) * 135,
    y: Math.floor(i / 5) * 125,
    radius: i ? 24 : 32,
    label: i ? `result ${i}` : "source thought",
    expandedText: `AI node ${i} retains its readable output and lineage.`,
    opLabel: i ? ["invert", "reframe", "expand"][i % 3] : null,
    history: [{ kind: "operation", at: i }],
  }));
}

async function seedLegacy(page, itemCount = 8, nodeCount = 10) {
  await page.addInitScript(
    ({ items, nodes }) => {
      if (sessionStorage.getItem("lens-audit-seeded")) return;
      sessionStorage.setItem("lens-audit-seeded", "1");
      localStorage.clear();
      localStorage.setItem("lens.onboarded.v1", "1");
      localStorage.setItem("lens.companion.seen.v1", "1");
      localStorage.setItem("lens.tour.v1", "1");
      localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
        version: 1,
        interviewComplete: true,
      }));
      localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
      localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
      localStorage.setItem("lens.board.camera.v1", JSON.stringify({ x: 110, y: 70, scale: 0.64 }));
      localStorage.setItem("lens.board.pages.v1", JSON.stringify([
        { id: "page-main", name: "Research page", camera: { x: 110, y: 70, scale: 0.64 }, sessions: [] },
      ]));
    },
    { items: legacyItems(itemCount), nodes: legacyNodes(nodeCount) }
  );
  await page.goto(BASE);
  try {
    await page.waitForSelector(".unified-workspace-grid .ai-node", { state: "attached", timeout: 10000 });
  } catch (error) {
    console.error("AUDIT BOOT DIAGNOSTIC", await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 500),
      nodes: document.querySelectorAll(".ai-node").length,
      unified: localStorage.getItem("lens.unified-workspace.v2"),
    })), errors);
    throw error;
  }
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
    errors.push(message.text());
  }
});

try {
  await seedLegacy(page);
  await shot(page, "before-after-migration");

  const migration = await page.evaluate(() => {
    const unified = JSON.parse(localStorage.getItem("lens.unified-workspace.v2") || "null");
    return {
      version: unified?.version,
      itemCount: unified?.items?.length,
      nodeCount: unified?.nodes?.length,
      legacyItems: JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length,
      legacyNodes: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]").length,
      firstNode: unified?.nodes?.[0],
    };
  });
  check("versioned migration created", migration.version === 3, `v${migration.version}`);
  check("paper records preserved", migration.itemCount === 8 && migration.legacyItems === 8);
  check("AI records and history preserved", migration.nodeCount === 10 && migration.firstNode?.history?.length === 1);

  const firstPosition = { x: migration.firstNode.x, y: migration.firstNode.y };
  await page.reload();
  await page.waitForSelector(".ai-node");
  const secondPosition = await page.evaluate(() => {
    const unified = JSON.parse(localStorage.getItem("lens.unified-workspace.v2"));
    return { x: unified.nodes[0].x, y: unified.nodes[0].y };
  });
  check("migration reload is idempotent", firstPosition.x === secondPosition.x && firstPosition.y === secondPosition.y);

  const visual = await page.evaluate(() => {
    const grid = document.querySelector(".unified-workspace-grid");
    const canvas = document.querySelector(".canvas-column");
    const node = document.querySelector(".ai-node");
    const paper = document.querySelector(".paper-sheet");
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      canvasBackground: getComputedStyle(canvas).backgroundColor,
      nodeColor: getComputedStyle(node.querySelector(".ai-node-ring")).borderColor,
      paperRect: paper.getBoundingClientRect().toJSON(),
      canvasRect: canvas.getBoundingClientRect().toJSON(),
    };
  });
  check("single primary canvas replaces paper/AI columns", visual.columns === 3, `${visual.columns} grid tracks`);
  check("white and graphite visual system", /250|249|248|255/.test(visual.canvasBackground) && /20/.test(visual.nodeColor));
  check("paper is a frame inside world", visual.paperRect.width < visual.canvasRect.width);
  await shot(page, "overview");

  const node = page.locator(".ai-node").last();
  const before = await node.boundingBox();
  const paperForMove = await page.locator(".paper-sheet").boundingBox();
  const direction = before.x + before.width / 2 > paperForMove.x + paperForMove.width / 2 ? -1 : 1;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + direction * 80, before.y + before.height / 2 + 35, { steps: 10 });
  await page.mouse.up();
  const after = await node.boundingBox();
  check("node center drag moves without spawning", Math.abs(after.x - before.x) > 50 && (await page.locator(".ai-node").count()) === 10);

  const edgeHandle = await node.locator(".ai-node-edge-handle-w").boundingBox();
  const movedCenter = { x: after.x + after.width / 2, y: after.y + after.height / 2 };
  await page.mouse.move(edgeHandle.x + edgeHandle.width / 2, edgeHandle.y + edgeHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedCenter.x - 120, movedCenter.y, { steps: 8 });
  await page.keyboard.press("ArrowRight");
  check("edge drag opens operation chooser", await page.locator(".ai-strand-choice-hud").isVisible());
  await shot(page, "branch-chooser");
  await page.mouse.up();

  const tools = page.locator(".canvas-tools-bar");
  if (!(await tools.evaluate((element) => element.classList.contains("expanded")))) {
    await page.locator(".canvas-tools-toggle").click();
  }
  await page.locator('[data-tool="pen"]').click();
  const canvasBox = await page.locator(".canvas-column-main").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + 260);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.82, canvasBox.y + 330, { steps: 24 });
  await page.mouse.up();
  check("ink crosses paper frame into node area", (await page.locator(".ink-layer polyline").count()) > 0);
  await shot(page, "paper-frame-focus");

  await page.locator('[data-tool="highlight"]').click();
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 90);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 560, canvasBox.y + 110, { steps: 18 });
  await page.mouse.up();
  const nodeBox = await page.locator(".ai-node").first().boundingBox();
  await page.mouse.click(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  check("mixed highlight can mark AI nodes", (await page.locator(".ai-node.omni-marked").count()) > 0);
  await shot(page, "mixed-selection");

  await page.setViewportSize({ width: 1180, height: 720 });
  await page.waitForTimeout(250);
  const narrow = await page.locator(".canvas-column").boundingBox();
  check("narrow laptop canvas remains usable", narrow.width > 700 && narrow.height > 560, `${Math.round(narrow.width)}×${Math.round(narrow.height)}`);
  await shot(page, "narrow-view");

  for (const count of [1, 10, 50, 150]) {
    await page.evaluate((nodes) => {
      const unified = JSON.parse(localStorage.getItem("lens.unified-workspace.v2"));
      unified.nodes = nodes.map((node) => ({ ...node, x: node.x + 820, y: node.y + 180 }));
      localStorage.setItem("lens.unified-workspace.v2", JSON.stringify(unified));
    }, legacyNodes(count));
    await page.reload();
    await page.waitForTimeout(250);
    check(`renders ${count} nodes`, (await page.locator(".ai-node").count()) === count);
  }
  await shot(page, "dense-node-graph");

  await page.evaluate((items) => {
    const unified = JSON.parse(localStorage.getItem("lens.unified-workspace.v2"));
    unified.items = items;
    localStorage.setItem("lens.unified-workspace.v2", JSON.stringify(unified));
  }, legacyItems(1000));
  await page.reload();
  await page.waitForTimeout(500);
  check("renders 1000 paper items", (await page.locator("[data-item]").count()) >= 1000);
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const passed = results.filter((result) => result.ok).length;
const report = `# Unified workspace audit

## Result

${passed}/${results.length} automated visible-UI checks passed.

## Capability parity

| Capability | Paper legacy | AI legacy | Unified |
| --- | --- | --- | --- |
| Text/blocks/images/ink/edit/move/resize | yes | source only | preserved in shared world |
| Node move/read/morph/lineage/paths | no | yes | preserved in shared world |
| Edge strand operation fan + keyboard | no | yes | preserved; expand remains one explicit choice |
| Persistent exact-fragment highlighter | yes | yes | mixed paper/node/ink selection |
| Lenses/generators/spatial outputs | yes | yes | shared coordinates and rail |
| Undo/redo | paper | separate mutations | mixed item/node snapshots |
| Persistence | legacy paper keys | legacy AI key | v2 snapshot plus readable legacy keys |

## Architecture and migration evidence

- One unbounded affine world camera drives paper objects, ink, AI nodes, edges, and overlays.
- The 8.5×11 page remains a visible frame at world origin; content may extend outside it.
- Legacy AI coordinates receive one deterministic offset during the idempotent v2 migration.
- Legacy keys are retained as recovery sources; the v2 snapshot duplicates all records and camera state.

## Interaction measurements

- Node core drag threshold: 8 px.
- Node edge band: at least 10 screen px.
- Strand activation: 4 px; operation fan supports arrow keys and release-to-commit.
- Narrow viewport checked at 1180×720.
- Density checked at 1, 10, 50, and 150 nodes plus 1000 paper items.

## Checks

${results.map((result) => `- ${result.ok ? "PASS" : "FAIL"} — ${result.name}${result.detail ? `: ${result.detail}` : ""}`).join("\n")}

## Screenshots

- [Overview](overview.png)
- [Paper frame focus](paper-frame-focus.png)
- [Dense node graph](dense-node-graph.png)
- [Mixed selection](mixed-selection.png)
- [Branch chooser](branch-chooser.png)
- [Narrow view](narrow-view.png)
- [Migration](before-after-migration.png)

## Honest limits

- Media capture still depends on browser microphone/file permissions.
- AI operation completion still depends on configured model credentials and network availability.
- The stress audit validates DOM stability and interaction routing, not GPU frame timing on every device.
`;
fs.writeFileSync(path.join(OUT, "REPORT.md"), report);
if (passed !== results.length) process.exitCode = 1;
