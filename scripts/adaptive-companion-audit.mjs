import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = path.resolve("audit-shots/adaptive-companion");
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const items = [
  { id: "claim", type: "text", x: 100, y: 120, w: 220, text: "Claim: retention proves durable demand", pageId: "page-main" },
  { id: "evidence-a", type: "text", x: 390, y: 170, w: 210, text: "Evidence: cohort retention improved", pageId: "page-main" },
  { id: "evidence-b", type: "text", x: 180, y: 330, w: 210, text: "Evidence: acquisition costs increased", pageId: "page-main" },
  { id: "assumption", type: "text", x: 510, y: 380, w: 210, text: "Assumption: the cohort is representative", pageId: "page-main" },
];
const nodes = [
  { id: "root", nodeKind: "source", x: 980, y: 220, radius: 30, label: "source memo", expandedText: "Retention improved but acquisition costs rose." },
  { id: "branch-a", nodeKind: "expanded", parentId: "root", x: 1140, y: 130, radius: 25, label: "quality branch", expandedText: "Evidence-led explanation with cohort detail." },
  { id: "branch-b", nodeKind: "expanded", parentId: "root", x: 1150, y: 330, radius: 25, label: "novelty branch", expandedText: "Contrarian explanation based on channel saturation." },
];

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.route("**/api/run", async (route) => {
  const body = JSON.parse(route.request().postData() || "{}");
  if (/Create the validated action plan/i.test(body.prompt || "")) {
    const plan = {
      version: 1,
      title: "compare and reorganize",
      root: {
        kind: "sequence",
        steps: [
          {
            kind: "parallel",
            steps: [
              { kind: "query", query: "selection", saveAs: "selection" },
              { kind: "query", query: "graph", filter: { id: "root", direction: "descendants" }, saveAs: "branches" },
            ],
          },
          {
            kind: "action",
            capability: "arrangeItems",
            args: { targets: ["claim", "evidence-a", "evidence-b", "assumption"], layout: "grid", options: { columns: 2, gap: 36 } },
          },
          {
            kind: "action",
            capability: "transformMaterial",
            args: {
              mode: "compare",
              targets: ["branch-a", "branch-b"],
              criteria: ["evidence quality", "novelty"],
              instruction: "Create a synthesis that preserves the strongest tension.",
            },
          },
        ],
      },
    };
    await new Promise((resolve) => setTimeout(resolve, 250));
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ outputs: [JSON.stringify(plan)] }),
    });
  }
  const output = body.prompt?.includes("Produce 2 distinct outputs")
    ? "One-page synthesis with the decision, evidence, and open risk.\n---OUTPUT---\nInvestment memo with thesis, counterevidence, and diligence questions."
    : "The evidence-quality branch is better grounded; the novelty branch exposes channel saturation. Synthesis: retain the cohort evidence while testing whether channel effects explain the apparent durability.";
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ outputs: [output] }),
  });
});

await page.addInitScript(({ items, nodes }) => {
  localStorage.clear();
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
  localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
  localStorage.setItem("lens.board.pages.v1", JSON.stringify([{ id: "page-main", name: "Adaptive audit" }]));
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify({
    version: 2,
    camera: { x: 90, y: 70, scale: 0.7 },
    items,
    nodes,
  }));
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
    version: 1,
    identity: "Audit",
    role: "researcher",
    goals: ["evaluate evidence"],
    preferences: { autonomy: "preview-complex" },
    references: { lenses: [], generators: [], paths: [] },
    actions: [],
    interviewComplete: true,
  }));
}, { items, nodes });

