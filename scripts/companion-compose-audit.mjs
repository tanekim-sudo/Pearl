import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5173";
const OUT = path.resolve("audit-shots/companion-compose");
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (name, condition, detail = "") => {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const request =
  "I'm an investor and I want three functions the first one give me a workflow for automating my investment memos second one give me a workflow to evaluate a company and the third one combine those two so I can share it with the people on my team";

const plan = {
  version: 1,
  title: "Build team investment workflow",
  root: {
    kind: "sequence",
    steps: [
      {
        kind: "action",
        id: "create-memo",
        capability: "createFunction",
        args: {
          name: "Investment memo workflow",
          description: "Automate an evidence-grounded investment memo",
          steps: [
            { name: "Frame the investment thesis" },
            { name: "Collect evidence and counterevidence" },
            { name: "Draft the decision memo" },
          ],
        },
        saveAs: "memoLens",
      },
      {
        kind: "action",
        id: "create-evaluation",
        capability: "createFunction",
        args: {
          name: "Company evaluation workflow",
          description: "Evaluate a company consistently",
          steps: [
            { name: "Assess market and moat" },
            { name: "Assess team and traction" },
            { name: "Surface risks and diligence gaps" },
          ],
        },
        saveAs: "evaluationLens",
      },
      {
        kind: "action",
        id: "combine",
        capability: "mergeLenses",
        args: {
          a: { $ref: "memoLens" },
          b: { $ref: "evaluationLens" },
          name: "Investment workflow for teams",
        },
        saveAs: "teamLens",
      },
      {
        kind: "action",
        id: "sample",
        capability: "spawnText",
        args: {
          text: "Demo input — Northstar Analytics, a sample B2B analytics company with early revenue and limited retention data.",
          caption: "sample company input",
        },
        saveAs: "sampleCompany",
      },
      {
        kind: "action",
        id: "run",
        capability: "applyFunction",
        args: { op: { $ref: "teamLens" }, target: { $ref: "sampleCompany" } },
      },
      { kind: "action", id: "focus", capability: "focusAiResult", args: {} },
    ],
  },
};

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route("**/api/run", async (route) => {
  const body = JSON.parse(route.request().postData() || "{}");
  const output = /Create the validated action plan/i.test(body.prompt || "")
    ? JSON.stringify(plan)
    : "Demo result — Northstar has a plausible wedge and early revenue. Key diligence gaps are cohort retention, sales efficiency, competitive differentiation, and referenceable customer evidence.";
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ outputs: [output] }),
  });
});
await page.route("**/api/execute", async (route) => {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      outputs: [
        {
          text: "Demo result — investment thesis, company evaluation, risks, and team-ready diligence questions.",
        },
      ],
    }),
  });
});

await page.addInitScript(() => {
  if (sessionStorage.getItem("companion-compose-audit-seeded")) return;
  sessionStorage.setItem("companion-compose-audit-seeded", "1");
  localStorage.clear();
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem(
    "lens.board.pages.v1",
    JSON.stringify([{ id: "page-main", name: "Companion compose audit" }])
  );
});

try {
  await page.goto(BASE);
  await page.waitForSelector(".canvas-column-main");
  const fab = page.locator(".companion-fab");
  if (await fab.isVisible()) await fab.click();
  await page.waitForSelector(".companion-panel");
  await page.screenshot({ path: path.join(OUT, "profile-command.png") });

  const input = page.locator(".companion-input");
  await input.fill(request);
  await input.press("Enter");

  try {
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("lens.transformation-repos.v1") || "[]").some(
          (lens) => lens.name === "Investment memo workflow"
        ),
      null,
      { timeout: 15_000 }
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      messages: [...document.querySelectorAll(".companion-msg")].map((node) => node.textContent),
      memory: localStorage.getItem("lens.companion.memory.v1:anonymous"),
      repos: localStorage.getItem("lens.transformation-repos.v1"),
    }));
    console.error("compose audit diagnostics", diagnostics);
    await page.screenshot({ path: path.join(OUT, "failure-retry.png") });
    throw error;
  }
  await page.screenshot({ path: path.join(OUT, "creating-a.png") });

  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("lens.transformation-repos.v1") || "[]").some(
        (lens) => lens.name === "Company evaluation workflow"
      ),
    null,
    { timeout: 15_000 }
  );
  await page.screenshot({ path: path.join(OUT, "creating-b.png") });

  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("lens.transformation-repos.v1") || "[]").some(
        (lens) => lens.name === "Investment workflow for teams" && lens.mergedFrom?.length === 2
      ),
    null,
    { timeout: 15_000 }
  );
  await page.screenshot({ path: path.join(OUT, "combining-c.png") });

  await page.waitForFunction(() => !document.querySelector(".companion-progress"), null, {
    timeout: 30_000,
  });
  await page.screenshot({ path: path.join(OUT, "execution-outputs.png") });

  const state = await page.evaluate(() => ({
    memory: JSON.parse(localStorage.getItem("lens.companion.memory.v1:anonymous") || "{}"),
    repos: JSON.parse(localStorage.getItem("lens.transformation-repos.v1") || "[]"),
    operators: JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"),
    items: JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]"),
    nodes: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]"),
  }));
  const userNames = [
    "Investment memo workflow",
    "Company evaluation workflow",
    "Investment workflow for teams",
  ];
  const created = state.repos.filter((lens) => userNames.includes(lens.name));
  const compound = created.find((lens) => lens.name === "Investment workflow for teams");
  check("mixed onboarding stores concise investor role", state.memory.role === "investor");
  check("full command is not stored as identity", !String(state.memory.identity || "").includes("three functions"));
  check("creates exactly three named user lenses", created.length === 3, created.map((lens) => lens.name).join(" | "));
  check(
    "compound references the two actual saved lenses",
    compound?.mergedFrom?.length === 2 &&
      compound.mergedFrom.every((id) => created.some((lens) => lens.id === id))
  );
  check("sample input is explicit and persisted", state.items.some((item) => /Demo input.*Northstar/.test(item.text || "")));
  check("execution creates AI output", state.nodes.length > 0, `nodes=${state.nodes.length}`);
  check("no invented function error appears", (await page.getByText(/no function called/i).count()) === 0);

  await page.reload();
  await page.waitForSelector(".canvas-column-main");
  const afterReload = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lens.transformation-repos.v1") || "[]")
  );
  check(
    "three lenses survive reload without duplicates",
    afterReload.filter((lens) => userNames.includes(lens.name)).length === 3,
    afterReload.map((lens) => lens.name).join(" | ")
  );
  await page.screenshot({ path: path.join(OUT, "three-saved-lenses.png") });

  await page.setViewportSize({ width: 720, height: 820 });
  const reloadedFab = page.locator(".companion-fab");
  if (await reloadedFab.isVisible()) await reloadedFab.click();
  await page.waitForTimeout(320);
  await page.screenshot({ path: path.join(OUT, "narrow-viewport.png") });
  const panel = await page.locator(".companion-panel").boundingBox();
  check(
    "narrow companion stays in viewport",
    panel && panel.x >= 0 && panel.x + panel.width <= 720,
    JSON.stringify(panel)
  );
  check("no browser errors", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  await browser.close();
}

const passed = checks.filter((entry) => entry.ok).length;
fs.writeFileSync(
  path.join(OUT, "REPORT.md"),
  `# Companion create/use/compose audit

${checks
  .map(
    (entry) =>
      `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? `: ${entry.detail}` : ""}`
  )
  .join("\n")}
`
);
console.log(`${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exitCode = 1;
