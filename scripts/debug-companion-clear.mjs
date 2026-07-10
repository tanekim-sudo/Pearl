/**
 * End-to-end verification for the companion's destructive administrative
 * fast path. Expects the dev app at AUDIT_URL or http://localhost:5173.
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.AUDIT_URL || "http://localhost:5173";
const OUT = "audit-shots";
const COMMAND =
  "delete all the functions in my current function tab as well as all the generators and delete every single thing that's in my whiteboard as well as in my AI space";

fs.mkdirSync(OUT, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

async function stored(page, key, fallback) {
  return page.evaluate(
    ([storageKey, defaultValue]) =>
      JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(defaultValue)),
    [key, fallback]
  );
}

async function sendCommand(page) {
  const input = page.locator(".companion-input");
  await input.fill(COMMAND);
  const started = Date.now();
  await input.press("Enter");
  await page.getByTestId("companion-clear-confirmation").waitFor({ state: "visible", timeout: 10_000 });
  return Date.now() - started;
}

async function main() {
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (error) => console.error("[pageerror]", error.message));

  await page.goto(BASE);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("lens.onboarded.v1", "1");
    localStorage.setItem("lens.tour.v1", "1");
    localStorage.setItem(
      "lens.board.items.v1",
      JSON.stringify([
        { id: "paper-1", type: "text", text: "seeded whiteboard note", x: 120, y: 140, w: 260, pageId: "page-1" },
        { id: "paper-2", type: "text", text: "linked note", x: 460, y: 280, w: 220, pageId: "page-1" },
        { id: "link-1", type: "link", fromId: "paper-1", toId: "paper-2" },
      ])
    );
    localStorage.setItem(
      "lens.artifact.v1",
      JSON.stringify({ text: "legacy artifact must not resurrect", objects: [] })
    );
    localStorage.setItem(
      "lens.seeds.v2",
      JSON.stringify([{ id: "legacy-seed", text: "legacy seed must not resurrect" }])
    );
    localStorage.setItem(
      "lens.ai.nodes.v1",
      JSON.stringify([{ id: "ai-1", label: "seeded AI thought", text: "seeded AI thought", x: 80, y: 80 }])
    );
    localStorage.setItem(
      "lens.board.operators.v2",
      JSON.stringify([
        {
          id: "user-lens-1",
          name: "seeded user lens",
          kind: "prompt",
          prompt: "Transform.",
          top: true,
        },
      ])
    );
    localStorage.setItem(
      "lens.transformation-repos.v1",
      JSON.stringify([{ id: "user-lens-1", opId: "user-lens-1", name: "seeded user lens", moveIds: ["user-lens-1"] }])
    );
    localStorage.setItem(
      "lens.lenses.v2",
      JSON.stringify([{ id: "generator-1", title: "seeded generator", kind: "idea", items: [], savedAt: Date.now() }])
    );
  });
  await page.reload();
  const companionFab = page.getByRole("button", { name: /ask the companion/i });
  if (await companionFab.isVisible().catch(() => false)) await companionFab.click();
  await page.locator(".companion-input").waitFor({ state: "visible" });
  const beforeCancel = {
    items: await stored(page, "lens.board.items.v1", []),
    ai: await stored(page, "lens.ai.nodes.v1", []),
    operators: await stored(page, "lens.board.operators.v2", []),
    generators: await stored(page, "lens.lenses.v2", []),
  };
  assert(beforeCancel.items.length === 3, "seeded whiteboard loaded");
  assert(beforeCancel.ai.length === 1, "seeded AI node loaded");
  assert(beforeCancel.operators.some((op) => op.id === "user-lens-1"), "seeded user lens loaded");
  assert(beforeCancel.generators.length === 1, "seeded generator loaded");

  const firstLatency = await sendCommand(page);
  assert(firstLatency < 10_000, `confirmation appeared in ${firstLatency}ms`);
  await page.screenshot({ path: `${OUT}/companion-clear-confirmation.png` });
  await page.getByTestId("companion-clear-cancel").click();

  assert(
    JSON.stringify(await stored(page, "lens.board.items.v1", [])) === JSON.stringify(beforeCancel.items),
    "cancel preserved whiteboard"
  );
  assert(
    JSON.stringify(await stored(page, "lens.ai.nodes.v1", [])) === JSON.stringify(beforeCancel.ai),
    "cancel preserved AI space"
  );
  assert(
    JSON.stringify(await stored(page, "lens.board.operators.v2", [])) === JSON.stringify(beforeCancel.operators),
    "cancel preserved user lens"
  );
  assert(
    JSON.stringify(await stored(page, "lens.lenses.v2", [])) === JSON.stringify(beforeCancel.generators),
    "cancel preserved generators"
  );

  await sendCommand(page);
  await page.getByTestId("companion-clear-confirm").click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length === 0 &&
      JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "[]").length === 0 &&
      JSON.parse(localStorage.getItem("lens.lenses.v2") || "[]").length === 0
  );

  let operators = await stored(page, "lens.board.operators.v2", []);
  assert(!operators.some((op) => op.id === "user-lens-1"), "confirmed clear removed user lenses");
  assert(operators.some((op) => op.primitive && op.name === "compress"), "built-in primitives remained");
  assert((await stored(page, "lens.transformation-repos.v1", [])).length === 0, "lens repos cleared");
  assert(
    await page.evaluate(() => localStorage.getItem("lens.artifact.v1") === null),
    "legacy artifact cache cleared"
  );
  await page.screenshot({ path: `${OUT}/companion-clear-complete.png` });

  await page.reload();
  const reloadedItems = await stored(page, "lens.board.items.v1", []);
  assert(reloadedItems.length === 0, `whiteboard stayed clear after reload (${JSON.stringify(reloadedItems)})`);
  assert(
    !(await page.getByText(/legacy (artifact|seed) must not resurrect/).count()),
    "legacy whiteboard stores did not resurrect"
  );
  assert((await stored(page, "lens.ai.nodes.v1", [])).length === 0, "AI space stayed clear after reload");
  assert((await stored(page, "lens.lenses.v2", [])).length === 0, "generators stayed clear after reload");
  operators = await stored(page, "lens.board.operators.v2", []);
  assert(!operators.some((op) => op.id === "user-lens-1"), "user lenses stayed clear after reload");
  assert(operators.some((op) => op.primitive && op.name === "compress"), "primitives survived reload");
  assert(!(await page.getByText("seeded whiteboard note", { exact: true }).count()), "cleared whiteboard content left the UI");
  assert(!(await page.getByText("seeded generator", { exact: true }).count()), "cleared generator left the UI");

  await browser.close();
  console.log("ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
