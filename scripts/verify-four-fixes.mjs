/**
 * End-to-end verification of the four fixes:
 *  1. load-time dedupe of duplicate operators (account-merge fallout)
 *  2. generator workspace: opens, spatial items, drag persists, select, chips, craft lens
 *  3. highlighter: persistent strokes on paper + AI, rail card marking, Escape clears
 *  4. AI space drag hygiene: background drags never spawn nodes; node drag still moves
 */
import { chromium } from "playwright";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const OPS = [
  { id: "op-a1", name: "echo test", prompt: "say it back", top: true, createdAt: 1000 },
  { id: "op-a2", name: "echo test", prompt: "say it back", top: true, createdAt: 2000 },
  { id: "op-b1", name: "other fn", prompt: "different", top: true, createdAt: 1500 },
];

const GEN = {
  id: "g-verify",
  title: "pressure release",
  kind: "symbol",
  savedAt: Date.now(),
  symbolStroke: { strokes: [[{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]] },
  items: [
    { id: "gi1", type: "text", x: 0, y: 0, w: 300, text: "Forgiveness is the controlled release of pressure" },
    { id: "gi2", type: "text", x: 340, y: 60, w: 300, text: "Ant colonies allocate labor without any manager" },
    { id: "gi3", type: "stroke", points: [{ x: 20, y: 220 }, { x: 90, y: 280 }, { x: 150, y: 230 }] },
  ],
  interpretation: {
    meaning: "structures that absorb pressure without central control",
    viewPrompt: "read the material as a pressure-absorbing structure",
    elements: [{ element: "release", reading: "lets go before being asked" }],
  },
};

const AI_NODES = [
  { id: "an1", type: "ai-node", nodeKind: "expanded", label: "seed one", expandedText: "a seeded thought about pressure", sourceIds: [], sourceNodeIds: [], parentId: null, x: 120, y: 80, radius: 26 },
  { id: "an2", type: "ai-node", nodeKind: "expanded", label: "seed two", expandedText: "another seeded thought", sourceIds: [], sourceNodeIds: [], parentId: null, x: 320, y: 220, radius: 26 },
];

async function drag(page, x1, y1, x2, y2, steps = 12) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
}

