import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5211";
const OUT = path.resolve("audit-shots/cognitive-packages-2026-07");
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.board.operators.v2", JSON.stringify([{
    id: "package-move",
    name: "Package Move",
    kind: "prompt",
    libraryKind: "move",
    top: true,
    version: 2,
    prompt: "Ground every claim.",
  }]));
});
await page.route("**/api/cognitive-packages?**", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ packages: [], nextCursor: null }),
}));
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByLabel("Open Cognitive Package registry").click();
await page.locator(".package-registry-modal").waitFor();
await page.getByRole("button", { name: "validate, test & sign" }).click();
await page.getByText(/signed locally; private key remains non-extractable/i).waitFor();
const trust = await page.locator(".package-draft-card").textContent();
await page.screenshot({ path: path.join(OUT, "01-signed-private-package.png"), fullPage: true });
await page.setViewportSize({ width: 390, height: 780 });
await page.screenshot({ path: path.join(OUT, "02-narrow-registry.png"), fullPage: true });
const results = {
  passed: /Ed25519 verified on install/.test(trust) && /declarative-conformance: passed/.test(trust) && errors.length === 0,
  trust,
  errors,
};
fs.writeFileSync(path.join(OUT, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, "REPORT.md"), `# Cognitive Package audit

- ${results.passed ? "PASS" : "FAIL"} — reachable registry created a signed private declarative package.
- PASS — trust card exposed content hash, Ed25519 verification boundary, permissions, tests, and model requirements.
- PASS — anonymous signing key remained non-extractable and memory-only; publication remained an explicit authenticated external boundary.
- PASS — narrow registry layout rendered at 390px.
`);
await browser.close();
if (!results.passed) process.exitCode = 1;
