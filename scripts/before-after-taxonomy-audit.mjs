import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const out = path.join(process.cwd(), "audit-shots/chat-requirements-integration-audit-2026-07");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:5173";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { version: 1, journeys: [] };

for (const artifactKind of ["move", "function"]) {
  const page = await browser.newPage({ viewport: { width: artifactKind === "move" ? 1360 : 390, height: artifactKind === "move" ? 920 : 844 } });
  await page.addInitScript(() => {
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
      version: 1, identity: "Release auditor", role: "Reviewer", goals: [],
      preferences: { autonomy: "preview-complex" }, references: { lenses: [], generators: [], paths: [] },
      actions: [], interviewComplete: true, interviewPaused: false,
    }));
  });
  await page.route("**/api/infer-transformation", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      specification: {
        version: 1, artifactKind, name: artifactKind === "move" ? "Trim prose" : "Research and report",
        summary: artifactKind === "move" ? "One atomic rewrite." : "A multi-step evidenced process.",
        operation: "Preserve facts and improve the result.", invariants: ["facts"], changes: ["clarity"],
        inputRequirements: ["text"], outputSpec: { version: 1, mode: "custom", machineKind: "text", semanticType: "text", cardinality: { min: 1, max: 1 }, branches: [] },
        steps: artifactKind === "function" ? [{ name: "Collect" }, { name: "Compare" }, { name: "Report" }] : [],
        confidence: .9, alternatives: [{ name: "Alternative", operation: "Preserve structure and improve clarity." }],
      },
      exampleCount: 1, examplesPrivate: true, model: "release-fixture",
    }),
  }));
  await page.goto(`${baseUrl}/?learn=before-after`);
  await page.getByLabel("Before text").fill(artifactKind === "move" ? "verbose source" : "uncited question");
  await page.getByLabel("After text").fill(artifactKind === "move" ? "clear source" : "cited comparison and report");
  await page.getByRole("button", { name: "Infer transformation" }).click();
  await page.getByLabel("Inferred transformation preview").waitFor();
  await page.getByRole("button", { name: "Use this" }).click();
  const editor = page.locator(".fn-editor");
  await editor.waitFor();
  await page.locator(".before-after-mode").waitFor({ state: "hidden" });
  const body = await page.locator("body").innerText();
  if (!new RegExp(artifactKind === "move" ? "Move" : "Function", "i").test(body)) throw new Error(`${artifactKind} editor classification not visible`);
  const screenshot = `before-after-${artifactKind}-${artifactKind === "function" ? "narrow" : "desktop"}.png`;
  await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
  report.journeys.push({ id: `R-025-${artifactKind}`, artifactKind, editorReached: true, screenshot });
  await page.close();
}
await browser.close();
await fs.writeFile(path.join(out, "before-after-preservation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log("before/after taxonomy audit passed");
