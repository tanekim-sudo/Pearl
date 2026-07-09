/**
 * UI audit — drives the running dev app (localhost:5173) with a real browser,
 * walks the core flows, and drops screenshots into audit-shots/ for review.
 *
 *   node scripts/ui-audit.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

const LONG_TEXT =
  "The father runs to the prodigal son. Grace arrives before the apology is finished — " +
  "the release happens on the parent's side long before the child asks. Forgiveness here " +
  "is not a verdict but a controlled release of pressure that had been held in the body of " +
  "the household. The same structure appears in immune tolerance, in debt jubilees, and in " +
  "fault-tolerant software that absorbs errors instead of propagating them.";

const seedItems = [
  {
    id: "it1",
    type: "text",
    x: 90,
    y: 130,
    w: 300,
    text: "Forgiveness is the controlled release of pressure",
    pageId: "page-1",
  },
  {
    id: "it2",
    type: "text",
    x: 120,
    y: 330,
    w: 300,
    text: "Ant colonies allocate labor without any manager",
    pageId: "page-1",
  },
];

const seedNodes = [
  {
    id: "n-src",
    nodeKind: "source",
    x: 0,
    y: 0,
    radius: 34,
    label: "Source",
    preview: "Forgiveness is the controlled release of pressure",
    sourceIds: ["it1"],
    createdAt: 1000,
  },
  {
    id: "n-exp",
    nodeKind: "expanded",
    parentId: "n-src",
    sourceNodeIds: ["n-src"],
    x: 500,
    y: -140,
    radius: 30,
    label: "expand",
    opLabel: "expand",
    kind: "expand",
    expandedText: LONG_TEXT,
    createdAt: 2000,
  },
  {
    id: "n-exp2",
    nodeKind: "expanded",
    parentId: "n-src",
    sourceNodeIds: ["n-src"],
    x: 440,
    y: 290,
    radius: 30,
    label: "invert",
    opLabel: "invert",
    kind: "move",
    expandedText:
      "Pressure held is debt accruing. The unforgiving household is a boiler with the valve wired shut.",
    createdAt: 3000,
  },
];

const shots = [];
async function shot(page, name, note = "") {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  shots.push({ name, note });
  console.log(`[shot] ${name}${note ? " — " + note : ""}`);
}

async function aiWheelZoom(page, steps, deltaY, at = null) {
  // ctrl+wheel = zoom toward cursor. One event per animation frame so React
  // state (and the camera ref) actually advances between steps.
  for (let i = 0; i < steps; i++) {
    await page.evaluate(
      ([point, dy]) => {
        const el = document.querySelector(".ai-node-viewport");
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = point ? point.x : r.left + r.width / 2;
        const cy = point ? point.y : r.top + r.height / 2;
        el.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY: dy,
            clientX: cx,
            clientY: cy,
          })
        );
      },
      [at, deltaY]
    );
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(450);
}

async function aiNodeCenters(page, { visibleOnly = false } = {}) {
  return page.evaluate((visible) => {
    const vp = document.querySelector(".ai-node-viewport")?.getBoundingClientRect();
    return [...document.querySelectorAll(".ai-node")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          w: r.width,
          h: r.height,
          cls: el.className,
        };
      })
      .filter(
        (c) =>
          !visible ||
          (vp && c.x > vp.left + 40 && c.x < vp.right - 40 && c.y > vp.top + 60 && c.y < vp.bottom - 60)
      );
  }, visibleOnly);
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  // ---------- 1. first run ----------
  await page.goto(BASE);
  await page.waitForTimeout(1600);
  await shot(page, "01-first-run", "onboarding or companion on fresh profile");

  // ---------- seed a deterministic board ----------
  await page.evaluate(
    ([items, nodes]) => {
      localStorage.clear();
      localStorage.setItem("lens.onboarded.v1", "1");
      localStorage.setItem("lens.companion.seen.v1", "1");
      localStorage.setItem("lens.tour.v1", "1");
      localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
      localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
    },
    [seedItems, seedNodes]
  );
  await page.reload();
  await page.waitForTimeout(1800);
  await shot(page, "02-layout", "three columns, rail split, title chip, page lock");

  // ---------- 2. rail ----------
  const rail = await page.$(".functions-board-rail");
  if (rail) {
    await shot(page, "03-rail", "transformations top half, lenses bottom half");
  }

  // ---------- 3. AI zoom morph sequence ----------
  const scaleOf = () =>
    page.evaluate(() => {
      const el = document.querySelector(".ai-world-layer");
      if (!el) return null;
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return m.a;
    });

  // step toward a target scale, zooming at the text-rich node so it stays put
  async function zoomToScale(targetScale) {
    for (let i = 0; i < 90; i++) {
      const s = await scaleOf();
      if (s !== null && Math.abs(s - targetScale) / targetScale < 0.04) break;
      const cs = await aiNodeCenters(page, { visibleOnly: true });
      const at = cs[1] || cs[0] || null;
      await aiWheelZoom(page, 1, s < targetScale ? -60 : 60, at);
    }
  }

  await zoomToScale(0.12);
  console.log("[scale]", await scaleOf());
  await shot(page, "04-ai-constellation", "zoomed out: dots + edges");

  await zoomToScale(0.95);
  console.log("[scale]", await scaleOf());
  await shot(page, "05-ai-mid-zoom", "mid blend: ring fading, silhouette still circular");

  await zoomToScale(1.15);
  console.log("[scale]", await scaleOf());
  await shot(page, "06-ai-text-zoom", "text blooming, ring mostly gone");

  await zoomToScale(1.6);
  console.log("[scale]", await scaleOf());
  await shot(page, "07-ai-full-text", "full text card, no circle, no spill");

  // fresh camera for the interaction tests: reload (board seed persists)
  await page.reload();
  await page.waitForTimeout(1600);
  console.log("[scale after reload]", await scaleOf());

  // ---------- 4. node interactions ----------
  let centers = await aiNodeCenters(page, { visibleOnly: true });
  console.log("[nodes]", JSON.stringify(centers));
  if (centers.length) {
    const n = centers[0];
    // 4a. center drag = move
    await page.mouse.move(n.x, n.y);
    await page.mouse.down();
    await page.mouse.move(n.x + 60, n.y + 45, { steps: 8 });
    await page.waitForTimeout(150);
    await shot(page, "08-node-center-drag", "grabbing middle moves the node");
    await page.mouse.up();
    await page.waitForTimeout(300);

    // 4b. edge drag = strand fan
    centers = await aiNodeCenters(page, { visibleOnly: true });
    const m = centers[0];
    const edgeX = m.x + m.w / 2 - 3; // right edge
    await page.mouse.move(edgeX, m.y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.mouse.move(edgeX + 90, m.y - 30, { steps: 10 });
    await page.waitForTimeout(250);
    await shot(page, "09-strand-fan", "edge drag opens the operation fan");

    // 4c. arrow keys cycle choice
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    await shot(page, "10-strand-arrow-keys", "arrow keys move the highlighted op");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.waitForTimeout(400);
  }

  // ---------- 5. paper: select-click makes a textbox ----------
  const paper = await page.$(".canvas-column");
  if (paper) {
    const pr = await paper.boundingBox();
    await page.mouse.click(pr.x + pr.width * 0.5, pr.y + pr.height * 0.62);
    await page.waitForTimeout(400);
    await page.keyboard.type("a new thought typed straight onto the page");
    await page.waitForTimeout(300);
    await shot(page, "11-select-click-textbox", "select tool click created a textbox");
    await page.keyboard.press("Escape");
  }

  // ---------- 6. highlighter ----------
  const hlBtn = await page.$('[title*="ighlight"]');
  if (hlBtn) {
    await hlBtn.click();
    await page.waitForTimeout(200);
    const items = await page.$$eval("[data-item]", (els) =>
      els.slice(0, 2).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
      })
    );
    for (const it of items) {
      await page.mouse.move(it.x - it.w / 3, it.y);
      await page.mouse.down();
      await page.mouse.move(it.x + it.w / 3, it.y, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    await shot(page, "12-highlighter", "two strokes -> persistent selection + toolbar");
  }

  // ---------- 7. companion ----------
  const fab = await page.$(".companion-fab");
  if (fab) {
    await fab.click();
    await page.waitForTimeout(500);
    await shot(page, "13-companion", "companion panel with demos");
    const close = await page.$(".companion-head-btn:last-child");
    if (close) await close.click();
  }

  // ---------- 8. toolbar / cursors ----------
  await shot(page, "14-final", "final state");

  await browser.close();
  console.log("\nDone. Shots:");
  for (const s of shots) console.log(` - ${s.name}: ${s.note}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
