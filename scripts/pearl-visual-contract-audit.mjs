import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { PHYSICAL_PEARL_CSS, physicalPearlMarkup } from "../shared/physical-pearl.js";
import { inspectPearlVisualContract, PEARL_VISUAL_FAIL_CONDITIONS } from "../shared/pearl-visual-contract.js";

const out = path.resolve(process.env.AUDIT_OUT || "audit-shots/unified-pearl-visual");
fs.mkdirSync(out, { recursive: true });
const variants = ["primary", "semantic", "result", "worker", "candidate", "cursor", "recipient", "canvas-anchor"];
const states = ["idle", "new", "listening", "executing", "blocked", "failed", "loading"];
const backgrounds = [
  ["light", "#f5f4ef", "#222825"],
  ["dark", "#0b0e0d", "#e8ece8"],
  ["colored", "#274e58", "#f0f3ef"],
  ["text-heavy", "#ecebe5", "#252a27"],
];

const specimens = backgrounds.map(([surrounding, background, color]) => `
  <section class="environment" data-environment="${surrounding}" style="--background:${background};--color:${color}">
    <div class="texture">${Array.from({ length: 18 }, (_, index) => `<span>Evidence ${index + 1} · quiet surrounding material remains subordinate.</span>`).join("")}</div>
    <div class="actual">${variants.map((variant) => physicalPearlMarkup({
      id: `${surrounding}-${variant}`,
      variant,
      state: variant === "result" ? "new" : "idle",
      size: variant === "cursor" ? 18 : 34,
      surrounding,
      label: `${variant} Pearl`,
    })).join("")}</div>
  </section>
`).join("");

const stateSpecimens = states.map((state) => `<figure>${physicalPearlMarkup({ id: `state-${state}`, variant: state === "new" ? "result" : "primary", state, size: 34, surrounding: "dark", label: `${state} Pearl` })}<figcaption>${state}</figcaption></figure>`).join("");
const closeups = ["primary", "result", "cursor", "recipient"].map((variant) => `<figure>${physicalPearlMarkup({ id: `close-${variant}`, variant, state: variant === "result" ? "new" : "idle", size: 144, surrounding: "dark", label: `${variant} diagnostic` })}<figcaption>${variant}</figcaption></figure>`).join("");

const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const checks = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, reducedMotion });
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      ${PHYSICAL_PEARL_CSS}
      *{box-sizing:border-box}html,body{margin:0;background:#090c0b;color:#e9ede9;font:12px/1.4 Inter,system-ui,sans-serif}
      main{padding:48px}.environment{position:relative;min-height:164px;margin:0 0 24px;padding:28px;background:var(--background);color:var(--color);overflow:hidden}
      .texture{position:absolute;inset:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px 26px;opacity:.2;font-size:10px}.actual{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:34px;min-height:90px}
      .states,.closeups{display:flex;align-items:end;justify-content:center;gap:38px;padding:34px 0;border-top:1px solid rgba(255,255,255,.12)}figure{display:grid;justify-items:center;gap:8px;margin:0}figcaption{font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.55}
      .closeups{gap:70px}.closeups figure:nth-child(3) .physical-pearl{width:144px;height:144px}.closeups figure:last-child .physical-pearl{width:72px;height:72px}
      @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    </style></head><body><main>${specimens}<div class="states">${stateSpecimens}</div><div class="closeups">${closeups}</div></main></body></html>`, { waitUntil: "load" });
    const metrics = await page.evaluate(() => {
      const pearls = [...document.querySelectorAll(".physical-pearl")];
      return {
        count: pearls.length,
        actual: pearls.slice(0, 32).map((entry) => ({
          variant: entry.dataset.pearlVariant,
          surrounding: entry.dataset.pearlSurrounding,
          width: entry.getBoundingClientRect().width,
          height: entry.getBoundingClientRect().height,
          boxShadow: getComputedStyle(entry).boxShadow,
          filter: getComputedStyle(entry).filter,
        })),
        runningPearlAnimations: document.getAnimations().filter((entry) => entry.playState === "running" && /pearl/i.test(entry.animationName)).map((entry) => entry.animationName),
      };
    });
    for (const pearl of metrics.actual) {
      const expected = pearl.variant === "cursor" ? 18 : 34;
      if (pearl.width !== expected || pearl.height !== expected) throw new Error(`actual-size mismatch: ${JSON.stringify(pearl)}`);
      if (pearl.boxShadow !== "none") throw new Error(`external shadow found: ${JSON.stringify(pearl)}`);
    }
    if (reducedMotion === "reduce" && metrics.runningPearlAnimations.length) throw new Error(`reduced-motion animation found: ${metrics.runningPearlAnimations.join(",")}`);
    await page.screenshot({ path: path.join(out, `matrix-${reducedMotion}.png`), fullPage: true });
    await page.locator(".closeups").screenshot({ path: path.join(out, `closeup-${reducedMotion}.png`) });
    checks.push({ reducedMotion, ...metrics });
    await context.close();
  }
  const contract = variants.flatMap((variant) => backgrounds.map(([surrounding]) => ({ variant, surrounding, ...inspectPearlVisualContract({ variant, surrounding }) })));
  if (contract.some((entry) => !entry.valid)) throw new Error("static Pearl visual contract failed");
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    browser: browser.version(),
    deviceScaleFactor: 2,
    variants,
    states,
    backgrounds: backgrounds.map(([name]) => name),
    failConditions: Object.fromEntries(PEARL_VISUAL_FAIL_CONDITIONS.map((condition) => [condition, "pending-manual-inspection"])),
    contract,
    checks,
  };
  fs.writeFileSync(path.join(out, "results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Pearl visual contract audit captured ${variants.length} variants across ${backgrounds.length} surroundings.`);
} finally {
  await browser.close();
}
