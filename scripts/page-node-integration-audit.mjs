import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve("audit-shots/page-node-integration");
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const pageErrors = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const legacyItems = [
  { id: "edge-text", type: "text", x: -180, y: -80, w: 260, text: "Exact highlighted phrase with context", pageId: "page-main" },
  { id: "edge-sticky", type: "sticky", x: 730, y: 1060, w: 220, text: "Sticky evidence", pageId: "page-main" },
  { id: "edge-image", type: "image", x: -400, y: 300, w: 1800, h: 1200, src: "", pageId: "page-main" },
  {
    id: "edge-ink",
    type: "stroke",
    points: [{ x: -90, y: 1080 }, { x: 840, y: 1180 }],
    width: 12,
    color: "#000",
    pageId: "page-main",
  },
];

const legacyNodes = Array.from({ length: 50 }, (_, index) => ({
  id: `node-${index}`,
  nodeKind: index ? "expanded" : "source",
  parentId: index ? `node-${Math.floor((index - 1) / 4)}` : null,
  sourceNodeIds: index ? [`node-${Math.floor((index - 1) / 4)}`] : [],
  sourceIds: index ? [] : ["edge-text"],
  x: index % 2 ? -200 - index * 8 : 900 + index * 7,
  y: index % 3 ? 80 + index * 28 : 1250,
  radius: index ? 30 : 34,
  label: index ? `Result ${index}` : "Bounded source",
  expandedText: index ? `Compact AI result ${index}` : undefined,
  preview: index ? undefined : "Bounded source material",
}));

const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
    pageErrors.push(message.text());
  }
});

async function screenshot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function persistedWorkspace() {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lens.unified-workspace.v2") || "{}"));
}

