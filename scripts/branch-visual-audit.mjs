import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve("audit-shots/branch-visual-audit");
fs.mkdirSync(OUT, { recursive: true });

const directions = [
  ["east", 0],
  ["south-east", Math.PI / 4],
  ["south", Math.PI / 2],
  ["south-west", (3 * Math.PI) / 4],
  ["west", Math.PI],
  ["north-west", (-3 * Math.PI) / 4],
  ["north", -Math.PI / 2],
  ["north-east", -Math.PI / 4],
];
const variants = [
  { name: "min", scale: 0.05, pan: [-180, -100], source: [384, 552] },
  { name: "dot", scale: 0.25, pan: [150, -90], source: [384, 552] },
  { name: "transition", scale: 0.72, pan: [-160, 100], source: [384, 552] },
  { name: "default", scale: 0.85, pan: [130, 90], source: [384, 552] },
  { name: "read", scale: 2.35, pan: [-120, -70], source: [384, 552] },
  { name: "max", scale: 3.2, pan: [110, 55], source: [384, 552] },
  { name: "page-positive", scale: 0.42, pan: [-190, 120], source: [384, 552] },
  { name: "page-negative", scale: 0.58, pan: [180, -120], source: [384, 552] },
];

const checks = [];
const failures = [];
const pageErrors = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const angleDistance = (a, b) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};
const degrees = (radians) => (radians * 180) / Math.PI;

function workspace(variant, viewport) {
  const [x, y] = variant.source;
  const [panX, panY] = variant.pan;
  return {
    version: 3,
    savedAt: new Date().toISOString(),
    camera: {
      scale: variant.scale,
      x: viewport.width / 2 + panX - x * variant.scale,
      y: viewport.height / 2 + panY - y * variant.scale,
    },
    items: [
      {
        id: "paper-source",
        type: "text",
        text: "Directional branch audit source material",
        x: 90,
        y: 110,
        w: 300,
        pageId: "page-main",
      },
    ],
    nodes: [
      {
        id: "source",
        type: "ai-node",
        nodeKind: "source",
        parentId: null,
        sourceIds: ["paper-source"],
        sourceNodeIds: [],
        x,
        y,
        radius: 18,
        label: "direction source",
        preview: "Directional branch audit source material",
      },
    ],
  };
}

async function seedSnapshot(page, snapshot) {
  await page.evaluate(
    ({ snapshot }) => {
      sessionStorage.setItem("lens.branch-audit.next", JSON.stringify(snapshot));
    },
    { snapshot }
  );
  await page.reload();
  try {
    await page.waitForSelector('[data-node-id="source"]', { state: "attached", timeout: 10000 });
  } catch (error) {
    console.error("BRANCH AUDIT BOOT", await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 500),
      nodes: [...document.querySelectorAll(".ai-node")].map((node) => ({
        id: node.dataset.nodeId,
        rect: node.getBoundingClientRect().toJSON(),
      })),
      unified: localStorage.getItem("lens.unified-workspace.v2"),
    })));
    throw error;
  }
  await page.waitForTimeout(80);
}

async function seed(page, variant, viewport) {
  return seedSnapshot(page, workspace(variant, viewport));
}

