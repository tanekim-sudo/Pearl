/**
 * Headed proof: Pearl Studio remounts original LensTreeEditor via bridge.
 * Seeds investor scaffold → opens Studio (full remount) → Open original Function editor → PNG.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildInvestorRolePearlScaffold } from "../shared/role-pearl-scaffold.js";
import { createPearlEntity } from "../shared/pearl-entity.js";
import { createSemanticOrb } from "../shared/semantic-orbs.js";
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
  // Seed before first document boot so main.jsx Studio path can read the pearl.
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
  await page.waitForSelector("[data-testid='studio-function-moves'], .web-pearl-studio", { timeout: 25_000 });
  await page.screenshot({ path: join(outDir, "f01-studio-moves.png"), fullPage: true });
  notes.push("f01: Studio Functions=ordered Moves list visible");

  const openBtn = page.locator("[data-testid='studio-open-lens-tree-editor']");
  if (!(await openBtn.count())) {
    await page.locator("[data-testid='studio-function'] button, .pearl-fn-moves__fn-head").first().click();
  }
  await page.waitForSelector("[data-testid='studio-open-lens-tree-editor']", { timeout: 8_000 });
  await openBtn.first().click();
  await page.waitForSelector(".fn-editor, .fn-editor-fullscreen, .fn-flow-main", { timeout: 12_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, "f02-original-lens-tree-editor.png"), fullPage: true });

  const editorText = await page.locator("body").innerText();
  const hasMoves = /Frame the thesis|Assess market|Write recommendation|Investment memo/i.test(editorText);
  const hasEditor = (await page.locator(".fn-editor, .fn-editor-fullscreen, .fn-flow-card, .fn-flow-main").count()) > 0;
  notes.push(hasEditor && hasMoves
    ? "f02 PASS: original LensTreeEditor mounted with named Moves"
    : `f02 FAIL: editor=${hasEditor} namedMoves=${hasMoves} text=${editorText.slice(0, 280)}`);

  writeFileSync(join(outDir, "notes.json"), JSON.stringify({ ok: hasEditor && hasMoves, notes }, null, 2));
  console.log(JSON.stringify({ ok: hasEditor && hasMoves, notes, outDir }, null, 2));
  if (!(hasEditor && hasMoves)) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
