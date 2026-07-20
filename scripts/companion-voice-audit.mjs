import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_URL || "http://127.0.0.1:5173";
const OUT = path.resolve("audit-shots/companion-voice");
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (name, condition, detail = "") => {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const items = [
  { id: "note", type: "text", x: 120, y: 120, w: 220, text: "Market note", pageId: "page-main" },
  { id: "drawing", type: "stroke", x: 220, y: 280, points: [{ x: 0, y: 0 }, { x: 40, y: 20 }], pageId: "page-main" },
  { id: "link", type: "link", fromId: "note", toId: "drawing", pageId: "page-main" },
];
const nodes = [
  { id: "node-a", nodeKind: "source", x: 900, y: 200, radius: 28, label: "AI note" },
  { id: "node-b", nodeKind: "expanded", parentId: "node-a", x: 1080, y: 260, radius: 24, label: "AI branch" },
];

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.addInitScript(({ items, nodes }) => {
  localStorage.clear();
  localStorage.setItem("lens.onboarded.v1", "1");
  localStorage.setItem("lens.companion.seen.v1", "1");
  localStorage.setItem("lens.tour.v1", "1");
  localStorage.setItem("lens.board.items.v1", JSON.stringify(items));
  localStorage.setItem("lens.ai.nodes.v1", JSON.stringify(nodes));
  localStorage.setItem("lens.board.pages.v1", JSON.stringify([{ id: "page-main", name: "Voice audit" }]));
  localStorage.setItem("lens.unified-workspace.v2", JSON.stringify({
    version: 2,
    savedAt: new Date().toISOString(),
    camera: { x: 80, y: 56, scale: 0.72 },
    items,
    nodes,
  }));
  localStorage.setItem("lens.scenes.v4", JSON.stringify({
    version: 4,
    activeSceneId: "voice-audit",
    scenes: [{
      id: "voice-audit",
      kind: "scene",
      version: 4,
      name: "Voice audit",
      items,
      nodes,
      frames: [],
      orbInstances: [],
      semanticOrbs: [],
      activeSemanticOrbId: null,
      workingSet: { context: [], lenses: [], selections: [], branches: [], checkpoints: [] },
      camera: { x: 80, y: 56, scale: 0.72 },
    }],
  }));

  class MockSpeechRecognition {
    static instances = [];
    constructor() {
      MockSpeechRecognition.instances.push(this);
    }
    start() {}
    stop() {}
  }
  window.SpeechRecognition = MockSpeechRecognition;
  window.__emitVoice = (parts) => {
    const recognition = MockSpeechRecognition.instances.at(-1);
    const results = parts.map(({ text, final }) => {
      const result = [{ transcript: text }];
      result.isFinal = final;
      return result;
    });
    recognition?.onresult?.({ resultIndex: 0, results });
  };
}, { items, nodes });

async function speak(parts) {
  const mic = page.locator(".companion-mic");
  if (await mic.getAttribute("aria-pressed") !== "true") await mic.click();
  for (const part of parts) {
    await page.evaluate((voicePart) => window.__emitVoice([voicePart]), part);
  }
  if (await mic.getAttribute("aria-pressed") === "true") await mic.click();
}

try {
  await page.goto(`${BASE}/scene/voice-audit?frame=workspace`);
  await page.waitForSelector(".canvas-column-main");
  const fab = page.locator(".companion-fab");
  if (await fab.isVisible()) await fab.click();
  await page.waitForSelector(".companion-panel");
  check("onboarding prompt appears once", await page.getByText("Who are you?", { exact: true }).count() === 1);

  let runEvents = 0;
  await page.evaluate(() => window.addEventListener("lens:companion-run", () => { window.__voiceAuditRuns = (window.__voiceAuditRuns || 0) + 1; }));
  await speak([
    { text: "delete everything in the Whiteboard", final: false },
    { text: "delete everything in the Whiteboard", final: true },
    { text: "delete everything in the Whiteboard", final: true },
  ]);
  await page.waitForSelector('[data-testid="companion-clear-confirmation"]');
  await page.waitForFunction(() => !document.querySelector(".companion-progress"));
  await page.screenshot({ path: path.join(OUT, "before-confirmation.png") });
  runEvents = await page.evaluate(() => window.__voiceAuditRuns || 0);
  const firstMessages = await page.locator(".companion-msg").allTextContents();
  check("duplicate finals insert one user bubble", firstMessages.filter((text) => text === "delete everything in the Whiteboard").length === 1, firstMessages.join(" | "));
  check("duplicate finals dispatch one request", runEvents === 1, `runs=${runEvents}`);
  const confirmationText = (await page.getByTestId("companion-clear-confirmation").innerText()).replace(/\s+/g, " ");
  check("unified confirmation counts every canvas domain", /3 whiteboard items.*2 AI nodes/.test(confirmationText), confirmationText);

  await page.getByTestId("companion-clear-confirm").click();
  await page.waitForFunction(() => {
    const input = document.querySelector(".companion-input");
    return input && !input.disabled && !document.querySelector(".companion-progress");
  });
  await page.screenshot({ path: path.join(OUT, "after-clear.png") });
  const persisted = await page.evaluate(() => ({
    items: JSON.parse(localStorage.getItem("lens.board.items.v1") || "null"),
    nodes: JSON.parse(localStorage.getItem("lens.ai.nodes.v1") || "null"),
    unified: JSON.parse(localStorage.getItem("lens.unified-workspace.v2") || "null"),
  }));
  check("clear mutates legacy and unified stores atomically",
    persisted.items?.length === 0 && persisted.nodes?.length === 0 &&
    persisted.unified?.items?.length === 0 && persisted.unified?.nodes?.length === 0);

  check("onboarding never repeats after commands", await page.getByText("Who are you?", { exact: true }).count() === 1);

  await page.setViewportSize({ width: 720, height: 820 });
  await page.screenshot({ path: path.join(OUT, "narrow-viewport.png") });
  const panel = await page.locator(".companion-panel").boundingBox();
  check("voice UI remains visible at narrow width", panel && panel.x >= 0 && panel.x + panel.width <= 720);
  check("no browser errors", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  await browser.close();
}

const passed = checks.filter((entry) => entry.ok).length;
fs.writeFileSync(path.join(OUT, "REPORT.md"), `# Companion voice audit

${checks.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} — ${entry.name}${entry.detail ? `: ${entry.detail}` : ""}`).join("\n")}
`);
console.log(`${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exitCode = 1;
