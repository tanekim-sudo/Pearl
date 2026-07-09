/**
 * Highlighter stress test: word-level marks, whole-item taps, loops,
 * zoom consistency, and drag-to-AI landing precision. Screenshots to audit-shots/.
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

const items = [
  { id: "t1", type: "text", x: 60, y: 120, w: 380, text: "Forgiveness is the controlled release of pressure held against someone who wronged you", pageId: "page-1" },
  { id: "t2", type: "text", x: 60, y: 320, w: 340, text: "Ant colonies allocate labor without any central manager", pageId: "page-1" },
  { id: "t3", type: "text", x: 60, y: 480, w: 340, text: "Markets are distributed computers that price information", pageId: "page-1" },
];

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
}

async function pickHighlighter(page) {
  const btns = await page.$$(".canvas-column-tools .canvas-tool-btn");
  // ↖ ✎ ▬ — highlighter is the ▬ one
  for (const b of btns) {
    const t = (await b.textContent())?.trim();
    if (t === "▬") { await b.click(); return; }
  }
  throw new Error("highlighter button not found");
}

async function strokeAcross(page, x0, y0, x1, y1, steps = 14) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(350);
}

async function wordRect(page, itemId, wordIdx) {
  return page.evaluate(({ itemId, wordIdx }) => {
    const el = document.querySelector(`[data-item="${itemId}"]`);
    if (!el) return null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let full = "";
    const nodes = [];
    while (walker.nextNode()) { nodes.push(walker.currentNode); full += walker.currentNode.nodeValue; }
    const words = [...full.matchAll(/\S+/g)];
    const w = words[wordIdx];
    if (!w) return null;
    // resolve offset to node
    let acc = 0;
    for (const n of nodes) {
      const len = n.nodeValue.length;
      if (w.index < acc + len) {
        const r = document.createRange();
        r.setStart(n, w.index - acc);
        r.setEnd(n, Math.min(len, w.index - acc + w[0].length));
        const rect = r.getBoundingClientRect();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, word: w[0] };
      }
      acc += len;
    }
    return null;
  }, { itemId, wordIdx });
}

async function fragCount(page) {
  return page.evaluate(() => document.querySelectorAll("mark.hl-fragment-mark").length);
}

async function zoomPaper(page, x, y, steps, delta) {
  await page.keyboard.down("Control");
  for (let i = 0; i < Math.abs(steps); i++) {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(80);
  }
  await page.keyboard.up("Control");
  await page.waitForTimeout(350);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  await page.goto(BASE);
  await page.waitForTimeout(700);
  await page.evaluate((its) => {
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem("lens.board.items.v1", JSON.stringify(its));
  }, items);
  await page.reload();
  await page.waitForTimeout(1500);
  await pickHighlighter(page);

  // ---- 1. word-level stroke across words 3..6 of t1 at default zoom
  let a = await wordRect(page, "t1", 3);
  let b = await wordRect(page, "t1", 6);
  await strokeAcross(page, a.x + 2, a.y + a.h / 2, b.x + b.w - 2, b.y + b.h / 2);
  let frags = await fragCount(page);
  check("word-level mark at 100%", frags >= 1, `marks=${frags}`);
  await page.screenshot({ path: `${OUT}/hl-word-100.png` });

  // ---- 2. toolbar visible for fragment-only selection
  const toolbar = await page.$(".omni-highlight-bar");
  check("toolbar shows for fragments", !!toolbar);

  // ---- 3. tap t2 → whole-item selection
  const t2 = await page.$('[data-item="t2"]');
  const t2bb = await t2.boundingBox();
  await page.mouse.click(t2bb.x + t2bb.width / 2, t2bb.y + t2bb.height / 2);
  await page.waitForTimeout(350);
  const wholeSel = await page.evaluate(() => document.querySelectorAll(".hl-selected").length);
  check("tap selects whole item", wholeSel >= 1, `selected=${wholeSel}`);
  await page.screenshot({ path: `${OUT}/hl-mixed-selection.png` });

  // ---- 4. drag the fragment mark into the AI column, verify landing under cursor
  const mark = await page.$("mark.hl-fragment-mark");
  check("fragment mark rendered", !!mark);
  if (mark) {
    const mb = await mark.boundingBox();
    const aiCol = await page.$(".ai-column");
    const ab = await aiCol.boundingBox();
    const dropX = ab.x + ab.width * 0.5;
    const dropY = ab.y + ab.height * 0.45;
    await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(
        mb.x + ((dropX - mb.x) * i) / 20,
        mb.y + ((dropY - mb.y) * i) / 20
      );
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/hl-drag-over-ai.png` });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const node = await page.evaluate(({ dropX, dropY }) => {
      let best = null;
      document.querySelectorAll(".ai-node").forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const d = Math.hypot(cx - dropX, cy - dropY);
        if (!best || d < best.d) best = { d, cx, cy };
      });
      return best;
    }, { dropX, dropY });
    check("fragment lands under cursor in AI", !!node && node.d < 80, node ? `offset=${node.d.toFixed(0)}px` : "no node");
    await page.screenshot({ path: `${OUT}/hl-frag-landed.png` });
  }

  // ---- 5. zoomed-in word-level stroke (paper zoom ~180%)
  await page.reload();
  await page.waitForTimeout(1300);
  await pickHighlighter(page);
  const t1bb = await (await page.$('[data-item="t1"]')).boundingBox();
  await zoomPaper(page, t1bb.x + 100, t1bb.y + 10, 3, -90);
  a = await wordRect(page, "t1", 1);
  b = await wordRect(page, "t1", 3);
  if (a && b) {
    await strokeAcross(page, a.x + 2, a.y + a.h / 2, b.x + b.w - 2, b.y + b.h / 2);
    frags = await fragCount(page);
    check("word-level mark zoomed in", frags >= 1, `marks=${frags}`);
    await page.screenshot({ path: `${OUT}/hl-word-zoom-in.png` });
  } else {
    check("word-level mark zoomed in", false, "words offscreen");
  }

  // ---- 6. zoomed-out stroke + loop selection
  await page.reload();
  await page.waitForTimeout(1300);
  await pickHighlighter(page);
  const paperC = await (await page.$('[data-item="t2"]')).boundingBox();
  await zoomPaper(page, paperC.x + 150, paperC.y, 4, 160);
  a = await wordRect(page, "t1", 2);
  b = await wordRect(page, "t1", 5);
  if (a && b && a.w > 4) {
    await strokeAcross(page, a.x + 1, a.y + a.h / 2, b.x + b.w - 1, b.y + b.h / 2);
    frags = await fragCount(page);
    check("word-level mark zoomed out", frags >= 1, `marks=${frags}`);
  } else {
    console.log("SKIP zoomed-out word stroke (words too small)");
  }
  // loop around t2+t3
  const l2 = await (await page.$('[data-item="t2"]')).boundingBox();
  const l3 = await (await page.$('[data-item="t3"]')).boundingBox();
  const minx = Math.min(l2.x, l3.x) - 30;
  const maxx = Math.max(l2.x + l2.width, l3.x + l3.width) + 30;
  const miny = l2.y - 25;
  const maxy = l3.y + l3.height + 25;
  await page.mouse.move(minx, miny);
  await page.mouse.down();
  const loop = [
    [maxx, miny],
    [maxx, maxy],
    [minx, maxy],
    [minx, miny + 4],
  ];
  for (const [lx, ly] of loop) {
    const from = await page.evaluate(() => null);
    for (let i = 1; i <= 8; i++) await page.mouse.move(lx, ly, { steps: 8 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const loopSel = await page.evaluate(() => document.querySelectorAll(".hl-selected").length);
  check("loop selects multiple items zoomed out", loopSel >= 2, `selected=${loopSel}`);
  await page.screenshot({ path: `${OUT}/hl-loop-zoom-out.png` });

  // ---- 7. AI layer: highlighter marks a node
  await page.evaluate(() => {
    localStorage.setItem("lens.ai.nodes.v1", JSON.stringify([
      { id: "an1", nodeKind: "source", label: "idea", preview: "A seed idea about forgiveness and pressure.", x: 0, y: 0, radius: 30 },
    ]));
  });
  await page.reload();
  await page.waitForTimeout(1300);
  await pickHighlighter(page);
  const aiNode = await page.$(".ai-node");
  if (aiNode) {
    const nb = await aiNode.boundingBox();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.waitForTimeout(400);
    const marked = await page.evaluate(() => document.querySelectorAll(".ai-node.omni-marked").length);
    check("highlighter marks AI node", marked >= 1, `marked=${marked}`);
    await page.screenshot({ path: `${OUT}/hl-ai-node-marked.png` });
  }

  await browser.close();
  console.log(failures ? `${failures} FAILURES` : "ALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
