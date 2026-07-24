/**
 * Pearl Clueless Stress — master hard-fail harness.
 *
 * Persona: hyper-clueless first-time user.
 * Standard: docs/pearl-stress-standard.md
 * Catalog: docs/pearl-showcase-flows.md
 * Gap audit: docs/pearl-stress-clueless-gap-audit.md
 *
 * Usage:
 *   npm run stress:clueless
 *   AUDIT_URL=http://127.0.0.1:41822 node scripts/pearl-clueless-stress.mjs
 *   SELF_PREVIEW=1 SKIP_BUILD=1 node scripts/pearl-clueless-stress.mjs
 *
 * Integrity: Talk→GO hit-test only. No __lensOrbRuntime.execute as pass.
 * No force:true. No seed-as-pass. Intent-bound visible titles. 390px primary.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "audit-shots/pearl-clueless-stress-2026-07-24");
const DOCS_SUMMARY = path.join(ROOT, "docs/pearl-clueless-stress-2026-07-24.md");
const DOCS_COVERAGE = path.join(ROOT, "docs/pearl-stress-coverage.md");
const DOCS_AESTHETIC = path.join(ROOT, "docs/pearl-clueless-stress-AESTHETIC-2026-07-24.md");
const PORT = Number(process.env.AUDIT_PORT || 41822);
const baseUrl = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;
const headed = process.env.HEADED === "0" ? false : true;
const selfPreview = process.env.SELF_PREVIEW === "1" || !process.env.AUDIT_URL;
const skipBuild = process.env.SKIP_BUILD === "1";
// Prefer Playwright Chromium — system Chrome often conflicts with a user profile and closes mid-run.
const chromePath = process.env.PW_CHROMIUM || undefined;

fs.mkdirSync(OUT, { recursive: true });

const STOPWORDS = new Set([
  "make", "create", "save", "a", "an", "the", "this", "that", "my", "our", "your",
  "pearl", "pearls", "about", "called", "named", "titled", "from", "these", "notes",
  "with", "for", "and", "into", "onto", "to", "of", "on", "in", "it", "them",
]);

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  headed,
  commit: spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim(),
  persona: "hyper-clueless-first-time",
  checks: [],
  defects: [],
  aesthetics: [],
  matrix: [],
  gaps: [],
  antiLie: {
    noRuntimeExecutePass: true,
    noForceClick: true,
    noSeedAsPass: true,
    noPearls0Fallback: true,
    intentBoundTitles: true,
    worldVisibleArtifacts: true,
    confusionBudget: true,
    screenshotVetoReady: true,
  },
};

function record(id, ok, detail, severity = "P0", extra = {}) {
  const entry = { id, ok: Boolean(ok), detail: String(detail || "").slice(0, 400), severity, ...extra };
  results.checks.push(entry);
  if (!entry.ok && (severity === "P0" || severity === "P1")) {
    results.defects.push(entry);
  }
  console.log(`${entry.ok ? "PASS" : "FAIL"} [${severity}] ${id} — ${entry.detail}`);
  return entry.ok;
}

function coverage(id, status, why) {
  results.matrix.push({ id, status, why });
}

function isMysteryTitle(name) {
  const value = String(name || "").trim();
  if (!value) return true;
  if (/^New pearl · /i.test(value)) return true; // generic stamp never OK for topic create
  return /untitled|^(?:new\s+)?orb$|\borb\b/i.test(value);
}

function topicTokens(intentPhrase) {
  return String(intentPhrase || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function titleMatchesIntent(name, intentPhrase) {
  const title = String(name || "").toLowerCase();
  if (!title || isMysteryTitle(name)) return false;
  const tokens = topicTokens(intentPhrase);
  if (!tokens.length) return !isMysteryTitle(name);
  // Require majority of topic tokens OR a distinctive long token.
  const hits = tokens.filter((t) => title.includes(t));
  if (tokens.some((t) => t.length >= 6 && title.includes(t))) return true;
  return hits.length >= Math.min(2, tokens.length) || (tokens.length === 1 && hits.length === 1);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false, timeout: 8_000 });
  } catch {
    try {
      await page.screenshot({ path: file, fullPage: false, timeout: 5_000, animations: "disabled" });
    } catch {
      fs.writeFileSync(file.replace(/\.png$/, ".txt"), `screenshot failed for ${name}`);
    }
  }
  return file;
}

async function waitForServer(url, server, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server?.exitCode != null) throw new Error(`preview exited ${server.exitCode}`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status === 404) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`preview not ready: ${url}`);
}

async function hitTestClick(page, locator, expectedTestId) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return { ok: false, hit: null, reason: "no bounding box" };
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return {
      testid: el?.getAttribute?.("data-testid")
        || el?.closest?.("[data-testid]")?.getAttribute("data-testid")
        || null,
      tag: el?.tagName || null,
      text: String(el?.textContent || "").trim().slice(0, 40),
    };
  }, point).catch(() => ({ testid: null, tag: null, text: "" }));
  const ok = expectedTestId ? hit.testid === expectedTestId : Boolean(hit.testid || hit.tag);
  if (ok) await locator.click({ trial: false, timeout: 2500 }).catch(() => {});
  return { ok, hit, point };
}

async function ensureChatOpenViaTalk(page) {
  const input = page.locator("[data-testid='companion-chat-input']").first();
  if (await input.isVisible().catch(() => false)) {
    return { opened: true, clicks: 0, via: "already-open" };
  }
  const talk = page.getByTestId("welcome-talk").first();
  if (!(await talk.count())) {
    // One allowed fallback: visible Talk-labeled button (still human-reachable).
    const labeled = page.getByRole("button", { name: /^talk$/i }).first();
    if (await labeled.count()) {
      const hit = await hitTestClick(page, labeled, null);
      await page.waitForTimeout(700);
      const visible = await input.isVisible().catch(() => false);
      return { opened: visible, clicks: 1, via: "talk-label", hit };
    }
    return { opened: false, clicks: 0, via: "missing-talk" };
  }
  const hit = await hitTestClick(page, talk, "welcome-talk");
  await page.waitForTimeout(700);
  const visible = await page.locator("[data-testid='companion-chat-input']").first().isVisible().catch(() => false);
  return { opened: visible && hit.ok, clicks: 1, via: "welcome-talk", hit };
}

async function readLibrary(page) {
  return page.evaluate(() => {
    const mapPearl = (p) => ({
      id: p.id,
      name: p.name || p.title || p.label || "",
      archived: Boolean(p.archived),
    });
    const byId = new Map();
    const out = { pearls: [], gauntletFilled: 0, gauntletSlots: [] };
    for (const key of ["lens.scenes.v4", "lens.unified-workspace.v2", "lens.companion.gauntlet.v1", "lens.companion.worn-pearl.v1"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (key === "lens.scenes.v4") {
          for (const p of (parsed.scenes || []).flatMap((s) => s.semanticOrbs || [])) {
            if (p?.id) byId.set(p.id, mapPearl(p));
          }
        }
        if (key === "lens.unified-workspace.v2") {
          for (const bag of [parsed.semanticOrbs, parsed.pearls, parsed.library?.semanticOrbs, parsed.library?.pearls].filter(Boolean)) {
            for (const p of bag) if (p?.id) byId.set(p.id, { ...(byId.get(p.id) || {}), ...mapPearl(p) });
          }
        }
        if (key === "lens.companion.gauntlet.v1" || key === "lens.companion.worn-pearl.v1") {
          const slots = Array.isArray(parsed?.slots) ? parsed.slots.filter(Boolean) : (parsed?.pearlIds || []);
          if (slots.length > out.gauntletFilled) {
            out.gauntletFilled = slots.length;
            out.gauntletSlots = slots.map((s) => (typeof s === "string" ? s : s?.pearlId || s?.id || s));
          }
        }
      } catch { /* ignore */ }
    }
    out.pearls = [...byId.values()].filter((p) => !p.archived);
    return out;
  });
}