async function sourceCenter(page) {
  const box = await page.locator('[data-node-id="source"]').boundingBox();
  if (!box) throw new Error("source node is not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function beginBranch(page, angle, opts = {}) {
  const source = await sourceCenter(page);
  const screenRadius = Math.max(7, Math.min(source.box.width, source.box.height) * 0.41);
  const start = {
    x: source.x + Math.cos(angle) * screenRadius,
    y: source.y + Math.sin(angle) * screenRadius,
  };
  const release = {
    x: source.x + Math.cos(angle) * (opts.distance || 178),
    y: source.y + Math.sin(angle) * (opts.distance || 178),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Activate on the final ray, then optionally exercise a curved path.
  await page.mouse.move(
    source.x + Math.cos(angle) * (screenRadius + 14),
    source.y + Math.sin(angle) * (screenRadius + 14)
  );
  if (opts.curved) {
    await page.mouse.move(
      source.x + Math.cos(angle + Math.PI / 3) * 90,
      source.y + Math.sin(angle + Math.PI / 3) * 90,
      { steps: 3 }
    );
  }
  await page.mouse.move(release.x, release.y, { steps: opts.fast ? 1 : 6 });
  await page.waitForSelector(".ai-strand-placement-preview");
  const preview = await page.locator(".ai-strand-placement-preview").evaluate((element) => ({
    x: Number(element.dataset.worldX),
    y: Number(element.dataset.worldY),
    intentAngle: Number(element.dataset.intentAngle),
    placementAngle: Number(element.dataset.placementAngle),
    angleError: Number(element.dataset.angleError),
  }));
  return { source, start, release, preview };
}

async function finishBranch(page, keyboard = null) {
  if (keyboard) await page.keyboard.press(keyboard);
  const before = await page.locator(".ai-node").count();
  await page.mouse.up();
  await page.waitForFunction((count) => document.querySelectorAll(".ai-node").length > count, before);
  await page.waitForTimeout(30);
  return page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem("lens.unified-workspace.v2"));
    const child = [...snapshot.nodes].reverse().find((node) => node.parentId === "source");
    const source = snapshot.nodes.find((node) => node.id === "source");
    return { child, source, camera: snapshot.camera };
  });
}

const viewport = { width: 1440, height: 900 };
const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport });
await page.addInitScript(() => {
  const raw = sessionStorage.getItem("lens.branch-audit.next");
  if (!raw) return;
  const snapshot = JSON.parse(raw);
  sessionStorage.removeItem("lens.branch-audit.next");
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem(
    "lens.companion.memory.v1:anonymous",
    JSON.stringify({ version: 1, interviewComplete: true })
  );
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify(snapshot));
  localStorage.setItem("lens.board.items.v1", JSON.stringify(snapshot.items));
  localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(snapshot.nodes));
  localStorage.setItem("lens.board.camera.v1", JSON.stringify(snapshot.camera));
});
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
    pageErrors.push(message.text());
  }
});
await page.route("**/api/run", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outputs: ["audited output"] }) })
);
await page.route("**/api/execute", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ output: "audited output" }) })
);

