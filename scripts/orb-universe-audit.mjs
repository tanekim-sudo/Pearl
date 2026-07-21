import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41737";
const evidence = path.resolve(process.env.AUDIT_OUT || "audit-shots/orb-universe-2026-07");
fs.mkdirSync(evidence, { recursive: true });
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const bundledChrome = chromium.executablePath();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PW_CHROMIUM
    || (fs.existsSync(bundledChrome) ? bundledChrome : fs.existsSync(systemChrome) ? systemChrome : undefined),
});
const results = [];

async function shot(name, viewport, url, setup) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: name.includes("reduced") ? "reduce" : "no-preference",
    forcedColors: name.includes("high-contrast") ? "active" : "none",
    colorScheme: name.includes("light") ? "light" : "dark",
    deviceScaleFactor: name.includes("200-zoom") ? 2 : 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (setup && typeof setup !== "function" && setup.before) await page.addInitScript(setup.before);
  await page.goto(`${baseUrl}${url}`, { waitUntil: "networkidle" });
  if (typeof setup === "function") await setup(page);
  else await setup?.after?.(page);
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
  const snapshot = await page.locator("body").ariaSnapshot();
  const diagnostics = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const animations = document.getAnimations().map((animation) => ({
      name: animation.animationName || animation.effect?.target?.className || "transition",
      playState: animation.playState,
    }));
    const visible = (node) => {
      if (node.classList?.contains("sr-only") || node.closest?.(".sr-only")) return false;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const textDefects = [...document.querySelectorAll("button,input,label,p,li,b,small")]
      .filter(visible)
      .filter((node) => !node.classList.contains("companion-orb"))
      .filter((node) => !node.classList.contains("semantic-orb-cluster"))
      .filter((node) => {
        const style = getComputedStyle(node);
        const clipped = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
        return clipped && !["auto", "scroll"].includes(style.overflow) && style.textOverflow !== "ellipsis";
      })
      .slice(0, 20)
      .map((node) => {
        const style = getComputedStyle(node);
        return { tag: node.tagName, className: node.className, text: node.textContent?.trim().slice(0, 80), fontSize: style.fontSize, lineHeight: style.lineHeight };
      });
    const weakLeading = [...document.querySelectorAll("p,li,button,label")]
      .filter(visible)
      .filter((node) => {
        const style = getComputedStyle(node);
        const font = Number.parseFloat(style.fontSize);
        const line = Number.parseFloat(style.lineHeight);
        return Number.isFinite(font) && Number.isFinite(line) && line < font * 1.15;
      })
      .slice(0, 20)
      .map((node) => {
        const style = getComputedStyle(node);
        return { tag: node.tagName, className: node.className, text: node.textContent?.trim().slice(0, 80), fontSize: style.fontSize, lineHeight: style.lineHeight };
      });
    const pearlVersions = [...document.querySelectorAll(".physical-pearl")].map((node) => node.getAttribute("data-pearl-renderer"));
    const activeSurfaces = [...document.querySelectorAll(".orb-ledger,.semantic-orb-inspector,.orb-emitted-library,.orb-stage-emission")].filter(visible);
    const competingGradients = activeSurfaces.filter((node) => getComputedStyle(node).backgroundImage !== "none").map((node) => node.className);
    const smallTargets = [...document.querySelectorAll("button")].filter(visible).filter((node) => {
      const box = node.getBoundingClientRect();
      return !node.classList.contains("companion-orb") && (box.width < 28 || box.height < 28);
    }).slice(0, 20).map((node) => ({ className: node.className, text: node.textContent?.trim().slice(0, 60) }));
    return {
      colors: { foreground: body.color, background: body.backgroundColor },
      overflow: {
        horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      animationCount: animations.length,
      animations: animations.slice(0, 20),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      highContrast: matchMedia("(prefers-contrast: more)").matches,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      pearlVersions,
      textDefects,
      weakLeading,
      competingGradients,
      smallTargets,
      genericSpinnerCount: document.querySelectorAll(".spinner,.loading-spinner,[class*=spinner]").length,
      legacyPearlNodeCount: document.querySelectorAll(".orb-pearl,.orb-core,.orb-nucleus,.extension-orb-core,.extension-orb-halo").length,
    };
  });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      loadMs: Math.round(navigation?.loadEventEnd || 0),
      transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      longTasks: performance.getEntriesByType("longtask").length,
    };
  });
  results.push({ name, viewport, url: page.url(), title: await page.title(), errors, diagnostics, metrics, snapshot: snapshot.slice(0, 2000) });
  if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
  if (!url.startsWith("/scene/") && diagnostics.overflow.horizontal) throw new Error(`${name}: unexpected horizontal overflow`);
  if (diagnostics.pearlVersions.some((version) => version !== "2")) throw new Error(`${name}: physical Pearl renderer drift`);
  if (diagnostics.textDefects.length) throw new Error(`${name}: clipped visible text ${JSON.stringify(diagnostics.textDefects)}`);
  if (diagnostics.weakLeading.length) throw new Error(`${name}: weak line-height ${JSON.stringify(diagnostics.weakLeading)}`);
  if (diagnostics.competingGradients.length) throw new Error(`${name}: competing emitted-surface gradients ${diagnostics.competingGradients.join(",")}`);
  if (diagnostics.smallTargets.length) throw new Error(`${name}: controls smaller than 28px ${JSON.stringify(diagnostics.smallTargets)}`);
  if (diagnostics.genericSpinnerCount || diagnostics.legacyPearlNodeCount) throw new Error(`${name}: generic or legacy Pearl visuals remain`);
  if (name.includes("reduced") && diagnostics.animations.some((entry) => /pearl|orb/i.test(entry.name) && entry.playState === "running")) throw new Error(`${name}: Pearl animation runs under reduced motion`);
  await context.close();
}

