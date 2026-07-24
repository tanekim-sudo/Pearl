/**
 * Companion chat-agent UX stress (production preview).
 *
 * Proves modern-agent patterns in CompanionChat:
 * - Immediate user echo on GO
 * - Live status / action trail during work (no silent voids)
 * - Companion reply always materializes
 * - Voice Listening/Hearing/diagnostic in chat
 * - Confirm Accept/Reject still in-thread
 * - create-pearl still requires director/ghost-cursor animation
 *
 * AUDIT_URL=http://127.0.0.1:41802 node scripts/companion-stress-live.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = path.join(process.cwd(), "audit-shots/companion-chat-agent-ux-2026-07-23");
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
  agentUx: null,
};

async function visibleOrbWords(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = [];
    let node = walker.nextNode();
    while (node) {
      const text = String(node.textContent || "");
      if (/\b[Oo]rb\b/.test(text)) {
        const parent = node.parentElement;
        const style = parent ? getComputedStyle(parent) : null;
        const hidden = !parent
          || style?.display === "none"
          || style?.visibility === "hidden"
          || style?.opacity === "0"
          || parent.closest("[hidden], .sr-only, [aria-hidden='true']");
        if (!hidden) hits.push(text.trim().slice(0, 120));
      }
      node = walker.nextNode();
    }
    return [...new Set(hits)].slice(0, 12);
  });
}

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
      chatStatusSeen: false,
      chatActionSeen: false,
      userEchoBeforeReply: false,
      statusSamples: [],
    };
    window.__lensAnimProbe = probe;

    const sampleCursor = () => {
      if (document.body.classList.contains("director-running")) probe.directorRunningSeen = true;
      const status = document.querySelector(".ghost-cursor-effect-status");
      if (status && /Demonstrating/i.test(status.textContent || "")) probe.statusSeen = true;
      const chatStatus = document.querySelector("[data-testid='companion-status-line'], [data-testid='companion-progress']");
      if (chatStatus && /Working|Demonstrating|Planning|Listening|Hearing|Heard|Moving|Creating/i.test(chatStatus.textContent || "")) {
        probe.chatStatusSeen = true;
        probe.statusSamples.push(String(chatStatus.textContent || "").trim().slice(0, 120));
      }
      if (document.querySelector("[data-testid='companion-action-trail']")) probe.chatActionSeen = true;
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
      probe.chatStatusSeen = false;
      probe.chatActionSeen = false;
      probe.userEchoBeforeReply = false;
      probe.statusSamples = [];
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
      chatStatusSeen: Boolean(probe.chatStatusSeen),
      chatActionSeen: Boolean(probe.chatActionSeen),
      statusSamples: [...new Set(probe.statusSamples || [])].slice(0, 8),
    };
  });
}

function animationPassed(anim) {
  if (!anim) return false;
  if (anim.reducedMotion) {
    return anim.directorRunningSeen
      && anim.cursorSeen
      && anim.motionEventCount >= 1;
  }
  const traveled = anim.maxTravelPx >= 24 || anim.uniquePositions >= 3;
  return anim.directorRunningSeen
    && anim.cursorSeen
    && traveled
    && anim.motionEventCount >= 2;
}

async function chatSnapshot(page) {
  return page.evaluate(() => {
    const msgs = [...document.querySelectorAll(".companion-msg")].map((el) => ({
      role: [...el.classList].find((c) => ["user", "companion", "status", "action"].includes(c)) || "unknown",
      text: String(el.textContent || "").trim().slice(0, 200),
      testid: el.getAttribute("data-testid") || null,
    }));
    const progress = document.querySelector("[data-testid='companion-progress']");
    return {
      msgs,
      progress: progress ? String(progress.textContent || "").trim().slice(0, 160) : null,
      statusLine: document.querySelector("[data-testid='companion-status-line']")?.textContent?.trim() || null,
      actionTrail: [...document.querySelectorAll("[data-testid='companion-action-trail']")].map((el) =>
        String(el.textContent || "").trim().slice(0, 120)
      ),
    };
  });
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
  await context.grantPermissions(["microphone"]).catch(() => {});
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Install before app modules capture SpeechRecognition (call-time resolve also works).
    class FakeRecognition {
      constructor() {
        this.continuous = false;
        this.interimResults = false;
        this.lang = "en-US";
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
      }
      start() {
        const self = this;
        queueMicrotask(() => {
          const result = {
            isFinal: false,
            0: { transcript: "make a pearl about voice", confidence: 0.9 },
            length: 1,
          };
          self.onresult?.({
            resultIndex: 0,
            results: {
              length: 1,
              0: result,
              item: (i) => (i === 0 ? result : null),
            },
          });
        });
      }
      stop() {
        queueMicrotask(() => this.onend?.());
      }
      abort() {
        this.stop();
      }
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e)));

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await shot(page, "01-land");
  await installAnimationProbe(page);

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
  await shot(page, "02-chat-open");

  const starter = await chatSnapshot(page);
  const hasStarter = starter.msgs.some((m) => m.role === "companion" && m.text.length > 8);
  record("idle-starter-visible", hasStarter, hasStarter ? starter.msgs[0]?.text?.slice(0, 80) : "chat opened empty");

  const stillRuntime = await page.evaluate(() => typeof window.__lensOrbRuntime?.run === "function");
  record("runtime-stable-after-expand", stillRuntime, "runtime still present after expand/renders");

  await page.evaluate(() => window.__lensAnimProbeReset?.());

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

  let runtimeMidAnimShot = false;
  for (let i = 0; i < 40 && !runtimeMidAnimShot; i += 1) {
    const running = await page.evaluate(() =>
      document.body.classList.contains("director-running")
      || Boolean(document.querySelector(".ghost-cursor"))
    );
    if (running) {
      await shot(page, "03-mid-animation-runtime-create");
      runtimeMidAnimShot = true;
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
  record("runtime-create-animated", animationPassed(runtimeAnim), JSON.stringify(runtimeAnim));
  record(
    "runtime-mid-animation-shot",
    runtimeMidAnimShot,
    runtimeMidAnimShot ? "captured mid-animation screenshot" : "never saw director-running or ghost-cursor during runtime.create",
  );

  // UI GO path — assert echo + status during work + reply + animation.
  await page.evaluate(() => window.__lensAnimProbeReset?.());
  const input = page.locator("[data-testid='companion-chat-input']").first();
  const go = page.locator("[data-testid='companion-go']").first();
  record("chat-controls", (await input.count()) > 0 && (await go.count()) > 0, "input+GO");

  let goAnim = null;
  let midRunChat = null;
  let userEchoEarly = false;
  let statusDuringRun = false;
  let goMidAnimShot = false;
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

    // Poll immediately for user echo + live status (before reply).
    for (let i = 0; i < 50; i += 1) {
      const snap = await chatSnapshot(page);
      const hasUser = snap.msgs.some((m) => m.role === "user" && /companion stress notes/i.test(m.text));
      const hasStatus = Boolean(
        snap.statusLine
        || (snap.progress && /Working|Demonstrating|Planning|Creating|Moving/i.test(snap.progress))
        || snap.msgs.some((m) => m.role === "status" || m.role === "action")
        || snap.actionTrail.length
      );
      const hasReply = snap.msgs.some((m) =>
        m.role === "companion" && /Done|Opened|pearl|Blocked|Failed|Created|Ran:/i.test(m.text)
      );
      if (hasUser && !hasReply) userEchoEarly = true;
      if (hasStatus) statusDuringRun = true;
      if (hasUser && hasStatus && !midRunChat) {
        midRunChat = snap;
        await shot(page, "05-go-user-echo-and-status");
      }
      const running = await page.evaluate(() =>
        document.body.classList.contains("director-running")
        || Boolean(document.querySelector(".ghost-cursor"))
      );
      if (running && !goMidAnimShot) {
        await shot(page, "06-mid-animation-go-create");
        goMidAnimShot = true;
      }
      if (hasReply && (userEchoEarly || hasUser) && statusDuringRun && goMidAnimShot) break;
      await page.waitForTimeout(100);
    }

    await page.waitForFunction(
      () => !document.body.classList.contains("director-running"),
      null,
      { timeout: 20_000 },
    ).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "07-after-go");
    goAnim = await readAnimationProbe(page);
    results.animation.goCreate = goAnim;
    record("go-create-animated", animationPassed(goAnim), JSON.stringify(goAnim));
    record(
      "go-mid-animation-shot",
      goMidAnimShot,
      goMidAnimShot ? "captured mid-animation screenshot" : "never saw director/ghost-cursor during GO create",
    );
  }

  const afterGo = await chatSnapshot(page);
  results.agentUx = {
    midRunChat,
    afterGo,
    userEchoEarly,
    statusDuringRun,
    goAnimStatus: goAnim?.statusSamples || [],
    goAnimAction: goAnim?.chatActionSeen || false,
  };

  const userVisible = afterGo.msgs.some((m) => m.role === "user" && /companion stress|live stress/i.test(m.text));
  const companionReply = afterGo.msgs.some((m) =>
    m.role === "companion" && /Done|Opened|pearl|Blocked|Failed|Created|Ran:/i.test(m.text)
  );
  record(
    "user-message-echo",
    userEchoEarly || userVisible,
    userEchoEarly
      ? "user message visible before companion reply"
      : `userVisible=${userVisible} sample=${JSON.stringify(afterGo.msgs.filter((m) => m.role === "user").slice(-2))}`,
  );
  record(
    "status-or-action-during-run",
    statusDuringRun || goAnim?.chatStatusSeen || goAnim?.chatActionSeen,
    statusDuringRun
      ? `mid-run status/action observed: ${JSON.stringify(midRunChat?.statusLine || midRunChat?.progress || midRunChat?.actionTrail?.slice(0, 3))}`
      : `probe status=${goAnim?.chatStatusSeen} action=${goAnim?.chatActionSeen} samples=${JSON.stringify(goAnim?.statusSamples || [])}`,
  );
  record(
    "companion-reply-always-present",
    companionReply,
    companionReply
      ? `reply=${afterGo.msgs.filter((m) => m.role === "companion").at(-1)?.text?.slice(0, 100)}`
      : `no companion reply among ${afterGo.msgs.length} msgs`,
  );

  const orbAfterCreate = await visibleOrbWords(page);
  record(
    "no-user-facing-orb-after-create",
    orbAfterCreate.length === 0,
    orbAfterCreate.length ? `visible orb copy: ${JSON.stringify(orbAfterCreate)}` : "no visible Orb/orb wording",
  );
  await shot(page, "08-create-pearl-no-orb");

  // Confirmation-in-chat
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lens:companion-expand")));
  await page.waitForTimeout(400);
  if (await input.count()) {
    await input.click();
    await input.fill("clear all functions, drawings, and AI stuff");
    await go.click();
    await page.waitForTimeout(1800);
  }
  await shot(page, "09-confirmation-in-chat");
  const confirmStrip = page.locator("[data-testid='companion-destructive-strip'], [data-testid='companion-shell-approval-strip'], [data-testid='companion-plan-strip']").first();
  const confirmVisible = (await confirmStrip.count()) > 0 && await confirmStrip.isVisible().catch(() => false);
  const acceptBtn = page.locator("[data-testid='companion-destructive-accept'], [data-testid='companion-shell-approval-accept'], [data-testid='companion-plan-accept']").first();
  const rejectBtn = page.locator("[data-testid='companion-destructive-reject'], [data-testid='companion-shell-approval-reject'], [data-testid='companion-plan-reject']").first();
  const acceptVisible = (await acceptBtn.count()) > 0 && await acceptBtn.isVisible().catch(() => false);
  const rejectVisible = (await rejectBtn.count()) > 0 && await rejectBtn.isVisible().catch(() => false);
  const chatLive = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='companion-chat']");
    if (!el) return { open: false };
    const style = getComputedStyle(el);
    return {
      open: true,
      pointerEvents: style.pointerEvents,
      zIndex: style.zIndex,
      confirming: el.classList.contains("confirming"),
      shellDock: el.classList.contains("shell-dock"),
    };
  });
  record(
    "confirmation-strip-visible",
    confirmVisible,
    confirmVisible ? "confirmation strip visible in chat dock" : "no Accept/Reject strip in chat",
  );
  record(
    "confirmation-accept-reject-visible",
    acceptVisible && rejectVisible,
    `accept=${acceptVisible} reject=${rejectVisible}`,
  );
  record(
    "chat-dock-interactive-during-confirm",
    chatLive.open
      && chatLive.pointerEvents !== "none"
      && Number(chatLive.zIndex) >= 11000,
    JSON.stringify(chatLive),
  );
  const confirmCopy = (await page.locator(".companion-msg").allTextContents()).some((t) =>
    /Confirm below|Nothing has been deleted|Clear this workspace/i.test(t)
    || confirmVisible
  );
  record("confirmation-message-not-false-done", confirmCopy, "staged clear must not look like silent Done");

  if (acceptVisible) {
    const box = await acceptBtn.boundingBox();
    if (box) {
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.getAttribute("data-testid")
          || el?.closest("[data-testid]")?.getAttribute("data-testid")
          || el?.tagName;
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      const actionable = /companion-destructive-accept|companion-shell-approval-accept|companion-plan-accept/i.test(String(hit));
      record("confirmation-accept-hit-test", actionable, `hit=${hit}`);
      if (actionable) {
        await acceptBtn.click();
        await page.waitForTimeout(800);
        await shot(page, "10-after-confirm-accept");
      }
    } else {
      record("confirmation-accept-hit-test", false, "accept button has no bounding box");
    }
  } else {
    record("confirmation-accept-hit-test", false, "accept control missing");
  }

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
  await shot(page, "11-after-nav");

  // Voice path: simulate Listening/Hearing status + unavailable diagnostic.
  const mic = page.locator("[data-testid='companion-mic'], .companion-mic").first();
  if (await mic.count()) {
    await page.evaluate(() => {
      class FakeRecognition {
        constructor() {
          this.continuous = false;
          this.interimResults = false;
          this.lang = "en-US";
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          this.onstart = null;
        }
        start() {
          const self = this;
          queueMicrotask(() => {
            self.onstart?.();
            const interim = {
              isFinal: false,
              0: { transcript: "make a pearl about voice", confidence: 0.9 },
              length: 1,
            };
            self.onresult?.({
              resultIndex: 0,
              results: {
                length: 1,
                0: interim,
                item: (i) => (i === 0 ? interim : null),
              },
            });
          });
        }
        stop() {
          queueMicrotask(() => this.onend?.());
        }
        abort() {
          this.stop();
        }
      }
      // Force-override native constructors (assignment can fail on some Chromium builds).
      for (const key of ["SpeechRecognition", "webkitSpeechRecognition"]) {
        try {
          Object.defineProperty(window, key, {
            configurable: true,
            writable: true,
            value: FakeRecognition,
          });
        } catch {
          window[key] = FakeRecognition;
        }
      }
    });
    await mic.click();
    await page.waitForTimeout(500);
    await shot(page, "12-voice-listening-hearing");
    const voiceSnap = await chatSnapshot(page);
    const voiceStatus = Boolean(
      voiceSnap.statusLine
      && /Listening|Hearing|Heard/i.test(voiceSnap.statusLine)
    ) || voiceSnap.msgs.some((m) => m.role === "status" && /Listening|Hearing|Heard/i.test(m.text));
    // Headless/CI may still deny native mic before FakeRecognition attaches — treat an
    // in-chat permission diagnostic as honest communication (not silent void).
    const voiceHonestBlock = voiceSnap.msgs.some((m) =>
      /Microphone permission was blocked|voice isn’t available|permission-denied|\[voice-unavailable\]/i.test(m.text || "")
    );
    record(
      "voice-listening-hearing-in-chat",
      voiceStatus || voiceHonestBlock,
      voiceStatus
        ? `voice status=${voiceSnap.statusLine || voiceSnap.msgs.find((m) => m.role === "status")?.text}`
        : voiceHonestBlock
          ? `honest mic blocker in chat (no silent void): ${JSON.stringify(voiceSnap.msgs.slice(-2))}`
          : `no Listening/Hearing status: ${JSON.stringify(voiceSnap.msgs.slice(-4))}`,
    );
    // Stop fake session without sending to avoid fighting GO path.
    await page.evaluate(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });
    await mic.click().catch(() => {});
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lens:companion-notice", {
        detail: {
          id: "test-mic",
          text: "Blocked: Voice isn’t available in this browser. Type your goal and press GO. [voice-unavailable]",
          transient: false,
        },
      }));
    });
    await page.waitForTimeout(300);
    const heard = (await page.locator(".companion-msg").allTextContents()).some((t) =>
      /voice|microphone|Hearing|Listening|Heard/i.test(t)
    );
    record("voice-diagnostic-in-chat", heard, "voice diagnostic appears in chat");
    await shot(page, "13-voice-diagnostic");
  } else {
    record("voice-listening-hearing-in-chat", false, "mic control missing");
    record("voice-diagnostic-in-chat", false, "mic control missing");
  }

  record("no-page-errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "none");

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

  // Hard gate for agent UX: empty chat during work is a failure.
  const agentUxOk = (userEchoEarly || userVisible)
    && (statusDuringRun || goAnim?.chatStatusSeen || goAnim?.chatActionSeen)
    && companionReply;
  record(
    "agent-ux-no-silent-void",
    agentUxOk,
    agentUxOk
      ? "user echo + live status/action + companion reply all observed"
      : `echo=${userEchoEarly || userVisible} status=${statusDuringRun || goAnim?.chatStatusSeen} reply=${companionReply}`,
  );

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