const measurements = [];
try {
  await page.goto(BASE);
  for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
    const variant = variants[variantIndex];
    for (let directionIndex = 0; directionIndex < directions.length; directionIndex++) {
      const [directionName, angle] = directions[directionIndex];
      await seed(page, variant, viewport);
      const gesture = await beginBranch(page, angle, {
        curved: directionIndex === 2,
        fast: directionIndex === 5,
        distance: directionIndex === 0 ? 92 : directionIndex === 4 ? 230 : 178,
      });
      if (variantIndex === 0) {
        await page.screenshot({ path: path.join(OUT, `fan-${directionName}.png`) });
      }
      const keyboard = directionIndex % 3 === 0 ? "ArrowRight" : directionIndex % 5 === 0 ? "ArrowUp" : null;
      const committed = await finishBranch(page, keyboard);
      const actualAngle = Math.atan2(
        committed.child.y - committed.source.y,
        committed.child.x - committed.source.x
      );
      const error = degrees(angleDistance(angle, actualAngle));
      const previewJump = Math.hypot(
        committed.child.x - gesture.preview.x,
        committed.child.y - gesture.preview.y
      );
      measurements.push({
        variant: variant.name,
        direction: directionName,
        scale: variant.scale,
        start: gesture.start,
        release: gesture.release,
        intendedAngleDeg: degrees(angle),
        previewAngleDeg: degrees(gesture.preview.placementAngle),
        actualAngleDeg: degrees(actualAngle),
        errorDeg: error,
        previewJump,
        keyboard,
      });
      check(
        `${variant.name}/${directionName}`,
        error <= 8 && previewJump < 0.01,
        `${error.toFixed(2)}°; jump ${previewJump.toFixed(3)} world px`
      );
      if (variantIndex === 2 && directionIndex === 0) {
        await page.screenshot({ path: path.join(OUT, "after-direction-overlay.png") });
      }
    }
  }

  // Tiny source jiggles and background drags are deliberately interleaved.
  await seed(page, variants[3], viewport);
  const initialCount = await page.locator(".ai-node").count();
  const source = await sourceCenter(page);
  const canvas = await page.locator(".canvas-column-main").boundingBox();
  for (let i = 0; i < 100; i++) {
    if (i % 2 === 0) {
      await page.mouse.move(source.x, source.y);
      await page.mouse.down();
      await page.mouse.move(source.x + 1 + (i % 7), source.y + (i % 3));
      await page.mouse.up();
    } else {
      const x = canvas.x + 80 + (i % 10) * 18;
      const y = canvas.y + 70 + (i % 8) * 16;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 12, y + 7);
      await page.mouse.up();
    }
  }
  check("100 rapid non-branch gestures create no outputs", (await page.locator(".ai-node").count()) === initialCount);
  check("no orphan preview after stress", (await page.locator(".ai-strand-placement-preview").count()) === 0);
  check("pointer drag class is cleared", !(await page.locator("body").evaluate((body) => body.classList.contains("ai-strand-dragging"))));

  const collisionSnapshot = workspace(variants[3], viewport);
  collisionSnapshot.nodes.push({
    id: "blocker",
    type: "ai-node",
    nodeKind: "expanded",
    parentId: null,
    sourceIds: [],
    sourceNodeIds: [],
    x: collisionSnapshot.nodes[0].x + 480,
    y: collisionSnapshot.nodes[0].y,
    radius: 28,
    label: "nearby node",
    expandedText: "Collision avoidance should preserve the intended hemisphere.",
  });
  await seedSnapshot(page, collisionSnapshot);
  const collisionGesture = await beginBranch(page, 0);
  await page.screenshot({ path: path.join(OUT, "collision-adjusted-preview.png") });
  const collisionCommit = await finishBranch(page);
  const collisionAngle = Math.atan2(
    collisionCommit.child.y - collisionCommit.source.y,
    collisionCommit.child.x - collisionCommit.source.x
  );
  check(
    "collision adjustment preserves east hemisphere within 20°",
    collisionCommit.child.x > collisionCommit.source.x &&
      degrees(angleDistance(0, collisionAngle)) <= 20 &&
      collisionGesture.preview.angleError <= (20 * Math.PI) / 180
  );

  const denseSnapshot = workspace(variants[1], viewport);
  denseSnapshot.nodes.push(
    ...Array.from({ length: 49 }, (_, index) => {
      const ring = 1 + Math.floor(index / 12);
      const angle = (index * Math.PI * 2) / 12;
      return {
        id: `dense-${index}`,
        type: "ai-node",
        nodeKind: "expanded",
        parentId: index < 8 ? "source" : `dense-${Math.max(0, index - 8)}`,
        sourceIds: [],
        sourceNodeIds: [],
        x: denseSnapshot.nodes[0].x + Math.cos(angle) * ring * 520,
        y: denseSnapshot.nodes[0].y + Math.sin(angle) * ring * 520,
        radius: 26,
        label: `dense result ${index + 1}`,
        expandedText: `Readable dense graph result ${index + 1}.`,
      };
    })
  );
  await seedSnapshot(page, denseSnapshot);
  check("dense graph renders 50 nodes", (await page.locator(".ai-node").count()) === 50);
  await page.screenshot({ path: path.join(OUT, "dense-graph-50.png") });

  for (const size of [
    { width: 1600, height: 1000, name: "overview-1600x1000" },
    { width: 1180, height: 720, name: "overview-narrow-laptop" },
  ]) {
    await page.setViewportSize(size);
    await seed(page, variants[1], size);
    await beginBranch(page, -Math.PI / 4);
    const visual = await page.evaluate(() => {
      const hud = document.querySelector(".ai-strand-choice-hud");
      const item = document.querySelector(".ai-strand-choice-hud-item");
      const path = document.querySelector(".ai-strand-placement-path");
      return {
        hudBackground: getComputedStyle(hud).backgroundColor,
        itemColor: getComputedStyle(item).color,
        placementStroke: getComputedStyle(path).stroke,
        hudRect: hud.getBoundingClientRect().toJSON(),
      };
    });
    check(
      `${size.name} chooser remains inside viewport`,
      visual.hudRect.left >= 0 &&
        visual.hudRect.bottom <= size.height &&
        visual.hudRect.right <= size.width,
      `${Math.round(visual.hudRect.width)}×${Math.round(visual.hudRect.height)}`
    );
    check(
      `${size.name} uses white/graphite strand tokens`,
      visual.hudBackground.includes("255") &&
        /20|30/.test(visual.itemColor) &&
        /20|30/.test(visual.placementStroke)
    );
    await page.screenshot({ path: path.join(OUT, `${size.name}.png`) });
    await page.mouse.up();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, variants[1], { width: 1180, height: 720 });
  await beginBranch(page, Math.PI / 4);
  const reducedMotion = await page.locator(".ai-strand-drag-path").first().evaluate((element) => ({
    animation: getComputedStyle(element).animationName,
    transition: getComputedStyle(element).transitionDuration,
  }));
  check(
    "reduced motion disables strand animation",
    reducedMotion.animation === "none" && reducedMotion.transition === "0s",
    `${reducedMotion.animation}/${reducedMotion.transition}`
  );
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const existingBefore = path.resolve("audit-shots/unified-workspace/branch-chooser.png");
if (fs.existsSync(existingBefore)) {
  fs.copyFileSync(existingBefore, path.join(OUT, "before-existing-branch-chooser.png"));
}

