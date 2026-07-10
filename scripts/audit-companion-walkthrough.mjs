/**
 * Focused regression audit for companion submission/walkthroughs, complex
 * director scripts, AI full-output reading, and generator symbol-UI removal.
 *
 * AUDIT_URL=http://localhost:5173 node scripts/audit-companion-walkthrough.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots/walkthrough-audit";
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const completeMemory = {
  version: 1,
  identity: "Audit user",
  role: "researcher",
  goals: ["build lenses"],
  preferences: {},
  references: { lenses: [], generators: [], paths: [] },
  actions: [],
  interviewComplete: true,
  updatedAt: new Date().toISOString(),
};

async function seedBase(page, extra = {}) {
  await page.evaluate(
    ({ memory, extraState }) => {
      localStorage.clear();
      localStorage.setItem("lens.onboarded.v1", "1");
      localStorage.setItem("lens.companion.seen.v1", "1");
      localStorage.setItem("lens.tour.v1", "1");
      localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify(memory));
      for (const [key, value] of Object.entries(extraState)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { memory: completeMemory, extraState: extra }
  );
  await page.reload();
  await page.waitForTimeout(700);
}

async function openCompanion(page) {
  const fab = page.locator(".companion-fab");
  if (await fab.isVisible().catch(() => false)) await fab.click();
  await page.locator(".companion-input").waitFor();
}

async function runDirector(page, steps, title) {
  return page.evaluate(([script, scriptTitle]) => window.__lensDirector.run(script, { title: scriptTitle }), [
    steps,
    title,
  ]);
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => console.error("[pageerror]", error.message));

  let plannerCalls = 0;
  await page.route("**/api/run", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (/Create the validated action plan/i.test(body.prompt || "")) {
      plannerCalls++;
      const demo = /show me.*(?:make|create).*lens/i.test(body.text || "");
      const output = {
        version: 1,
        title: demo ? "create lens walkthrough" : "place audit note",
        root: {
          kind: "sequence",
          steps: demo
            ? [
                {
                  kind: "action",
                  capability: "createFunction",
                  args: { name: "audit lens", steps: [{ name: "inspect", description: "Inspect the material" }] },
                },
                {
                  kind: "action",
                  capability: "addFunctionBranch",
                  args: { op: "audit lens", from: "inspect", name: "brief", prompt: "Write a brief." },
                },
                {
                  kind: "action",
                  capability: "addFunctionBranch",
                  args: { op: "audit lens", from: "inspect", name: "memo", prompt: "Write a memo." },
                },
                {
                  kind: "action",
                  capability: "saveFunction",
                  args: { op: "audit lens", message: "audit branched lens" },
                },
              ]
            : [{
                kind: "action",
                capability: "spawnText",
                args: { text: `audit:${body.text}`, saveAs: "submitted" },
              }],
        },
      };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ outputs: [JSON.stringify(output)] }) });
    }
    const output = /JSON only|Return ONLY JSON/i.test(`${body.prompt || ""}\n${body.system || ""}`)
      ? JSON.stringify({
          name: "generator lens",
          description: "crafted from selected material",
          steps: [{ name: "read material", prompt: "Read the selected material." }],
        })
      : "stub model output\nfinal line";
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ outputs: [output] }) });
  });
  await page.route("**/api/execute", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ output: "stub execute output\nfinal line" }) })
  );

  await page.goto(BASE);
  await seedBase(page);
  await openCompanion(page);

  // Duplicate-submit matrix: keyboard/form, repeat, composition, speech/pointer-equivalent races.
  await page.evaluate(() => {
    window.__auditRuns = [];
    window.addEventListener("lens:companion-run", (event) => window.__auditRuns.push(event.detail));
  });
  const input = page.locator(".companion-input");
  await input.fill("put one audit note on paper");
  await input.press("Enter");
  await page.locator(".companion-send").click({ force: true }).catch(() => {});
  await page.waitForFunction(() => document.body.classList.contains("director-running"), null, { timeout: 3000 });
  await page.waitForFunction(() => !document.body.classList.contains("director-running"), null, { timeout: 3000 });
  let runs = await page.evaluate(() => window.__auditRuns);
  check("single Enter creates one observable run", runs.length === 1, `${runs.length} runs`);
  check("single Enter invokes planner once", plannerCalls === 1, `${plannerCalls} calls`);
  check("single Enter renders one user message", (await page.locator(".companion-msg.user").count()) === 1);
  let items = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]"));
  const firstMutationCount = items.filter((item) => /put one audit note/.test(item.text || "")).length;
  check("single Enter mutates state once", firstMutationCount === 1, `${firstMutationCount} matching items`);

  await input.fill("composition command");
  await input.dispatchEvent("compositionstart");
  await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await input.dispatchEvent("compositionend");
  await page.waitForTimeout(80);
  check("composition Enter does not submit", (await page.evaluate(() => window.__auditRuns.length)) === 1);
  await input.press("Enter");
  await page.waitForTimeout(850);
  runs = await page.evaluate(() => window.__auditRuns);
  check("post-composition Enter submits once", runs.length === 2);

  await input.fill("repeat command");
  await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", repeat: true });
  await page.waitForTimeout(80);
  check("key repeat is ignored", (await page.evaluate(() => window.__auditRuns.length)) === 2);
  await input.press("Enter");
  await page.waitForTimeout(850);
  check("different intentional command works", (await page.evaluate(() => window.__auditRuns.length)) === 3);

  // Real branched-lens walkthrough: chat tucks away before visible actions.
  await input.fill("show me how to create a lens");
  const walkthroughStarted = Date.now();
  await input.press("Enter");
  await page.waitForFunction(() => document.body.classList.contains("director-running"), null, { timeout: 2500 });
  await page.waitForTimeout(260);
  const playingBox = await page.locator(".companion-panel.playing").boundingBox();
  check("walkthrough begins under one second", Date.now() - walkthroughStarted < 1000, `${Date.now() - walkthroughStarted}ms`);
  check(
    "chat minimizes into the corner",
    !!playingBox && playingBox.width <= 225 && playingBox.x + playingBox.width >= 1400,
    playingBox ? `${Math.round(playingBox.x)},${Math.round(playingBox.width)}` : "missing"
  );
  await page.screenshot({ path: `${OUT}/walkthrough-playing-1440x900.png` });
  await page.waitForFunction(() => !document.body.classList.contains("director-running"), null, { timeout: 15_000 });
  const walkthroughMs = Date.now() - walkthroughStarted;
  check("full branched walkthrough completes promptly", walkthroughMs < 12_000, `${walkthroughMs}ms`);
  const opsAfterWalkthrough = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"));
  check("walkthrough saves a real fork", opsAfterWalkthrough.some((op) => op.fork && op.steps?.length >= 2));

  const ordinaryStarted = Date.now();
  const ordinaryResult = await runDirector(
    page,
    [
      { verb: "spawnText", args: { text: "timing sample", saveAs: "timed" } },
      { verb: "moveItem", args: { target: "timed", dx: 80, dy: 40 } },
      { verb: "editItem", args: { target: "timed", text: "timing sample revised" } },
      { verb: "selectItems", args: { targets: ["timed"] } },
      { verb: "renamePage", args: { name: "Timed walkthrough" } },
      { verb: "fitPaper", args: {} },
    ],
    "ordinary timing"
  );
  const ordinaryMs = Date.now() - ordinaryStarted;
  check("ordinary six-step demo stays under eight seconds", ordinaryResult.completed && ordinaryMs < 8000, `${ordinaryMs}ms`);

  // Three 15+ step scripts, including nested branch args and one recoverable failure.
  const branched = [
    { verb: "createFunction", args: { name: "stress branch", steps: [{ name: "shared", description: "shared pass" }] } },
    { verb: "openFunctionEditor", args: { op: "stress branch" } },
    { verb: "addFunctionBranch", args: { op: "stress branch", from: "shared", name: "brief", prompt: "Write a brief." } },
    { verb: "addFunctionBranch", args: { op: "stress branch", from: "shared", name: "memo", prompt: "Write a memo." } },
    { verb: "setFunctionStep", args: { op: "stress branch", step: "shared", prompt: "Extract shared facts." } },
    { verb: "addFunctionStep", args: { op: "stress branch", after: "brief", name: "polish", prompt: "Polish the brief." } },
    { verb: "saveFunction", args: { op: "stress branch", message: "stress branch saved" } },
    { verb: "spawnText", args: { text: "branch subject", saveAs: "branchSubject" } },
    { verb: "moveItem", args: { target: "branchSubject", to: { x: 250, y: 260 } } },
    { verb: "editItem", args: { target: "branchSubject", text: "branch subject revised" } },
    { verb: "selectItems", args: { targets: ["branchSubject"] } },
    { verb: "zoomToItem", args: { target: "branchSubject" } },
    { verb: "fitPaper", args: {} },
    { verb: "renamePage", args: { name: "Branch stress" } },
    { verb: "pause", args: { ms: 220 } },
  ];
  const branchResult = await runDirector(page, branched, "branched stress");
  check("15-step branched script completes", branchResult.completed, (branchResult.errors || []).join("; "));

  const generator = [
    { verb: "newGenerator", args: { saveAs: "stressGen" } },
    { verb: "spawnText", args: { text: "generator material one", saveAs: "gm1" } },
    { verb: "spawnText", args: { text: "generator material two", saveAs: "gm2" } },
    { verb: "moveItem", args: { target: "gm1", dx: 60, dy: 40 } },
    { verb: "moveItem", args: { target: "gm2", dx: -50, dy: 90 } },
    { verb: "selectItems", args: { targets: ["gm1", "gm2"] } },
    { verb: "attachToGenerator", args: { generator: "stressGen", target: "gm1" } },
    { verb: "attachToGenerator", args: { generator: "stressGen", target: "gm2" } },
    { verb: "graduateGenerator", args: { generator: "stressGen", name: "material workspace" } },
    { verb: "showLenses", args: {} },
    { verb: "pause", args: { ms: 200 } },
    { verb: "makeLensFromGenerator", args: { generator: "stressGen" } },
    { verb: "fitPaper", args: {} },
    { verb: "selectItems", args: { targets: ["gm1"] } },
    { verb: "clearHighlight", args: {} },
  ];
  const generatorResult = await runDirector(page, generator, "generator stress");
  check("15-step generator script completes", generatorResult.completed, (generatorResult.errors || []).join("; "));

  const paperAiRecovery = [
    { verb: "spawnText", args: { text: "paper ai share seed", saveAs: "shareSeed" } },
    { verb: "editItem", args: { target: "shareSeed", text: "paper ai share seed revised" } },
    { verb: "moveItem", args: { target: "shareSeed", dx: 80, dy: 30 } },
    { verb: "selectItems", args: { targets: ["shareSeed"] } },
    { verb: "dragItemToAi", args: { target: "shareSeed" } },
    { verb: "selectAiNode", args: {} },
    { verb: "applyFunctionToAiNode", args: { op: "invert" } },
    { verb: "waitForJobs", args: {} },
    { verb: "focusAiResult", args: {} },
    { verb: "moveItem", args: { target: "definitely missing", dx: 1, dy: 1 } },
    { verb: "fitAiSpace", args: {} },
    { verb: "selectAiNode", args: {} },
    { verb: "dragAiResultToPaper", args: {} },
    { verb: "captureThread", args: { target: "last", name: "shared path lens" } },
    { verb: "fitPaper", args: {} },
  ];
  const recoveryResult = await runDirector(page, paperAiRecovery, "paper ai recovery");
  check("recoverable failure is reported once", recoveryResult.errors?.length === 1, `${recoveryResult.errors?.length || 0}`);
  items = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]"));
  check("script continues after recoverable failure", items.length > 3, `${items.length} paper items`);

  // AI full-output read mode at 1k / 5k / 15k characters.
  for (const len of [1000, 5000, 15000]) {
    const final = `FINAL-LINE-${len}`;
    const text = `${"wrapped output ".repeat(Math.ceil(len / 15)).slice(0, len)}\n${final}`;
    await seedBase(page, {
      "lens.ai.nodes.v1": [
        { id: `long-${len}`, nodeKind: "expanded", x: 0, y: 0, radius: 30, label: `${len} chars`, expandedText: text, createdAt: 1 },
      ],
    });
    const node = page.locator(".ai-node").first();
    await node.dblclick({ force: true });
    const panel = page.getByTestId("ai-full-output");
    await panel.waitFor();
    const scroll = await page.locator(".ai-explore-overlay-inner").evaluate((el) => ({
      top: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      horizontal: el.scrollWidth > el.clientWidth + 1,
    }));
    check(`${len} chars opens at top`, scroll.top === 0, `${scroll.top}`);
    check(`${len} chars wraps without horizontal spill`, !scroll.horizontal);
    await page.locator(".ai-explore-overlay-inner").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(80);
    const bottom = await page.locator(".ai-explore-overlay-inner").evaluate(
      (el, finalLine) => ({
        atEnd: Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 2,
        hasFinal: (el.textContent || "").trimEnd().endsWith(finalLine),
      }),
      final
    );
    check(`${len} chars final line is reachable`, bottom.atEnd && bottom.hasFinal);
    if (len === 15000) {
      await page.locator(".ai-explore-overlay-inner").evaluate((el) => el.scrollTo(0, 0));
      await page.screenshot({ path: `${OUT}/ai-15000-top.png` });
      await page.locator(".ai-explore-overlay-inner").evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.screenshot({ path: `${OUT}/ai-15000-bottom.png` });
    }
  }

  // Legacy symbolStroke remains stored but has no symbol drawing UI.
  const legacyStroke = { strokes: [[{ x: 1, y: 2 }, { x: 9, y: 12 }]] };
  await seedBase(page, {
    "lens.lenses.v2": [
      {
        id: "legacy-generator",
        title: "legacy generator",
        kind: "symbol",
        symbolStroke: legacyStroke,
        items: [{ id: "legacy-item", type: "text", x: 0, y: 0, text: "old material" }],
        savedAt: 1,
      },
    ],
  });
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  check("generator rail has no symbol drawing language", !/draw symbol|draw a glyph|edit symbol|redraw glyph/.test(bodyText));
  check("generator card has no glyph editor", (await page.locator(".struct-card-glyph").count()) === 0);
  await page.getByTitle("Open generator workspace").click({ force: true });
  const dialogText = (await page.locator(".lens-settings").innerText()).toLowerCase();
  check("generator workspace uses generator semantics", !/symbol|glyph|latent structure|proto-concept/.test(dialogText));
  await page.locator(".lens-settings-save").click();
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]")[0]?.symbolStroke);
  check("legacy symbolStroke survives save", JSON.stringify(retained) === JSON.stringify(legacyStroke));
  await page.screenshot({ path: `${OUT}/generator-workspace-no-symbol.png` });

  // Narrow viewport placement/clipping.
  await page.setViewportSize({ width: 820, height: 900 });
  await openCompanion(page);
  const panelBox = await page.locator(".companion-panel").boundingBox();
  check("companion stays inside narrow viewport", !!panelBox && panelBox.x >= 0 && panelBox.x + panelBox.width <= 820);
  await page.screenshot({ path: `${OUT}/companion-narrow-820x900.png` });

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
