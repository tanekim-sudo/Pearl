/**
 * Verifies the two AI-space fixes against the running dev app:
 *  1. arrowheads point into nodes along the path tangent (fan of children)
 *  2. wheel-zoom at AI_MAX_SCALE is a no-op — no sideways camera drift
 *
 *   node scripts/verify-arrows-zoom.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

// one parent with children fanning out — the user's screenshot scenario
const seedNodes = [
  {
    id: "n-src",
    nodeKind: "source",
    x: 0,
    y: 0,
    radius: 34,
    label: "Source",
    preview: "Forgiveness is the controlled release of pressure",
    createdAt: 1000,
  },
  ...[
    [520, -260, "expand"],
    [560, 40, "invert"],
    [430, 330, "compress"],
    [-480, -180, "interpret"],
    [-380, 300, "trace"],
  ].map(([x, y, op], i) => ({
    id: `n-c${i}`,
    nodeKind: "expanded",
    parentId: "n-src",
    sourceNodeIds: ["n-src"],
    x,
    y,
    radius: 28,
    label: op,
    opLabel: op,
    expandedText: `${op} result — a short synthetic body of text for node ${i}.`,
    createdAt: 2000 + i,
  })),
];

async function wheel(page, deltaY, ticks, at = null) {
  for (let i = 0; i < ticks; i++) {
    await page.evaluate(
      ([point, dy]) => {
        const el = document.querySelector(".ai-node-viewport");
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY: dy,
            clientX: point ? point.x : r.left + r.width / 2,
            clientY: point ? point.y : r.top + r.height / 2,
          })
        );
      },
      [at, deltaY]
    );
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(250);
}

const cameraOf = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".ai-world-layer");
    if (!el) return null;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { scale: m.a, x: m.e, y: m.f };
  });

// arrowhead alignment straight from the live SVG: for each edge path, the
// marker-end tangent (p3 - c2) should aim at the target node's center.
async function measureArrowAlignment(page) {
  return page.evaluate(() => {
    const nodes = JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]");
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const out = [];
    for (const p of document.querySelectorAll(".ai-node-line")) {
      const d = p.getAttribute("d") || "";
      const m = d.match(
        /M ([\d.e+-]+) ([\d.e+-]+) C ([\d.e+-]+) ([\d.e+-]+), ([\d.e+-]+) ([\d.e+-]+), ([\d.e+-]+) ([\d.e+-]+)/
      );
      if (!m) continue;
      const [, , , , , cx2, cy2, x2, y2] = m.map(Number);
      // nearest node center to the endpoint = the target node
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const dd = (n.x - x2) ** 2 + (n.y - y2) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = n;
        }
      }
      if (!best) continue;
      const tangent = Math.atan2(y2 - cy2, x2 - cx2);
      const radialIn = Math.atan2(best.y - y2, best.x - x2);
      let diff = Math.abs(tangent - radialIn);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      out.push({ target: best.id, offDeg: (diff * 180) / Math.PI });
    }
    return out;
  });
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto(BASE);
  await page.waitForTimeout(1200);
  await page.evaluate((nodes) => {
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
  }, seedNodes);
  await page.reload();
  await page.waitForTimeout(1800);

  // ---- 1. arrow alignment at several zoom levels ----
  let ok = true;
  for (const [name, ticks, dy] of [
    ["constellation", 0, 0],
    ["mid", 10, -80],
    ["closer", 8, -80],
  ]) {
    if (ticks) await wheel(page, dy, ticks);
    const cam = await cameraOf(page);
    const arrows = await measureArrowAlignment(page);
    const worst = Math.max(0, ...arrows.map((a) => a.offDeg));
    console.log(
      `[arrows @ ${name}] scale=${cam?.scale.toFixed(3)} edges=${arrows.length} worst-off=${worst.toFixed(2)}°`
    );
    if (worst > 2) ok = false;
    await page.screenshot({ path: `${OUT}/arrows-${name}.png` });
  }

  // ---- 2. zoom drift at the max-scale clamp ----
  await page.reload();
  await page.waitForTimeout(1500);
  // zoom hard toward an off-center point until the clamp engages
  const at = { x: 400, y: 250 };
  await wheel(page, -240, 40, at);
  const a = await cameraOf(page);
  await wheel(page, -240, 15, at); // keep zooming past the clamp
  const b = await cameraOf(page);
  const drift = Math.hypot(b.x - a.x, b.y - a.y);
  console.log(
    `[zoom clamp] scale ${a.scale.toFixed(3)} -> ${b.scale.toFixed(3)}, drift=${drift.toFixed(2)}px`
  );
  await page.screenshot({ path: `${OUT}/zoom-at-clamp.png` });
  if (a.scale < 3.19 || drift > 0.5) ok = false;

  // zoom back out must still work smoothly
  await wheel(page, 240, 6, at);
  const c = await cameraOf(page);
  console.log(`[zoom out after clamp] scale ${c.scale.toFixed(3)}`);
  if (!(c.scale < b.scale)) ok = false;

  await browser.close();
  console.log(ok ? "VERIFY OK" : "VERIFY FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
