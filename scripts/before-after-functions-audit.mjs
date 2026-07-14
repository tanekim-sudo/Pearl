import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";

const root = process.cwd();
const out = path.join(root, "audit-shots/before-after-functions-2026-07");
await fs.mkdir(out, { recursive: true });

const inference = {
  version: 1,
  name: "Structured bullet summary",
  summary: "I think this transformation is concise prose rewritten as faithful bullets.",
  operation: "Extract the essential claims from the input and return concise bullets. Preserve factual meaning, names, and quantities. Remove repetition and do not add facts.",
  invariants: ["factual meaning", "names and quantities"],
  changes: ["remove repetition", "reorder by importance", "format as bullets"],
  inputRequirements: ["readable source material"],
  outputSpec: {
    version: 1, mode: "custom", semanticType: "bullet summary", machineKind: "list",
    description: "A concise list of the source's essential claims.",
    instructions: "Return one bullet per claim.", schema: null, cardinality: { min: 1, max: 1 }, branches: [],
  },
  modality: { input: ["text", "image", "drawing"], output: ["text"], constraints: ["Preserve visible facts."] },
  confidence: 0.78,
  ambiguity: "A single pair may indicate either summarization or formatting only.",
  alternatives: [
    { name: "Formatting only", operation: "Keep all wording and reformat it as bullets.", rationale: "The example may not prove content deletion." },
    { name: "Executive outline", operation: "Create a short hierarchical outline of the input.", rationale: "The target could imply hierarchy." },
  ],
};

async function prepare(page, viewport = { width: 1440, height: 980 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
      version: 1, identity: "Audit user", role: "Reviewer", goals: [],
      preferences: { autonomy: "preview-complex" }, references: { lenses: [], generators: [], paths: [] },
      actions: [], interviewComplete: true, interviewPaused: false,
    }));
  });
  await page.route("**/api/infer-transformation", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ specification: inference, exampleCount: 1, examplesPrivate: true, model: "audit-fixture" }) });
  });
  await page.goto("http://localhost:5173/?learn=before-after");
  await page.locator("[data-before-after-editor]").waitFor();
  await page.getByTitle("Close").click().catch(() => {});
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await prepare(page);
await page.screenshot({ path: path.join(out, "01-empty.png"), fullPage: true });

await page.getByLabel("Before text").fill("The launch grew 42%, but onboarding remained confusing. Support volume fell after the guide shipped.");
await page.getByLabel("After text").fill("- Launch growth: 42%\n- Risk: confusing onboarding\n- Support volume fell after the guide");
await page.screenshot({ path: path.join(out, "02-text-pair.png"), fullPage: true });

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=", "base64");
const inputs = page.locator('input[type="file"]');
await inputs.nth(0).setInputFiles({ name: "before.png", mimeType: "image/png", buffer: png });
await inputs.nth(1).setInputFiles({ name: "after.png", mimeType: "image/png", buffer: png });
await page.screenshot({ path: path.join(out, "03-image-pair.png"), fullPage: true });

await page.locator(".ba-slot").first().getByRole("button", { name: "Draw", exact: true }).click();
const canvas = page.getByLabel("Drawing area").first();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + 20, box.y + 70);
await page.mouse.down();
await page.mouse.move(box.x + 100, box.y + 30, { steps: 5 });
await page.mouse.move(box.x + 180, box.y + 90, { steps: 5 });
await page.mouse.up();
await page.screenshot({ path: path.join(out, "04-drawing-mixed-pair.png"), fullPage: true });

await page.getByRole("button", { name: "Infer transformation" }).click();
await page.getByLabel("Inferred transformation preview").waitFor();
await page.screenshot({ path: path.join(out, "05-inference-alternatives.png"), fullPage: true });

await page.getByRole("button", { name: /Formatting only/ }).click();
await page.getByLabel("Name").fill("Faithful bullet formatter");
await page.getByRole("button", { name: "Use this" }).click();
await page.locator("[data-output-spec-editor]").waitFor();
await page.screenshot({ path: path.join(out, "06-editable-output-spec.png"), fullPage: true });
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(out, "07-saved-function-rack.png"), fullPage: true });