async function pickTool(page, tool) {
  const open = await page.$(".canvas-tools-bar.expanded");
  if (!open) {
    await page.click(".canvas-tools-toggle");
    await page.waitForTimeout(200);
  }
  await page.click(`.canvas-tools-bar [data-tool="${tool}"]`);
  await page.waitForTimeout(200);
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
    console.log("[pageerror]", (err.stack || err.message).slice(0, 400));
  });

  await page.goto(BASE);
  await page.waitForTimeout(600);
  await page.evaluate(
    ({ ops, gen, aiNodes }) => {
      localStorage.clear();
      localStorage.setItem("lens.onboarded.v1", "1");
      localStorage.setItem("lens.companion.seen.v1", "1");
      localStorage.setItem("lens.tour.v1", "1");
      // done interview → companion stays closed and off the paper
      localStorage.setItem(
        "lens.companion.memory.v1:anonymous",
        JSON.stringify({ version: 1, interviewComplete: true })
      );
      localStorage.setItem("lens.board.operators.v2", JSON.stringify(ops));
      localStorage.setItem("lens.lenses.v2", JSON.stringify([gen]));
      localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(aiNodes));
    },
    { ops: OPS, gen: GEN, aiNodes: AI_NODES }
  );
  await page.reload();
  await page.waitForTimeout(1800);

  // ---- 1. load-time dedupe -------------------------------------------------
  const echoCount = await page.evaluate(() => {
    const ops = JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]");
    return ops.filter((o) => o.name === "echo test").length;
  });
  check("dedupe: duplicate 'echo test' collapsed to one", echoCount === 1, `count=${echoCount}`);
  const otherKept = await page.evaluate(() => {
    const ops = JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]");
    return ops.some((o) => o.name === "other fn");
  });
  check("dedupe: non-duplicate operator survives", otherKept);
  const keptOldest = await page.evaluate(() => {
    const ops = JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]");
    const kept = ops.find((o) => o.name === "echo test");
    return kept?.id;
  });
  check("dedupe: oldest copy kept", keptOldest === "op-a1", `kept=${keptOldest}`);
  check("no conflict prompt on plain reopen", !(await page.$(".board-conflict, .onboard-scrim .board-conflict")));

  // ---- 2. generator workspace ----------------------------------------------
  const wsBtn = await page.$('button[title*="generator workspace" i]');
  check("generator workspace button present", !!wsBtn);
  if (wsBtn) {
    await wsBtn.click({ force: true });
    await page.waitForTimeout(700);
    check("workspace dialog opens", !!(await page.$(".lens-settings-wide")));
    const cardCount = await page.$$eval(".gen-space-card", (els) => els.length);
    const strokeCount = await page.$$eval(".gen-space-stroke", (els) => els.length);
    check("items rendered spatially", cardCount === 2 && strokeCount === 1, `cards=${cardCount} strokes=${strokeCount}`);

    // drag first card and confirm position persists to storage
    const card = await page.$(".gen-space-card");
    const box = await card.boundingBox();
    await drag(page, box.x + box.width / 2, box.y + box.height / 2, box.x + box.width / 2 + 90, box.y + box.height / 2 + 40);
    const movedPos = await page.evaluate(() => {
      const gens = JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]");
      const it = gens[0]?.items?.find((i) => i.id === "gi1");
      return it ? { x: it.x, y: it.y } : null;
    });
    check("item drag persists position", !!movedPos && (movedPos.x !== 0 || movedPos.y !== 0), JSON.stringify(movedPos));

    // click-select a card
    const card2 = await page.$$(".gen-space-card");
    await card2[1].click();
    await page.waitForTimeout(200);
    check("click selects item", !!(await page.$(".gen-space-card.gen-item-selected")));

    const chipNames = await page.$$eval(".gen-space-tools .lens-settings-probe-chip", (els) => els.map((e) => e.textContent.trim()));
    check("built-in function chips + find sameness", chipNames.includes("find sameness") && chipNames.length >= 3, chipNames.join(","));
    check("craft lens affordance present", !!(await page.$(".gen-craft-lens")));
    const quietOpen = await page.$eval(".gen-quiet-tools", (el) => el.open);
    check("ai assists tucked away (closed by default)", quietOpen === false);
    await page.screenshot({ path: "audit-shots/verify-gen-workspace.png" });

    // craft lens hands off to the lens editor (full-screen fn modal)
    await page.click(".gen-craft-lens");
    await page.waitForTimeout(900);
    const editorOpen = await page.$(".fn-scrim-full");
    check("craft lens opens the lens editor", !!editorOpen);
    await page.screenshot({ path: "audit-shots/verify-craft-lens.png" });
    const closeBtn = await page.$(".fn-close");
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(400);
    // close the workspace dialog too if still open
    const wsClose = await page.$(".lens-settings-close");
    if (wsClose) await wsClose.click();
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // ---- 3a. highlighter on paper --------------------------------------------
  await pickTool(page, "highlight");
  const paper = await page.$(".canvas-column-main");
  const pb = await paper.boundingBox();
  const px = pb.x + pb.width * 0.5;
  const py = pb.y + pb.height * 0.55;
  await drag(page, px, py, px + 160, py + 60);
  let strokes = await page.$$eval("polyline.hl-session-stroke", (els) => els.length);
  check("paper: stroke persists after release", strokes >= 1, `strokes=${strokes}`);
  await page.screenshot({ path: "audit-shots/verify-hl-paper.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  strokes = await page.$$eval("polyline.hl-session-stroke", (els) => els.length);
  check("paper: Escape clears session strokes", strokes === 0, `strokes=${strokes}`);

  // stroke again, then switch tool → strokes clear
  await drag(page, px, py + 40, px + 120, py + 90);
  strokes = await page.$$eval("polyline.hl-session-stroke", (els) => els.length);
  const hadStroke = strokes >= 1;
  await pickTool(page, "select");
  await page.waitForTimeout(300);
  strokes = await page.$$eval("polyline.hl-session-stroke", (els) => els.length);
  check("paper: leaving highlighter clears strokes", hadStroke && strokes === 0, `strokes=${strokes}`);

  // ---- 3b + 4. AI space: highlight stroke persists, background drags never spawn nodes
  let aiViewport = await page.$(".ai-node-viewport");
  check("ai viewport present", !!aiViewport);
  if (aiViewport) {
    let ab = await aiViewport.boundingBox();
    const nodeCountBefore = await page.$$eval(".ai-node", (els) => els.length);

    // select tool: background drag pans, never spawns
    await drag(page, ab.x + ab.width * 0.6, ab.y + ab.height * 0.7, ab.x + ab.width * 0.3, ab.y + ab.height * 0.4);
    let nodeCount = await page.$$eval(".ai-node", (els) => els.length);
    check("ai: select-tool background drag spawns nothing", nodeCount === nodeCountBefore, `${nodeCountBefore}→${nodeCount}`);

    // select a node, then background drag again (the reported bug path)
    const firstNode = await page.$(".ai-node");
    if (firstNode) {
      const nb = await firstNode.boundingBox();
      await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
      await page.waitForTimeout(400);
      // close any explore overlay the click opened
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await drag(page, ab.x + ab.width * 0.7, ab.y + ab.height * 0.75, ab.x + ab.width * 0.45, ab.y + ab.height * 0.5);
      nodeCount = await page.$$eval(".ai-node", (els) => els.length);
      check("ai: background drag with node selected spawns nothing", nodeCount === nodeCountBefore, `${nodeCountBefore}→${nodeCount}`);
    }

    // Reset the camera after adversarial pans so the sweep targets a genuinely
    // visible node instead of depending on an offscreen bounding box.
    await page.reload();
    await page.waitForTimeout(900);
    aiViewport = await page.$(".ai-node-viewport");
    ab = await aiViewport.boundingBox();

    // highlight tool: background stroke persists, marks swept nodes, spawns nothing
    await pickTool(page, "highlight");
    const n1 = await page.$$(".ai-node");
    const n1b = await n1[0].boundingBox();
    await drag(page, ab.x + 40, ab.y + 40, n1b.x + n1b.width / 2, n1b.y + n1b.height / 2);
    let aiStrokes = await page.$$eval("polyline.ai-hl-session-stroke", (els) => els.length);
    check("ai: highlight stroke persists after release", aiStrokes >= 1, `strokes=${aiStrokes}`);
    const marked = await page.$$eval(".ai-node.omni-marked", (els) => els.length);
    check("ai: swept node is marked", marked >= 1, `marked=${marked}`);
    nodeCount = await page.$$eval(".ai-node", (els) => els.length);
    check("ai: highlight background drag spawns nothing", nodeCount === nodeCountBefore, `${nodeCountBefore}→${nodeCount}`);
    await page.screenshot({ path: "audit-shots/verify-hl-ai.png" });

    // ---- 3c. rail card marking with the highlighter ----
    const opCard = await page.$(".functions-board-rail [data-op-id]");
    if (opCard) {
      await opCard.click();
      await page.waitForTimeout(300);
      const railMarked = await page.$$eval(".omni-rail-marked", (els) => els.length);
      check("rail: highlighter click marks a card", railMarked >= 1, `marked=${railMarked}`);
    } else {
      check("rail: op card found", false, "no [data-op-id] in rail");
    }
    const genCard = await page.$("[data-struct-id]");
    if (genCard) {
      await genCard.click();
      await page.waitForTimeout(300);
      const railMarked2 = await page.$$eval(".omni-rail-marked", (els) => els.length);
      check("rail: generator card marks too", railMarked2 >= 2, `marked=${railMarked2}`);
    }
    const toolbarVisible = await page.$(".omni-highlight-bar");
    check("highlight toolbar visible with rail selection", !!toolbarVisible);
    await page.screenshot({ path: "audit-shots/verify-hl-rail.png" });

    // Escape clears everything cross-domain
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const leftover = await page.evaluate(
      () =>
        document.querySelectorAll(".omni-rail-marked").length +
        document.querySelectorAll("polyline.ai-hl-session-stroke").length +
        document.querySelectorAll(".ai-node.omni-marked").length
    );
    check("Escape clears cross-domain selection + strokes", leftover === 0, `leftover=${leftover}`);

    // ---- 4b. deliberate node drag still moves the node ----
    await pickTool(page, "select");
    await page.waitForTimeout(400);
    const ab2 = await (await page.$(".ai-node-viewport")).boundingBox();
    const nodes = await page.$$(".ai-node");
    let target = null;
    let tb = null;
    for (const n of nodes) {
      const b = await n.boundingBox();
      if (
        b &&
        b.x > ab2.x + 10 &&
        b.y > ab2.y + 10 &&
        b.x + b.width < ab2.x + ab2.width - 100 &&
        b.y + b.height < ab2.y + ab2.height - 100
      ) {
        target = n;
        tb = b;
        break;
      }
    }
    if (!target) {
      target = nodes[0];
      tb = await target.boundingBox();
    }
    const posBefore = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]");
      return arr.map((n) => ({ id: n.id, x: n.x, y: n.y }));
    });
    await drag(page, tb.x + tb.width / 2, tb.y + tb.height / 2, tb.x + tb.width / 2 + 70, tb.y + tb.height / 2 + 50);
    await page.waitForTimeout(700);
    const posAfter = await page.evaluate(() => {
      const arr = JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]");
      return arr.map((n) => ({ id: n.id, x: n.x, y: n.y }));
    });
    const movedNode = posAfter.some((n) => {
      const b = posBefore.find((p) => p.id === n.id);
      return b && (Math.abs(b.x - n.x) > 5 || Math.abs(b.y - n.y) > 5);
    });
    nodeCount = await page.$$eval(".ai-node", (els) => els.length);
    check("ai: node center-drag still moves node", movedNode);
    check("ai: node drag spawned nothing", nodeCount === nodeCountBefore, `${nodeCountBefore}→${nodeCount}`);
  }

  // ---- zoom-level variants: repeat the core checks zoomed in and out -------
  const paper2 = await page.$(".canvas-column-main");
  const pb2 = await paper2.boundingBox();
  const zx = pb2.x + pb2.width * 0.5;
  const zy = pb2.y + pb2.height * 0.5;
  for (const [label, wheelDy] of [["zoomed out", 600], ["zoomed in", -900]]) {
    await page.keyboard.down("Control");
    await page.mouse.move(zx, zy);
    await page.mouse.wheel(0, wheelDy);
    await page.keyboard.up("Control");
    await page.waitForTimeout(400);
    await pickTool(page, "highlight");
    await drag(page, zx - 80, zy + 60, zx + 80, zy + 110);
    const s = await page.$$eval("polyline.hl-session-stroke", (els) => els.length);
    check(`paper ${label}: stroke persists`, s >= 1, `strokes=${s}`);
    await page.keyboard.press("Escape");
    await pickTool(page, "select");
  }

  const aiVp2 = await page.$(".ai-node-viewport");
  const avb = await aiVp2.boundingBox();
  const azx = avb.x + avb.width * 0.5;
  const azy = avb.y + avb.height * 0.5;
  for (const [label, wheelDy] of [["zoomed out", 600], ["zoomed in", -900]]) {
    await page.mouse.move(azx, azy);
    await page.mouse.wheel(0, wheelDy);
    await page.waitForTimeout(500);
    const before = await page.$$eval(".ai-node", (els) => els.length);
    await drag(page, avb.x + avb.width * 0.7, avb.y + avb.height * 0.7, avb.x + avb.width * 0.35, avb.y + avb.height * 0.4);
    const after = await page.$$eval(".ai-node", (els) => els.length);
    check(`ai ${label}: background drag spawns nothing`, after === before, `${before}→${after}`);
  }
  await page.screenshot({ path: "audit-shots/verify-zoom-levels.png" });

  check("no page errors across whole pass", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
