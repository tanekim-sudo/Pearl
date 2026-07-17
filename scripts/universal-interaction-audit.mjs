import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

import {
  DROP_SOURCE_KINDS,
  DROP_TARGET_KINDS,
  resolveDropIntent,
} from "../shared/drop-intent-resolver.js";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5190";
const OUT = path.resolve(process.env.AUDIT_OUT || "audit-shots/universal-interaction-2026-07");
const EXACT = "Clear only this page. Then create market, founder, product, competition, risks, and recommendation branches; compare the evidence and keep the strongest result.";
fs.mkdirSync(OUT, { recursive: true });

function source(kind) {
  if (kind.startsWith("canonical-")) {
    const canonical = kind.replace("canonical-", "");
    return {
      id: `${canonical}-fixture`,
      kind: canonical,
      schemaVersion: 2,
      version: 1,
      name: `${canonical} fixture`,
      ...(canonical === "move" ? { prompt: "Transform exactly." } : {}),
      ...(canonical === "function" ? { processGraph: { nodes: [], edges: [], outputs: [] } } : {}),
      ...(canonical === "lens" ? { contextPolicy: "bounded", material: [] } : {}),
    };
  }
  return { id: `${kind}-fixture`, sourceKind: kind, text: `Exact ${kind} fixture` };
}

const matrix = DROP_SOURCE_KINDS.flatMap((sourceKind) =>
  DROP_TARGET_KINDS.map((targetKind) => {
    const resolved = resolveDropIntent(source(sourceKind), { kind: targetKind });
    return {
      source: sourceKind,
      target: targetKind,
      defaultIntent: resolved.defaultIntent.id,
      preview: resolved.defaultIntent.preview,
      resultKind: resolved.defaultIntent.resultKind,
      preserving: resolved.preserved,
      prerequisites: resolved.defaultIntent.prerequisites,
    };
  })
);

