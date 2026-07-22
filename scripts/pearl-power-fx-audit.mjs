/**
 * Visual stress audit for pearl power FX overlays + host animations.
 * Captures fission/echo/charge/filament/seek/fuse under motion + reduced motion.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { PHYSICAL_PEARL_CSS, physicalPearlMarkup } from "../shared/physical-pearl.js";
import { PEARL_POWER_FX_CSS, filamentPath, radialFissionPoints } from "../shared/pearl-power-fx.js";

const out = path.resolve(process.env.AUDIT_OUT || "audit-shots/pearl-power-fx");
fs.mkdirSync(out, { recursive: true });

const origin = { x: 420, y: 280 };
const satellites = radialFissionPoints(origin, 8, 96);
const filamentTargets = [
  { x: 180, y: 140, width: 90, height: 16 },
  { x: 620, y: 180, width: 120, height: 18 },
  { x: 500, y: 420, width: 70, height: 14 },
  { x: 240, y: 460, width: 100, height: 16 },
];

const powerScene = `
  <div class="stage">
    <div class="pearl-slot">${physicalPearlMarkup({ id: "power-primary", variant: "primary", state: "executing", animation: "charge", size: 56, label: "Charging pearl" })}</div>
    <div class="pearl-slot echo">${physicalPearlMarkup({ id: "power-echo", variant: "semantic", animation: "echo", size: 48, label: "Echo pearl" })}</div>
    <div class="pearl-slot fission">${physicalPearlMarkup({ id: "power-fission", variant: "primary", animation: "fission", size: 52, label: "Fission pearl" })}</div>
    ${satellites.map((point, index) => `<div class="pearl-power-fx__satellite" data-kind="fission" style="left:${origin.x}px;top:${origin.y}px;--dx:${point.x - origin.x}px;--dy:${point.y - origin.y}px;--fx-ms:720ms"></div>`).join("")}
    <svg class="pearl-power-fx__layer" aria-hidden="true">
      ${filamentTargets.map((rect) => {
        const to = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const d = filamentPath(origin, to);
        return `<path class="pearl-power-fx__filament" d="${d}"/><path class="pearl-power-fx__filament pearl-power-fx__filament-core" d="${d}"/><rect class="pearl-power-fx__mark" x="${rect.x - 2}" y="${rect.y - 2}" width="${rect.width + 4}" height="${rect.height + 4}" rx="3"/>`;
      }).join("")}
    </svg>
    <div class="pearl-power-fx__burst" style="left:${origin.x}px;top:${origin.y}px"></div>
    <div class="pearl-power-fx__charge-ring" style="left:${origin.x}px;top:${origin.y}px"></div>
    <div class="pearl-power-fx__seek-ghost" style="left:${origin.x}px;top:${origin.y}px;--dx:180px;--dy:-90px;--fx-ms:700ms"></div>
    <p class="copy">limited partner briefing · pearl · LP memo · filament targets</p>
  </div>
`;

const browser = await chromium.launch({ headless: true, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const results = { checks: [], out };
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 2, reducedMotion });
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      ${PHYSICAL_PEARL_CSS}
      ${PEARL_POWER_FX_CSS}
      *{box-sizing:border-box}html,body{margin:0;background:#0a0d0c;color:#e8ece8;font:13px/1.4 ui-sans-serif,system-ui,sans-serif}
      .stage{position:relative;width:900px;height:640px;overflow:hidden;background:radial-gradient(circle at 30% 20%,#1a2220, #0a0d0c 55%)}
      .pearl-slot{position:absolute;left:392px;top:252px}.pearl-slot.echo{left:470px;top:300px}.pearl-slot.fission{left:340px;top:300px}
      .copy{position:absolute;left:48px;bottom:36px;opacity:.35;max-width:420px}
      @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    </style></head><body class="pearl-power-fx-host" data-reduced-motion="${reducedMotion === "reduce"}">${powerScene}</body></html>`, { waitUntil: "load" });
    await page.waitForTimeout(220);
    const shot = path.join(out, `powers-${reducedMotion}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const metrics = await page.evaluate(() => {
      const pearls = [...document.querySelectorAll(".physical-pearl")];
      const satellites = [...document.querySelectorAll(".pearl-power-fx__satellite")];
      const filaments = [...document.querySelectorAll(".pearl-power-fx__filament")];
      return {
        pearls: pearls.length,
        satellites: satellites.length,
        filaments: filaments.length,
        whiteDot: pearls.some((pearl) => {
          const fill = pearl.querySelector(".physical-pearl__body")?.getAttribute("fill") || "";
          return fill === "#fff" || fill === "#ffffff";
        }),
        boxShadows: pearls.map((pearl) => getComputedStyle(pearl).boxShadow),
      };
    });
    const ok = metrics.pearls >= 3 && metrics.satellites === 8 && metrics.filaments >= 4 && !metrics.whiteDot
      && metrics.boxShadows.every((value) => !value || value === "none");
    results.checks.push({ reducedMotion, shot, metrics, ok });
    await context.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
const failed = results.checks.filter((entry) => !entry.ok);
if (failed.length) {
  console.error("pearl-power-fx audit failed", failed);
  process.exit(1);
}
console.log(`pearl-power-fx audit ok → ${out}`);
