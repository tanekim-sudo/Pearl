import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const out = path.join(process.cwd(), "audit-shots/chat-requirements-integration-audit-2026-07");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:5173";
await fs.mkdir(out, { recursive: true });
const candidates = {
  move: { supported: true, name: "Evidence check", prompt: "Check each claim against cited evidence.", confidence: .91, evidenceRefs: [1, 2], alternatives: [{ name: "Source check", prompt: "Verify sources before answering." }] },
  function: { supported: true, name: "Research function", steps: [{ name: "Collect" }, { name: "Compare" }, { name: "Report" }], confidence: .87, evidenceRefs: [1, 3], alternatives: [{ name: "Fast research", steps: [{ name: "Collect" }, { name: "Report" }] }] },
  lens: { supported: true, name: "Evidence-first", material: [{ id: "m1", content: "Prefer primary sources." }], contextPolicy: "bounded", confidence: .82, evidenceRefs: [2], alternatives: [{ name: "Skeptical", material: [{ id: "m2", content: "Seek counterevidence." }] }] },
};

const browser = await chromium.launch({ headless: true });
const report = { version: 1, journeys: [] };
for (const kind of ["move", "function", "lens", "all"]) {
  const page = await browser.newPage({ viewport: { width: kind === "all" ? 390 : 1360, height: kind === "all" ? 844 : 920 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
      version: 1, identity: "Release auditor", role: "Reviewer", goals: [],
      preferences: { autonomy: "preview-complex" }, references: { lenses: [], generators: [], paths: [] },
      actions: [], interviewComplete: true, interviewPaused: false,
    }));
  });
  await page.route("**/api/infer-transcript-artifacts", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ transcript: { source: "audit", messageCount: 3, fingerprint: "audit-transcript" }, candidates }),
  }));
  await page.route("**/api/models", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ models: [] }),
  }));
  await page.goto(`${baseUrl}/?learn=chat`);
  await page.getByRole("dialog", { name: "Learn from a chat" }).waitFor();
  await page.getByLabel("Paste plain text, Markdown, or chat export JSON").fill("User: First collect sources.\nAssistant: Compare the evidence.\nUser: Report with citations.");
  await page.getByText(/3 messages/).waitFor();
  await page.getByLabel(kind === "all" ? "All three" : `${kind[0].toUpperCase()}${kind.slice(1)} only`).check();
  const generate = page.getByRole("button", { name: new RegExp(`Generate ${kind === "all" ? "all three" : kind}`, "i") });
  await page.waitForFunction((button) => !button.disabled, await generate.elementHandle());
  await generate.click();
  await page.getByText("Preview ready · nothing has been saved").waitFor();
  const expected = kind === "all" ? 3 : 1;
  const cards = await page.locator(".learn-chat-results article").count();
  if (cards !== expected) throw new Error(`${kind}: expected ${expected} candidates, got ${cards}`);
  await page.locator(".learn-chat-alternatives button").first().click();
  if (kind === "move" || kind === "function") {
    await page.getByRole("button", { name: new RegExp(`Edit in ${kind}`, "i") }).click();
    await page.locator(".fn-editor").waitFor();
  } else {
    await page.getByRole("button", { name: "Save selected artifacts" }).click();
    await page.getByText(/saved .*Lens.* from chat/).waitFor();
  }
  const screenshot = `${kind === "all" ? "transcript-all-narrow" : `transcript-${kind}`}.png`;
  await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
  if (errors.length) throw new Error(`${kind}: console errors: ${errors.join(" | ")}`);
  report.journeys.push({ id: `R-022-${kind}`, kind, candidateCount: cards, alternativeSelected: true, editorOrSaveAssertion: true, screenshot });
  await page.close();
}
await browser.close();
await fs.writeFile(path.join(out, "transcript-preservation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`transcript audit passed: ${report.journeys.length} journeys`);
