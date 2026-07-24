/**
 * Headed proof: Pearl Studio defaults to original LensTreeEditor (no buried click).
 * Seeds investor scaffold → opens Studio → expects named Moves + drag grips immediately.
 * Then applies canonical reorderStep-backed mutate and confirms world-visible order change.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildInvestorRolePearlScaffold } from "../shared/role-pearl-scaffold.js";
import { createPearlEntity } from "../shared/pearl-entity.js";
import { createSemanticOrb } from "../shared/semantic-orbs.js";
import { mutatePearlFunctionMoves, summarizePearlFunctions } from "../shared/pearl-function-moves.js";
import { PEARL_STORE_KEY } from "../shared/pearl-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../audit-shots/pearl-function-moves-forensics-2026-07-24");
mkdirSync(outDir, { recursive: true });

const server = await createServer({
  configFile: join(__dirname, "../vite.config.js"),
  server: { host: "127.0.0.1", port: 41931, strictPort: true },
});
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");

const scaffold = buildInvestorRolePearlScaffold({ firm: "S32", utterance: "make me an investor pearl" });
const entity = createPearlEntity(createSemanticOrb({ ...scaffold.pearl, id: "forensics-investor-1" }));
const studioRef = "forensics-studio-ref-1";

const browser = await chromium.launch({
  headless: false,
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const notes = [];

try {
  await page.addInitScript(({ storeKey, pearl, ref }) => {
    const store = { version: 1, entities: { [pearl.id]: pearl }, activePearlId: pearl.id, updatedAt: Date.now() };
    localStorage.setItem(storeKey, JSON.stringify(store));
    localStorage.setItem("pearlStudioRefs.v1", JSON.stringify({
      [ref]: { pearlId: pearl.id, createdAt: Date.now(), expiresAt: Date.now() + 10 * 60_000 },
    }));
    sessionStorage.setItem("pearlStudioActiveRef", ref);
    sessionStorage.setItem("pearlStudioActivePearlId", pearl.id);
  }, { storeKey: PEARL_STORE_KEY, pearl: entity, ref: studioRef });

  await page.goto(`${base}/#pearl-studio=${encodeURIComponent(studioRef)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector("[data-testid='studio-lens-tree-editor'], .fn-editor, .fn-flow-main", { timeout: 25_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, "f01-studio-default-editor.png"), fullPage: true });

  const editorText = await page.locator("body").innerText();
  const hasMoves = /Frame the thesis|Assess market|Write recommendation|Investment memo/i.test(editorText);
  const hasEditor = (await page.locator("[data-testid='studio-lens-tree-editor'], .fn-editor, .fn-flow-card, .fn-flow-main").count()) > 0;
  const hasGrips = (await page.locator(".fn-flow-grip, [data-testid='studio-move-grip']").count()) > 0;
  const buriedButton = (await page.locator("[data-testid='studio-open-lens-tree-editor']").count()) > 0;
  const immediate = hasEditor && hasMoves && hasGrips && !buriedButton;
  notes.push(immediate
    ? "f01 PASS: original LensTreeEditor is default primary (named Moves + drag grips, no buried Open button)"
    : `f01 FAIL: editor=${hasEditor} namedMoves=${hasMoves} grips=${hasGrips} buriedBtn=${buriedButton}`);

  const beforeSummary = summarizePearlFunctions(entity).find((fn) => /investment memo/i.test(fn.name));
  const mutated = mutatePearlFunctionMoves(entity, {
    operation: "reorder",
    functionName: "Investment memo",
    from: "last",
    to: "first",
  });
  let reorderOk = false;
  let afterNames = [];
  if (!mutated.ok) {
    notes.push(`f02 FAIL: mutatePearlFunctionMoves ${mutated.reason}`);
  } else {
    const nextEntity = createPearlEntity({
      ...entity,
      ...mutated.patch,
      revision: (entity.revision || 0) + 1,
    });

    await page.evaluate(({ storeKey, pearl }) => {
      const store = JSON.parse(localStorage.getItem(storeKey) || "{}");
      store.entities = { ...(store.entities || {}), [pearl.id]: pearl };
      store.updatedAt = Date.now();
      localStorage.setItem(storeKey, JSON.stringify(store));
      try {
        new BroadcastChannel(`pearl-studio:${pearl.id}`).postMessage({
          revision: pearl.revision,
          entityId: pearl.id,
          reason: "reorder-function-moves",
          reload: true,
        });
      } catch { /* private */ }
      window.dispatchEvent(new CustomEvent("lens:pearl-function-moves-changed", {
        detail: { pearlId: pearl.id, operation: "reorder" },
      }));
    }, { storeKey: PEARL_STORE_KEY, pearl: nextEntity });

    await page.waitForTimeout(1100);
    await page.screenshot({ path: join(outDir, "f02-after-canonical-reorder.png"), fullPage: true });
    afterNames = await page.evaluate(() => [...document.querySelectorAll("[data-testid='studio-move'] b, .fn-flow-card-name b")]
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 8));
    const recommendFirst = /recommend/i.test(afterNames[0] || "");
    const beforeNames = (beforeSummary?.moves || []).map((m) => m.name);
    const orderChanged = afterNames.length >= 2 && afterNames.join("|") !== beforeNames.join("|");
    reorderOk = Boolean(mutated.ok && recommendFirst && orderChanged);
    notes.push(reorderOk
      ? `f02 PASS: canonical reorderStep path last→first world-visible (${afterNames.slice(0, 3).join(" → ")})`
      : `f02 FAIL: afterNames=${afterNames.join("→")} mutatedFirst=${mutated.moves[0]?.name} (UI must show recommendation first)`);
  }

  const ok = Boolean(immediate && reorderOk);
  writeFileSync(join(outDir, "notes.json"), JSON.stringify({
    ok,
    notes,
    before: beforeSummary?.moves?.map((m) => m.name) || [],
    after: mutated.ok ? mutated.moves.map((m) => m.name) : [],
    afterNames,
  }, null, 2));
  console.log(JSON.stringify({ ok, notes, outDir }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
