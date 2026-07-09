/**
 * Smoke test for the expanded director verbs — drives localhost:5173,
 * runs a long multi-step script through window.__lensDirector, and
 * verifies each manipulation actually changed app state.
 *
 *   node scripts/debug-verbs.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

const seedItems = [
  { id: "it1", type: "text", x: 90, y: 130, w: 300, text: "Forgiveness is the controlled release of pressure", pageId: "page-1" },
  { id: "it2", type: "text", x: 420, y: 520, w: 300, text: "Ant colonies allocate labor without any manager", pageId: "page-1" },
  { id: "it3", type: "text", x: 150, y: 780, w: 280, text: "Markets clear when prices carry information", pageId: "page-1" },
];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function runScript(page, steps, title) {
  return page.evaluate(
    ([s, t]) => window.__lensDirector.run(s, { title: t }),
    [steps, title]
  );
}

async function itemsState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]"));
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto(BASE);
  await page.waitForTimeout(1200);
  await page.evaluate((items) => {
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
  }, seedItems);
  await page.reload();
  await page.waitForTimeout(1500);

  const hasDirector = await page.evaluate(() => !!window.__lensDirector);
  check("director hook exposed", hasDirector);
  if (!hasDirector) process.exit(1);

  const verbs = await page.evaluate(() => window.__lensDirector.verbs());
  for (const v of ["moveItem", "editItem", "deleteItem", "organizePage", "addBlock", "renamePage", "zoomToItem", "selectItems", "moveAiNode", "openFunctionEditor", "editFunction"]) {
    check(`verb registered: ${v}`, verbs.includes(v));
  }

  // ---- one long multi-step script covering move/edit/add/organize/rename ----
  const r1 = await runScript(
    page,
    [
      { verb: "caption", args: { text: "multi-step run", ms: 300 } },
      { verb: "moveItem", args: { target: "Ant colonies", to: { x: 120, y: 300 } } },
      { verb: "editItem", args: { target: "Markets clear", text: "Markets clear when prices carry information — and jam when they don't" } },
      { verb: "addBlock", args: { type: "sticky", text: "remember: check the valve" } },
      { verb: "renamePage", args: { name: "Pressure & Release" } },
      { verb: "organizePage", args: {} },
      { verb: "zoomToItem", args: { target: "Forgiveness" } },
      { verb: "selectItems", args: { targets: ["Forgiveness"] } },
    ],
    "verb smoke"
  );
  console.log("script result:", JSON.stringify(r1));
  check("long script completed", r1.completed === true, (r1.errors || []).join("; "));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/verbs-after-script.png` });

  const items = await itemsState(page);
  const ant = items.find((i) => (i.text || "").includes("Ant colonies"));
  const markets = items.find((i) => (i.text || "").includes("Markets clear"));
  const sticky = items.find((i) => i.type === "sticky" && (i.text || "").includes("valve"));
  check("moveItem persisted (item relocated)", !!ant && (ant.x !== 420 || ant.y !== 520), ant ? `at ${ant.x},${ant.y}` : "missing");
  check("editItem persisted", !!markets && markets.text.includes("jam when they don't"));
  check("addBlock created sticky", !!sticky);
  const title = await page.inputValue(".page-title-input");
  check("renamePage set title", title === "Pressure & Release", title);

  // ---- deleteItem in its own script ----
  const before = (await itemsState(page)).length;
  const r2 = await runScript(page, [{ verb: "deleteItem", args: { target: "valve" } }], "delete");
  await page.waitForTimeout(600);
  const after = (await itemsState(page)).length;
  check("deleteItem removed the sticky", r2.completed && after === before - 1, `${before} -> ${after}`);

  // ---- resilience: bad step in the middle must not kill the script ----
  const r3 = await runScript(
    page,
    [
      { verb: "caption", args: { text: "resilience", ms: 200 } },
      { verb: "moveItem", args: { target: "no-such-item-xyz" } },
      { verb: "addBlock", args: { type: "sticky", text: "survived the failure" } },
    ],
    "resilience"
  );
  await page.waitForTimeout(500);
  const survived = (await itemsState(page)).some((i) => (i.text || "").includes("survived the failure"));
  check("script continues past failed step", survived && r3.errors?.length === 1, JSON.stringify(r3.errors));

  // ---- editFunction on a primitive ----
  const r4 = await runScript(
    page,
    [{ verb: "editFunction", args: { op: "compress", prompt: "Distill to a haiku.", description: "haiku compress" } }],
    "edit primitive"
  );
  await page.waitForTimeout(600);
  check("editFunction on primitive completed", r4.completed === true, (r4.errors || []).join("; "));
  const opsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.operators.v2") || localStorage.getItem("lens.board.operators.v1") || "[]"));
  const compress = opsAfter.find((o) => o.name === "compress" && o.primitive);
  check("primitive edit persisted to store", !!compress && compress.prompt === "Distill to a haiku.", compress?.prompt);

  // ---- primitive edit survives reload (migrateOperatorStore) ----
  await page.reload();
  await page.waitForTimeout(1500);
  const opsReloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.operators.v2") || localStorage.getItem("lens.board.operators.v1") || "[]"));
  const compress2 = opsReloaded.find((o) => o.name === "compress" && o.primitive);
  check("primitive edit survives reload", !!compress2 && compress2.prompt === "Distill to a haiku.", compress2?.prompt);

  // ---- primitive chip shows edit pencil on hover, opens the editor ----
  const chip = await page.$('.op-chip-grid .op-card[data-op-id]');
  if (chip) {
    await chip.hover();
    await page.waitForTimeout(300);
    const editBtn = await chip.$('[title="Edit"]');
    const visible = editBtn ? await editBtn.isVisible() : false;
    check("primitive chip reveals edit on hover", visible);
    if (visible) {
      await editBtn.click();
      await page.waitForTimeout(600);
      const editorOpen = await page.$(".fn-editor");
      check("primitive opens in function editor", !!editorOpen);
      await page.screenshot({ path: `${OUT}/verbs-primitive-editor.png` });
      const rootName = await page.inputValue(".fn-inspector-section input.fn-tree-input");
      console.log("editor root name:", rootName);
      const close = await page.$(".fn-close");
      if (close) await close.click();
    }
  } else {
    check("primitive chip present", false);
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