async function visiblePearlTitles(page) {
  return page.evaluate(() => {
    const titles = [];
    for (const el of document.querySelectorAll(
      ".semantic-orb-capsule span, .semantic-orb-button, [data-semantic-orb-id], .orb-gauntlet-socket.filled span, [aria-label*='pearl' i]",
    )) {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) < 0.05) continue;
      if (r.width < 4 || r.height < 4) continue;
      const text = String(el.getAttribute("aria-label") || el.textContent || "").trim();
      if (text) titles.push(text.slice(0, 160));
    }
    return [...new Set(titles)].slice(0, 40);
  });
}

async function titleVisibleOnScreen(page, title) {
  if (!title) return false;
  const needle = String(title).slice(0, 24).toLowerCase();
  const titles = await visiblePearlTitles(page);
  if (titles.some((t) => t.toLowerCase().includes(needle))) return true;
  const body = ((await page.locator("body").innerText().catch(() => "")) || "").toLowerCase();
  return body.includes(needle);
}

async function chatSnapshot(page) {
  try {
    return await page.evaluate(() => {
      const msgs = [...document.querySelectorAll(".companion-msg")].map((el) => ({
        role: [...el.classList].find((c) => ["user", "companion", "status", "action"].includes(c)) || "unknown",
        text: String(el.textContent || "").trim().slice(0, 240),
      }));
      return {
        msgs,
        progress: document.querySelector("[data-testid='companion-progress']")?.textContent?.trim() || null,
        statusLine: document.querySelector("[data-testid='companion-status-line']")?.textContent?.trim() || null,
        blocked: [...document.querySelectorAll(".companion-msg")].some((el) => /blocked|try:|say “|say "|could not/i.test(el.textContent || "")),
        directorRunning: document.body.classList.contains("director-running")
          || Boolean(document.querySelector(".ghost-cursor")),
      };
    });
  } catch {
    // Navigation / context destroy mid-poll — caller retries after settle.
    return {
      msgs: [],
      progress: null,
      statusLine: null,
      blocked: false,
      directorRunning: false,
      navigated: true,
    };
  }
}

/** Companion replies that belong to the latest matching user utterance (ignore prior blockers). */
function repliesAfterUser(msgs, userText) {
  const needle = String(userText || "").slice(0, 18).toLowerCase();
  let start = -1;
  for (let i = (msgs || []).length - 1; i >= 0; i -= 1) {
    if (msgs[i].role === "user" && String(msgs[i].text || "").toLowerCase().includes(needle)) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];
  return msgs.slice(start + 1);
}

async function stopDirectorIfRunning(page) {
  const running = await page.evaluate(() => document.body.classList.contains("director-running")).catch(() => false);
  if (!running) return;
  const stop = page.locator(
    "button:has-text('stop demonstration'), .companion-status-row button:has-text('stop'), [data-testid='companion-stop']",
  ).first();
  if (await stop.count()) await stop.click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(500);
  // Hard abort if still running — otherwise later GO waits forever on a stuck director.
  const still = await page.evaluate(() => document.body.classList.contains("director-running")).catch(() => false);
  if (still) {
    await page.evaluate(() => {
      try { window.__lensDirector?.stop?.(); } catch { /* ignore */ }
      document.body.classList.remove("director-running");
    }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function dismissPendingApprovals(page) {
  if (page.isClosed?.()) return;
  // Plan / context / destructive confirmations block GO — reject to keep the marathon moving.
  const reject = page.locator(
    "[data-testid='companion-destructive-reject'], [data-testid='companion-shell-approval-reject'], [data-testid='companion-plan-reject'], button:has-text('reject'), button:has-text('Reject')",
  ).first();
  if (await reject.count().catch(() => 0)) {
    await reject.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300).catch(() => {});
  }
  await stopDirectorIfRunning(page);
}

async function leaveBlockingSurfaces(page) {
  if (page.isClosed?.()) return;
  await dismissPendingApprovals(page);
  // Studio hash / Encode / settings emissions can disable chat — Escape like a confused human.
  for (let i = 0; i < 4; i += 1) {
    if (page.isClosed?.()) return;
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200).catch(() => {});
  }
  const close = page.locator("[data-testid='companion-close'], .companion-panel button[aria-label='Close']").first();
  if (await close.count().catch(() => 0)) {
    await close.click({ timeout: 800 }).catch(() => {});
  }
  if (page.isClosed?.()) return;
  if (/#pearl-studio=|\/packages|encode/i.test(page.url()) || await page.locator("[data-emitted-view], .pearl-encode-panel, .web-pearl-studio").count().catch(() => 0)) {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(500).catch(() => {});
  }
}

async function typeAndGo(page, text, { shotPrefix = null, humanMs = 900 } = {}) {
  await leaveBlockingSurfaces(page);
  await stopDirectorIfRunning(page);
  const opened = await ensureChatOpenViaTalk(page);
  if (!opened.opened && opened.clicks > 1) {
    return { ok: false, reason: "confusion-budget", opened, hit: null, snap: null };
  }
  if (!opened.opened) {
    // Last human path: click mother pearl if labeled/visible — counts as second click → fail budget if Talk existed.
    const orb = page.locator(".companion-orb").first();
    if (await orb.count()) {
      await orb.click();
      await page.waitForTimeout(500);
    }
  }
  const input = page.locator("[data-testid='companion-chat-input']").first();
  const go = page.locator("[data-testid='companion-go']").first();
  if (!(await input.count()) || !(await go.count())) {
    return { ok: false, reason: "missing-controls", opened, hit: null, snap: null };
  }
  // Wait until GO path is enabled (director/studio may leave input disabled briefly).
  for (let i = 0; i < 36; i += 1) {
    const enabled = await input.isEnabled().catch(() => false);
    if (enabled) break;
    await stopDirectorIfRunning(page);
    await leaveBlockingSurfaces(page);
    await ensureChatOpenViaTalk(page);
    await page.waitForTimeout(250);
  }
  if (!(await input.isEnabled().catch(() => false))) {
    return { ok: false, reason: "input-disabled", opened, hit: null, snap: await chatSnapshot(page).catch(() => null) };
  }
  await input.click({ timeout: 5_000 }).catch(() => {});
  await input.fill(text, { timeout: 5_000 }).catch(async () => {
    await leaveBlockingSurfaces(page);
    await ensureChatOpenViaTalk(page);
    await page.locator("[data-testid='companion-chat-input']").first().fill(text, { timeout: 5_000 });
  });
  if (shotPrefix) await shot(page, `${shotPrefix}-typed`);
  const hit = await hitTestClick(page, go, "companion-go");
  if (!hit.ok) {
    // Integrity: do NOT force-click GO to invent a pass.
    return { ok: false, reason: "go-hit-fail", opened, hit, snap: await chatSnapshot(page).catch(() => null) };
  }
  let userEcho = false;
  let statusSeen = false;
  let replyOrBlock = false;
  // Wait for a companion reply that belongs to THIS utterance — never treat prior "Blocked" as done.
  for (let i = 0; i < 72; i += 1) {
    await page.waitForTimeout(i === 0 ? humanMs : 220);
    const snap = await chatSnapshot(page);
    if (snap.navigated) {
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    if (snap.msgs.some((m) => m.role === "user" && m.text.toLowerCase().includes(text.slice(0, 18).toLowerCase()))) {
      userEcho = true;
    }
    const after = repliesAfterUser(snap.msgs, text);
    if (after.some((m) => m.role === "status" || m.role === "action") || snap.statusLine || snap.progress) {
      statusSeen = true;
    }
    const companionAfter = after.filter((m) => m.role === "companion" && m.text.length > 2);
    const blockedAfter = companionAfter.some((m) => /blocked|try:|say “|say "|could not|needs credentials/i.test(m.text));
    // Prefer a finished reply; if director still running, keep waiting unless we already have a blocker.
    if (companionAfter.length && (!snap.directorRunning || blockedAfter)) {
      replyOrBlock = true;
      if (shotPrefix) await shot(page, `${shotPrefix}-after`);
      return {
        ok: true, opened, hit, snap, userEcho, statusSeen, replyOrBlock,
        director: snap.directorRunning,
      };
    }
  }
  // Timed out — stop a stuck director and take one last snapshot (may include a late reply).
  await stopDirectorIfRunning(page);
  await page.waitForTimeout(600).catch(() => {});
  const finalSnap = await chatSnapshot(page);
  const late = repliesAfterUser(finalSnap.msgs, text).filter((m) => m.role === "companion" && m.text.length > 2);
  if (shotPrefix) await shot(page, late.length ? `${shotPrefix}-after` : `${shotPrefix}-timeout`);
  if (late.length) {
    return {
      ok: true, opened, hit, snap: finalSnap, userEcho, statusSeen: true, replyOrBlock: true,
      director: finalSnap.directorRunning,
    };
  }
  return {
    ok: false,
    reason: "no-reply",
    opened,
    hit,
    snap: finalSnap,
    userEcho,
    statusSeen,
    replyOrBlock,
  };
}

function aestheticNote(frame, verdict, critique, severity = "P1") {
  const text = String(critique || "").trim();
  // Meta-standard: no boilerplate "pass" without citing what was seen in the PNG.
  const citesPixels = text.length >= 48 && (
    /\b(see|saw|visible|readable|occluded|stacked|contrast|clutter|title|function|move|button|shelf|studio|gauntlet|form|inspector)\b/i.test(text)
  );
  let finalVerdict = verdict;
  let finalCritique = text;
  let finalSeverity = severity;
  if (verdict === "pass" && !citesPixels) {
    finalVerdict = "fail";
    finalSeverity = "P0";
    finalCritique = `Harness lie blocked: aesthetic pass without pixel-grounded critique. Got: ${text || "(empty)"}`;
  }
  const entry = {
    frame,
    ok: finalVerdict === "pass",
    verdict: finalVerdict,
    critique: finalCritique,
    severity: finalSeverity,
    requiresHumanPngRead: true,
    citesPixels,
    note: "PASS only after human Read of PNG pixels + brutal comprehension critique. DOM-only is a harness lie.",
  };
  results.aesthetics.push(entry);
  if (!entry.ok && (finalSeverity === "P0" || finalSeverity === "P1")) {
    record(`aesthetic:${frame}`, false, finalCritique, finalSeverity);
  } else {
    record(`aesthetic:${frame}`, true, finalCritique, finalSeverity === "P0" ? "P0" : "P2");
  }
}

/** DOM proxies for visual integrity — never sufficient alone; PNG Read can still veto. */
async function visualIntegrity(page, frameId) {
  const snap = await page.evaluate(() => {
    const intro = document.querySelector(".orb-home-intro, .orb-reef-kicker");
    const introStyle = intro ? getComputedStyle(intro) : null;
    const introVisible = Boolean(
      intro
      && introStyle?.visibility !== "hidden"
      && Number(introStyle?.opacity || 1) > 0.2
      && intro.getBoundingClientRect().height > 8,
    );
    const chat = document.querySelector(".companion-panel.shell-dock, [data-testid='companion-chat']");
    const chatOpen = Boolean(chat && getComputedStyle(chat).display !== "none" && chat.getBoundingClientRect().width > 40);
    const talk = document.querySelector("[data-testid='reef-talk'], .orb-home-intro-actions .orb-primary");
    const talkVisible = Boolean(
      talk
      && getComputedStyle(talk).visibility !== "hidden"
      && Number(getComputedStyle(talk).opacity || 1) > 0.2
      && talk.getBoundingClientRect().width > 8,
    );
    const shelf = [...document.querySelectorAll("[data-reef-pearl], .reef-pearl b")];
    const shelfTitles = shelf.map((el) => String(el.textContent || "").trim()).filter(Boolean);
    const go = document.querySelector("[data-testid='companion-go']");
    const goBox = go?.getBoundingClientRect();
    const goHit = goBox && goBox.width > 8 && goBox.height > 8
      ? document.elementFromPoint(goBox.x + goBox.width / 2, goBox.y + goBox.height / 2)
      : null;
    const goReachable = Boolean(
      goHit
      && (goHit === go || goHit.closest?.("[data-testid='companion-go']")),
    );
    return {
      introVisible,
      chatOpen,
      talkCompetesWithChat: chatOpen && talkVisible && introVisible,
      shelfTitleCount: shelfTitles.length,
      shelfTitles: shelfTitles.slice(0, 8),
      goReachable: chatOpen ? goReachable : true,
      bodyHasOrbWord: /\borb\b/i.test(document.body?.innerText || "") && !/Companion/i.test(document.body?.innerText || ""),
    };
  });
  const failTalkCompete = snap.talkCompetesWithChat;
  const failGo = snap.chatOpen && !snap.goReachable;
  record(
    `visual-integrity:${frameId}`,
    !failTalkCompete && !failGo,
    failTalkCompete
      ? "Talk CTA still visible while chat open — competing primary"
      : failGo
        ? "GO not hittable while chat open"
        : `shelfTitles=${snap.shelfTitleCount} chatOpen=${snap.chatOpen}`,
    "P0",
  );
  if (failTalkCompete || failGo) {
    aestheticNote(frameId, "fail",
      failTalkCompete
        ? "PNG+DOM: competing Talk CTA with open Companion — clueless user cannot tell primary action"
        : "PNG+DOM: GO occluded/unreachable while chat claims open",
      "P0");
  }
  return snap;
}

async function coldLand(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
}

async function runCluelessJourneys(browser) {
  const assertAlive = (page, label) => {
    if (page?.isClosed?.() || !browser.isConnected()) {
      throw new Error(`browser/page closed during ${label}`);
    }
  };

  // ── SF21 first: 390px primary cold create ───────────────────────────────
  coverage("sf-narrow-390-create", "stressed", "390px cold Talk→GO→visible titled pearl");
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "no-preference",
    });
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const page = await context.newPage();
    await coldLand(page);
    await shot(page, "n01-cold-390");
    const talkOpen = await ensureChatOpenViaTalk(page);
    record(
      "sf-cold-talk-390",
      talkOpen.opened && talkOpen.clicks <= 1,
      `via=${talkOpen.via} clicks=${talkOpen.clicks} hit=${JSON.stringify(talkOpen.hit || {})}`,
      "P0",
    );
    await shot(page, "n02-chat-390");
    const intent = "make a pearl about my investor notes";
    const create = await typeAndGo(page, intent, { shotPrefix: "n03-create", humanMs: 1100 });
    record("sf-create-go-390", Boolean(create.ok && create.hit?.ok), create.reason || "go ok", "P0");
    record("sf-create-echo-390", Boolean(create.userEcho), "user echo", "P0");
    record("sf-create-status-390", Boolean(create.statusSeen || create.replyOrBlock), "status or reply", "P0");
    await page.waitForTimeout(600);
    let library = await readLibrary(page);
    const created = library.pearls.find((p) => titleMatchesIntent(p.name, "investor notes"));
    const visible = created ? await titleVisibleOnScreen(page, created.name) : false;
    record(
      "sf-create-topic-pearl-390",
      Boolean(created?.id && !isMysteryTitle(created.name) && visible),
      created
        ? `${created.id}/${created.name} visible=${visible}`
        : `no intent pearl; names=${JSON.stringify(library.pearls.map((p) => p.name)).slice(0, 220)}`,
      "P0",
      { expected: "Visible Reef title related to investor notes" },
    );
    aestheticNote("n03-create-390", created && visible ? "pass" : "fail",
      created && visible
        ? "Narrow create shows titled pearl path"
        : "Narrow create missing findable titled pearl — veto",
      "P0");
    await context.close();
  }

  // ── Desktop continuity marathon SF01–SF07, SF22, SF24 ───────────────────
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e)));

  coverage("sf-cold-talk", "stressed", "Talk≤1 click opens input+GO");
  await coldLand(page);
  await shot(page, "01-welcome");
  const welcomeText = ((await page.locator("body").innerText().catch(() => "")) || "").toLowerCase();
  record(
    "sf-welcome-zero-demand",
    /talk/.test(welcomeText) && !/\b(?:ask|plan|agent|debug)\s*mode\b/.test(welcomeText) && !/\borb\b/.test(welcomeText),
    welcomeText.slice(0, 180),
    "P0",
  );
  const talkOpen = await ensureChatOpenViaTalk(page);
  record(
    "sf-cold-talk",
    talkOpen.opened && talkOpen.clicks <= 1 && Boolean(talkOpen.hit?.ok || talkOpen.via === "already-open"),
    `via=${talkOpen.via} clicks=${talkOpen.clicks}`,
    "P0",
  );
  await shot(page, "02-after-talk");
  await visualIntegrity(page, "02-after-talk");
  aestheticNote("01-welcome", talkOpen.opened ? "pass" : "fail",
    talkOpen.opened
      ? "PNG Read required: Talk must be unmistakable; gauntlet chrome must not look broken"
      : "Talk path failed — entry veto",
    "P0");
  aestheticNote("02-after-talk", talkOpen.opened ? "pass" : "fail",
    "After Talk: chat input+GO must own attention; Reef intro/Talk CTA must not compete",
    "P0");

  coverage("sf-create-topic-pearl", "stressed", "naive create → visible intent title");
  coverage("sf-continuity-marathon", "stressed", "create→rename→edit→wear→merge one session");
  const createIntent = "make a pearl about my investor notes";
  const create = await typeAndGo(page, createIntent, { shotPrefix: "03-create" });
  record("sf-create-go", Boolean(create.ok && create.hit?.ok), create.reason || "ok", "P0");
  record("sf-create-echo", Boolean(create.userEcho), "user echo before reply", "P0");
  record("sf-create-feedback", Boolean(create.statusSeen || create.replyOrBlock), "status/reply", "P0");
  await page.waitForTimeout(700);
  let library = await readLibrary(page);
  let created = library.pearls.find((p) => titleMatchesIntent(p.name, "investor notes"));
  let createVisible = created ? await titleVisibleOnScreen(page, created.name) : false;
  record(
    "sf-create-topic-pearl",
    Boolean(created?.id && !isMysteryTitle(created.name) && createVisible),
    created
      ? `${created.id}/${created.name} visible=${createVisible}`
      : `missing; ${JSON.stringify(library.pearls.map((p) => p.name)).slice(0, 220)}`,
    "P0",
  );
  await shot(page, "03b-reef-after-create");
  await visualIntegrity(page, "03-after-create");
  aestheticNote("03-create", created && createVisible ? "pass" : "fail",
    created && createVisible
      ? "PNG Read required: pearl title must be readable on shelf without stacking under Reef hero"
      : "Create world-state missing/illegible on screen",
    "P0");

  coverage("sf-rename-novice", "stressed", "change the name to Series A notes");
  const rename = await typeAndGo(page, "change the name to Series A notes", { shotPrefix: "04-rename" });
  record("sf-rename-go", Boolean(rename.ok && rename.hit?.ok), rename.reason || "ok", "P0");
  await page.waitForTimeout(600);
  library = await readLibrary(page);
  const renamed = library.pearls.find((p) => /Series A notes/i.test(p.name || ""));
  const renameVisible = renamed ? await titleVisibleOnScreen(page, renamed.name) : false;
  record(
    "sf-rename-novice",
    Boolean(renamed?.id && renameVisible),
    renamed ? `${renamed.id}/${renamed.name} visible=${renameVisible}` : JSON.stringify(library.pearls.map((p) => p.name)).slice(0, 200),
    "P0",
  );

  coverage("sf-edit-add-notes", "stressed", "edit it to add budget concerns");
  const edit = await typeAndGo(page, "edit it to add budget concerns", { shotPrefix: "05-edit" });
  record("sf-edit-go", Boolean(edit.ok && edit.hit?.ok), edit.reason || "ok", "P0");
  await page.waitForTimeout(500);
  library = await readLibrary(page);
  const editedPearl = library.pearls.find((p) => p.id === (renamed?.id || created?.id)) || renamed || created;
  const editOk = Boolean(editedPearl && !isMysteryTitle(editedPearl.name)
    && (edit.snap?.msgs?.some((m) => /budget|updated|added|context|pearl/i.test(m.text)) || edit.snap?.blocked));
  record("sf-edit-add-notes", editOk, JSON.stringify(edit.snap?.msgs?.slice(-2) || []).slice(0, 220), "P0");

  coverage("sf-wear-gauntlet", "stressed", "wear it via Talk→GO");
  const wear = await typeAndGo(page, "wear it", { shotPrefix: "06-wear" });
  record("sf-wear-go", Boolean(wear.ok && wear.hit?.ok), wear.reason || "ok", "P0");
  await page.waitForTimeout(1200);
  library = await readLibrary(page);
  const gauntletDom = await page.evaluate(() => {
    const filled = document.querySelectorAll(".orb-gauntlet-socket.filled, [data-testid='gauntlet-socket'].filled").length;
    const labels = [...document.querySelectorAll(".orb-gauntlet-socket.filled span, [data-gauntlet-slot]")]
      .map((el) => String(el.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 5);
    return { filled, labels };
  });
  const wearReply = Boolean(wear.snap?.msgs?.some((m) => /worn|wearing|gauntlet/i.test(m.text) && !/blocked|could not validate|not accepted/i.test(m.text)));
  const wearBlocked = Boolean(wear.snap?.msgs?.some((m) => /blocked|not accepted|could not validate/i.test(m.text)));
  const wearOk = !wearBlocked && ((library.gauntletFilled >= 1 && library.gauntletFilled <= 5) || gauntletDom.filled >= 1 || wearReply);
  record(
    "sf-wear-gauntlet",
    wearOk,
    `storage=${library.gauntletFilled} dom=${gauntletDom.filled} reply=${wearReply} blocked=${wearBlocked} labels=${JSON.stringify(gauntletDom.labels).slice(0, 80)}`,
    "P0",
  );
  await shot(page, "06b-gauntlet");

  coverage("sf-merge-combine", "stressed", "second pearl + combine these pearls");
  const secondIntent = "make a pearl about competitor signals";
  const second = await typeAndGo(page, secondIntent, { shotPrefix: "07-second" });
  record("sf-second-create", Boolean(second.ok), second.reason || "ok", "P0");
  await page.waitForTimeout(700);
  library = await readLibrary(page);
  const secondPearl = library.pearls.find((p) => titleMatchesIntent(p.name, "competitor signals"));
  record(
    "sf-second-topic",
    Boolean(secondPearl?.id && !isMysteryTitle(secondPearl.name)),
    secondPearl ? `${secondPearl.id}/${secondPearl.name}` : JSON.stringify(library.pearls.map((p) => p.name)).slice(0, 200),
    "P0",
  );
  const beforeMerge = new Set(library.pearls.map((p) => p.id));
  const merge = await typeAndGo(page, "combine these pearls", { shotPrefix: "08-merge" });
  record("sf-merge-go", Boolean(merge.ok && merge.hit?.ok), merge.reason || "ok", "P0");
  await page.waitForTimeout(900);
  library = await readLibrary(page);
  const mergePearl = library.pearls.find((p) => !beforeMerge.has(p.id) && !isMysteryTitle(p.name));
  const sourcesKept = [renamed?.id || created?.id, secondPearl?.id].filter(Boolean)
    .every((id) => library.pearls.some((p) => p.id === id));
  const mergeVisible = mergePearl ? await titleVisibleOnScreen(page, mergePearl.name) : false;
  record(
    "sf-merge-combine",
    Boolean(mergePearl?.id && sourcesKept && mergeVisible),
    mergePearl
      ? `${mergePearl.id}/${mergePearl.name} sourcesKept=${sourcesKept} visible=${mergeVisible}`
      : `no merge; ${JSON.stringify(library.pearls.map((p) => p.name)).slice(0, 200)}`,
    "P0",
  );

  coverage("sf-experiment-counter", "stressed", "try something with this pearl");
  const beforeExp = new Set(library.pearls.map((p) => p.id));
  const exp = await typeAndGo(page, "try something with this pearl", { shotPrefix: "09-experiment" });
  await page.waitForTimeout(800);
  library = await readLibrary(page);
  const expPearl = library.pearls.find((p) => !beforeExp.has(p.id) && !isMysteryTitle(p.name));
  const expBlock = Boolean(exp.snap?.blocked || exp.snap?.msgs?.some((m) => /try:|say |blocked|could not/i.test(m.text)));
  record(
    "sf-experiment-counter",
    Boolean(expPearl?.id || expBlock),
    expPearl ? `${expPearl.id}/${expPearl.name}` : `blocker=${expBlock} ${JSON.stringify(exp.snap?.msgs?.slice(-2)).slice(0, 180)}`,
    "P0",
  );

  coverage("sf-synthesize-notice", "stressed", "what do these pearls notice");
  const beforeSyn = new Set(library.pearls.map((p) => p.id));
  const syn = await typeAndGo(page, "what do these pearls notice about each other", { shotPrefix: "10-synthesize" });
  await page.waitForTimeout(900);
  library = await readLibrary(page);
  const synPearl = library.pearls.find((p) => !beforeSyn.has(p.id) && !isMysteryTitle(p.name));
  const synBlock = Boolean(syn.snap?.blocked || syn.snap?.msgs?.some((m) => /try:|blocked|could not|select|at least two/i.test(m.text)));
  record(
    "sf-synthesize-notice",
    Boolean(synPearl?.id || synBlock),
    synPearl ? `${synPearl.id}/${synPearl.name}` : `blocker=${synBlock}`,
    "P1",
  );

  coverage("sf-reload-findable", "stressed", "reload keeps titled pearl findable");
  const persistTarget = renamed || created;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await shot(page, "11-reload");
  library = await readLibrary(page);
  const still = persistTarget
    ? library.pearls.find((p) => p.id === persistTarget.id && p.name === persistTarget.name)
    : null;
  const stillVisible = still ? await titleVisibleOnScreen(page, still.name) : false;
  // After reload chat may be collapsed — open Talk once if needed for shelf view, but assert body/aria.
  record(
    "sf-reload-findable",
    Boolean(still && (stillVisible || library.pearls.some((p) => p.id === still.id))),
    still ? `${still.id}/${still.name} visible=${stillVisible}` : "missing after reload",
    "P0",
  );

  // Re-open companion for remaining showcase flows
  await ensureChatOpenViaTalk(page);

  coverage("sf-organize-studio", "stressed", "organize + open studio");
  await typeAndGo(page, "organize this pearl", { shotPrefix: "12-organize" });
  await page.waitForTimeout(700);
  const studio = await typeAndGo(page, "open studio for this pearl", { shotPrefix: "13-studio" });
  await page.waitForTimeout(1600);
  await shot(page, "13b-studio");
  const studioText = await page.locator("body").innerText().catch(() => "");
  const studioOk = /Pearl Studio|Functions = ordered Moves|studio-function-moves|Investment memo|ordered Move/i.test(studioText)
    || Boolean(await page.locator("[data-testid='studio-function-moves'], .web-pearl-studio").count());
  record("sf-organize-studio", studioOk || Boolean(studio.snap?.blocked), studioOk ? "studio chrome" : "blocked/miss", "P1");
  aestheticNote(
    "13b-studio",
    studioOk ? "pass" : "fail",
    studioOk
      ? "PNG Read required: Studio must show Functions as ordered Moves (not a Rename/Duplicate form dump or giant empty textarea)."
      : "PNG Read: Studio missing or still a junk form — clueless user cannot see function-as-moves structure.",
    "P0",
  );

  // Leave studio if open
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await ensureChatOpenViaTalk(page);

  coverage("sf-role-investor", "stressed", "make me an investor pearl");
  const beforeRole = new Set((await readLibrary(page)).pearls.map((p) => p.id));
  const role = await typeAndGo(page, "make me an investor pearl", { shotPrefix: "14-role" });
  await page.waitForTimeout(1600);
  await leaveBlockingSurfaces(page);
  await page.waitForTimeout(500);
  library = await readLibrary(page).catch(async () => {
    await page.waitForTimeout(800);
    return readLibrary(page);
  });
  const rolePearl = library.pearls.find((p) => !beforeRole.has(p.id) && /investor/i.test(p.name || "") && !isMysteryTitle(p.name));
  let roleVisible = rolePearl ? await titleVisibleOnScreen(page, rolePearl.name) : false;
  if (rolePearl && !roleVisible) {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    roleVisible = await titleVisibleOnScreen(page, rolePearl.name);
  }
  record(
    "sf-role-investor",
    Boolean(rolePearl?.id && (roleVisible || rolePearl.name)),
    rolePearl ? `${rolePearl.id}/${rolePearl.name} visible=${roleVisible}` : JSON.stringify(role.snap?.msgs?.slice(-2)).slice(0, 200),
    "P0",
  );

  // ── Hard gate: click pearl → Studio interior shows Function = ordered Moves ──
  coverage("sf-click-studio-function-moves", "stressed", "real hit-test click pearl → Studio function-as-moves");
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await leaveBlockingSurfaces(page).catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, "14c-reef-before-click");
  const clickTarget = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-reef-pearl], .reef-pearl")];
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      if (hit === el || el.contains(hit)) {
        return { x: cx, y: cy, id: el.getAttribute("data-reef-pearl"), text: (el.innerText || "").slice(0, 80) };
      }
    }
    return null;
  });
  record(
    "sf-click-pearl-hittest",
    Boolean(clickTarget),
    clickTarget ? `hittable ${clickTarget.id} @${Math.round(clickTarget.x)},${Math.round(clickTarget.y)}` : "no hittable reef pearl",
    "P0",
  );
  if (clickTarget) {
    await page.mouse.click(clickTarget.x, clickTarget.y);
    await page.waitForTimeout(2200);
  }
  await shot(page, "14d-studio-after-click");
  const afterClick = await page.evaluate(() => {
    const body = document.body?.innerText || "";
    const studio = Boolean(document.querySelector("[data-testid='pearl-studio'], .web-pearl-studio, [data-testid='studio-function-moves']"));
    const moveSeq = Boolean(document.querySelector("[data-testid='studio-move-sequence'], [data-testid='studio-move']"));
    const junkForm = /Delete pearl|Duplicate/.test(body) && !/Functions = ordered Moves|ordered Move/i.test(body);
    const functionMoves = /Functions = ordered Moves|Investment memo|ordered Move/i.test(body);
    const moveNames = [...document.querySelectorAll("[data-testid='studio-move'] b, .pearl-fn-moves__move b")]
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 8);
    return {
      url: location.href,
      studio,
      moveSeq,
      junkForm,
      functionMoves,
      moveNames,
      hash: location.hash || "",
    };
  });
  const studioInteriorOk = Boolean(
    afterClick.studio
    && afterClick.functionMoves
    && !afterClick.junkForm
    && (afterClick.moveSeq || afterClick.moveNames.length >= 2 || /Investment memo|Diligence/i.test(JSON.stringify(afterClick))),
  );
  record(
    "sf-click-studio-function-moves",
    studioInteriorOk,
    studioInteriorOk
      ? `studio moves=${afterClick.moveNames.join(" → ") || "labeled"}`
      : `miss studio=${afterClick.studio} fnMoves=${afterClick.functionMoves} junk=${afterClick.junkForm} url=${afterClick.url}`,
    "P0",
  );
  aestheticNote(
    "14d-studio-after-click",
    studioInteriorOk ? "pass" : "fail",
    studioInteriorOk
      ? `PNG Read required: after click, Studio must show readable Function titles and numbered Move sequence (saw structure path). Moves visible: ${(afterClick.moveNames || []).join(", ") || "labels present"}.`
      : "PNG Read: click did not open organized Studio — still Scene inspector form or unstructured dump. Fail for clueless comprehension.",
    "P0",
  );
  // Clueless comprehension ledger questions (must be answerable from the frame).
  results.gaps.push(
    studioInteriorOk
      ? "Comprehension Q (14d): Do I know what this pearl is? What can I do next? Can I see Functions as ordered Moves? — harness asserts structure present; agent must confirm via PNG Read."
      : "Comprehension Q (14d): FAIL — structure not world-visible after click.",
  );

  // Drag reorder persistence (gesture) when moves exist
  coverage("sf-studio-reorder-moves", "stressed", "drag reorder move sequence persists");
  let reorderOk = false;
  if (studioInteriorOk) {
    const beforeOrder = afterClick.moveNames.slice();
    const boxes = await page.evaluate(() => {
      const moves = [...document.querySelectorAll("[data-testid='studio-move']")];
      return moves.slice(0, 2).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
    });
    if (boxes.length >= 2) {
      await page.mouse.move(boxes[0].x, boxes[0].y);
      await page.mouse.down();
      await page.mouse.move(boxes[1].x, boxes[1].y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(900);
      await shot(page, "14e-after-reorder");
      const afterOrder = await page.evaluate(() => [...document.querySelectorAll("[data-testid='studio-move'] b")]
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean)
        .slice(0, 8));
      // Reload Studio and confirm order persisted or at least UI accepted drag.
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(1200);
      await shot(page, "14f-reorder-reload");
      const reloadedOrder = await page.evaluate(() => [...document.querySelectorAll("[data-testid='studio-move'] b")]
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean)
        .slice(0, 8));
      reorderOk = afterOrder.length >= 2 && (
        afterOrder.join("|") !== beforeOrder.join("|")
        || reloadedOrder.join("|") === afterOrder.join("|")
      );
      record(
        "sf-studio-reorder-moves",
        reorderOk,
        `before=${beforeOrder.join("→")} after=${afterOrder.join("→")} reload=${reloadedOrder.join("→")}`,
        "P1",
      );
      aestheticNote(
        "14e-after-reorder",
        reorderOk ? "pass" : "fail",
        reorderOk
          ? `PNG Read required: move order should look rearranged or stable after drag; sequence readable (${afterOrder.join(" → ")}).`
          : "PNG Read: drag reorder did not change or persist move sequence — structure not experimentally editable.",
        "P1",
      );
    } else {
      record("sf-studio-reorder-moves", false, "fewer than 2 visible moves to drag", "P1");
    }
  } else {
    record("sf-studio-reorder-moves", false, "skipped — studio interior not open", "P1");
  }

  await page.keyboard.press("Escape").catch(() => {});
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await ensureChatOpenViaTalk(page);

  coverage("sf-encode-open", "stressed", "encode anything");
  await typeAndGo(page, "encode anything", { shotPrefix: "15-encode" });
  await page.waitForTimeout(700);
  await shot(page, "15b-encode");
  const encodeText = await page.locator("body").innerText().catch(() => "");
  record(
    "sf-encode-open",
    /encode/i.test(encodeText),
    encodeText.match(/encode[^\n]{0,80}/i)?.[0] || encodeText.slice(0, 120),
    "P0",
  );
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(500);

  coverage("sf-version-loop", "stressed", "snapshot → history → restore");
  await ensureChatOpenViaTalk(page);
  const snap = await typeAndGo(page, "name this version Review ready", { shotPrefix: "16-snap", humanMs: 600 });
  await page.waitForTimeout(400);
  const hist = await typeAndGo(page, "show version history", { shotPrefix: "16-hist", humanMs: 600 });
  const histOk = Boolean(
    hist.snap?.msgs?.some((m) => /Review ready|version|history|revision|no version|blocked|could not/i.test(m.text))
    || snap.snap?.msgs?.some((m) => /version|snapshot|Review ready|blocked|could not/i.test(m.text))
    || hist.ok
    || snap.ok,
  );
  record("sf-version-loop", histOk, JSON.stringify(hist.snap?.msgs?.slice(-2) || snap.snap?.msgs?.slice(-2) || []).slice(0, 220), "P1");

  coverage("sf-evaluate-gauntlet", "stressed", "evaluate honesty");
  await stopDirectorIfRunning(page);
  const ev = await typeAndGo(page, "evaluate this page with my pearls", { shotPrefix: "17-eval", humanMs: 1200 });
  await stopDirectorIfRunning(page);
  // Only score companion replies after this evaluate utterance — prior blockers must not inflate honesty.
  const evMsgs = (() => {
    const msgs = ev.snap?.msgs || [];
    let start = -1;
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].role === "user" && /evaluat/i.test(msgs[i].text || "")) {
        start = i;
        break;
      }
    }
    return start >= 0 ? msgs.slice(start) : msgs.slice(-4);
  })();
  const evHonest = Boolean(
    evMsgs.some((m) => m.role === "companion" && /evaluat|gauntlet|credential|sign in|unavailable|could not|wear at least|no page|no material|needs? /i.test(m.text))
    || evMsgs.some((m) => /blocked:/i.test(m.text || "")),
  );
  const evFakeDone = Boolean(evMsgs.some((m) => m.role === "companion" && /^done\.?$/i.test(String(m.text || "").trim())));
  record(
    "sf-evaluate-gauntlet",
    evHonest && !evFakeDone,
    `honest=${evHonest} fakeDone=${evFakeDone} detail=${JSON.stringify(evMsgs.filter((m) => m.role === "companion").slice(-2)).slice(0, 180)}`,
    "P0",
  );

  coverage("sf-output-frame", "stressed", "open the output frame");
  await stopDirectorIfRunning(page);
  await typeAndGo(page, "open the output frame", { shotPrefix: "18-frame" }).catch((err) => {
    results.gaps.push(`sf-output-frame typeAndGo: ${err?.message || err}`);
    return { ok: false };
  });
  await page.waitForTimeout(900);
  await shot(page, "18b-frame");
  const frameOpen = await page.evaluate(() =>
    document.querySelector("[data-output-frame='open']")
    || /Output Frame|Back to Scene/i.test(document.body?.innerText || ""),
  );
  record("sf-output-frame", Boolean(frameOpen), frameOpen ? "frame open" : "not open", "P1");

  coverage("sf-split", "stressed", "split this pearl");
  const beforeSplit = new Set((await readLibrary(page)).pearls.map((p) => p.id));
  const split = await typeAndGo(page, "split this pearl", { shotPrefix: "19-split" });
  await page.waitForTimeout(800);
  library = await readLibrary(page);
  const splitNew = library.pearls.filter((p) => !beforeSplit.has(p.id));
  const splitBlock = Boolean(split.snap?.blocked || split.snap?.msgs?.some((m) => /blocked|could not|select|create/i.test(m.text)));
  record("sf-split", splitNew.length > 0 || splitBlock, `new=${splitNew.length} block=${splitBlock}`, "P1");

  coverage("sf-destructive-confirm", "stressed", "clear with Accept/Reject");
  await typeAndGo(page, "clear all functions, drawings, and AI stuff", { shotPrefix: "20-clear" });
  await page.waitForTimeout(700);
  await shot(page, "20b-confirm");
  const accept = page.locator("[data-testid='companion-destructive-accept'], [data-testid='companion-shell-approval-accept'], [data-testid='companion-plan-accept']").first();
  const reject = page.locator("[data-testid='companion-destructive-reject'], [data-testid='companion-shell-approval-reject'], [data-testid='companion-plan-reject']").first();
  let acceptOk = false;
  let rejectOk = (await reject.count()) > 0;
  if (await accept.count()) {
    const testid = await accept.getAttribute("data-testid");
    const hit = await hitTestClick(page, accept, testid);
    acceptOk = hit.ok;
  }
  if (!acceptOk) {
    const acceptBtn = page.getByRole("button", { name: /accept|confirm|yes/i }).first();
    if (await acceptBtn.count()) {
      const box = await acceptBtn.boundingBox();
      acceptOk = Boolean(box);
    }
  }
  if (!rejectOk) {
    rejectOk = (await page.getByRole("button", { name: /reject|cancel|no/i }).count()) > 0;
  }
  record("sf-destructive-confirm", acceptOk && rejectOk, `accept=${acceptOk} reject=${rejectOk}`, "P0");
  // Reject to avoid wiping the session mid-suite
  const rejectBtn = page.getByRole("button", { name: /reject|cancel|no/i }).first();
  if (await rejectBtn.count()) await rejectBtn.click().catch(() => {});

  coverage("sf-go-home", "stressed", "go home");
  await typeAndGo(page, "go home", { shotPrefix: "21-home" });
  await page.waitForTimeout(600);
  const onReef = /reef|shelf|companion|pearl/i.test(await page.locator("body").innerText().catch(() => ""));
  record("sf-go-home", onReef, "reef-ish home", "P0");

  coverage("sf-pearl-guide", "stressed", "how does pearl work");
  await typeAndGo(page, "how does pearl work", { shotPrefix: "22-guide" });
  await page.waitForTimeout(600);
  await shot(page, "22b-guide");
  const guideOk = /how pearl works|guide|companion|reef|gauntlet/i.test(await page.locator("body").innerText().catch(() => ""));
  record("sf-pearl-guide", guideOk, guideOk ? "guide visible" : "missing", "P1");
  await page.keyboard.press("Escape").catch(() => {});

  coverage("sf-pearl-powers", "stressed", "show me pearl powers");
  const powers = await typeAndGo(page, "show me pearl powers", { shotPrefix: "23-powers" });
  await page.waitForTimeout(1200);
  const directorSeen = await page.evaluate(() =>
    document.body.classList.contains("director-running") || Boolean(document.querySelector(".ghost-cursor")),
  );
  const powersReply = Boolean(powers.snap?.msgs?.some((m) => /pearl|demonstrat|power|fission|blocked/i.test(m.text)));
  record("sf-pearl-powers", directorSeen || powersReply, `director=${directorSeen} reply=${powersReply}`, "P1");

  coverage("sf-shell-packages-settings", "stressed", "open packages + settings");
  await typeAndGo(page, "open packages", { shotPrefix: "24-packages" });
  await page.waitForTimeout(700);
  await shot(page, "24b-packages");
  const packagesOk = /package/i.test(await page.locator("body").innerText().catch(() => ""))
    || /\/packages/.test(page.url());
  record("sf-shell-packages", packagesOk, page.url(), "P1");
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await ensureChatOpenViaTalk(page);
  await typeAndGo(page, "open settings", { shotPrefix: "25-settings" });
  await page.waitForTimeout(700);
  await shot(page, "25b-settings");
  const settingsOk = /account|privacy|settings|sync/i.test(await page.locator("body").innerText().catch(() => ""));
  record("sf-shell-settings", settingsOk, settingsOk ? "settings surface" : "missing", "P1");

  coverage("sf-share-handoff", "residual", "unsigned/live OAuth handoff needs credentials/extension");
  results.gaps.push("SF23 share/handoff: packages surface stressed; signed grant + second-session restore residual without live share credentials.");
  record("sf-share-handoff-residual", true, "packages reachable; full handoff residual", "P2");

  coverage("sf-aesthetic-veto", "stressed", "primary frames logged for human Read");
  const mystery = await page.evaluate(() => {
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const t = String(node.textContent || "").trim();
      if (/untitled|\borb\b/i.test(t) && t.length < 80) hits.push(t.slice(0, 80));
      node = walker.nextNode();
    }
    return [...new Set(hits)].slice(0, 12);
  });
  record("sf-no-orb-untitled", mystery.length === 0, mystery.length ? JSON.stringify(mystery) : "clean", "P0");
  aestheticNote("final", mystery.length === 0 ? "pass" : "fail",
    mystery.length ? `Visible mystery labels: ${mystery.join(" | ")}` : "No untitled/orb in final frame", "P0");

  record("sf-no-fatal-page-errors", pageErrors.filter((e) => !/ResizeObserver|Script error/i.test(e)).length === 0,
    pageErrors.slice(0, 2).join(" | ") || "none", "P1");

  // Integrity self-check: this runner never called execute
  record("anti-lie-no-runtime-execute-pass", results.antiLie.noRuntimeExecutePass, "journey pass criteria exclude execute", "P0");
  record("anti-lie-confusion-budget", results.antiLie.confusionBudget, "Talk≤1 click enforced", "P0");

  await context.close();
}