try {
  await page.goto(BASE);
  await page.waitForSelector(".canvas-column-main");
  await page.waitForFunction(() => window.__lensDirector?.run);

  await page.evaluate(() =>
    window.__lensDirector.run([
      {
        verb: "arrangeItems",
        args: {
          targets: ["claim", "evidence-a", "evidence-b", "assumption"],
          layout: "grid",
          options: { columns: 2, gap: 36, anchor: { x: 120, y: 130 } },
        },
      },
    ], { title: "geometry arrangement" })
  );
  await page.screenshot({ path: path.join(OUT, "rearrangement.png") });
  const arranged = JSON.parse(await page.evaluate(() => localStorage.getItem("lens.board.items.v1") || "[]"));
  check("arrangement mutates real geometry", new Set(arranged.filter((item) => ["claim", "evidence-a", "evidence-b", "assumption"].includes(item.id)).map((item) => `${item.x}:${item.y}`)).size === 4);

  await page.evaluate(() =>
    window.__lensDirector.run([
      { verb: "annotateFeedback", args: { target: "assumption", kind: "assumption", text: "Weakest assumption: this cohort may not represent future acquisition channels." } },
    ], { title: "critique annotation" })
  );
  await page.screenshot({ path: path.join(OUT, "critique-annotations.png") });
  const afterAnnotation = JSON.parse(await page.evaluate(() => localStorage.getItem("lens.board.items.v1") || "[]"));
  check("feedback creates linked artifact", afterAnnotation.some((item) => item.type === "link" && item.fromId === "assumption"));

  await page.evaluate(() =>
    window.__lensDirector.run([
      {
        verb: "transformMaterial",
        args: {
          mode: "reflect",
          targets: ["root", "branch-a", "branch-b"],
          criteria: ["changed assumptions", "divergence"],
          instruction: "Identify where the branches diverged and preserve the tension.",
        },
      },
    ], { title: "lineage reflection" })
  );
  await page.screenshot({ path: path.join(OUT, "reflection.png") });
  check("reflection materializes output", (await page.locator("text=The evidence-quality branch").count()) > 0);

  await page.evaluate(() =>
    window.__lensDirector.run([
      { verb: "groupItems", args: { targets: ["evidence-a", "evidence-b", "assumption"], name: "hidden sameness and tension" } },
      { verb: "arrangeItems", args: { targets: ["evidence-a", "evidence-b", "assumption"], layout: "cluster", options: { columns: 3, gap: 28 } } },
    ], { title: "generator-style organization" })
  );
  await page.screenshot({ path: path.join(OUT, "generator-organization.png") });

  await page.evaluate(() =>
    window.__lensDirector.run([
      {
        verb: "transformMaterial",
        args: {
          mode: "synthesize",
          targets: ["claim", "evidence-a", "evidence-b", "assumption"],
          outputCount: 2,
          instruction: "Create a one-pager and an investment memo from the shared evidence.",
          preserveOriginal: true,
        },
      },
    ], { title: "multi-output result" })
  );
  await page.screenshot({ path: path.join(OUT, "multi-output-result.png") });
  const outputs = JSON.parse(await page.evaluate(() => localStorage.getItem("lens.board.items.v1") || "[]"));
  check("multi-output preserves originals", outputs.some((item) => item.id === "claim") && outputs.filter((item) => item.bornFrom?.includes("claim")).length >= 2);

  const fab = page.locator(".companion-fab");
  if (await fab.isVisible()) await fab.click();
  const input = page.locator(".companion-input");
  await input.fill("compare these branches and reorganize the evidence");
  await input.press("Enter");
  await page.waitForSelector('[data-testid="companion-plan-strip"]', { timeout: 5000 });
  await page.screenshot({ path: path.join(OUT, "plan-strip.png") });
  check("complex plan exposes visual strip", await page.locator('[data-testid="companion-plan-strip"]').isVisible());
  await page.getByTestId("companion-plan-strip").getByRole("button", { name: "stop" }).click();

  await page.setViewportSize({ width: 820, height: 900 });
  await page.screenshot({ path: path.join(OUT, "narrow-viewport.png") });
  const panel = await page.locator(".companion-panel").boundingBox();
  check("narrow companion remains in viewport", panel && panel.x >= 0 && panel.x + panel.width <= 820);
  check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
}

const passed = checks.filter((entry) => entry.ok).length;
const report = `# Adaptive companion audit

## Architecture

The companion now observes a bounded snapshot, validates a versioned control-flow plan, and executes only canonical capabilities. The DSL supports sequence, safe parallel reads, foreach, conditionals, finite retry, queries, evaluation, research, checkpoints, and artifact placement. Execution keeps a journal/checkpoint and exposes cancellation.

## Reusable capabilities

- Geometry-aware align, distribute, stack, grid, cluster, relative move, overlap avoidance, grouping, and linking.
- Generic synthesize, compare, critique, reflect, alternatives, counterexamples, revise, and semantic-cluster transforms.
- Linked feedback artifacts with source/provenance metadata.
- User-scoped autonomy: act immediately, preview complex plans (default), or always preview.

## Provenance and research

Created artifacts carry source IDs and operation metadata. Research results are required to contain sources before execution may continue. The current backend does not expose verifiable live browsing, so research plans fail before mutation with an explicit blocker rather than fabricating citations.

## Reliability

- 40-step, 100-iteration, 3-research-call, 3-retry defaults.
- Unsupported capabilities and malformed arguments fail before mutation.
- Cancellation aborts director/model work.
- Partial failure reports an exact checkpoint and retains completed work for retry/undo.

## Automated evidence

${checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? `: ${entry.detail}` : ""}`).join("\n")}

## Screenshots

- [Plan strip](plan-strip.png)
- [Rearrangement](rearrangement.png)
- [Critique annotations](critique-annotations.png)
- [Reflection](reflection.png)
- [Generator organization](generator-organization.png)
- [Multi-output result](multi-output-result.png)
- [Narrow viewport](narrow-viewport.png)

## Limitations

- Live external research is intentionally blocked until the server provides a source-returning browse/search tool.
- This audit uses deterministic model responses. Credentialed model quality and external-source ranking require environment-specific evaluation.
- Permanent lens capture still uses the existing explicit user crafting/confirmation flow.
`;
fs.writeFileSync(path.join(OUT, "REPORT.md"), report);
console.log(`${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exitCode = 1;
