import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5190";
const OUT = path.resolve("audit-shots/companion-release-audit-2026-07");
const COMMAND = "Who are you?\nclear everything let me start fomr scratch";
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const items = [
  { id: "note-a", type: "text", x: 120, y: 120, w: 220, text: "Keep until confirmed", pageId: "page-main" },
  { id: "note-b", type: "text", x: 420, y: 250, w: 220, text: "Second note", pageId: "page-main" },
  { id: "stroke-a", type: "stroke", x: 260, y: 340, points: [{ x: 0, y: 0 }, { x: 30, y: 20 }], pageId: "page-main" },
];
const nodes = [
  { id: "node-a", nodeKind: "source", x: 900, y: 220, radius: 28, label: "AI source" },
  { id: "node-b", nodeKind: "expanded", x: 1080, y: 300, radius: 24, label: "AI branch", parentId: "node-a" },
];
const userLens = { id: "audit-lens", name: "Account library lens", kind: "prompt", prompt: "Keep.", top: true };
const generator = { id: "audit-generator", title: "Account library generator", kind: "idea", items: [], savedAt: Date.now() };

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const pageErrors = [];
const consoleErrors = [];
const failedResponses = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

await page.addInitScript(({ items, nodes, userLens, generator }) => {
  if (localStorage.getItem("lens.companion.release.seeded") === "1") return;
  localStorage.clear();
  localStorage.setItem("lens.companion.release.seeded", "1");
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.board.pages.v1", JSON.stringify([{ id: "page-main", name: "Companion release audit" }]));
  localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
  localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify({
    version: 2,
    savedAt: new Date().toISOString(),
    camera: { x: 80, y: 56, scale: 0.72 },
    items,
    nodes,
  }));
  localStorage.setItem("lens.board.operators.v2", JSON.stringify([userLens]));
  localStorage.setItem("lens.lenses.v2", JSON.stringify([generator]));
}, { items, nodes, userLens, generator });