try {
  await shot("01-continuation-desktop", { width: 1600, height: 1000 }, "/", async (page) => {
    await page.evaluate(() => localStorage.removeItem("lens.orb-universe.continued.v1"));
    await page.reload({ waitUntil: "networkidle" });
    if (await page.getByRole("region", { name: "Continue extension work" }).count()) {
      throw new Error("zero-state root exposes a continuation panel without material");
    }
    if (!await page.locator(".pearl-start-hint").isVisible()) {
      throw new Error("cold root does not attach the first action to Pearl");
    }
    if (await page.locator(".orb-continuation-pearl").isVisible()) throw new Error("idle root duplicates the primary Pearl");
    if (await page.locator(".companion-orb").count() !== 1) throw new Error("off-Scene Pearl is not the single persistent command affordance");
    await page.locator(".companion-orb").click();
    await page.getByRole("textbox", { name: "Tell Pearl your goal" }).waitFor();
    if (await page.getByRole("navigation").count()) throw new Error("Pearl click exposed persistent navigation");
    await page.keyboard.press("Escape");
    if (await page.getByRole("textbox", { name: "Tell Pearl your goal" }).isVisible()) throw new Error("Escape did not collapse Pearl completely");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    if (!await page.getByRole("searchbox", { name: /Search every Pearl action/ }).isVisible()) throw new Error("keyboard universal search is unreachable");
    await page.keyboard.press("Escape");
    if (await page.getByRole("link", { name: /Add Pearl to Chrome/ }).count()) throw new Error("extension download still dominates the web root");
  });
  await shot("02-library-laptop", { width: 1280, height: 800 }, "/library", async (page) => {
    await page.evaluate(() => localStorage.setItem("lens.orb-universe.continued.v1", "true"));
    await page.reload({ waitUntil: "networkidle" });
    if (await page.locator(".companion-orb").count() !== 1) throw new Error("library lost its single Pearl command affordance");
    if (await page.locator(".orb-home-nav,.orb-library-grid").count()) throw new Error("legacy navigation/grid remains visible");
    if (!await page.getByRole("heading", { name: "No saved work yet." }).isVisible()) throw new Error("empty library is an unexplained blank field");
  });
  await shot("03-library-narrow", { width: 390, height: 844 }, "/library", async (page) => {
    await page.evaluate(() => localStorage.setItem("lens.orb-universe.continued.v1", "true"));
    await page.reload({ waitUntil: "networkidle" });
    if (!await page.getByRole("heading", { name: "No saved work yet." }).isVisible()) throw new Error("narrow empty library loses its recovery action");
  });
  await shot("03a-trusted-handoff-output-frame", { width: 1280, height: 800 }, "/#handoff=semantic-orb-scene&view=integrate&token=0123456789abcdef0123456789abcdef", {
    before: () => {
      const handoff = {
        type: "pearl-workspace-handoff",
        handoff: { id: "audit-handoff", surface: "semantic-orb-scene", createdAt: 42, name: "Audit continuation" },
        semanticOrbs: [{
          version: 1,
          id: "first-pearl",
          kind: "semantic-orb",
          sceneId: "extension-captures",
          name: "First pearl",
          placement: { x: 0, y: 0, radius: 24 },
          representation: { kind: "selection", refs: ["handoff-fragment"], label: "First pearl", snapshot: null },
          workingSet: { context: [{ id: "handoff-fragment", quote: "Trusted carried material" }], lenses: [], selections: [], branches: [], checkpoints: [] },
          parentOrbId: null,
          childOrbIds: [],
          lineage: [],
          provenance: { sourceId: "handoff-fragment", sourceKind: "selection" },
          archived: false,
        }],
        activeSemanticOrbId: "first-pearl",
        session: {
          fragments: [{ id: "handoff-fragment", quote: "Trusted carried material", provenance: { origin: "https://example.test", title: "Fixture" } }],
          queue: [{ id: "clarify", name: "Clarify", libraryKind: "move" }],
          generator: null,
          results: [{ id: "handoff-run", outputs: [{ id: "handoff-candidate", text: "Verified carried candidate" }] }],
        },
      };
      globalThis.__handoffMessages = [];
      Object.defineProperty(globalThis, "chrome", {
        configurable: false,
        writable: false,
        value: {
          runtime: {
            lastError: null,
            sendMessage(_id, message, callback) {
              globalThis.__handoffMessages.push({ id: _id, type: message?.type });
              callback(message.type === "lens-install-check"
                ? { ok: true, value: { installed: true } }
                : { ok: true, value: handoff });
            },
          },
        },
      });
    },
    after: async (page) => {
      await page.waitForTimeout(500);
      const heading = await page.locator(".orb-continuation h2").textContent();
      if (!/First pearl is ready to continue/.test(heading || "")) {
        const messages = await page.evaluate(() => ({
          calls: globalThis.__handoffMessages,
          send: typeof globalThis.chrome?.runtime?.sendMessage,
          random: typeof globalThis.crypto?.randomUUID,
        }));
        throw new Error(`trusted handoff did not expose the pearl: ${heading || "missing continuation"}; ${JSON.stringify(messages)}`);
      }
      await page.getByRole("button", { name: "Continue this work" }).click();
      await page.waitForURL(/\/scene\/scene-extension-audit-handoff\?frame=workspace/);
      const outputFrame = page.locator('[data-semantic-anchor="output-frame"]');
      await outputFrame.waitFor({ state: "visible" });
      const persisted = await page.evaluate(() => {
        const workspace = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
        const scene = workspace?.scenes?.find((entry) => entry.id === "scene-extension-audit-handoff");
        return {
          items: scene?.items?.map((entry) => entry.id),
          createdFrom: scene?.metadata?.createdFrom,
          queue: scene?.metadata?.handoffQueue,
          candidates: scene?.metadata?.handoffCandidates,
          pearls: scene?.semanticOrbs?.map((entry) => entry.id),
        };
      });
      if (JSON.stringify(persisted) !== JSON.stringify({
        items: ["handoff-fragment", "handoff-candidate", "extension-queue:clarify"],
        createdFrom: "pearl-extension-handoff",
        queue: ["clarify"],
        candidates: ["handoff-candidate"],
        pearls: ["first-pearl", "extension-working-set-audit-handoff"],
      })) throw new Error(`handoff material mismatch: ${JSON.stringify(persisted)}`);
      await page.reload({ waitUntil: "networkidle" });
      await outputFrame.waitFor({ state: "visible" });
      const count = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.scenes.v4")).scenes.filter((entry) => entry.id === "scene-extension-audit-handoff").length);
      if (count !== 1) throw new Error(`handoff duplicated after reload: ${count}`);
    },
  });
  await shot("04-stage-desktop", { width: 1600, height: 1000 }, "/scene/audit-scene", async (page) => {
    await page.evaluate(() => {
      localStorage.removeItem("lens.orb.cursor.v1");
      document.documentElement.setAttribute("data-lens-orb-cursor-active", "false");
      localStorage.setItem("lens.scenes.v4", JSON.stringify({
        version: 4,
        activeSceneId: "audit-scene",
        scenes: [{
          id: "audit-scene",
          kind: "scene",
          version: 4,
          name: "Audit Scene",
          items: [{ id: "audit-material", type: "text", text: "A grounded Stage material", x: 120, y: 160, frameId: null }],
          nodes: [],
          frames: [],
          orbInstances: [],
          semanticOrbs: Array.from({ length: 20 }, (_, index) => ({
            version: 1,
            id: `audit-orb-${index + 1}`,
            kind: "semantic-orb",
            sceneId: "audit-scene",
            name: `Audit orb ${index + 1}`,
            placement: { x: -280 + index * 10, y: -120 + index * 6, radius: 24 },
            representation: { kind: index % 3 === 0 ? "lens" : "material", refs: [index % 3 === 0 ? "lens-audit" : "audit-material"], label: `Audit orb ${index + 1}`, snapshot: null },
            workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
            parentOrbId: null,
            childOrbIds: [],
            lineage: [],
            provenance: { source: "orb-universe-audit" },
            archived: false,
          })),
          activeSemanticOrbId: null,
          workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
          camera: { x: 0, y: 0, scale: 1 },
        }],
      }));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-semantic-anchor="scene-stage"]').first().waitFor();
    const orb = await page.locator('[data-semantic-anchor="primary-orb"] .companion-orb').boundingBox();
    if (!orb || orb.width < 28 || orb.width > 36) throw new Error("Stage Pearl is not a compact primary manipulation handle");
    if (await page.locator(".orb-context-drawer").count()) throw new Error("legacy permanent Stage drawer remains");
    await page.locator(".semantic-orb-cluster").first().waitFor();
    await page.locator(".semantic-orb-cluster").first().click();
    await page.locator(".orb-black-stage").dblclick({ position: { x: 1200, y: 700 } });
    await page.locator(".semantic-orb-capsule.active").waitFor();
    await page.waitForFunction(() => {
      const workspace = JSON.parse(localStorage.getItem("lens.scenes.v4") || "null");
      const scene = workspace?.scenes?.find((entry) => entry.id === "audit-scene");
      return scene?.semanticOrbs?.length === 21 && Boolean(scene.activeSemanticOrbId);
    });
    const activeId = await page.evaluate(() => JSON.parse(localStorage.getItem("lens.scenes.v4")).scenes[0].activeSemanticOrbId);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(`[data-semantic-orb-id="${activeId}"]`).waitFor();
    if (!(await page.locator(`[data-semantic-orb-id="${activeId}"] .semantic-orb-button`).getAttribute("aria-pressed"))) {
      throw new Error("active semantic orb did not survive reload");
    }
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true");
    await page.mouse.move(620, 420);
    const cursor = await page.locator(".physical-pearl-host.orb-cursor-visual").boundingBox();
    if (!cursor || Math.abs(cursor.x + cursor.width / 2 - 620) > 8 || Math.abs(cursor.y + cursor.height / 2 - 420) > 8) {
      throw new Error("web orb cursor does not track the pointer hotspot");
    }
    const nativeCursor = await page.locator(".orb-black-stage").evaluate((node) => getComputedStyle(node).cursor);
    if (nativeCursor !== "none") throw new Error("web native cursor remains visible in orb cursor mode");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "false");
    await page.locator(".companion-orb").click();
    const command = page.getByRole("textbox", { name: "Tell Pearl your goal" });
    await command.focus();
    await command.fill("before");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    if (await page.evaluate(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true")) {
      throw new Error("web Triple-Space toggled while editing an orb command");
    }
    if ((await command.inputValue()) !== "before   ") throw new Error("editable Triple-Space did not preserve typed spaces");
    await page.keyboard.press("Escape");
    await page.locator(".orb-black-stage").click({ position: { x: 80, y: 80 } });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-lens-orb-cursor-active") === "true");
    await page.keyboard.press("Escape");
    await page.locator(".companion-orb").click();
    await page.getByRole("textbox", { name: "Tell Pearl your goal" }).fill("show me the scene controls");
    await page.getByRole("button", { name: "Send command" }).click();
    await page.locator(".pearl-scene-actions").getByRole("button", { name: "Grid", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".orb-black-stage")?.dataset.stageView === "gallery");
    await page.getByRole("button", { name: "Add to Pearl context" }).click();
    await page.locator(".orb-context-object").waitFor();
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "Evidence Lens");
      transfer.setData("application/x-lens-object", JSON.stringify({ id: "lens-audit", kind: "lens", name: "Evidence Lens", strength: .75 }));
      document.querySelector(".companion-orb-shell").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.locator(".orb-lens-atmosphere").waitFor();
    const beforeDrop = await page.locator(".orb-stage-materials article").count();
    await page.locator(".orb-context-object").dragTo(page.locator(".orb-black-stage"), { targetPosition: { x: 980, y: 620 } });
    await page.waitForFunction((count) => document.querySelectorAll(".orb-stage-materials article").length > count, beforeDrop);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.locator(".orb-stage-table").waitFor();
  });
  await shot("04b-stage-mobile-placement", { width: 390, height: 844 }, "/scene/mobile-audit", async (page) => {
    await page.evaluate(() => {
      localStorage.setItem("lens.orb.placement.v1", JSON.stringify({ x: 900, y: 700, manual: true }));
      localStorage.setItem("lens.scenes.v4", JSON.stringify({
        version: 4,
        activeSceneId: "mobile-audit",
        scenes: [{
          id: "mobile-audit",
          kind: "scene",
          version: 4,
          name: "Mobile Audit",
          items: [{ id: "mobile-material", type: "text", text: "Visible mobile material", x: 900, y: 600 }],
          nodes: [],
          frames: [],
          orbInstances: [],
          semanticOrbs: [],
          activeSemanticOrbId: null,
          workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
          camera: { x: 0, y: 0, scale: 1 },
        }],
      }));
    });
    await page.reload({ waitUntil: "networkidle" });
    const pearl = await page.locator(".companion-orb").boundingBox();
    if (!pearl || pearl.x < 0 || pearl.x + pearl.width > 390 || pearl.y < 0 || pearl.y + pearl.height > 844) {
      throw new Error(`persisted Pearl remained off-screen: ${JSON.stringify(pearl)}`);
    }
    const material = await page.locator('[data-material-id="mobile-material"]').boundingBox();
    if (!material || material.x < 0 || material.x + material.width > 390) {
      throw new Error(`mobile Stage material remained off-screen: ${JSON.stringify(material)}`);
    }
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      visible: Boolean(document.activeElement?.matches(":focus-visible")),
    }));
    if (focused.tag === "BODY" || !focused.visible) throw new Error(`mobile primary focus is not visible: ${JSON.stringify(focused)}`);
  });
  await shot("05-install-reduced-motion", { width: 1280, height: 800 }, "/install", async (page) => {
    const animations = await page.evaluate(() => document.getAnimations().filter((entry) => entry.playState === "running").length);
    if (animations) throw new Error(`reduced-motion setup still animates: ${animations}`);
  });
  await shot("06-command-360-high-contrast", { width: 360, height: 800 }, "/", async (page) => {
    await page.locator(".companion-orb").click();
    const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
    await input.waitFor();
    await input.focus();
    const focus = await input.evaluate((node) => {
      const style = getComputedStyle(node);
      return { outline: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset };
    });
    if (focus.outline === "none" || Number.parseFloat(focus.width) < 1) throw new Error(`high-contrast command focus is not visible: ${JSON.stringify(focus)}`);
    if (await page.locator(".pearl-start-hint").count()) throw new Error("first-use prompt overlaps the open Companion");
  });
  await shot("07-command-200-zoom-light", { width: 720, height: 450 }, "/", async (page) => {
    await page.locator(".companion-orb").click();
    const ledger = page.locator(".orb-ledger");
    await ledger.waitFor();
    const box = await ledger.boundingBox();
    const viewport = page.viewportSize();
    if (!box || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) {
      throw new Error(`command surface is clipped at 200% zoom: ${JSON.stringify({ box, viewport })}`);
    }
    if (await page.locator(".pearl-start-hint").count()) throw new Error("first-use prompt overlaps the zoomed Companion");
  });
  await shot("08-destructive-approval-390", { width: 390, height: 844 }, "/", async (page) => {
    await page.locator(".companion-orb").click();
    const input = page.getByRole("textbox", { name: "Tell Pearl your goal" });
    await input.fill("delete my local pearl data");
    await input.press("Enter");
    await page.getByRole("region", { name: "Plan approval required" }).waitFor({ timeout: 8_000 });
    if (!await page.getByRole("button", { name: "Confirm" }).isVisible() || !await page.getByRole("button", { name: "Cancel" }).isVisible()) {
      throw new Error("destructive approval does not expose both clear choices");
    }
    if (await page.locator(".pearl-start-hint").count()) throw new Error("first-use prompt overlaps destructive confirmation");
  });
  fs.writeFileSync(path.join(evidence, "web-results.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: browser.version(),
    checks: results,
    passed: results.length,
    failed: 0,
  }, null, 2)}\n`);
  console.log(`Orb web audit passed: ${results.length} route/viewport states.`);
} finally {
  await browser.close();
}