const errors = measurements.map((row) => row.errorDeg);
const maxError = Math.max(...errors);
const meanError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
const report = `# Branch geometry and visual audit

## Result

${checks.filter((item) => item.ok).length}/${checks.length} checks passed. The 64-case directional matrix measured a mean angular error of ${meanError.toFixed(2)}° and a maximum of ${maxError.toFixed(2)}°.

## Root causes and contract

- The legacy commit path used the selected operation fan spoke as the child angle, coupling keyboard/pointer operation selection to placement.
- The legacy fan froze at activation, so curved paths and center crossings retained an early angle.
- Short high-zoom drops could fall back to the graph's default outward sector.
- Placement now follows the release ray from the source center. Distance is clamped in world space, collision adjustment searches no more than 20° and preserves the cursor-facing hemisphere, and the exact resolved point is previewed and committed.
- Arrow/number keys change only the operation. Pointer cancellation commits nothing.
- Lens-editor strand jiggles commit nothing; upward/downward drags insert the constrained branch lane above/below.

## Automated scenarios

- 64 committed UI branches: 8 directions × 8 zoom/camera/page-origin variants.
- Includes short/long drags, curved path, fast flick, keyboard operation changes, all camera quadrants, and min/dot/transition/default/read/max zoom.
- 100 rapid mixed tiny node/background gestures.
- 1440×900, 1600×1000, and 1180×720 visual captures.
- DOM assertions cover preview/commit equality, angular error, orphan previews, drag-class cleanup, accidental outputs, and page errors.

## Visual-system fixes

- Replaced stale dark-theme strand HUD/fan colors in the unified white workspace with graphite/white styling.
- Reduced gold emphasis, line-weight variation, and heavy chooser shadow.
- Added one explicit dashed placement edge and ghost node, distinct from operation choices.
- Added readable label knockouts on white and a complete reduced-motion path.

## Screenshot index

- [Existing pre-fix chooser](before-existing-branch-chooser.png)
- [After commit](after-direction-overlay.png)
- [1600×1000 fan](overview-1600x1000.png)
- [Narrow laptop fan](overview-narrow-laptop.png)
- [Collision-adjusted preview](collision-adjusted-preview.png)
- [Dense 50-node graph](dense-graph-50.png)
- Eight directional fan captures: ${directions.map(([name]) => `[${name}](fan-${name}.png)`).join(", ")}

## Measurements

${measurements.map((row) => `- ${row.variant}/${row.direction}: ${row.errorDeg.toFixed(2)}° error, ${row.previewJump.toFixed(3)} world-px preview jump${row.keyboard ? `, ${row.keyboard}` : ""}`).join("\n")}

## Honest limits

- Touch was validated through pointer-event-compatible code paths, but this desktop audit did not emulate a physical touch digit or macOS trackpad firmware.
- The pre-fix image is the prior unified-workspace audit capture; numeric before behavior is documented from the removed fan-spoke/fallback code path rather than replayed against a second historical server.
- Model calls are intercepted with deterministic responses so geometry stress does not depend on credentials or network latency.
`;
fs.writeFileSync(path.join(OUT, "REPORT.md"), report);
if (failures.length) process.exitCode = 1;