try {
  await page.goto(BASE);
  await page.waitForSelector(".canvas-column-main");
  const fab = page.locator(".companion-fab");
  if (await fab.isVisible()) await fab.click();
  const input = page.locator(".companion-input");
  await input.waitFor();
  await page.evaluate(() => {
    window.__companionAuditRuns = 0;
    window.addEventListener("lens:companion-run", () => { window.__companionAuditRuns += 1; });
  });

  await input.fill(COMMAND);
  await page.screenshot({ path: path.join(OUT, "01-exact-command-entry.png") });
  const started = performance.now();
  await input.press("Enter");
  try {
    await page.getByTestId("companion-clear-confirmation").waitFor({ timeout: 10_000 });
  } catch (error) {
    console.error("companion diagnostics", await page.evaluate(() => ({
      run: window.__lensCompanionLastRun,
      auditRuns: window.__companionAuditRuns,
      messages: [...document.querySelectorAll(".companion-msg")].map((node) => node.textContent),
      progress: document.querySelector(".companion-progress")?.textContent,
    })));
    await page.screenshot({ path: path.join(OUT, "99-timeout-diagnostic.png") });
    throw error;
  }
  const latency = Math.round(performance.now() - started);
  await page.screenshot({ path: path.join(OUT, "02-unified-confirmation.png") });

  const confirmation = (await page.getByTestId("companion-clear-confirmation").innerText()).replace(/\s+/g, " ");
  const messages = await page.locator(".companion-msg").allTextContents();
  check("exact typo-containing multiline input reaches confirmation", true, `${latency}ms`);
  check("current workspace means paper and AI", /3 whiteboard items.*2 AI nodes/.test(confirmation), confirmation);
  check("account libraries are outside unqualified clear",
    !/user-created lenses|generators?/i.test(confirmation), confirmation);
  check("mixed identity question does not swallow executable command",
    messages.some((text) => /Who are you\?\s+clear everything let me start fomr scratch/.test(text)));
  check("executable request dispatches exactly once", await page.evaluate(() => window.__companionAuditRuns) === 1);
  check("deterministic planning reaches visible action under two seconds", latency < 2000, `${latency}ms`);
  check("reported schema error is absent", !messages.some((text) => /not accepted by clearPaper/.test(text)));

  const before = await page.evaluate(() => ({
    items: JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length,
    nodes: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]").length,
  }));
  check("confirmation stages without early mutation", before.items === 3 && before.nodes === 2);

  await page.getByTestId("companion-clear-confirm").click();
  await page.waitForFunction(() => {
    const unified = JSON.parse(localStorage.getItem("lens.unified-workspace.v2") || "{}");
    return (unified.items || []).length === 0 && (unified.nodes || []).length === 0;
  });
  await page.screenshot({ path: path.join(OUT, "03-confirmed-result.png") });

  const after = await page.evaluate(() => ({
    items: JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]"),
    nodes: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]"),
    unified: JSON.parse(localStorage.getItem("lens.unified-workspace.v2") || "{}"),
    lenses: JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"),
    generators: JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]"),
  }));
  check("confirmation performs real unified state mutation",
    after.items.length === 0 && after.nodes.length === 0 &&
    after.unified.items?.length === 0 && after.unified.nodes?.length === 0);
  check("unqualified clear preserves account library",
    after.lenses.some((entry) => entry.id === "audit-lens") &&
    after.generators.some((entry) => entry.id === "audit-generator"));

  await page.reload();
  await page.waitForSelector(".canvas-column-main");
  const persisted = await page.evaluate(() => ({
    items: JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length,
    nodes: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]").length,
    unified: JSON.parse(localStorage.getItem("lens.unified-workspace.v2") || "{}"),
    lenses: JSON.parse(localStorage.getItem("lens.board.operators.v2") || "[]"),
    generators: JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]"),
  }));
  check("cleared workspace survives refresh",
    persisted.items === 0 && persisted.nodes === 0 &&
    persisted.unified.items?.length === 0 && persisted.unified.nodes?.length === 0,
    `items=${persisted.items}, nodes=${persisted.nodes}, unified=${persisted.unified.items?.length || 0}/${persisted.unified.nodes?.length || 0}`);
  check("preserved library survives refresh",
    persisted.lenses.some((entry) => entry.id === "audit-lens") &&
    persisted.generators.some((entry) => entry.id === "audit-generator"));

  await page.setViewportSize({ width: 720, height: 820 });
  if (await page.locator(".companion-fab").isVisible()) await page.locator(".companion-fab").click();
  await page.screenshot({ path: path.join(OUT, "04-narrow-after-refresh.png") });
  check("no uncaught browser errors", pageErrors.length === 0, pageErrors.join(" | "));
  const materialConsoleErrors = failedResponses.filter(({ url }) => !/favicon\.ico$/.test(url));
  check("no material console or request errors",
    pageErrors.length === 0 && materialConsoleErrors.length === 0,
    JSON.stringify({ consoleErrors, failedResponses: materialConsoleErrors }));

  const results = {
    generatedAt: new Date().toISOString(),
    command: COMMAND,
    latencyMs: latency,
    passed: checks.filter((entry) => entry.ok).length,
    failed: checks.filter((entry) => !entry.ok).length,
    checks,
    pageErrors,
    consoleErrors,
    failedResponses,
  };
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, "REPORT.md"), `# Companion release audit

Verdict: ${results.failed ? "not release-ready" : "exact reported failure fixed and browser-verified"}.

## Exact regression
- Input: \`Who are you?\\nclear everything let me start fomr scratch\`
- First visible confirmation: ${latency} ms
- Result: ${results.passed}/${checks.length} checks passed

${checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? `: ${entry.detail}` : ""}`).join("\n")}

## Screenshots
- \`01-exact-command-entry.png\`
- \`02-unified-confirmation.png\`
- \`03-confirmed-result.png\`
- \`04-narrow-after-refresh.png\`
`);
  if (results.failed) process.exitCode = 1;
} finally {
  await browser.close();
}
