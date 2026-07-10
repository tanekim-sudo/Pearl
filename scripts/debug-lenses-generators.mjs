/**
 * Verification for the lenses/generators rework:
 *   - rename visible in UI (pane headers + subtitles)
 *   - fork a lens, merge two lenses
 *   - create empty ◇N generator, attach material, graduate (rename)
 *   - generator workspace: probe row + "make lens from this" affordances
 *   - capture thread as lens
 *   - new companion/director verbs registered
 *
 *   node scripts/debug-lenses-generators.mjs
 * (expects dev client on localhost:5173; API-dependent steps only verify
 *  the affordance fires / loading state, matching other debug scripts)
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
fs.mkdirSync(OUT, { recursive: true });

const seedItems = [
  { id: "it1", type: "text", x: 90, y: 130, w: 300, text: "Forgiveness is the controlled release of pressure", pageId: "page-1" },
  {
    id: "it2", type: "text", x: 420, y: 520, w: 300, pageId: "page-1",
    text: "Pressure released is trust restored",
    via: { name: "invert", opId: null },
    bornFrom: ["it1"],
  },
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

const generatorsState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]"));
const reposState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("lens.transformation-repos.v1") || "[]"));

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

  // ---- PART 1: rename visible in UI ----
  const lensesHeader = await page.textContent(".cognition-git-title").catch(() => null);
  check("upper pane titled 'lenses'", lensesHeader?.trim() === "lenses", lensesHeader);
  const lensesSub = await page.textContent(".cognition-git-brand .rail-pane-sub").catch(() => null);
  check("lenses pane has subtitle", !!lensesSub && /ways of transforming/i.test(lensesSub), lensesSub);
  const genHeading = await page.textContent(".rail-lenses-pane .rail-pane-heading").catch(() => null);
  check("lower pane titled 'generators'", !!genHeading && /generators/i.test(genHeading), genHeading?.slice(0, 60));
  check("generators pane has subtitle", !!genHeading && /open workspaces/i.test(genHeading));
  await page.screenshot({ path: `${OUT}/lg-pane-headers.png` });

  // ---- PART 3: new director verbs registered ----
  const verbs = await page.evaluate(() => window.__lensDirector.verbs());
  for (const v of [
    "forkLens", "mergeLenses", "editLensByInstruction",
    "newGenerator", "attachToGenerator", "graduateGenerator",
    "probeGenerator", "makeLensFromGenerator", "captureThread",
  ]) {
    check(`verb registered: ${v}`, verbs.includes(v));
  }

  // ---- generators: create empty ◇N, attach, graduate ----
  const r1 = await runScript(
    page,
    [
      { verb: "newGenerator", args: { saveAs: "g1" } },
      { verb: "attachToGenerator", args: { generator: "last", target: "Forgiveness" } },
      { verb: "graduateGenerator", args: { generator: "last", name: "pressure release" } },
    ],
    "generator lifecycle"
  );
  console.log("generator lifecycle result:", JSON.stringify(r1));
  check("generator lifecycle script completed", r1.completed === true && !(r1.errors || []).length, (r1.errors || []).join("; "));
  await page.waitForTimeout(600);
  check("companion-created generator opens its workspace", await page.locator(".lens-settings").isVisible().catch(() => false));
  if (await page.locator(".lens-settings-close").isVisible().catch(() => false)) {
    await page.locator(".lens-settings-close").click();
  }
  let gens = await generatorsState(page);
  const graduated = gens.find((g) => g.title === "pressure release");
  check("empty ◇N generator created + graduated to name", !!graduated, gens.map((g) => g.title).join(", "));
  check("attach accumulated material", !!graduated && (graduated.items || []).length >= 1, `${graduated?.items?.length} items`);

  // also verify the pane's + button creates a placeholder directly
  const plusBtn = await page.$(".rail-lenses-pane .generator-new");
  check("generators pane has 'new' + button", !!plusBtn);
  if (plusBtn) {
    await plusBtn.click();
    await page.waitForTimeout(500);
    gens = await generatorsState(page);
    check("+ button created ◇N placeholder", gens.some((g) => /^◇\d+$/.test(g.title || "")), gens.map((g) => g.title).join(", "));
    check("+ button opens the new generator workspace", await page.locator(".lens-settings").isVisible().catch(() => false));
    if (await page.locator(".lens-settings-close").isVisible().catch(() => false)) {
      await page.locator(".lens-settings-close").click();
    }
  }
  await page.screenshot({ path: `${OUT}/lg-generators-pane.png` });

  // ---- lenses: create → fork → merge ----
  const r2 = await runScript(
    page,
    [
      {
        verb: "createFunction",
        args: {
          name: "essence finder",
          description: "find the essence",
          steps: [{ name: "strip", description: "strip detail" }, { name: "name it", description: "name the core" }],
        },
      },
      {
        verb: "createFunction",
        args: {
          name: "twin domains",
          description: "find twin domains",
          steps: [{ name: "map", description: "map structure" }],
        },
      },
    ],
    "seed lenses"
  );
  check("seed lenses created", r2.completed === true, (r2.errors || []).join("; "));
  await page.waitForTimeout(600);

  const r3 = await runScript(page, [{ verb: "forkLens", args: { lens: "essence finder" } }], "fork");
  await page.waitForTimeout(600);
  let repos = await reposState(page);
  const fork = repos.find((l) => (l.name || "").includes("essence finder · fork"));
  check("forkLens created a fork copy", r3.completed === true && !!fork, repos.map((l) => l.name).join(", "));

  const r4 = await runScript(
    page,
    [{ verb: "mergeLenses", args: { a: "essence finder", b: "twin domains" } }],
    "merge"
  );
  await page.waitForTimeout(600);
  repos = await reposState(page);
  const merged = repos.find((l) => (l.name || "").includes("⚭"));
  check("mergeLenses composed a compound lens", r4.completed === true && !!merged, merged?.name);
  await page.screenshot({ path: `${OUT}/lg-lenses-fork-merge.png` });

  // ---- capture thread as lens (item with via seeded) ----
  const opsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"));
  const r5 = await runScript(page, [{ verb: "captureThread", args: { target: "Pressure released" } }], "capture");
  console.log("capture result:", JSON.stringify(r5));
  await page.waitForTimeout(800);
  const opsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"));
  check(
    "captureThread stored the thread as a lens",
    r5.completed === true && opsAfter.length > opsBefore.length,
    `${opsBefore.length} -> ${opsAfter.length} ops; ${(r5.errors || []).join("; ")}`
  );

  // ---- lens editor: output count/type control ----
  const editorOpened = await runScript(page, [{ verb: "openFunctionEditor", args: { op: "essence finder" } }], "open editor");
  await page.waitForTimeout(800);
  const editorTitle = await page.textContent(".fn-editor h3").catch(() => null);
  check("editor titled Create/Edit lens", !!editorTitle && /lens/i.test(editorTitle), editorTitle);
  const outputControls = await page.$(".fn-output-controls");
  check("editor exposes output count/type control", !!outputControls, editorOpened.errors?.join("; "));
  if (outputControls) await page.screenshot({ path: `${OUT}/lg-editor-output-control.png` });
  const closeBtn = await page.$(".fn-close");
  if (closeBtn) await closeBtn.click();
  await page.waitForTimeout(400);

  // ---- generator workspace: probe row + make-lens affordances ----
  const settingsBtn = await page.$('.rail-lenses-pane button[title="Open generator workspace"]');
  check("generator card has workspace button", !!settingsBtn);
  if (settingsBtn) {
    await settingsBtn.click({ force: true });
    await page.waitForTimeout(600);
    await page.click(".gen-quiet-tools > summary");
    const probeRow = await page.$(".lens-settings-probe");
    check("workspace has probe row", !!probeRow);
    const chips = await page.$$eval(".lens-settings-probe-chip", (els) => els.map((e) => e.textContent.trim()));
    check("probe domains present", ["music", "books", "prayers", "paintings"].every((d) => chips.includes(d)), chips.join(", "));
    const freeInput = await page.$(".lens-settings-probe-input");
    check("probe free-text input present", !!freeInput);
    const makeLens = await page.$(".lens-settings-make-lens");
    check("'make lens from this' button present", !!makeLens);
    const gradHint = await page.textContent(".lens-settings-title").catch(() => null);
    // fire a probe: without an API key we accept either loading state or an error status
    const musicChip = await page.$(".gen-quiet-tools .lens-settings-probe-chip");
    if (musicChip) {
      await musicChip.click();
      await page.waitForTimeout(400);
      const status = await page.textContent(".lens-settings-probe-status").catch(() => null);
      check("probe fires (loading or error state shown)", !!status, status);
    }
    await page.screenshot({ path: `${OUT}/lg-generator-workspace.png` });
    const close = await page.$(".lens-settings-close");
    if (close) await close.click();
  }

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