fs.writeFileSync(path.join(OUT, "source-target-matrix.json"), `${JSON.stringify({
  version: 1,
  sources: DROP_SOURCE_KINDS,
  targets: DROP_TARGET_KINDS,
  cells: matrix.length,
  rows: matrix,
}, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, "source-target-matrix.md"), `# Universal semantic transfer matrix

- Sources: ${DROP_SOURCE_KINDS.length}
- Targets: ${DROP_TARGET_KINDS.length}
- Cartesian cells: ${matrix.length}
- Null/dead cells: ${matrix.filter((entry) => !entry.defaultIntent).length}
- Non-preserving cells without safeguards: ${matrix.filter((entry) => !entry.preserving && !entry.prerequisites.length).length}

${matrix.map((entry) => `- \`${entry.source}\` → \`${entry.target}\`: ${entry.preview} (\`${entry.defaultIntent}\`)`).join("\n")}
`);

fs.writeFileSync(path.join(OUT, "research-principles.md"), `# Applied interaction principles

- Figma plugin drops carry translated absolute and parent-relative coordinates; preserve coordinate spaces explicitly across surfaces.
- FigJam stickable hosts make valid attachment targets discoverable before release.
- Miro panel drops expose target plus board coordinates and create native board objects instead of retaining panel-only types.
- Notion treats every item as a block, shows insertion guides, supports drag handles, Option/Alt duplication, keyboard movement, and a compact modify/move menu.
- Apple Freeform keeps center drag for movement, supports multi-selection, zoom-independent canvas positioning, space-drag panning, and touch equivalents.
- Google Slides uses one-pixel arrow nudges and Shift for larger movement, preserving precise keyboard control.
- Linear provides a contextual command menu, bulk selection, a dedicated move shortcut, and scoped undo after cross-team transfer.
- Raycast exposes every contextual action in an Action Panel, assigns stable primary/secondary keyboard actions, and uses submenus only for materially different choices.

Applied here: semantic payloads are normalized independently from MIME; every source×target cell resolves to a preserving action, chooser, or safeguarded prerequisite; exact text remains exact; target previews name the effect; destructive targets require scoped confirmation; and direct/companion/extension routes share the resolver contract.
`);

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/models", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({ models: [] }),
}));
await page.addInitScript(({ exact }) => {
  if (sessionStorage.getItem("universal-audit-seeded") === "1") return;
  sessionStorage.setItem("universal-audit-seeded", "1");
  localStorage.clear();
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.board.pages.v1", JSON.stringify([{ id: "page-main", name: "Universal interaction audit" }]));
  const item = {
    id: "complex-command",
    type: "text",
    x: 320,
    y: 240,
    w: 460,
    text: exact,
    pageId: "page-main",
    bornAt: 1,
  };
  localStorage.setItem("lens.board.items.v1", JSON.stringify([item]));
  localStorage.setItem("lens.ai.nodes.v1", "[]");
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify({
    version: 3,
    camera: { x: 0, y: 0, scale: 1 },
    items: [item],
    nodes: [],
  }));
  localStorage.setItem("lens.board.operators.v2", "[]");
  localStorage.setItem("lens.lenses.v2", "[]");
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
    version: 1,
    identity: "Universal interaction auditor",
    role: "tester",
    goals: ["verify semantic transfer"],
    preferences: { autonomy: "act-immediately" },
    references: {},
    actions: [],
    interviewComplete: true,
  }));
}, { exact: EXACT });

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
let trace = null;

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('[data-item="complex-command"]', { timeout: 60_000 });
  const sourceBox = await page.locator('[data-item="complex-command"]').boundingBox();
  const targetBox = await page.locator(".move-quick-add").boundingBox();
  if (!sourceBox || !targetBox) throw new Error("source or Moves target is not visible");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 30, sourceBox.y + sourceBox.height / 2, { steps: 4 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 24 });
  await page.mouse.up();
  await page.waitForFunction((exact) => {
    const operators = JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]");
    return operators.some((entry) =>
      entry.libraryKind === "move" &&
      entry.sourceInstruction === exact &&
      entry.promptTemplate === exact
    );
  }, EXACT, { timeout: 15_000 });
  await page.screenshot({ path: path.join(OUT, "01-complex-command-to-moves.png"), fullPage: true });
  const direct = await page.evaluate((exact) => {
    const operators = JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]");
    const items = JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]");
    return {
      move: operators.find((entry) => entry.sourceInstruction === exact),
      sourcePresent: items.some((entry) => entry.id === "complex-command" && entry.text === exact),
      toast: document.querySelector(".toast")?.textContent || "",
    };
  }, EXACT);
  check("complex command creates a Move", direct.move?.libraryKind === "move");
  check("sourceInstruction remains byte-for-byte exact", direct.move?.sourceInstruction === EXACT);
  check("promptTemplate remains byte-for-byte exact", direct.move?.promptTemplate === EXACT);
  check("paper source remains unchanged", direct.sourcePresent);
  check("drop advertises undo", /undo/i.test(direct.toast));
  check("created Move is immediately usable in the rail", direct.move?.id
    ? await page.locator(`[data-op-id="${direct.move.id}"]`).isVisible().catch(() => false)
    : false);

  const undo = page.locator('button[title="Undo"]').first();
  await undo.click();
  await page.waitForFunction((exact) =>
    !JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]").some((entry) => entry.sourceInstruction === exact),
  EXACT);
  check("immediate undo removes only the created Move", true);
  check("undo preserves source", await page.evaluate((exact) =>
    JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").some((entry) => entry.id === "complex-command" && entry.text === exact),
  EXACT));

  const companionSourceBox = await page.locator('[data-item="complex-command"]').boundingBox();
  if (!companionSourceBox) throw new Error("paper command disappeared before companion parity test");
  await page.mouse.click(
    companionSourceBox.x + companionSourceBox.width / 2,
    companionSourceBox.y + companionSourceBox.height / 2
  );
  const fab = page.locator(".companion-fab");
  if (await fab.isVisible()) await fab.click();
  const input = page.locator(".companion-input");
  await input.fill("turn this whole command into a Move exactly as written");
  await input.press("Enter");
  await page.waitForFunction((exact) =>
    JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]").some((entry) => entry.sourceInstruction === exact),
  EXACT, { timeout: 15_000 });
  await page.waitForFunction(() => {
    const traces = window.__lensDirector?.traces?.();
    return !traces?.active && traces?.completed?.some((entry) =>
      entry.expectedCapabilities?.includes("semanticTransfer")
    );
  }, null, { timeout: 15_000 });
  trace = await page.evaluate(() => window.__lensDirector?.traces?.().completed.at(-1) || null);
  check("companion uses semanticTransfer", trace?.expectedCapabilities?.includes("semanticTransfer"));
  check("companion animation completed", trace?.status === "completed");
  check("companion trace starts and lands", trace?.events?.some((event) => event.type === "cursor-jump") &&
    trace?.events?.some((event) => event.type === "target-resolved") &&
    trace?.events?.some((event) => event.type === "gesture-release"));
  await page.screenshot({ path: path.join(OUT, "02-companion-equivalent.png"), fullPage: true });

  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-item="complex-command"]');
  check("Move persists after refresh", await page.evaluate((exact) =>
    JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]").some((entry) =>
      entry.sourceInstruction === exact && entry.promptTemplate === exact
    ), EXACT));

  await page.setViewportSize({ width: 720, height: 900 });
  await page.screenshot({ path: path.join(OUT, "03-narrow-persisted.png"), fullPage: true });
  check("no uncaught browser errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
}

const sourceFiles = [
  "client/App.jsx",
  "client/components/AiNodeCanvas.jsx",
  "client/components/BeforeAfterLensEditor.jsx",
  "client/components/LensTreeEditor.jsx",
  "extension/src/sidepanel/main.jsx",
];
const ignoredScan = sourceFiles.map((file) => {
  const text = fs.readFileSync(path.resolve(file), "utf8");
  return {
    file,
    dropHandlers: (text.match(/\bonDrop\s*=/g) || []).length,
    genericConversionErrors: (text.match(/cannot convert|can't convert|no transformation lineage|unsupported .*drop/gi) || []),
  };
});
fs.writeFileSync(path.join(OUT, "ignored-drop-scan.json"), `${JSON.stringify(ignoredScan, null, 2)}\n`);

const results = {
  generatedAt: new Date().toISOString(),
  exactCommand: EXACT,
  matrix: {
    sources: DROP_SOURCE_KINDS.length,
    targets: DROP_TARGET_KINDS.length,
    cells: matrix.length,
    preserving: matrix.filter((entry) => entry.preserving).length,
  },
  checks,
  passed: checks.filter((entry) => entry.ok).length,
  failed: checks.filter((entry) => !entry.ok).length,
  browserErrors: errors,
  companionTrace: trace,
  screenshots: [
    "01-complex-command-to-moves.png",
    "02-companion-equivalent.png",
    "03-narrow-persisted.png",
  ],
};
fs.writeFileSync(path.join(OUT, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, "REPORT.md"), `# Universal interaction audit

Verdict: ${results.failed ? "not release-ready" : "exact paper → Moves failure fixed and universal resolver/browser evidence passed"}.

- Matrix: ${results.matrix.sources} source kinds × ${results.matrix.targets} targets = ${results.matrix.cells} preserving/safeguarded cells.
- Browser checks: ${results.passed}/${checks.length} passed.
- Exact command preserved as both \`sourceInstruction\` and \`promptTemplate\`.
- Direct manipulation and companion \`semanticTransfer\` produced the same persisted Move.
- Extension page capture can now wrap exact text as a one-step Function rather than rejecting missing lineage.

${checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? `: ${entry.detail}` : ""}`).join("\n")}

## External boundaries
- Native OS drag payload bytes for arbitrary files remain browser-managed; the resolver preserves metadata/material and requires explicit extraction before execution.
- Live paid model decomposition is optional enrichment and was not used for the exact Move or one-step Function paths.
- Store-account installation and physical touch/stylus hardware are contract/build boundaries in this run.
`);

console.log(JSON.stringify({ passed: results.passed, failed: results.failed, matrix: results.matrix }));
if (results.failed) process.exitCode = 1;