try {
  await page.addInitScript(
    ({ items, nodes }) => {
      localStorage.clear();
      localStorage.setItem("lens.onboarded.v1", "1");
      localStorage.setItem("lens.companion.seen.v1", "1");
      localStorage.setItem("lens.tour.v1", "1");
      localStorage.setItem(
        "lens.companion.memory.v1:anonymous",
        JSON.stringify({ version: 1, interviewComplete: true })
      );
      localStorage.setItem(
        "lens.unified-workspace.v2",
        JSON.stringify({
          version: 2,
          savedAt: new Date().toISOString(),
          camera: { x: 120, y: 60, scale: 0.64 },
          items,
          nodes,
        })
      );
      localStorage.setItem(
        "lens.board.pages.v1",
        JSON.stringify([{ id: "page-main", name: "Page contract audit", sessions: [] }])
      );
    },
    { items: legacyItems, nodes: legacyNodes }
  );
  await page.goto(BASE);
  await page.waitForSelector(".paper-sheet");
  await page.waitForSelector(".ai-node");
  await page.waitForTimeout(700);

  const stored = await persistedWorkspace();
  const boundedNodes = (stored.nodes || []).every(
    (node) =>
      node.x - node.radius >= 24 &&
      node.x + node.radius <= 768 - 24 &&
      node.y - node.radius >= 24 &&
      node.y + node.radius <= 1104 - 24
  );
  check("legacy AI migration clamps every full circle", boundedNodes, `${stored.nodes?.length || 0} nodes`);
  check(
    "legacy default node radii migrate to 14–18",
    (stored.nodes || []).every((node) => node.radius >= 14 && node.radius <= 18),
    [...new Set((stored.nodes || []).map((node) => node.radius))].join(", ")
  );

  const visualBounds = await page.evaluate(() => {
    const paper = document.querySelector(".paper-sheet")?.getBoundingClientRect();
    if (!paper) return { inside: false, maxError: Infinity };
    const content = [...document.querySelectorAll(".ai-node, [data-item]")];
    let maxError = 0;
    let worst = null;
    for (const element of content) {
      const box = element.getBoundingClientRect();
      const error = Math.max(
        maxError,
        paper.left - box.left,
        paper.top - box.top,
        box.right - paper.right,
        box.bottom - paper.bottom
      );
      if (error > maxError) {
        maxError = error;
        worst = {
          id: element.getAttribute("data-item") || element.getAttribute("data-node-id") || element.className,
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
          paper: { left: paper.left, top: paper.top, right: paper.right, bottom: paper.bottom },
        };
      }
    }
    return { inside: maxError <= 1.5, maxError, worst };
  });
  check("rendered persistent footprints stay inside page", visualBounds.inside, `max overflow ${visualBounds.maxError.toFixed(2)}px · ${JSON.stringify(visualBounds.worst || "none")}`);

  const hitBox = await page.locator(".ai-node-screen-hit-target").first().boundingBox();
  check("compact node keeps 24px screen hit target", hitBox && hitBox.width >= 23.5 && hitBox.height >= 23.5, hitBox ? `${hitBox.width.toFixed(1)}×${hitBox.height.toFixed(1)}` : "missing");
  await screenshot("01-bounded-50-node-page");

  const node = page.locator('.ai-node[data-node-id="node-49"]');
  const nodeBox = await node.boundingBox();
  const operators = page.locator(".op-card-row.toolbox-drag-row");
  const primitiveCount = Math.min(8, await operators.count());
  if (primitiveCount === 8 && nodeBox) {
    let targeted = true;
    let branched = 0;
    for (let index = 0; index < primitiveCount; index++) {
      const operatorBox = await operators.nth(index).boundingBox();
      const before = await page.locator(".ai-node").count();
      await page.mouse.move(operatorBox.x + operatorBox.width / 2, operatorBox.y + operatorBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2, { steps: 8 });
      await page.waitForTimeout(35);
      targeted &&= await node.evaluate((element) => element.classList.contains("operator-drop-target"));
      if (index === 0) await screenshot("02-operator-node-drop-target");
      await page.mouse.up();
      await page.waitForTimeout(80);
      const after = await page.locator(".ai-node").count();
      if (after === before + 1) branched += 1;
    }
    check("all 8 primitives identify the exact node", targeted);
    check("all 8 primitives branch the targeted node", branched === 8, `${branched}/8`);
  } else {
    check("all 8 primitives identify the exact node", false, `${primitiveCount}/8 rows`);
    check("all 8 primitives branch the targeted node", false, `${primitiveCount}/8 rows`);
  }

  await page.locator('[data-tool="highlight"]').click();
  await page.waitForTimeout(150);
  for (const selector of ['[data-item="edge-text"]', '[data-item="edge-sticky"]', '[data-item="edge-ink"]']) {
    const target = page.locator(selector);
    if (!(await target.count())) continue;
    await target.click({ force: true });
  }
  const visibleNodeId = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.ai-node[data-node-id^="node-"]')].reverse();
    for (const element of nodes) {
      const box = element.getBoundingClientRect();
      const hit = document
        .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        ?.closest?.(".ai-node");
      if (hit === element) return element.dataset.nodeId;
    }
    return null;
  });
  if (visibleNodeId) {
    await page.locator(`.ai-node[data-node-id="${visibleNodeId}"]`).click();
  }
  const makeNode = page.locator(".omni-highlight-btn.make-node");
  const markedBefore = await page.locator(".omni-marked, .hl-selected").count();
  check("mixed material produces persistent highlight", markedBefore > 0, `${markedBefore} marked`);
  if (await makeNode.isVisible()) {
    const before = await page.locator(".ai-node").count();
    await makeNode.click();
    await page.waitForTimeout(250);
    const after = await page.locator(".ai-node").count();
    const latest = await persistedWorkspace();
    const bundleNode = [...(latest.nodes || [])].reverse().find((entry) => entry.sourceBundle);
    check("make node creates exactly one source", after === before + 1 && bundleNode?.nodeKind === "source");
    check(
      "source retains structured provenance",
      Boolean(bundleNode?.sourceBundle?.paper?.length && bundleNode?.sourceBundle?.ai?.length),
      bundleNode ? `${bundleNode.sourceBundle.paper.length} paper · ${bundleNode.sourceBundle.ai.length} AI` : "missing"
    );
    check("successful conversion clears highlight", !(await makeNode.isVisible()));
    await screenshot("03-mixed-source-node");
  } else {
    check("make node creates exactly one source", false, "toolbar unavailable");
    check("source retains structured provenance", false, "toolbar unavailable");
    check("successful conversion clears highlight", false, "toolbar unavailable");
  }

  const viewport = await page.locator('[data-tour="paper-canvas"]').boundingBox();
  for (let index = 0; index < 100 && viewport; index++) {
    const x = viewport.x + 30 + ((index * 37) % Math.max(40, viewport.width - 60));
    const y = viewport.y + 30 + ((index * 53) % Math.max(40, viewport.height - 60));
    await page.mouse.move(x, y);
  }
  check("100 rapid pointer passes leave no stuck ghosts", (await page.locator(".toolbox-apply-ghost, .space-transfer-ghost").count()) === 0);
  check("visible audit has no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  await screenshot("04-final-page-contract");

  const finalWorkspace = await persistedWorkspace();
  const report = `# Page + node integration audit

- Checks: ${checks.filter((entry) => entry.ok).length}/${checks.length} passed
- Page: 768 × 1104 world units; persistent margin: 24
- Compact AI radii: ${[...new Set((finalWorkspace.nodes || []).map((node) => node.radius))].sort((a, b) => a - b).join(", ")} world units
- Maximum measured visual overflow: ${visualBounds.maxError.toFixed(2)} px
- Page errors: ${pageErrors.length}

## Results
${checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? ` (${entry.detail})` : ""}`).join("\n")}

## Screenshots
- [Bounded dense page](01-bounded-50-node-page.png)
- [Exact operator target](02-operator-node-drop-target.png)
- [Mixed source node](03-mixed-source-node.png)
- [Final contract](04-final-page-contract.png)
`;
  fs.writeFileSync(path.join(OUT, "REPORT.md"), report);
} finally {
  await browser.close();
}

if (checks.some((entry) => !entry.ok) || pageErrors.length) process.exitCode = 1;
