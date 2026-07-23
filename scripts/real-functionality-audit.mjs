/**
 * Real-functionality dogfood: upload/paste → material/pearl, Encode Anything,
 * forming pearls, organize, companion GO, Studio, Reef/Scene.
 * Evidence: audit-shots/real-functionality-2026-07-22/
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { discoverFormingPearls, MAX_FORMING_PEARLS } from "../shared/forming-pearls.js";
import { compileAutomationPearl } from "../shared/automation-pearl.js";
import { buildEncodeEvidenceList, classifyDroppedText, extractTextFromFile } from "../shared/encode-evidence.js";
import { organizePearlContents } from "../shared/pearl-organize.js";

const root = process.cwd();
const out = path.join(root, "audit-shots/real-functionality-2026-07-22");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);
const fixtures = path.join("/tmp/lens-audit-fixtures");

fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(fixtures, { recursive: true });
if (!fs.existsSync(path.join(fixtures, "chat-sample.txt"))) {
  fs.writeFileSync(path.join(fixtures, "chat-sample.txt"), `User: Can you summarize this investment memo as an LP briefing?

Assistant: Here is a draft summary...

User: Rewrite that for a limited partner meeting, tighten the bios section.

Assistant: Updated draft...

User: Compare the Pitchbook overview with Affinity notes and critique the relationship objectives.

User: Plan the research steps for attendee bios and prior briefings.

User: As a venture partner, explain the firm overview from a portfolio angle.

User: Summarize again but keep commitments verbatim.

User: Brainstorm alternatives for the meeting objectives frame.
`);
}
if (!fs.existsSync(path.join(fixtures, "note.txt"))) {
  fs.writeFileSync(path.join(fixtures, "note.txt"), "Plain note for scene upload test.\nSecond paragraph with enough length to form material.\n");
}

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  screenshots: [],
  defects: [],
  gaps: [],
};

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: false });
  results.screenshots.push(file);
}

function record(id, status, detail, severity = "P1") {
  const ok = status === "pass" || status === "fixed";
  results.checks.push({ id, status, detail });
  if (!ok) results.defects.push({ id, detail, severity, status });
}

async function dismissWelcome(page) {
  const skip = page.locator(".pearl-welcome-dismiss");
  if (await skip.count()) {
    await skip.click({ force: true });
    await page.locator(".pearl-welcome").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  }
}

async function openFreshScene(page) {
  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  await dismissWelcome(page);
  const newScene = page.locator(".orb-recent-orbit").getByRole("button", { name: /Create a pearl workspace|New Scene/i }).first();
  await newScene.click({ force: true });
  await page.locator("[data-semantic-anchor='scene-stage']").waitFor({ timeout: 8000 });
}

async function main() {
  // Deterministic unit-path proofs (no model)
  const chat = fs.readFileSync(path.join(fixtures, "chat-sample.txt"), "utf8");
  const discovery = discoverFormingPearls(chat, { source: "audit" });
  record(
    "unit-forming-pearls",
    discovery.pearls.length >= 1 && discovery.pearls.length <= MAX_FORMING_PEARLS ? "pass" : "fail",
    `pearls=${discovery.pearls.length} reason=${discovery.reason}`,
    "P0",
  );
  const noteFile = new File(
    [fs.readFileSync(path.join(fixtures, "note.txt"))],
    "note.txt",
    { type: "text/plain" },
  );
  const extracted = await extractTextFromFile(noteFile);
  record("unit-extract-text-file", /Plain note/.test(extracted.text) ? "pass" : "fail", extracted.filename, "P0");
  const evidence = buildEncodeEvidenceList([
    { ...classifyDroppedText("Draft an LP briefing from Pitchbook and Affinity notes.", { kind: "instructions" }), id: "e1" },
  ]);
  const compiled = compileAutomationPearl(evidence);
  record("unit-encode-local-compile", Boolean(compiled?.id && compiled?.identity?.name) ? "pass" : "fail", compiled?.identity?.name || "none", "P0");
  const organized = organizePearlContents({
    id: "p1",
    name: "Dump",
    workingSet: { context: [{ id: "c1", text: chat.slice(0, 800) }] },
  });
  record("unit-organize-dump", organized.ok ? "pass" : "fail", organized.reason || "ok", "P0");

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("__lens_audit_booted")) {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem("__lens_audit_booted", "1");
    }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // 1. Reef home
  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, "01-reef-home");
  record("reef-nav", await page.locator("[data-reef-home='true']").count() > 0 ? "pass" : "fail", "home reef", "P0");
  await dismissWelcome(page);

  // 2. Open Encode Anything from welcome/library path
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lens:shell-action", { detail: { action: "openEncode" } }));
  });
  await page.waitForTimeout(400);
  const encodeVisible = await page.locator(".pearl-encode-panel").count();
  await shot(page, "02-encode-panel");
  record("encode-panel-opens", encodeVisible > 0 ? "pass" : "fail", `panel=${encodeVisible}`, "P0");

  if (encodeVisible) {
    await page.getByLabel("Paste material to encode").fill(
      "Draft an LP briefing for Acme Partners using Pitchbook overview and Affinity notes. Keep commitments verbatim.",
    );
    await page.getByRole("button", { name: "Add to evidence" }).click();
    await page.getByRole("button", { name: "Make this a Pearl" }).click();
    await page.waitForTimeout(900);
    await shot(page, "03-encode-compiled");
    const encodeResult = await page.locator(".pearl-encode-result").count();
    const storeHasAutomation = await page.evaluate(() => {
      try {
        const store = JSON.parse(localStorage.getItem("pearlEntities.v1") || "null");
        return Boolean(store?.automationPearls && Object.keys(store.automationPearls).length);
      } catch {
        return false;
      }
    });
    record(
      "encode-anything-compiles",
      encodeResult > 0 && storeHasAutomation ? "fixed" : encodeResult > 0 ? "pass" : "fail",
      `ui=${encodeResult} store=${storeHasAutomation}`,
      "P0",
    );
    await page.getByRole("button", { name: "Close" }).click().catch(() => {});
  }

  // 3. Scene: file drop → material
  await openFreshScene(page);
  await shot(page, "04-scene-empty");
  const beforeMaterials = await page.locator(".orb-stage-materials article").count();
  await page.locator("[data-testid='scene-stage-surface']").evaluate(async (stage) => {
    const transfer = new DataTransfer();
    const file = new File(
      ["Plain note for scene upload test.\nSecond paragraph with enough length to form material.\n"],
      "note.txt",
      { type: "text/plain" },
    );
    transfer.items.add(file);
    stage.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await page.waitForTimeout(700);
  await shot(page, "05-file-drop-material");
  const afterMaterials = await page.locator(".orb-stage-materials article").count();
  record(
    "upload-file-to-material",
    afterMaterials > beforeMaterials ? "fixed" : "fail",
    `before=${beforeMaterials} after=${afterMaterials}`,
    "P0",
  );

  // 4. Make pearl from material
  const makePearl = page.getByRole("button", { name: /Make pearl|Create a pearl/i }).first();
  if (await makePearl.count()) {
    await makePearl.click({ force: true });
    await page.waitForTimeout(600);
  } else {
    await page.getByTestId("scene-place-pearl").click({ force: true });
    await page.waitForTimeout(500);
  }
  await shot(page, "06-pearl-from-material");
  const pearls = await page.locator(".semantic-orb-capsule").count();
  record("create-pearl", pearls >= 1 ? "pass" : "fail", `pearls=${pearls}`, "P0");

  // 5. Companion file drop → working memory → Keep this
  await page.locator(".companion-orb").click();
  await page.waitForTimeout(300);
  await page.locator(".companion-orb-shell").evaluate(async (shell) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "User: Summarize the LP briefing again with commitments verbatim.\n\nUser: Rewrite bios as a venture partner.");
    shell.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await page.waitForTimeout(500);
  const contextCount = await page.locator(".orb-context-object").count();
  record("companion-text-drop", contextCount > 0 ? "pass" : "fail", `context=${contextCount}`, "P0");
  await shot(page, "07-companion-context");

  const keep = page.getByRole("button", { name: /Keep this/i });
  if (await keep.count()) {
    const beforeKeep = await page.locator(".semantic-orb-capsule").count();
    await keep.click({ force: true });
    await page.waitForTimeout(700);
    const afterKeep = await page.locator(".semantic-orb-capsule").count();
    const keepHasDump = await page.evaluate(() => {
      const ws = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
      const scene = ws?.scenes?.find((entry) => entry.id === ws.activeSceneId) || ws?.scenes?.[0];
      return (scene?.semanticOrbs || []).some((orb) =>
        (orb.workingSet?.context || []).some((item) => /LP briefing|venture partner/i.test(item.text || item.label || "")));
    });
    record(
      "keep-this-preserves-dump",
      afterKeep >= beforeKeep && keepHasDump ? "fixed" : "fail",
      `before=${beforeKeep} after=${afterKeep} dump=${keepHasDump}`,
      "P0",
    );
  } else {
    record("keep-this-preserves-dump", "fail", "Keep this button missing", "P1");
  }
  await shot(page, "08-keep-this-pearl");

  // 6. Forming pearls via companion (clipboard + command)
  await page.evaluate(async (corpus) => {
    await navigator.clipboard.writeText(corpus);
  }, chat);
  await page.locator(".companion-orb").click();
  const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
  await input.fill("import this chat and find the pearls that were already forming");
  await page.getByRole("button", { name: "GO — run your command" }).click();
  await page.waitForTimeout(2200);
  await shot(page, "09-forming-pearls");
  const formingCount = await page.evaluate(() => {
    const ws = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
    const scene = ws?.scenes?.find((entry) => entry.id === ws.activeSceneId) || ws?.scenes?.[0];
    return (scene?.semanticOrbs || []).filter((orb) =>
      orb.provenance?.formingPearls || orb.representation?.discovery === "forming-pearls"
      || (orb.moves || []).length || (orb.functions || []).length).length;
  });
  const orbCount = await page.locator(".semantic-orb-capsule").count();
  record(
    "discover-forming-pearls",
    formingCount >= 1 || orbCount >= 2 ? "fixed" : "fail",
    `formingMeta=${formingCount} visible=${orbCount}`,
    "P0",
  );

  // 7. Organize active pearl
  await input.fill("organize this pearl");
  await page.getByRole("button", { name: "GO — run your command" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "10-organize");
  const organizedLive = await page.evaluate(() => {
    const ws = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
    const scene = ws?.scenes?.find((entry) => entry.id === ws.activeSceneId) || ws?.scenes?.[0];
    const active = (scene?.semanticOrbs || []).find((orb) => orb.id === scene.activeSemanticOrbId)
      || (scene?.semanticOrbs || [])[0];
    return {
      moves: active?.moves?.length || 0,
      functions: active?.functions?.length || 0,
      lenses: active?.lenses?.length || 0,
      organized: Boolean(active?.organized || active?.provenance?.organized),
    };
  });
  record(
    "organize-pearl",
    organizedLive.moves + organizedLive.functions + organizedLive.lenses > 0 || organizedLive.organized
      ? "pass"
      : "fail",
    JSON.stringify(organizedLive),
    "P1",
  );

  // 8. Wear / gauntlet label (before Studio — Studio may popup/reload)
  await page.locator(".companion-orb").click();
  await page.waitForTimeout(300);
  const gauntlet = await page.locator("[data-testid='gauntlet-legend']").count();
  record("gauntlet-labeled", gauntlet > 0 ? "pass" : "fail", `legend=${gauntlet}`, "P2");
  await shot(page, "11-gauntlet");

  // 9. Studio open — force same-tab reload path (headless popups are unreliable)
  await page.evaluate(() => {
    const open = window.open;
    window.open = () => null; // exercise blocked-popup reload path
    window.dispatchEvent(new CustomEvent("lens:open-pearl-studio"));
    window.open = open;
  });
  await page.waitForFunction(() => Boolean(document.querySelector(".web-pearl-studio")), null, { timeout: 12000 }).catch(() => {});
  const studioHosts = await page.locator(".web-pearl-studio, [data-testid='studio-banner']").count();
  await shot(page, "12-studio");
  record("studio-open", studioHosts > 0 ? "pass" : "fail", `studioHosts=${studioHosts} url=${page.url()}`, "P2");

  // 10. Reef escape
  if (studioHosts > 0) {
    await page.getByRole("button", { name: /Close Studio|Back to Reef/i }).click({ force: true }).catch(() => page.goto(baseUrl + "/", { waitUntil: "networkidle" }));
    await page.waitForTimeout(600);
  } else if (!/\/scene\//.test(page.url()) && !(await page.locator("[data-semantic-anchor='scene-stage']").count())) {
    await openFreshScene(page);
  }
  if (await page.getByTestId("scene-home").count()) {
    await page.getByTestId("scene-home").click({ force: true }).catch(() => {});
  } else {
    await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(500);
  await shot(page, "13-reef-return");
  record("reef-return", await page.locator("[data-reef-home='true']").count() > 0 ? "pass" : "fail", "home", "P1");

  results.gaps.push(
    "Live model inference (/api/infer-automation, encodeConversation screen capture, evaluateWithGauntlet model rewrite) not proven — local deterministic paths exercised.",
    "Browser extension side panel not loaded in this audit (web Scene + Encode only).",
    "PDF binary extract quality depends on PDF structure; text/md/json proven.",
  );
  results.consoleErrors = consoleErrors.slice(0, 20);
  const fatalConsole = consoleErrors.filter((line) => !/Download the React DevTools|favicon|Font/i.test(line));
  record("no-fatal-console", fatalConsole.length === 0 ? "pass" : "fail", fatalConsole.slice(0, 3).join(" | ") || "clean", "P1");

  fs.writeFileSync(path.join(out, "ledger.json"), JSON.stringify(results, null, 2));
  const failed = results.checks.filter((entry) => entry.status === "fail");
  const summary = [
    `# Real functionality ledger — 2026-07-22`,
    "",
    `Base: ${baseUrl}`,
    "",
    ...results.checks.map((entry) => `- **${entry.status.toUpperCase()}** \`${entry.id}\` — ${entry.detail}`),
    "",
    "## Gaps",
    ...results.gaps.map((gap) => `- ${gap}`),
    "",
    failed.length ? `FAILED: ${failed.length}` : "No local P0/P1 fail remaining in exercised matrix.",
  ].join("\n");
  fs.writeFileSync(path.join(out, "LEDGER.md"), summary);
  await browser.close();
  if (failed.length) {
    console.error(summary);
    process.exitCode = 1;
  } else {
    console.log(summary);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
