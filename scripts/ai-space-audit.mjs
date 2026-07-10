/**
 * Focused AI-space/highlighter stress audit.
 * Saves evidence under audit-shots/final-audit/ai-space/.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve("audit-shots/final-audit/ai-space");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const pageErrors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

function nodes(count, shape = "scatter") {
  return Array.from({ length: count }, (_, i) => {
    const parentId = i ? `stress-${Math.floor((i - 1) / (shape === "fan" ? count : 2))}` : null;
    const angle = count === 1 ? 0 : (i / Math.max(1, count - 1)) * Math.PI * 8;
    const distance = shape === "fan" ? 650 : 90 * Math.sqrt(i);
    return {
      id: `stress-${i}`,
      nodeKind: i ? "expanded" : "source",
      parentId,
      sourceNodeIds: parentId ? [parentId] : [],
      x: i ? Math.cos(angle) * distance : 0,
      y: i ? Math.sin(angle) * distance : 0,
      radius: i ? 22 : 30,
      label: i ? `node ${i}` : "source",
      opLabel: i ? ["expand", "invert", "reframe"][i % 3] : null,
      preview: i ? undefined : "A source thought about pressure, release, and resilient systems.",
      expandedText: i
        ? `Node ${i} says the controlled release of pressure lets a resilient system remain coherent across domains.`
        : undefined,
      createdAt: 1000 + i,
    };
  });
}

async function settleAndSeed(page, seeded) {
  await page.waitForTimeout(650);
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem(
      "lens.companion.memory.v1:anonymous",
      JSON.stringify({ version: 1, interviewComplete: true })
    );
    localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(value));
  }, seeded);
  await page.reload();
  await page.waitForTimeout(900);
}

async function setNodes(page, seeded) {
  await page.evaluate((value) => localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(value)), seeded);
  await page.reload();
  await page.waitForTimeout(800);
}

async function pick(page, tool) {
  if (!(await page.locator(".canvas-tools-bar.expanded").count())) {
    await page.locator(".canvas-tools-toggle").click();
  }
  await page.locator(`[data-tool="${tool}"]`).click();
  await page.waitForTimeout(80);
}

async function drag(page, a, b, steps = 12) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function wheel(page, deltaY, ticks, point = null) {
  for (let i = 0; i < ticks; i++) {
    await page.evaluate(
      ({ dy, point: p }) => {
        const el = document.querySelector(".ai-node-viewport");
        const r = el?.getBoundingClientRect();
        if (!el || !r) return;
        el.dispatchEvent(new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: dy,
          clientX: p?.x ?? r.left + r.width / 2,
          clientY: p?.y ?? r.top + r.height / 2,
        }));
      },
      { dy: deltaY, point }
    );
    await page.waitForTimeout(28);
  }
  await page.waitForTimeout(130);
}

const camera = (page) =>
  page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector(".ai-world-layer")).transform);
    return { scale: m.a, x: m.e, y: m.f };
  });

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function densityAudit(page) {
  for (const count of [1, 10, 50, 150]) {
    await setNodes(page, nodes(count, count === 10 ? "fan" : "scatter"));
    const rendered = await page.locator(".ai-node").count();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]").length);
    check(`density ${count}: render/storage parity`, rendered === count && stored === count, `${rendered}/${stored}`);
    const vp = await page.locator(".ai-node-viewport").boundingBox();
    await wheel(page, 240, 50, { x: vp.x + 25, y: vp.y + 25 });
    const minA = await camera(page);
    await wheel(page, 240, 25, { x: vp.x + 25, y: vp.y + 25 });
    const minB = await camera(page);
    const drift = Math.hypot(minB.x - minA.x, minB.y - minA.y);
    check(`density ${count}: min clamp stable`, minB.scale <= 0.051 && drift < 0.5, `scale=${minB.scale.toFixed(3)}, drift=${drift.toFixed(2)}px`);
    if (count > 1) await screenshot(page, `density-${count}-dot`);
  }
}

async function textHighlightAudit(page) {
  const longText =
    "The controlled release of pressure preserves coherence while allowing a resilient system to adapt. " +
    "This sentence repeats enough material to wrap naturally across several lines in the reading card.";
  const seeded = [{
    id: "text-node",
    nodeKind: "expanded",
    x: 0,
    y: 0,
    radius: 30,
    label: "reading node",
    opLabel: "expand",
    expandedText: longText,
    createdAt: 1,
  }];
  await setNodes(page, seeded);
  const vp = await page.locator(".ai-node-viewport").boundingBox();
  await wheel(page, -90, 11, { x: vp.x + vp.width / 2, y: vp.y + vp.height / 2 });
  await pick(page, "highlight");
  const node = page.locator(".ai-node").first();
  await node.click();
  await page.waitForTimeout(150);
  check("AI text: tap persistently marks whole node", await node.evaluate((el) => el.classList.contains("omni-marked")));
  const overlay = page.locator(".fragment-highlight-text");
  await overlay.waitFor();
  await screenshot(page, "text-before-word-mark");
  const words = await overlay.evaluate((el) => {
    const text = el.firstChild;
    const source = text?.nodeValue || "";
    return [...source.matchAll(/\S+/g)].slice(1, 5).map((m) => {
      const range = document.createRange();
      range.setStart(text, m.index);
      range.setEnd(text, m.index + m[0].length);
      const r = range.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  });
  await drag(
    page,
    { x: words[0].x + 2, y: words[0].y + words[0].height / 2 },
    { x: words.at(-1).x + words.at(-1).width - 2, y: words.at(-1).y + words.at(-1).height / 2 },
    16
  );
  const marked = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]")[0]?.goldenFragment || "");
  check("AI text: first stroke creates exact persistent words", /controlled release of pressure/i.test(marked), JSON.stringify(marked));
  check("AI text: first stroke does not start transfer", (await page.locator(".space-transfer-ghost, .transfer-ghost").count()) === 0);
  check("AI text: toolbar counts living node selection", /1 node/.test((await page.locator(".omni-highlight-count").textContent()) || ""));
  await screenshot(page, "text-after-word-mark");

  const mark = page.locator(".fragment-highlight-preview");
  const mb = await mark.boundingBox();
  const paper = await page.locator(".canvas-column-main").boundingBox();
  const drop = { x: paper.x + paper.width * 0.58, y: paper.y + paper.height * 0.62 };
  await drag(page, { x: mb.x + mb.width / 2, y: mb.y + mb.height / 2 }, drop, 22);
  await page.waitForTimeout(500);
  const landed = await page.evaluate(({ drop, marked }) => {
    const matches = [...document.querySelectorAll("[data-item]")].filter((el) => (el.textContent || "").includes(marked));
    return matches.map((el) => {
      const r = el.getBoundingClientRect();
      const dx = Math.max(r.left - drop.x, 0, drop.x - r.right);
      const dy = Math.max(r.top - drop.y, 0, drop.y - r.bottom);
      return Math.hypot(dx, dy);
    }).sort((a, b) => a - b)[0] ?? null;
  }, { drop, marked });
  check("AI text: marked phrase drags to paper", landed !== null && landed < 90, landed === null ? "not found" : `landing error=${landed.toFixed(1)}px`);
  await screenshot(page, "text-fragment-to-paper");
}

async function compactNodeAndStressAudit(page) {
  await setNodes(page, nodes(10, "fan"));
  const vp = await page.locator(".ai-node-viewport").boundingBox();
  await wheel(page, 240, 50);
  await pick(page, "highlight");
  const hit = page.locator(".ai-node-screen-hit-target").first();
  const hb = await hit.boundingBox();
  check("dot tier: compact node has at least 24px hit target", hb.width >= 23.5 && hb.height >= 23.5, `${hb.width.toFixed(1)}×${hb.height.toFixed(1)}px`);
  await hit.click();
  check("dot tier: compact-node tap marks node", (await page.locator(".ai-node.omni-marked").count()) === 1);
  await screenshot(page, "dot-node-hit-target-marked");

  await page.keyboard.press("Escape");
  const nodeBoxes = await page.locator(".ai-node").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).sort((a, b) => a.x - b.x)
  );
  const left = nodeBoxes[0];
  const right = nodeBoxes.at(-1);
  await drag(page, { x: left.x - 16, y: left.y }, { x: right.x + 16, y: right.y }, 35);
  const swept = await page.locator(".ai-node.omni-marked").count();
  check("dot tier: screen-space sweep additively marks nodes", swept >= 2, `marked=${swept}`);

  const countBefore = await page.locator(".ai-node").count();
  for (let i = 0; i < 30; i++) {
    const y = vp.y + 40 + (i % 10) * 24;
    await drag(page, { x: vp.x + 25, y }, { x: vp.x + vp.width - 25, y: y + (i % 3) * 3 }, 2);
  }
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Escape");
    await pick(page, i % 2 ? "select" : "highlight");
  }
  await pick(page, "select");
  for (let i = 0; i < 25; i++) {
    const y = vp.y + 50 + (i % 8) * 28;
    await drag(page, { x: vp.x + vp.width - 30, y }, { x: vp.x + 30, y: y + 2 }, 2);
  }
  for (let i = 0; i < 30; i++) {
    await wheel(page, i % 2 ? 90 : -90, 1, { x: vp.x + 30 + (i % 5) * 40, y: vp.y + 40 });
  }
  const countAfter = await page.locator(".ai-node").count();
  const ghosts = await page.locator(".space-transfer-ghost, .transfer-ghost, .ai-lasso").count();
  check("105 rapid gestures create no accidental nodes", countAfter === countBefore, `${countBefore}→${countAfter}`);
  check("105 rapid gestures leave no orphan gesture UI", ghosts === 0, `ghosts=${ghosts}`);
  check("105 rapid gestures preserve finite camera", await page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector(".ai-world-layer")).transform);
    return [m.a, m.e, m.f].every(Number.isFinite);
  }));
  await screenshot(page, "after-105-gesture-stress");
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(BASE);
  await settleAndSeed(page, nodes(1));

  await densityAudit(page);
  await textHighlightAudit(page);
  await compactNodeAndStressAudit(page);
  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