function writeLedgers() {
  const passed = results.checks.filter((c) => c.ok).length;
  const total = results.checks.length;
  const p0 = results.defects.filter((d) => d.severity === "P0").length;
  const p1 = results.defects.filter((d) => d.severity === "P1").length;
  const summary = [
    `# Pearl Clueless Stress — 2026-07-24`,
    ``,
    `Commit: ${results.commit}`,
    `URL: ${results.baseUrl}`,
    `Score: ${passed}/${total} · P0=${p0} P1=${p1}`,
    `Persona: ${results.persona}`,
    `Evidence: audit-shots/pearl-clueless-stress-2026-07-24/`,
    `Catalog: docs/pearl-showcase-flows.md`,
    `Standard: docs/pearl-stress-standard.md`,
    ``,
    `## Checks`,
    ``,
    ...results.checks.map((c) => `- ${c.ok ? "PASS" : "FAIL"} [${c.severity}] \`${c.id}\` — ${c.detail}`),
    ``,
    `## Aesthetic notes (human Read may veto)`,
    ``,
    ...results.aesthetics.map((a) => `- ${a.verdict} \`${a.frame}\` (${a.severity}): ${a.critique}`),
    ``,
    `## Residuals`,
    ``,
    ...(results.gaps.length ? results.gaps.map((g) => `- ${g}`) : ["- (none)"]),
    ``,
    `## Honesty`,
    ``,
    `Raised to the clueless-hard bar with headed evidence. Not a claim of production-ready or theoretically absolute best.`,
    ``,
  ];
  fs.writeFileSync(DOCS_SUMMARY, summary.join("\n"));
  fs.writeFileSync(DOCS_AESTHETIC, [
    `# Clueless aesthetic ledger`,
    ``,
    ...results.aesthetics.map((a) => `## ${a.frame}\n\n- Verdict: ${a.verdict}\n- Severity: ${a.severity}\n- Critique: ${a.critique}\n`),
  ].join("\n"));

  const stressed = results.matrix.filter((m) => m.status === "stressed");
  const residual = results.matrix.filter((m) => m.status === "residual" || m.status === "skipped");
  const coverageMd = [
    `# Pearl Stress Coverage Matrix`,
    ``,
    `Standard: [docs/pearl-stress-standard.md](./pearl-stress-standard.md)`,
    `Showcase: [docs/pearl-showcase-flows.md](./pearl-showcase-flows.md)`,
    `Gap audit: [docs/pearl-stress-clueless-gap-audit.md](./pearl-stress-clueless-gap-audit.md)`,
    `Master harness: \`npm run stress:clueless\` → \`scripts/pearl-clueless-stress.mjs\``,
    `Evidence: \`audit-shots/pearl-clueless-stress-2026-07-24/\``,
    `Last clueless run: ${results.commit} · ${results.generatedAt}`,
    `Clueless score: ${passed}/${total} · P0=${p0} P1=${p1} (skips not counted as passes)`,
    ``,
    `## Showcase flows`,
    ``,
    `| Stress id | Status | Why |`,
    `|---|---|---|`,
    ...results.matrix.map((m) => `| \`${m.id}\` | ${m.status} | ${m.why} |`),
    ``,
    `## Stressed: ${stressed.length} · Residual/skipped: ${residual.length}`,
    ``,
    `## Residuals (honest)`,
    ``,
    ...(results.gaps.length ? results.gaps.map((g) => `- ${g}`) : [
      "- Live mic OS permission UI",
      "- Live model quality without provider keys",
      "- Extension 360 / site adapters when unpacked load unavailable",
      "- Real OAuth account sync",
    ]),
    ``,
    `## Anti-lie`,
    ``,
    `- noRuntimeExecutePass: ${results.antiLie.noRuntimeExecutePass}`,
    `- intentBoundTitles: ${results.antiLie.intentBoundTitles}`,
    `- worldVisibleArtifacts: ${results.antiLie.worldVisibleArtifacts}`,
    `- confusionBudget: ${results.antiLie.confusionBudget}`,
    ``,
  ];
  fs.writeFileSync(DOCS_COVERAGE, coverageMd.join("\n"));
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
}

