import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const out = path.join(process.cwd(), "audit-shots/chat-requirements-integration-audit-2026-07");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:5173";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 920 } });
await page.addInitScript(() => {
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.memory.v1:anonymous", JSON.stringify({
    version: 1, identity: "Adoption auditor", role: "Reviewer", goals: [],
    preferences: { autonomy: "preview-complex" }, references: { lenses: [], generators: [], paths: [] },
    actions: [], interviewComplete: true,
  }));
});
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
const result = await page.evaluate(async () => {
  const { mergeBoardSnapshots } = await import("/lib/board-sync.js");
  const operatorsKey = "lens.board.operators.v2";
  const lensesKey = "lens.lenses.v2";
  const anonymous = { version: 1, keys: {
    [operatorsKey]: [{ id: "move", kind: "prompt", libraryKind: "move", prompt: "Act.", name: "Act" }],
    [lensesKey]: [{ id: "lens", kind: "lens", name: "Evidence", contextPolicy: "bounded", items: [] }],
  } };
  const account = { version: 1, keys: {} };
  const once = mergeBoardSnapshots(anonymous, account);
  const retried = mergeBoardSnapshots(anonymous, once);
  localStorage.setItem("lens.release-adoption-fixture", JSON.stringify(retried));
  return {
    idempotent: JSON.stringify(once) === JSON.stringify(retried),
    operators: retried.keys[operatorsKey].length,
    lenses: retried.keys[lensesKey].length,
  };
});
if (!result.idempotent || result.operators !== 1 || result.lenses !== 1) throw new Error(`adoption duplicate regression: ${JSON.stringify(result)}`);
await page.reload();
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.release-adoption-fixture")));
if (!persisted) throw new Error("adoption fixture did not survive reload");
await page.screenshot({ path: path.join(out, "account-adoption-reload.png"), fullPage: true });
await fs.writeFile(path.join(out, "account-adoption-preservation-report.json"), `${JSON.stringify({ version: 1, result, reloadPersisted: true, screenshot: "account-adoption-reload.png" }, null, 2)}\n`);
await browser.close();
console.log("account adoption preservation audit passed");
