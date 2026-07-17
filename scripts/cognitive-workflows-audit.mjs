import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5211";
const roots = {
  higher: path.resolve("audit-shots/higher-order-functions-2026-07"),
  vocabulary: path.resolve("audit-shots/personal-command-vocabulary-2026-07"),
  pullRequest: path.resolve("audit-shots/cognitive-pull-requests-2026-07"),
  packages: path.resolve("audit-shots/cognitive-packages-2026-07"),
};
Object.values(roots).forEach((root) => fs.mkdirSync(root, { recursive: true }));
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
await page.addInitScript(() => {
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.board.operators.v2", JSON.stringify([{
    id: "workflow-move", name: "Challenge assumptions", kind: "prompt", libraryKind: "move", move: true, top: true, version: 2,
    prompt: "Challenge each consequential assumption.", promptTemplate: "Challenge each consequential assumption.",
  }]));
  localStorage.setItem("lens.board.items.v1", JSON.stringify([{
    id: "workflow-material", type: "text", text: "Challenge assumptions. Compare the evidence. Treat uncertainty as a signal.", x: 180, y: 180, w: 360, h: 180, version: 1,
  }]));
});
await page.route("**/api/models", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models: [] }) }));
await page.route("**/api/cognitive-packages?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ packages: [], nextCursor: null }) }));
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

await page.getByLabel("Open Cognitive Workflow Studio").click();
await page.getByRole("dialog", { name: "Cognitive Workflow Studio" }).waitFor();
await page.getByRole("button", { name: "Propose evidence-grounded patch" }).click();
await page.getByText(/isolated tests: passed/i).waitFor();
await page.screenshot({ path: path.join(roots.higher, "01-isolated-selective-patch.png"), fullPage: true });
await page.getByRole("button", { name: "Accept selected hunks as new version" }).click();
const patchReceipt = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.higher-order-patches.v1") || "[]").at(-1));

await page.getByRole("button", { name: "Vocabulary" }).click();
await page.getByPlaceholder("Founder pass").fill("Founder pass");
await page.getByLabel("Run").fill("orchestrateCognitiveWorkflow");
await page.getByLabel("Scope").selectOption("workspace");
await page.getByRole("button", { name: "Preview & remember" }).click();
await page.getByLabel("Test without executing").fill("write the words founder pass");
await page.getByText(/Literal text; no execution/i).waitFor();
await page.screenshot({ path: path.join(roots.vocabulary, "01-scoped-literal-safe-vocabulary.png"), fullPage: true });
const vocabulary = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.personal-command-vocabulary.v1") || "[]"));

await page.getByRole("button", { name: "Pull request" }).click();
await page.getByRole("button", { name: "Create extraction pull request" }).click();
await page.getByText(/move: Atomic operation/i).waitFor();
await page.getByText(/function: Latent sequence/i).waitFor();
await page.getByText(/lens: Source perspective/i).waitFor();
const articles = page.locator(".cognitive-studio-body article");
await articles.nth(0).getByRole("button", { name: "Accept" }).click();
await articles.nth(1).getByRole("button", { name: "Reject" }).click();
await articles.nth(2).getByRole("button", { name: "Accept" }).click();
await page.screenshot({ path: path.join(roots.pullRequest, "01-grounded-partial-review.png"), fullPage: true });
await page.getByRole("button", { name: "Merge accepted" }).click();
const pullRequests = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.cognitive-pull-requests.v1") || "[]"));

await page.getByRole("button", { name: "Integrate" }).click();
await page.getByRole("button", { name: "Continue to package review" }).click();
await page.locator(".package-registry-modal").waitFor();
await page.screenshot({ path: path.join(roots.packages, "03-integrated-review-to-package.png"), fullPage: true });

await page.getByLabel("Close package registry").click();
if (await page.locator(".companion-input").count() === 0) await page.locator(".companion-fab").click();
await page.locator(".companion-input").fill("open cognitive workflow studio");
await page.locator(".companion-input").press("Enter");
await page.getByRole("dialog", { name: "Cognitive Workflow Studio" }).waitFor();
await page.screenshot({ path: path.join(roots.higher, "02-companion-visible-workflow.png"), fullPage: true });

await page.setViewportSize({ width: 390, height: 780 });
await page.screenshot({ path: path.join(roots.pullRequest, "02-narrow-workflow-studio.png"), fullPage: true });

const results = {
  passed: Boolean(patchReceipt?.receipt && vocabulary.length === 1 && pullRequests.at(-1)?.receipt && errors.length === 0),
  patch: { status: patchReceipt?.status, receipt: patchReceipt?.receipt, isolatedTestPassed: patchReceipt?.test?.passed },
  vocabulary: vocabulary.map(({ id, trigger, scope, version, active }) => ({ id, trigger, scope, version, active })),
  pullRequest: { status: pullRequests.at(-1)?.status, candidateKinds: pullRequests.at(-1)?.candidates?.map((entry) => entry.kind), receipt: pullRequests.at(-1)?.receipt },
  companionVisible: true,
  errors,
};
for (const root of Object.values(roots)) fs.writeFileSync(path.join(root, "workflow-results.json"), `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
if (!results.passed) process.exitCode = 1;
