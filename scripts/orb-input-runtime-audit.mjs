import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const evidence = path.resolve(process.env.AUDIT_OUT || "audit-shots/orb-parity-visual-refinement-2026-07/after");
fs.mkdirSync(evidence, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/run", (route) => route.fulfill({
  contentType: "application/json",
  body: JSON.stringify({
    outputs: [JSON.stringify({
      version: 1,
      title: "create note from orb request",
      root: {
        kind: "action",
        id: "orb-note",
        capability: "spawnText",
        args: { text: "Orb-created persisted evidence" },
      },
    })],
  }),
}));
await page.addInitScript(() => {
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
});

const storedItems = () => page.evaluate(() =>
  JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]")
);
const submitOrbRequest = async () => {
  const orb = page.locator(".companion-orb");
  if (await page.getByLabel("Tell the orb your goal").count() === 0) await orb.click();
  await page.getByLabel("Tell the orb your goal").fill("put this idea on paper");
  await page.getByRole("button", { name: "Run", exact: true }).click();
};

try {
  await page.goto(`${baseUrl}/scene/orb-effect-audit`, { waitUntil: "networkidle" });
  await submitOrbRequest();
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]")
      .some((item) => item.text === "Orb-created persisted evidence")
  );
  await page.waitForFunction(() => document.querySelector(".companion-orb-shell")?.dataset.orbState === "completed");
  await page.waitForTimeout(700);
  const first = await storedItems();
  await page.screenshot({ path: path.join(evidence, "orb-command-effect.png"), fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  const afterReload = await storedItems();
  await submitOrbRequest();
  await page.waitForFunction((count) =>
    JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length > count,
  afterReload.length);
  await page.waitForFunction(() => document.querySelector(".companion-orb-shell")?.dataset.orbState === "completed");
  const undoButton = page.locator(".orb-ledger").getByRole("button", { name: "Undo", exact: true });
  const undoRect = await undoButton.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewport: { width: innerWidth, height: innerHeight } };
  });
  if (undoRect.x < 0 || undoRect.y < 0 || undoRect.x + undoRect.width > undoRect.viewport.width || undoRect.y + undoRect.height > undoRect.viewport.height) {
    throw new Error(`orb Undo control is outside viewport: ${JSON.stringify(undoRect)}`);
  }
  await undoButton.click();
  await page.waitForFunction((count) =>
    JSON.parse(localStorage.getItem("lens.board.items.v1") || "[]").length === count,
  afterReload.length);
  const afterUndo = await storedItems();

  const result = {
    version: 1,
    generatedAt: new Date().toISOString(),
    inputPath: "visible Scene orb input",
    planner: "controlled typed plan through production planner boundary",
    canonicalCapability: "spawnText",
    firstEffect: {
      itemCount: first.length,
      stableId: first.at(-1)?.id || null,
      text: first.at(-1)?.text || null,
    },
    persistedAfterRefresh: afterReload.some((item) => item.id === first.at(-1)?.id),
    noDuplicateOnRefresh: afterReload.length === first.length,
    undoThroughOrbControl: afterUndo.length === afterReload.length,
    runtimeBridge: await page.evaluate(() => Boolean(window.__lensOrbRuntime?.run)),
    errors,
    status: "passed",
  };
  if (!result.persistedAfterRefresh || !result.noDuplicateOnRefresh || !result.undoThroughOrbControl || errors.length) {
    result.status = "failed";
    process.exitCode = 1;
  }
  fs.writeFileSync(path.join(evidence, "orb-input-runtime.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Orb visible-input effect audit ${result.status}.`);
} finally {
  await browser.close();
}
