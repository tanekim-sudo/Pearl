/**
 * Verification for lens-editor branching:
 *   - junk BASICS suggestion chips are gone (no orphan sub-step chips)
 *   - primitives row intact; only deduped top-level lenses offered
 *   - drag a primitive chip into the tree (HTML5 dnd)
 *   - drag a strand out of a mid step -> fork with side-by-side branches
 *   - save, reload -> branched structure persists (fork survives migration)
 *   - companion verbs build a branched lens end to end
 *   - running a forked lens produces one output node per leaf branch
 *     (API stubbed via routes so runs complete headlessly without a key)
 *
 *   node scripts/debug-lens-branching.mjs
 * (expects dev client on localhost:5173)
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

const seedItems = [
  { id: "it1", type: "text", x: 120, y: 160, w: 320, text: "Gimlet Labs — ai startup building dev tools", pageId: "page-1" },
];

// A saved lens whose sub-steps used to flood the old BASICS palette.
const seedOperators = [
  { id: "seed-root", kind: "pipeline", name: "investment memo", description: "full memo", top: true, steps: ["seed-s1", "seed-s2", "seed-s3", "seed-s4"] },
  { id: "seed-s1", kind: "prompt", name: "market map", prompt: "Map the market. Return ONLY the step output." },
  { id: "seed-s2", kind: "prompt", name: "edge analysis", prompt: "Analyze the edge. Return ONLY the step output." },
  { id: "seed-s3", kind: "prompt", name: "risk ledger", prompt: "List the risks. Return ONLY the step output." },
  { id: "seed-s4", kind: "prompt", name: "verdict", prompt: "Give a verdict. Return ONLY the step output." },
];

async function runScript(page, steps, title) {
  return page.evaluate(
    ([s, t]) => window.__lensDirector.run(s, { title: t }),
    [steps, title]
  );
}

const operatorsState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"));

async function dragChipToSlot(page, chipSel, slotSel) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.dispatchEvent(chipSel, "dragstart", { dataTransfer });
  await page.dispatchEvent(slotSel, "dragover", { dataTransfer });
  await page.dispatchEvent(slotSel, "drop", { dataTransfer });
  await page.dispatchEvent(chipSel, "dragend", { dataTransfer });
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  // Stub the model API so branched runs complete headlessly without a key.
  let apiCalls = 0;
  await page.route("**/api/run", (route) => {
    apiCalls++;
    const body = JSON.parse(route.request().postData() || "{}");
    const tag = (body.prompt || "").slice(0, 40).replace(/\s+/g, " ");
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ outputs: [`stub output ${apiCalls} · ${tag}`] }),
    });
  });
  await page.route("**/api/execute", (route) => {
    apiCalls++;
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ output: `stub execute output ${apiCalls}` }),
    });
  });

  await page.goto(BASE);
  await page.waitForTimeout(1200);
  await page.evaluate(
    ([items, ops]) => {
      localStorage.clear();
      localStorage.setItem("lens.onboarded.v1", "1");
      localStorage.setItem("lens.companion.seen.v1", "1");
      localStorage.setItem("lens.tour.v1", "1");
      localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
      localStorage.setItem("lens.board.operators.v2", JSON.stringify(ops));
    },
    [seedItems, seedOperators]
  );
  await page.reload();
  await page.waitForTimeout(1500);

  // ---- new companion verbs registered ----
  const verbs = await page.evaluate(() => window.__lensDirector.verbs());
  for (const v of ["addFunctionStep", "addFunctionBranch", "setFunctionStep", "saveFunction"]) {
    check(`verb registered: ${v}`, verbs.includes(v));
  }

  // ---- open the editor on the seeded lens ----
  const r1 = await runScript(page, [{ verb: "openFunctionEditor", args: { op: "investment memo" } }], "open editor");
  await page.waitForTimeout(900);
  check("editor opened", !!(await page.$(".fn-editor")), (r1.errors || []).join("; "));

  // ---- 1. junk suggestions are gone ----
  const groupLabels = await page.$$eval(".fn-palette-group-label", (els) => els.map((e) => e.textContent.trim()));
  check("no 'basics' palette group", !groupLabels.some((l) => /basics/i.test(l)), groupLabels.join(", "));
  const chipTexts = await page.$$eval(".fn-palette-block", (els) => els.map((e) => e.textContent.trim()));
  for (const junk of ["market map", "edge analysis", "risk ledger", "verdict"]) {
    check(`no orphan sub-step chip: ${junk}`, !chipTexts.includes(junk));
  }
  const dupes = chipTexts.filter((t, i) => chipTexts.indexOf(t) !== i);
  check("no repeated chips", dupes.length === 0, dupes.join(", "));
  for (const prim of ["compress", "expand", "explore", "research", "invert", "reframe", "merge", "transcend"]) {
    check(`primitive chip present: ${prim}`, chipTexts.includes(prim));
  }
  check("user's top-level lens offered once", chipTexts.filter((t) => t === "investment memo").length === 1);
  await page.screenshot({ path: `${OUT}/branch-palette-clean.png` });

  // ---- 2. drag a primitive chip into the tree ----
  const cardsBefore = await page.$$eval(".fn-flow-card", (els) => els.length);
  await dragChipToSlot(
    page,
    '.fn-palette-group:has(.fn-palette-group-label:text("primitives")) .fn-palette-block:text-is("compress")',
    ".fn-drop-slot.horizontal"
  );
  await page.waitForTimeout(500);
  const cardsAfter = await page.$$eval(".fn-flow-card", (els) => els.length);
  check("primitive chip dropped into tree", cardsAfter === cardsBefore + 1, `${cardsBefore} -> ${cardsAfter}`);
  const cardNames = await page.$$eval(".fn-flow-card-name", (els) => els.map((e) => e.textContent.trim()));
  check("dropped step named compress", cardNames.includes("compress"), cardNames.join(", "));

  // ---- 3. drag a strand out of a mid step -> fork ----
  const handle = await page.$('.fn-flow-card[data-step-id="seed-s2"] [data-branch-handle]');
  check("step cards expose a strand handle", !!handle);
  if (handle) {
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 140, hb.y + 120, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  check("fork block rendered", !!(await page.$(".fn-flow-fork")));
  const branchLanes = await page.$$eval(".fn-flow-fork .fn-flow-branch", (els) => els.length);
  check("fork has two branches", branchLanes === 2, `${branchLanes} branches`);
  const forkNote = await page.textContent(".fn-output-fork-note").catch(() => null);
  check("outputs control folded into branching", !!forkNote && /2 outputs/.test(forkNote), forkNote);
  await page.screenshot({ path: `${OUT}/branch-fork-created.png` });

  // ---- save, reload, confirm persistence ----
  await page.$eval(".fn-primary", (el) => el.click());
  await page.waitForTimeout(800);
  let ops = await operatorsState(page);
  let forkOp = ops.find((o) => o.fork && o.kind === "pipeline");
  check("fork persisted to operator store", !!forkOp, `${ops.length} ops`);

  await page.reload();
  await page.waitForTimeout(1500);
  ops = await operatorsState(page);
  forkOp = ops.find((o) => o.fork && o.kind === "pipeline");
  const root = ops.find((o) => o.name === "investment memo" && o.top);
  check("fork survives reload + migration", !!forkOp && !!root, forkOp ? `fork ${forkOp.id}` : "missing");
  if (forkOp) {
    const missing = forkOp.steps.filter((sid) => !ops.some((o) => o.id === sid));
    check("all branch children survive migration", missing.length === 0, missing.join(", "));
  }
  const r2 = await runScript(page, [{ verb: "openFunctionEditor", args: { op: "investment memo" } }], "reopen");
  await page.waitForTimeout(900);
  check("branched structure renders after reload", !!(await page.$(".fn-flow-fork")), (r2.errors || []).join("; "));
  await page.screenshot({ path: `${OUT}/branch-fork-persisted.png` });
  const close = await page.$(".fn-close");
  if (close) await close.click();
  await page.waitForTimeout(400);

  // ---- 4. companion builds a branched lens end to end ----
  const r3 = await runScript(
    page,
    [
      { verb: "createFunction", args: { name: "memo builder", description: "memo or one pager", steps: [{ name: "expand", description: "unfold the company" }] } },
      { verb: "addFunctionBranch", args: { op: "memo builder", from: "expand", name: "one pager" } },
      { verb: "addFunctionBranch", args: { op: "memo builder", from: "expand", name: "write memo" } },
    ],
    "companion builds branched lens"
  );
  await page.waitForTimeout(800);
  check("companion script completed", r3.completed === true, (r3.errors || []).join("; "));
  ops = await operatorsState(page);
  const builderRoot = ops.find((o) => o.name === "memo builder");
  const builderFork = ops.find(
    (o) => o.fork && o.kind === "pipeline" && (o.steps || []).some((sid) => ops.find((x) => x.id === sid && /one pager|write memo/.test(x.name || "")))
  );
  check("companion created the lens", !!builderRoot);
  check("companion fork has two branches", !!builderFork && builderFork.steps.length === 2, builderFork ? `${builderFork.steps.length}` : "no fork");

  // ---- run the forked lens: one output node per leaf branch ----
  const nodesBefore = await page.$$eval(".ai-node", (els) => els.length).catch(() => 0);
  const r4 = await runScript(
    page,
    [{ verb: "applyFunction", args: { op: "memo builder", target: "Gimlet" } }],
    "run branched lens"
  );
  await page.waitForTimeout(1500);
  check("run script completed", r4.completed === true, (r4.errors || []).join("; "));
  const nodesAfter = await page.$$eval(".ai-node", (els) => els.length).catch(() => 0);
  // source node + 2 branch outputs
  check("two branch outputs spawned in AI space", nodesAfter - nodesBefore >= 3, `${nodesBefore} -> ${nodesAfter} nodes (${apiCalls} api calls)`);
  check("branched run hit the model once per step (3 steps)", apiCalls >= 3, `${apiCalls} calls`);
  await page.screenshot({ path: `${OUT}/branch-two-outputs.png` });

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
