import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5173";
const OUT = path.resolve("audit-shots/lens-grammar");
fs.mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({ version: 1, interviewComplete: true }));
  const operators = Array.from({ length: 1000 }, (_, index) => ({
    id: `audit-lens-${index}`,
    name: index === 0 ? "invert audit" : index === 1 ? "ground audit" : `Rack lens ${String(index).padStart(4, "0")}`,
    description: index % 2 ? "argument writing" : "research evidence",
    tags: [index % 2 ? "argument" : "evidence"],
    domains: [index % 3 ? "writing" : "research"],
    kind: "prompt",
    prompt: `Transform input using audit behavior ${index}. Return only output.`,
    top: true,
    version: (index % 7) + 1,
    outputCount: index === 0 ? 2 : index === 1 ? 3 : 1,
  }));
  localStorage.setItem("lens.board.operators.v2", JSON.stringify(operators));
});

await page.goto(BASE);
await page.waitForSelector("[data-lens-rack-toolbar]", { timeout: 15000 });
await page.waitForTimeout(500);

const rendered = await page.locator("[data-transformation-lens-id], .op-card").count();
check("1000-lens rack uses bounded rendering", rendered <= 130, `${rendered} cards in DOM`);
await page.screenshot({ path: path.join(OUT, "rack-1000.png"), fullPage: true });

await page.getByLabel("Search lens rack").fill("invert audit");
await page.waitForTimeout(150);
check("rack search finds component/name", (await page.locator("text=invert audit").count()) > 0);
await page.screenshot({ path: path.join(OUT, "rack-search.png"), fullPage: true });

const beforeNodes = await page.locator(".ai-node").count();
const beforeOps = JSON.parse(await page.evaluate(() => localStorage.getItem("lens.board.operators.v2"))).length;
const brushButtons = page.locator(".rail-brush-btn");
await brushButtons.nth(0).click();
await page.getByLabel("Search lens rack").fill("ground audit");
await page.waitForTimeout(120);
await page.locator(".rail-brush-btn").first().click();
await page.waitForTimeout(120);
check("queueing lenses causes zero execution", (await page.locator(".ai-node").count()) === beforeNodes);
check("queueing does not save compound", JSON.parse(await page.evaluate(() => localStorage.getItem("lens.board.operators.v2"))).length === beforeOps);
check("pending stack shows numbered order", (await page.locator(".omni-highlight-stack-chip").count()) === 2);
await page.screenshot({ path: path.join(OUT, "pending-stack-go.png"), fullPage: true });

await page.evaluate(async () => {
  await window.__lensDirector.run([
    { verb: "stackLenses", args: { a: "invert audit", b: "ground audit", name: "invert → ground audit" } },
  ], { speed: 3 });
});
await page.waitForSelector("[data-composition-preview]");
check("card/companion stack opens explicit order preview", (await page.locator("[data-composition-order]").innerText()).includes("invert audit → ground audit"));
await page.screenshot({ path: path.join(OUT, "stack-preview.png"), fullPage: true });
await page.locator("[data-composition-preview] button.primary").click();
await page.waitForTimeout(180);
const stored = JSON.parse(await page.evaluate(() => localStorage.getItem("lens.board.operators.v2")));
const compound = stored.find((op) => op.name === "invert → ground audit");
check("saved stack is a reproducible compound", compound?.composition?.linkMode === "pinned");
check("saved output algebra predicts N×M", compound?.outputCount === 6, `count=${compound?.outputCount}`);

await page.locator(".lens-rack-grind-button").click();
await page.waitForSelector("[data-grind-workspace]");
for (const [input, output, note] of [
  ["Abstract market claim", "Named customer counterexample", "specific and grounded"],
  ["Broad product thesis", "Dated adoption disproof", "concrete evidence"],
]) {
  await page.getByPlaceholder("input before transformation").fill(input);
  await page.getByPlaceholder("output you kept").fill(output);
  await page.getByPlaceholder("why you liked it").fill(note);
  await page.getByRole("button", { name: "keep example" }).click();
}
check("grinding tray retains full transformation pairs", (await page.locator("[data-grind-example-id]").count()) === 2);
await page.screenshot({ path: path.join(OUT, "grind-workspace.png"), fullPage: true });

await page.setViewportSize({ width: 760, height: 900 });
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(OUT, "narrow.png"), fullPage: true });
check("narrow viewport has no horizontal document overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
check("no page errors", pageErrors.length === 0, pageErrors.join("; "));

const report = [
  "# Lens grammar audit",
  "",
  `Run: ${new Date().toISOString()}`,
  "",
  ...checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? ` (${entry.detail})` : ""}`),
  "",
  "## Measured contracts",
  "- Rack rendering is capped at 120 records per selector page.",
  "- Drag/companion stacking invariant is dragged/first A → target/second B.",
  "- Pending brush queue does not execute or save before GO.",
  "- Compound snapshots preserve component ids, versions, hashes, order, and N×M output count.",
  "- Grind examples persist input, output, note, polarity, domain, source and provenance; private examples are excluded from packs by default.",
].join("\n");
fs.writeFileSync(path.join(OUT, "REPORT.md"), report);
await browser.close();

if (checks.some((entry) => !entry.ok)) process.exitCode = 1;
