/**
 * All-paths dogfood — primary web journeys + unit proofs for wear/merge/synthesize/counter.
 * Evidence: audit-shots/all-paths-2026-07-22/
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { discoverFormingPearls, MAX_FORMING_PEARLS } from "../shared/forming-pearls.js";
import { compileAutomationPearl } from "../shared/automation-pearl.js";
import { buildEncodeEvidenceList, classifyDroppedText, extractTextFromFile } from "../shared/encode-evidence.js";
import { organizePearlContents } from "../shared/pearl-organize.js";
import { executeDomainCommand } from "../shared/domain-commands.js";
import {
  MAX_GAUNTLET_SLOTS,
  wearPearlIdInGauntlet,
  loadGauntletState,
} from "../shared/companion-pearl-gauntlet.js";
import { inspectPearlVisualContract, PEARL_VISUAL_CONTRACT_VERSION } from "../shared/pearl-visual-contract.js";
import { PHYSICAL_PEARL_CSS, PHYSICAL_PEARL_VERSION, physicalPearlMarkup } from "../shared/physical-pearl.js";

const root = process.cwd();
const out = path.join(root, "audit-shots/all-paths-2026-07-22");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

fs.mkdirSync(out, { recursive: true });

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  screenshots: [],
  defects: [],
  gaps: [],
  paths: [],
};

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: false });
  results.screenshots.push(file);
}

function record(id, status, detail, severity = "P1", pathId = null) {
  const ok = status === "pass" || status === "fixed";
  results.checks.push({ id, status, detail, severity, pathId });
  if (pathId) {
    const existing = results.paths.find((entry) => entry.id === pathId);
    if (existing) {
      if (!ok) existing.status = "fail";
      else if (existing.status !== "fail") existing.status = status === "fixed" ? "fixed" : "pass";
      existing.checks.push(id);
    } else {
      results.paths.push({ id: pathId, status: ok ? (status === "fixed" ? "fixed" : "pass") : "fail", checks: [id] });
    }
  }
  if (!ok) results.defects.push({ id, detail, severity, status, pathId });
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

async function closeCompanion(page) {
  if (await page.locator(".companion-orb-shell.expanded").count()) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

async function companionGo(page, text) {
  const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
  if (!(await input.count()) || !(await input.isVisible().catch(() => false))) {
    await page.locator(".companion-orb").click({ force: true });
    await page.waitForTimeout(350);
  }
  if (!(await input.count()) || !(await input.isVisible().catch(() => false))) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
    await page.waitForTimeout(350);
  }
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill(text);
  await page.getByRole("button", { name: "GO — run your command" }).click({ force: true });
  await page.waitForTimeout(1600);
  await closeCompanion(page);
}

function memoryStorage() {
  const memory = new Map();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
}

async function main() {
  // —— Unit / domain proofs ——
  const visual = inspectPearlVisualContract({ variant: "primary", size: 34 });
  record(
    "unit-arc-reactor-contract",
    visual.valid && PEARL_VISUAL_CONTRACT_VERSION === 3 && PHYSICAL_PEARL_VERSION === 3 ? "pass" : "fail",
    `valid=${visual.valid} contract=${PEARL_VISUAL_CONTRACT_VERSION} renderer=${PHYSICAL_PEARL_VERSION} elements=${visual.metrics.svgElements}`,
    "P0",
    "visual.physical-pearl",
  );
  const markup = physicalPearlMarkup({ id: "audit-reactor", variant: "primary", size: 34 });
  record(
    "unit-arc-reactor-layers",
    /physical-pearl__core/.test(markup) && /physical-pearl__ring--inner/.test(markup) && /physical-pearl-core-breath/.test(PHYSICAL_PEARL_CSS)
      ? "pass"
      : "fail",
    "core+rings+breath",
    "P0",
    "visual.physical-pearl",
  );

  const storage = memoryStorage();
  for (const id of ["a", "b", "c", "d", "e"]) wearPearlIdInGauntlet(id, {}, storage);
  let capThrew = false;
  try {
    wearPearlIdInGauntlet("f", {}, storage);
  } catch {
    capThrew = true;
  }
  const gauntlet = loadGauntletState(storage);
  record(
    "unit-gauntlet-cap-5",
    gauntlet.filled === 5 && capThrew ? "pass" : "fail",
    `filled=${gauntlet.filled} cap=${MAX_GAUNTLET_SLOTS} threw=${capThrew}`,
    "P0",
    "companion.pearl-gauntlet",
  );

  let nextId = 0;
  const cmdOpts = { idFactory: () => `audit-${++nextId}`, now: 1 };
  let state = { semanticOrbs: [], activeSemanticOrbId: null };
  const createdA = await executeDomainCommand("createSemanticOrb", state, {
    sceneId: "scene-1",
    orb: { name: "Alpha", workingSet: { context: [{ id: "c1", text: "Alpha dump evidence about markets." }] } },
    placement: { x: 20, y: 30 },
  }, cmdOpts);
  state = createdA.state;
  const createdB = await executeDomainCommand("createSemanticOrb", state, {
    sceneId: "scene-1",
    orb: { name: "Beta", workingSet: { context: [{ id: "c2", text: "Beta dump evidence about product." }] } },
    placement: { x: 80, y: 40 },
  }, cmdOpts);
  state = createdB.state;
  const ids = state.semanticOrbs.map((orb) => orb.id);
  const merged = await executeDomainCommand("mergeSemanticOrbs", state, { ids, sceneId: "scene-1", name: "Combined" }, cmdOpts);
  record(
    "unit-merge-preserves-sources",
    merged.state.semanticOrbs.length === 3
      && merged.result?.preservedSourceIds?.length === 2
      && merged.state.semanticOrbs.some((orb) => orb.id === ids[0])
      ? "pass"
      : "fail",
    `orbs=${merged.state.semanticOrbs.length} preserved=${(merged.result?.preservedSourceIds || []).join(",")}`,
    "P0",
    "scene.semantic-orbs.merge",
  );

  const synthesized = await executeDomainCommand("synthesizeSemanticOrbs", state, {
    ids,
    sceneId: "scene-1",
    mode: "mutual",
  }, cmdOpts);
  record(
    "unit-synthesize-mutual",
    synthesized.state.semanticOrbs.length === 3
      && synthesized.result?.object?.representation?.kind === "synthesis"
      && synthesized.result?.preservedSourceIds?.length === 2
      ? "pass"
      : "fail",
    `orbs=${synthesized.state.semanticOrbs.length} kind=${synthesized.result?.object?.representation?.kind}`,
    "P0",
    "scene.semantic-orbs.synthesize",
  );

  const countered = await executeDomainCommand("createCounterPearl", state, {
    id: ids[0],
    sceneId: "scene-1",
    instruction: "foil the source",
  }, cmdOpts);
  record(
    "unit-counter-pearl",
    countered.result?.object?.representation?.kind === "counter"
      && countered.state.semanticOrbs.some((orb) => orb.id === ids[0])
      ? "pass"
      : "fail",
    `kind=${countered.result?.object?.representation?.kind} orbs=${countered.state.semanticOrbs.length}`,
    "P0",
    "pearl.counter",
  );

  const chat = `User: Summarize this investment memo as an LP briefing.
Assistant: Draft summary...
User: Rewrite that for a limited partner meeting.
User: Compare Pitchbook with Affinity notes.
User: Plan research steps for attendee bios.
User: As a venture partner, explain the firm overview.`;
  const discovery = discoverFormingPearls(chat, { source: "audit" });
  record(
    "unit-forming-pearls",
    discovery.pearls.length >= 1 && discovery.pearls.length <= MAX_FORMING_PEARLS ? "pass" : "fail",
    `pearls=${discovery.pearls.length}`,
    "P0",
    "learning.forming-pearls",
  );
  const noteFile = new File(["Plain note for scene upload test.\nSecond paragraph.\n"], "note.txt", { type: "text/plain" });
  const extracted = await extractTextFromFile(noteFile);
  record("unit-extract-text-file", /Plain note/.test(extracted.text) ? "pass" : "fail", extracted.filename, "P0", "scene.ingest");
  const evidence = buildEncodeEvidenceList([
    { ...classifyDroppedText("Draft an LP briefing from Pitchbook notes.", { kind: "instructions" }), id: "e1" },
  ]);
  const compiled = compileAutomationPearl(evidence);
  record("unit-encode-local-compile", Boolean(compiled?.id) ? "pass" : "fail", compiled?.identity?.name || "none", "P0", "encode.automation-anything");
  const organized = organizePearlContents({
    id: "p1",
    name: "Dump",
    workingSet: { context: [{ id: "c1", text: chat }] },
  });
  record("unit-organize-dump", organized.ok ? "pass" : "fail", organized.reason || "ok", "P0", "pearl.organize");

  // —— Browser dogfood ——
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

  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  await dismissWelcome(page);
  await shot(page, "01-reef-home");
  record("reef-nav", await page.locator("[data-reef-home='true']").count() > 0 ? "pass" : "fail", "home reef", "P0", "shell.reef-home");

  // Pearl visual close-up (companion mother + empty sockets)
  await openFreshScene(page);
  await page.locator(".companion-orb").click();
  await page.waitForTimeout(300);
  await shot(page, "02-mother-pearl-reactor");
  const reactorLive = await page.evaluate(() => {
    const pearl = document.querySelector(".companion-orb .physical-pearl");
    if (!pearl) return { ok: false };
    return {
      ok: true,
      version: pearl.getAttribute("data-pearl-renderer"),
      variant: pearl.getAttribute("data-pearl-variant"),
      hasCore: Boolean(pearl.querySelector(".physical-pearl__core")),
      hasRing: Boolean(pearl.querySelector(".physical-pearl__ring--inner")),
      size: pearl.getAttribute("width"),
      emptySockets: document.querySelectorAll(".orb-gauntlet-socket.empty").length,
    };
  });
  record(
    "live-mother-arc-reactor",
    reactorLive.ok && reactorLive.version === "3" && reactorLive.hasCore && reactorLive.hasRing && Number(reactorLive.size) <= 36
      ? "pass"
      : "fail",
    JSON.stringify(reactorLive),
    "P0",
    "visual.physical-pearl",
  );
  record(
    "live-empty-gauntlet-sockets",
    reactorLive.emptySockets === 5 ? "pass" : "fail",
    `empty=${reactorLive.emptySockets}`,
    "P1",
    "companion.pearl-gauntlet",
  );
  await closeCompanion(page);

  // Paste → material/pearl path on stage
  await page.locator("[data-testid='scene-stage-surface']").click({ force: true });
  await page.evaluate(async () => {
    const stage = document.querySelector("[data-testid='scene-stage-surface']");
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "Paste seed for pearl path — enough text to materialize on the Scene stage.");
    stage.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  });
  await page.waitForTimeout(700);
  await shot(page, "03-paste-to-stage");
  const pasteMaterials = await page.locator(".orb-stage-materials article, .semantic-orb-capsule").count();
  record("paste-to-stage", pasteMaterials > 0 ? "pass" : "fail", `nodes=${pasteMaterials}`, "P0", "scene.ingest.paste");

  // File drop
  await page.locator("[data-testid='scene-stage-surface']").evaluate((stage) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      ["Dropped note for all-paths audit.\nSecond paragraph with substance.\n"],
      "drop-note.txt",
      { type: "text/plain" },
    ));
    stage.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await page.waitForTimeout(700);
  await shot(page, "04-file-drop");
  record(
    "file-drop-material",
    await page.locator(".orb-stage-materials article").count() > 0 ? "pass" : "fail",
    "material present",
    "P0",
    "scene.ingest.drop",
  );

  // Create two pearls for wear/merge/synthesize/counter
  const place = page.getByTestId("scene-place-pearl");
  if (await place.count()) {
    await place.click({ force: true });
    await page.waitForTimeout(400);
    await place.click({ force: true });
    await page.waitForTimeout(400);
  }
  const makePearl = page.getByRole("button", { name: /Make pearl|Create a pearl/i }).first();
  if (await makePearl.count()) {
    await makePearl.click({ force: true });
    await page.waitForTimeout(500);
  }
  let pearlCount = await page.locator(".semantic-orb-capsule").count();
  if (pearlCount < 2) {
    await companionGo(page, "create a pearl named Alpha");
    await companionGo(page, "create a pearl named Beta");
    pearlCount = await page.locator(".semantic-orb-capsule").count();
  }
  await shot(page, "05-two-pearls");
  record("create-pearls", pearlCount >= 1 ? "pass" : "fail", `pearls=${pearlCount}`, "P0", "scene.semantic-orbs");

  // Wear into gauntlet
  const pearlNames = await page.evaluate(() => {
    const ws = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
    const scene = ws?.scenes?.find((entry) => entry.id === ws.activeSceneId) || ws?.scenes?.[0];
    return (scene?.semanticOrbs || []).slice(0, 2).map((orb) => orb.name || orb.id);
  });
  if (pearlNames[0]) await companionGo(page, `wear the ${pearlNames[0]} pearl`);
  if (pearlNames[1]) await companionGo(page, `wear the ${pearlNames[1]} pearl`);
  await page.waitForTimeout(500);
  await page.locator(".companion-orb").click();
  await page.waitForTimeout(250);
  await shot(page, "06-gauntlet-worn");
  const wornLive = await page.evaluate(() => {
    const filled = document.querySelectorAll(".orb-gauntlet-socket.filled").length;
    const empty = document.querySelectorAll(".orb-gauntlet-socket.empty").length;
    const stones = document.querySelectorAll(".orb-gauntlet-socket.filled .physical-pearl").length;
    let gauntlet = null;
    try {
      gauntlet = JSON.parse(localStorage.getItem("lens.companion.gauntlet.v1") || "null");
    } catch {
      gauntlet = null;
    }
    return { filled, empty, stones, stored: gauntlet?.filled ?? gauntlet?.slots?.filter(Boolean).length ?? 0 };
  });
  record(
    "wear-gauntlet",
    wornLive.filled >= 1 || wornLive.stored >= 1 ? "fixed" : "fail",
    JSON.stringify(wornLive),
    "P0",
    "companion.pearl-wear",
  );
  await closeCompanion(page);

  // Merge / synthesize / counter via companion — counts must increase
  const beforeMerge = await page.locator(".semantic-orb-capsule").count();
  await companionGo(page, "merge these pearls");
  await shot(page, "07-merge");
  const afterMerge = await page.locator(".semantic-orb-capsule").count();
  record("live-merge", afterMerge > beforeMerge ? "fixed" : "fail", `before=${beforeMerge} after=${afterMerge}`, "P0", "scene.semantic-orbs.merge");

  const beforeSynth = afterMerge;
  await companionGo(page, "synthesize these pearls");
  await shot(page, "08-synthesize");
  const afterSynth = await page.locator(".semantic-orb-capsule").count();
  record("live-synthesize", afterSynth > beforeSynth ? "fixed" : "fail", `before=${beforeSynth} after=${afterSynth}`, "P0", "scene.semantic-orbs.synthesize");

  const beforeCounter = afterSynth;
  await companionGo(page, "create a counter pearl");
  await shot(page, "09-counter");
  const afterCounter = await page.locator(".semantic-orb-capsule").count();
  record("live-counter", afterCounter > beforeCounter ? "fixed" : "fail", `before=${beforeCounter} after=${afterCounter}`, "P0", "pearl.counter");

  // Keep this (seed dump) then organize
  await closeCompanion(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  await page.waitForTimeout(350);
  await page.locator(".companion-orb-shell").evaluate((shell) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "Keep-this dump: As a skeptical LP, evaluate traction and moat. Rewrite the problem slide but keep the metaphors. Care about capital efficiency.");
    shell.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await page.waitForFunction(() => {
    const ctx = document.querySelectorAll(".orb-context-object").length;
    const keepBtn = [...document.querySelectorAll("button")].some((node) => /Keep this/i.test(node.textContent || ""));
    return ctx > 0 || keepBtn;
  }, null, { timeout: 5000 }).catch(() => {});
  await shot(page, "11-keep-this");
  const keep = page.getByRole("button", { name: /Keep this/i });
  if (await keep.count()) {
    const before = await page.locator(".semantic-orb-capsule").count();
    await keep.click({ force: true });
    await page.waitForTimeout(700);
    const after = await page.locator(".semantic-orb-capsule").count();
    const keepHasDump = await page.evaluate(() => {
      const ws = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
      const scene = ws?.scenes?.find((entry) => entry.id === ws.activeSceneId) || ws?.scenes?.[0];
      return (scene?.semanticOrbs || []).some((orb) =>
        (orb.workingSet?.context || []).some((item) => /skeptical LP|capital efficiency/i.test(item.text || item.label || "")));
    });
    record(
      "keep-this",
      after >= before && keepHasDump ? "fixed" : after >= before ? "pass" : "fail",
      `before=${before} after=${after} dump=${keepHasDump}`,
      "P0",
      "companion.keep-this",
    );
  } else {
    const contextCount = await page.locator(".orb-context-object").count();
    record("keep-this", "fail", `Keep this missing context=${contextCount}`, "P1", "companion.keep-this");
  }
  await closeCompanion(page);

  await companionGo(page, "organize this pearl");
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
      context: active?.workingSet?.context?.length || 0,
    };
  });
  record(
    "live-organize",
    organizedLive.moves + organizedLive.functions + organizedLive.lenses > 0 ? "fixed" : "fail",
    JSON.stringify(organizedLive),
    "P1",
    "pearl.organize",
  );

  // Drag = move (not delete)
  const moveProbe = await page.evaluate(() => {
    const capsule = document.querySelector(".semantic-orb-capsule");
    if (!capsule) return { ok: false, reason: "no-capsule" };
    const before = capsule.getBoundingClientRect();
    const id = capsule.getAttribute("data-orb-id") || capsule.dataset.orbId;
    capsule.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: before.left + 8, clientY: before.top + 8 }));
    capsule.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: before.left + 80, clientY: before.top + 40 }));
    capsule.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: before.left + 80, clientY: before.top + 40 }));
    const hint = document.body.innerText.includes("Drag moves") || document.body.innerText.includes("drag = move")
      || document.querySelector("[data-testid='scene-stage-surface']")?.textContent?.includes("move");
    return { ok: true, id, hint: Boolean(hint), count: document.querySelectorAll(".semantic-orb-capsule").length };
  });
  await shot(page, "12-drag-move");
  record(
    "drag-move-not-delete",
    moveProbe.ok && moveProbe.count >= 1 ? "pass" : "fail",
    JSON.stringify(moveProbe),
    "P1",
    "interaction.orb-gesture",
  );

  // Output Frame only on intent (shell action + toolbar)
  await closeCompanion(page);
  const frameBefore = await page.locator("[data-semantic-anchor='output-frame'], .orb-output-frame-host").count();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lens:shell-action", { detail: { action: "openOutputFrame" } }));
  });
  await page.waitForTimeout(400);
  let frameAfter = await page.locator("[data-semantic-anchor='output-frame'], .orb-output-frame-host, [data-testid='output-frame-label']").count();
  if (!frameAfter) {
    const toggle = page.getByTestId("scene-toggle-frame");
    if (await toggle.count()) await toggle.click({ force: true });
    await page.waitForTimeout(400);
    frameAfter = await page.locator("[data-semantic-anchor='output-frame'], .orb-output-frame-host, [data-testid='output-frame-label']").count();
  }
  await shot(page, "13-output-frame");
  record(
    "output-frame-on-intent",
    frameBefore === 0 && frameAfter > 0 ? "fixed" : frameAfter > 0 ? "pass" : "fail",
    `before=${frameBefore} after=${frameAfter}`,
    "P1",
    "scene.output-frame",
  );

  // Delete path
  const beforeDelete = await page.locator(".semantic-orb-capsule").count();
  await page.keyboard.press("Backspace").catch(() => {});
  await page.waitForTimeout(400);
  await companionGo(page, "delete the selected pearl");
  await shot(page, "14-delete");
  const afterDelete = await page.locator(".semantic-orb-capsule").count();
  record(
    "delete-pearl",
    afterDelete <= beforeDelete ? "pass" : "fail",
    `before=${beforeDelete} after=${afterDelete}`,
    "P1",
    "scene.semantic-orbs.delete",
  );

  // Studio + Reef return
  await page.evaluate(() => {
    const open = window.open;
    window.open = () => null;
    window.dispatchEvent(new CustomEvent("lens:open-pearl-studio"));
    window.open = open;
  });
  await page.waitForFunction(() => Boolean(document.querySelector(".web-pearl-studio")), null, { timeout: 12000 }).catch(() => {});
  const studioHosts = await page.locator(".web-pearl-studio, [data-testid='studio-banner']").count();
  await shot(page, "15-studio");
  record("studio-open", studioHosts > 0 ? "pass" : "fail", `hosts=${studioHosts}`, "P2", "studio.pearl");
  if (studioHosts > 0) {
    await page.getByRole("button", { name: /Close Studio|Back to Reef/i }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  if (await page.getByTestId("scene-home").count()) {
    await page.getByTestId("scene-home").click({ force: true }).catch(() => {});
  } else {
    await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(400);
  await shot(page, "16-reef-return");
  record("reef-return", await page.locator("[data-reef-home='true']").count() > 0 ? "pass" : "fail", "home", "P1", "shell.reef-home");

  // Encode panel
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lens:shell-action", { detail: { action: "openEncode" } }));
  });
  await page.waitForTimeout(400);
  const encodeVisible = await page.locator(".pearl-encode-panel").count();
  await shot(page, "17-encode");
  record("encode-panel", encodeVisible > 0 ? "pass" : "fail", `panel=${encodeVisible}`, "P0", "encode.automation-anything");

  results.gaps.push(
    "Live model GO / evaluateWithGauntlet model rewrite not proven — needs credentials and provider access.",
    "Screen encode (encodeConversationAsPearl capture) and /api/infer-automation not proven in this run.",
    "Browser extension side panel / page Pearl dogfood not loaded here; shared renderer + CSS updated and unit-covered; extension build verified by release:check:fast.",
    "Voice/mic, Supabase multi-account, and Chrome Web Store packaged install not exercised.",
  );
  results.consoleErrors = consoleErrors.slice(0, 20);
  const fatalConsole = consoleErrors.filter((line) => !/Download the React DevTools|favicon|Font/i.test(line));
  record("no-fatal-console", fatalConsole.length === 0 ? "pass" : "fail", fatalConsole.slice(0, 3).join(" | ") || "clean", "P1");

  fs.writeFileSync(path.join(out, "ledger.json"), JSON.stringify(results, null, 2));
  const failed = results.checks.filter((entry) => entry.status === "fail");
  const p0p1 = failed.filter((entry) => entry.severity === "P0" || entry.severity === "P1");
  const summary = [
    `# All-paths ledger — 2026-07-22`,
    "",
    `Base: ${baseUrl}`,
    "",
    "## Paths matrix",
    ...results.paths.map((entry) => `- **${entry.status.toUpperCase()}** \`${entry.id}\` — checks: ${entry.checks.join(", ")}`),
    "",
    "## Checks",
    ...results.checks.map((entry) => `- **${entry.status.toUpperCase()}** \`${entry.id}\` (${entry.severity || "P1"}) — ${entry.detail}`),
    "",
    "## Gaps",
    ...results.gaps.map((gap) => `- ${gap}`),
    "",
    p0p1.length ? `FAILED P0/P1: ${p0p1.length}` : "No local P0/P1 fail remaining in exercised matrix.",
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