const narrow = await browser.newPage();
await prepare(narrow, { width: 390, height: 844 });
await narrow.getByLabel("Before text").fill("Raw note");
await narrow.getByLabel("After text").fill("Clean note");
await narrow.screenshot({ path: path.join(out, "08-narrow.png"), fullPage: true });

const errorPage = await browser.newPage();
await errorPage.setViewportSize({ width: 1100, height: 820 });
await errorPage.addInitScript(() => {
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
    version: 1, identity: "Audit user", role: "Reviewer", goals: [],
    preferences: { autonomy: "preview-complex" }, references: { lenses: [], generators: [], paths: [] },
    actions: [], interviewComplete: true, interviewPaused: false,
  }));
});
await errorPage.route("**/api/infer-transformation", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Model unavailable; retry when the connection is restored" }) }));
await errorPage.goto("http://localhost:5173/?learn=before-after");
await errorPage.getByTitle("Close").click().catch(() => {});
await errorPage.getByLabel("Before text").fill("Before");
await errorPage.getByLabel("After text").fill("After");
await errorPage.getByRole("button", { name: "Infer transformation" }).click({ force: true });
await errorPage.getByRole("alert").waitFor();
await errorPage.screenshot({ path: path.join(out, "09-retryable-error.png"), fullPage: true });

const companionPage = await browser.newPage();
await companionPage.setViewportSize({ width: 1280, height: 900 });
await companionPage.addInitScript(() => {
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
    version: 1, identity: "Audit user", role: "Reviewer", goals: [],
    preferences: { autonomy: "act-immediately" }, references: { lenses: [], generators: [], paths: [] },
    actions: [], interviewComplete: true, interviewPaused: false,
  }));
});
await companionPage.goto("http://localhost:5173/");
const companionInput = companionPage.getByLabel("Companion request");
if (!(await companionInput.isVisible().catch(() => false))) {
  await companionPage.getByTitle("Ask the companion").click();
}
await companionInput.fill("make a lens from this before and after");
await companionInput.press("Enter");
await companionPage.locator("[data-before-after-editor]").waitFor();
await companionPage.screenshot({ path: path.join(out, "11-companion.png"), fullPage: true });

await browser.close();

const extensionPath = path.join(root, "extension/dist/chrome");
const staticServer = createServer(async (request, response) => {
  const relative = new URL(request.url, "http://localhost").pathname.replace(/^\/+/, "") || "sidepanel.html";
  try {
    const body = await fs.readFile(path.join(extensionPath, relative));
    response.setHeader("content-type", relative.endsWith(".js") ? "text/javascript" : relative.endsWith(".css") ? "text/css" : "text/html");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end("not found");
  }
});
await new Promise((resolve) => staticServer.listen(9321, resolve));
const extensionBrowser = await chromium.launch({ headless: true });
const extensionPage = await extensionBrowser.newPage();
await extensionPage.addInitScript(() => {
  const session = { fragments: [{ id: "f", quote: "Explicitly captured page text", provenance: { title: "Audit page", origin: "audit.local" } }], queue: [], generator: null, results: [] };
  globalThis.chrome = {
    runtime: { sendMessage: async (message) => ({ ok: true, value: message.type === "get-session" ? session : message.type === "auth-status" ? { authenticated: false } : message.type.includes("library") ? { operators: [], generators: [] } : session }) },
    storage: {
      local: { get: (_keys, callback) => callback({ onboardingComplete: true, onboardingMode: "local" }), set: () => {} },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  };
});
await extensionPage.goto("http://localhost:9321/sidepanel.html");
await extensionPage.getByRole("button", { name: "Learn from before/after" }).click();
await extensionPage.screenshot({ path: path.join(out, "10-extension.png"), fullPage: true });
await extensionBrowser.close();
await new Promise((resolve) => staticServer.close(resolve));

await fs.writeFile(path.join(out, "audit-results.json"), JSON.stringify({
  passed: true,
  flows: ["empty", "text", "image", "drawing", "mixed", "inference alternatives", "editable output spec", "saved function", "narrow", "retryable error", "extension", "companion execution"],
  modelNetwork: "Inference response mocked for deterministic visual audit; server integration is covered separately.",
  privateExamples: "Excluded from public packs by default.",
}, null, 2));
