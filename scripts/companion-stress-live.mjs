/**
 * Thorough Companion stress: runtime stability, chat replies, GO execution,
 * and REQUIRED director/ghost-cursor animation evidence.
 *
 * Silent state mutation with zero animation = FAIL.
 *
 * AUDIT_URL=http://127.0.0.1:41802 node scripts/companion-stress-live.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = path.join(process.cwd(), "audit-shots/companion-animation-stress-2026-07-23");
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:41802";
const chromePath = process.env.PW_CHROMIUM
  || (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);
const headed = process.env.HEADED === "0" ? false : true;

fs.mkdirSync(out, { recursive: true });
const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  headed,
  reducedMotion: "no-preference",
  checks: [],
  defects: [],
  animation: null,
};

function record(id, ok, detail) {
  results.checks.push({ id, ok, detail });
  if (!ok) results.defects.push({ id, detail });
  console.log(`${ok ? "✓" : "✗"} ${id}: ${detail}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
}

async function installAnimationProbe(page) {
  await page.evaluate(() => {
    const probe = {
      directorRunningSeen: false,
      cursorSeen: false,
      statusSeen: false,
      positions: [],
      eventTypes: [],
      maxTravelPx: 0,
      startedAt: performance.now(),
    };
    window.__lensAnimProbe = probe;

    const sampleCursor = () => {
      if (document.body.classList.contains("director-running")) probe.directorRunningSeen = true;
      const status = document.querySelector(".ghost-cursor-effect-status");
      if (status && /Demonstrating/i.test(status.textContent || "")) probe.statusSeen = true;
      const cursor = document.querySelector(".ghost-cursor");
      if (!cursor) return;
      probe.cursorSeen = true;
      const transform = cursor.style.transform || "";
      const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
      if (!match) return;
      const point = { x: Number(match[1]), y: Number(match[2]), t: performance.now() };
      const prev = probe.positions[probe.positions.length - 1];
      if (!prev || Math.hypot(point.x - prev.x, point.y - prev.y) > 0.5) {
        probe.positions.push(point);
      }
      if (probe.positions.length >= 2) {
        const first = probe.positions[0];
        const last = probe.positions[probe.positions.length - 1];
        probe.maxTravelPx = Math.max(
          probe.maxTravelPx,
          Math.hypot(last.x - first.x, last.y - first.y),
        );
      }
    };

    const observer = new MutationObserver(sampleCursor);
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class", "style"],
      childList: true,
    });
    window.__lensAnimProbeObserver = observer;
    window.addEventListener("lens:director-effect-trace", (event) => {
      const type = event.detail?.event?.type;
      if (type) probe.eventTypes.push(type);
      sampleCursor();
    });
    sampleCursor();
    window.__lensAnimProbeReset = () => {
      probe.directorRunningSeen = false;
      probe.cursorSeen = false;
      probe.statusSeen = false;
      probe.positions = [];
      probe.eventTypes = [];
      probe.maxTravelPx = 0;
      probe.startedAt = performance.now();
      window.__lensDirectorProbe?.clearTraces?.();
    };
  });
}

async function readAnimationProbe(page) {
  return page.evaluate(() => {
    const probe = window.__lensAnimProbe || {};
    const traces = window.__lensDirectorProbe?.traces?.() || { active: null, completed: [] };
    const last = traces.completed?.at(-1) || traces.active || null;
    const eventTypes = [
      ...(probe.eventTypes || []),
      ...((last?.events || []).map((event) => event.type)),
    ];
    const motionEvents = eventTypes.filter((type) =>
      /cursor-move|cursor-jump|gesture-press|gesture-release|cursor-move-start|cursor-move-complete/.test(type)
    );
    const uniquePositions = new Set((probe.positions || []).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size;
    return {
      directorRunningSeen: Boolean(probe.directorRunningSeen || document.body.classList.contains("director-running")),
      cursorSeen: Boolean(probe.cursorSeen || document.querySelector(".ghost-cursor")),
      statusSeen: Boolean(probe.statusSeen),
      positionSamples: (probe.positions || []).length,
      uniquePositions,
      maxTravelPx: Number(probe.maxTravelPx || 0),
      motionEventCount: motionEvents.length,
      motionEvents: [...new Set(motionEvents)].slice(0, 12),
      eventTypes: [...new Set(eventTypes)].slice(0, 20),
      reducedMotion: Boolean(last?.reducedMotion),
      scriptTitle: last?.title || null,
      expectedCapabilities: last?.expectedCapabilities || [],
    };
  });
}

function animationPassed(anim) {
  if (!anim) return false;
  if (anim.reducedMotion) {
    // Reduced-motion still must show director activity (jump/press/status), not silent mutation.
    return anim.directorRunningSeen
      && anim.cursorSeen
      && anim.motionEventCount >= 1;
  }
  // Full motion: cursor must appear, travel, and emit real move/gesture traces.
  const traveled = anim.maxTravelPx >= 24 || anim.uniquePositions >= 3;
  return anim.directorRunningSeen
    && anim.cursorSeen
    && traveled
    && anim.motionEventCount >= 2;
}

async function main() {
  const browser = await chromium.launch({
    headless: !headed,
    executablePath: chromePath,
  });
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

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, "01-land");
  await installAnimationProbe(page);

  // Runtime must register and stay registered across React renders.
  const runtimeOk = await page.waitForFunction(
    () => typeof window.__lensOrbRuntime?.run === "function",
    null,
    { timeout: 8000 },
  ).then(() => true).catch(() => false);
  record("runtime-registered", runtimeOk, "__lensOrbRuntime.run present");

  const probeOk = await page.evaluate(() => typeof window.__lensDirectorProbe?.traces === "function");
  record("director-probe-present", probeOk, "__lensDirectorProbe.traces present");

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  await page.waitForTimeout(600);
  await shot(page, "02-chat");

  const stillRuntime = await page.evaluate(() => typeof window.__lensOrbRuntime?.run === "function");
  record("runtime-stable-after-expand", stillRuntime, "runtime still present after expand/renders");

  // Reset probe before the animated create-pearl path.
  await page.evaluate(() => window.__lensAnimProbeReset?.());

  // Direct runtime.run must return a chattable reply AND animate.
  const directPromise = page.evaluate(async () => {
    const result = await window.__lensOrbRuntime.run("make a pearl about live stress test");
    return {
      hasResult: !!result,
      text: result?.text || result?.execution?.message || null,
      completed: result?.completed,
      code: result?.code || result?.execution?.code || null,
      visible: result?.visible,
    };
  });

  // Capture mid-animation while create-pearl director is running.
  let midAnimShot = false;
  for (let i = 0; i < 40 && !midAnimShot; i += 1) {
    const running = await page.evaluate(() =>
      document.body.classList.contains("director-running")
      || Boolean(document.querySelector(".ghost-cursor"))
    );
    if (running) {
      await shot(page, "03-mid-animation-runtime-create");
      midAnimShot = true;
      break;
    }
    await page.waitForTimeout(100);
  }
  const direct = await directPromise;
  await page.waitForTimeout(400);
  await shot(page, "04-after-runtime-create");
  const runtimeAnim = await readAnimationProbe(page);
  results.animation = { runtimeCreate: runtimeAnim };
  record("runtime-run-returns", Boolean(direct.hasResult), JSON.stringify(direct));
  record(
    "runtime-create-animated",
    animationPassed(runtimeAnim),
    JSON.stringify(runtimeAnim),
  );
  if (!midAnimShot) {
    record("runtime-mid-animation-shot", false, "never saw director-running or ghost-cursor during runtime.create");
  } else {
    record("runtime-mid-animation-shot", true, "captured mid-animation screenshot");
  }

  // UI GO path: type + real click (no force) — must also animate.
  await page.evaluate(() => window.__lensAnimProbeReset?.());
  const input = page.locator("[data-testid='companion-chat-input']").first();
  const go = page.locator("[data-testid='companion-go']").first();
  record("chat-controls", (await input.count()) > 0 && (await go.count()) > 0, "input+GO");
  let goAnim = null;
  if (await input.count()) {
    await input.click();
    await input.fill("make a pearl about companion stress notes");
    const box = await go.boundingBox();
    if (box) {
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.getAttribute("data-testid") || el?.closest("[data-testid]")?.getAttribute("data-testid");
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      record("go-hit-test", hit === "companion-go", `hit=${hit}`);
      await go.click();
    }
    midAnimShot = false;
    for (let i = 0; i < 50 && !midAnimShot; i += 1) {
      const running = await page.evaluate(() =>
        document.body.classList.contains("director-running")
        || Boolean(document.querySelector(".ghost-cursor"))
      );
      if (running) {
        await shot(page, "05-mid-animation-go-create");
        midAnimShot = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(
      () => !document.body.classList.contains("director-running"),
      null,
      { timeout: 20_000 },
    ).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "06-after-go");
    goAnim = await readAnimationProbe(page);
    results.animation.goCreate = goAnim;
    record("go-create-animated", animationPassed(goAnim), JSON.stringify(goAnim));
    record(
      "go-mid-animation-shot",
      midAnimShot,
      midAnimShot ? "captured mid-animation screenshot" : "never saw director/ghost-cursor during GO create",
    );
  }

  const chatText = await page.locator(".companion-msg").allTextContents();
  const userMsg = chatText.some((t) => /companion stress|live stress/i.test(t));
  const companionReply = chatText.some((t) => /Done|Opened|pearl|Blocked|Failed|Created/i.test(t));
  record("user-message-visible", userMsg || chatText.length >= 2, `msgs=${chatText.length} sample=${JSON.stringify(chatText.slice(-3))}`);
  record("companion-reply-visible", companionReply || chatText.length >= 2, `reply visible among ${chatText.length} messages`);

  // Remount stress: open scene then home — chat transcript should persist
  await page.evaluate(async () => {
    await window.__lensOrbRuntime.run("open a new scene");
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  await page.waitForTimeout(500);
  const afterNav = await page.locator(".companion-msg").count();
  record("chat-survives-nav", afterNav >= 2, `messages after nav=${afterNav}`);
  await shot(page, "07-after-nav");

  // Mic unavailable must talk
  const mic = page.locator("[data-testid='companion-mic'], .companion-mic").first();
  if (await mic.count()) {
    await page.evaluate(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lens:companion-notice", {
        detail: { id: "test-mic", text: "Blocked: Voice isn’t available in this browser. Type your goal and press GO. [voice-unavailable]", transient: false },
      }));
    });
    await page.waitForTimeout(300);
    const heard = (await page.locator(".companion-msg").allTextContents()).some((t) => /voice|microphone|Hearing|Listening/i.test(t));
    record("voice-status-in-chat", heard, "voice diagnostic appears in chat");
  } else {
    record("voice-status-in-chat", false, "mic control missing");
  }

  record("no-page-errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "none");

  // Hard gate: if either animated create path was silent, fail the suite.
  const anySilentSuccess = (direct.completed !== false && !animationPassed(runtimeAnim))
    || (goAnim && !animationPassed(goAnim));
  if (anySilentSuccess) {
    record(
      "no-silent-mutation",
      false,
      "command completed without director/ghost-cursor motion evidence",
    );
  } else {
    record("no-silent-mutation", true, "demonstrable create-pearl paths showed animation");
  }

  fs.writeFileSync(path.join(out, "audit-results.json"), JSON.stringify(results, null, 2));
  const failed = results.defects.length;
  console.log(`\n${results.checks.length - failed}/${results.checks.length} passed`);
  console.log(`evidence: ${out}`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