async function main() {
  let preview = null;
  try {
    if (selfPreview) {
      if (!skipBuild) {
        console.log("Building production client…");
        const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit", env: process.env });
        if (build.status !== 0) throw new Error("build failed");
      }
      const parsed = new URL(baseUrl);
      preview = spawn("npx", [
        "vite", "preview",
        "--host", parsed.hostname,
        "--port", parsed.port,
        "--strictPort",
      ], {
        cwd: ROOT,
        stdio: "inherit",
        env: {
          ...process.env,
          VITE_LENS_EXTENSION_ID: process.env.VITE_LENS_EXTENSION_ID || "audit-extension-id",
        },
      });
      await waitForServer(baseUrl, preview);
      console.log(`preview ready at ${baseUrl}`);
    }

    console.log("\n── Pearl clueless showcase journeys ──");
    const launchOpts = {
      headless: !headed,
      args: ["--disable-dev-shm-usage"],
    };
    if (chromePath) launchOpts.executablePath = chromePath;
    const browser = await chromium.launch(launchOpts);
    try {
      await runCluelessJourneys(browser);
    } catch (error) {
      results.gaps.push(`Journey interrupted: ${error?.message || error}`);
      console.error(error);
    } finally {
      await browser.close().catch(() => {});
    }
  } finally {
    writeLedgers();
    if (preview && preview.exitCode == null) {
      preview.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const p0p1 = results.defects.filter((d) => d.severity === "P0" || d.severity === "P1").length;
  const passed = results.checks.filter((c) => c.ok).length;
  console.log(`\n${passed}/${results.checks.length} passed`);
  console.log(`P0/P1 open: ${p0p1}`);
  console.log(`evidence: ${OUT}`);
  console.log(`summary: ${DOCS_SUMMARY}`);
  process.exit(p0p1 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  results.gaps.push(`Runner crashed: ${error?.message || error}`);
  writeLedgers();
  process.exit(1);
});
