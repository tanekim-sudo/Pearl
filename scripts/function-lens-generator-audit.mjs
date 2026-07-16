import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.LENS_AUDIT_URL || "http://localhost:5174";
const outputDir = path.resolve("audit-shots/function-lens-generator-separation-2026-07");
await mkdir(outputDir, { recursive: true });

const results = {
  kind: "function-lens-generator-separation-audit",
  version: 1,
  ranAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  screenshots: [],
  runtimeLogs: [],
};

function check(name, pass, evidence = "") {
  results.checks.push({ name, pass: !!pass, evidence });
  if (!pass) throw new Error(`${name}: ${evidence}`);
}

async function shot(page, name, fullPage = false) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(outputDir, filename), fullPage });
  results.screenshots.push(filename);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.tour.completed.v1", "1");
    localStorage.setItem("lens.companion.seen.v1", "1");
    localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
      version: 1,
      identity: "Auditor",
      role: "product tester",
      goals: [],
      preferences: { autonomy: "preview-complex" },
      references: { lenses: [], generators: [], paths: [] },
      actions: [],
      interviewComplete: true,
      interviewPaused: false,
      updatedAt: Date.now(),
    }));
    localStorage.setItem("lens.board.items.v1", JSON.stringify([{
      id: "audit-text",
      type: "text",
      text: "Keep  double spaces.\nAnd lines.",
      x: 120,
      y: 120,
      w: 280,
      h: 100,
      pageId: "page-1",
    }]));
  });
  const page = await context.newPage();
  page.on("console", (message) => results.runtimeLogs.push(`console:${message.type()}:${message.text()}`));
  page.on("pageerror", (error) => results.runtimeLogs.push(`pageerror:${error.message}`));
  await page.goto(`${baseUrl}/?auditLibrary=1`, { waitUntil: "networkidle" });
  await page.locator(".functions-board-rail").waitFor();

  const guide = await page.locator(".library-kind-guide").innerText();
  check("three-kind-guide", /Function = one instruction/.test(guide) && /Lens = a process/.test(guide) && /Generator = a structure in progress/.test(guide), guide);
  check("three-primary-sections", await page.getByText("Functions", { exact: false }).count() > 0
    && await page.getByText("lenses", { exact: true }).count() > 0
    && await page.getByText("Generators", { exact: false }).count() > 0, "Functions, Lenses, and Generators are visible");
  await shot(page, "01-desktop-three-sections");

  await page.evaluate(() => window.__lensLibraryAudit.openSaveAs(["audit-text"]));
  await page.locator(".library-save-as-chooser").waitFor();
  const chooserText = await page.locator(".library-save-as-chooser").innerText();
  check("chooser-explains-three-semantics", /Use this content verbatim/.test(chooserText)
    && /No transformation lineage is available/.test(chooserText)
    && /Collect each item as separate material/.test(chooserText), chooserText);
  check("zero-history-lens-disabled", await page.locator(".library-save-as-options button").nth(1).isDisabled(), "Lens disabled for plain text with no lineage");
  await shot(page, "02-universal-save-as-chooser");

  await page.locator(".library-save-as-options button").nth(0).click({ force: true });
  await page.locator(".fn-editor-atomic").waitFor();
  const prompt = await page.locator(".fn-create-panel textarea").inputValue();
  check("function-drop-verbatim", prompt === "Keep  double spaces.\nAnd lines.", JSON.stringify(prompt));
  check("function-editor-is-atomic", /one instruction · one model call · no child graph/.test(await page.locator(".fn-create-panel").innerText()), "Atomic contract visible");
  await shot(page, "03-function-verbatim-preview");
  await page.locator(".fn-close").click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".library-kind-guide").waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("narrow-no-horizontal-page-clipping", overflow <= 1, `overflow=${overflow}`);
  await shot(page, "04-narrow-library", true);

  const report = `# Function / Lens / Generator separation audit

Ran: ${results.ranAt}

## Outcome

${results.checks.every((entry) => entry.pass) ? "PASS" : "FAIL"} — the primary app rail presents three distinct object types, the universal chooser explains destination semantics, zero-history Lens capture is disabled honestly, and Function drop preserves text verbatim in the compact atomic editor.

## Checks

${results.checks.map((entry) => `- ${entry.pass ? "PASS" : "FAIL"} — ${entry.name}: ${entry.evidence}`).join("\n")}

## Screenshots

${results.screenshots.map((entry) => `- ${entry}`).join("\n")}

## External boundaries

- Live model quality, authenticated Supabase adoption, and extension execution against arbitrary third-party pages require deployed credentials and host permissions; automated unit/build coverage verifies their local contracts.
- Page text alone has no web-app transformation lineage, so the extension disables Lens creation and directs the user to the process editor.
`;
  await writeFile(path.join(outputDir, "REPORT.md"), report);
} finally {
  await browser.close();
  await writeFile(path.join(outputDir, "results.json"), JSON.stringify(results, null, 2));
}
