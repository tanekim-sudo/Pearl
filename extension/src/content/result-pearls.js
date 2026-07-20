import { placeResultPearls } from "../../../shared/result-pearls.js";

const HOST_ID = "pearl-result-pearls-host";

function sourceAnchor(sourceRefs = []) {
  const selection = getSelection?.();
  if (selection && !selection.isCollapsed && selection.rangeCount) {
    const value = selection.getRangeAt(0).getBoundingClientRect();
    if (value.width || value.height) return { x: value.x, y: value.y, width: value.width, height: value.height, fallback: false };
  }
  for (const source of sourceRefs) {
    const selector = source.anchor?.selector || source.selector;
    if (!selector) continue;
    try {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      if (value && (value.width || value.height)) return { x: value.x, y: value.y, width: value.width, height: value.height, fallback: false };
    } catch {
      // Invalid or stale selectors are intentionally ignored.
    }
  }
  return { x: innerWidth / 2 - 1, y: innerHeight / 2 - 1, width: 2, height: 2, fallback: true };
}

function nativeObstacles() {
  return [...document.querySelectorAll("button,input,textarea,select,[contenteditable=true],[role=button]")]
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    })
    .slice(0, 120)
    .map((element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height };
    });
}

export function createResultPearlLayer({ send }) {
  let host;
  let shadow;
  let results = [];

  function ensure() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483645;pointer-events:none";
    shadow = host.attachShadow({ mode: "open" });
    document.documentElement.append(host);
    shadow.addEventListener("click", click);
    shadow.addEventListener("keydown", keydown);
  }

  function screenPlacement(result) {
    const placement = result.placement || {};
    const screen = placement.coordinateSpace === "viewport"
      ? placement
      : { ...placement, x: (placement.x || 0) - scrollX, y: (placement.y || 0) - scrollY };
    return {
      ...screen,
      x: Math.max(8, Math.min(innerWidth - (screen.width || 32) - 8, screen.x)),
      y: Math.max(8, Math.min(innerHeight - (screen.height || 32) - 8, screen.y)),
    };
  }

  function render() {
    ensure();
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        .result{position:fixed;width:32px;height:32px;padding:0;border:0;border-radius:50%;background:transparent;pointer-events:auto;touch-action:manipulation}
        .result svg{width:32px;height:32px;overflow:visible}
        .contact{fill:rgba(0,0,0,.13);filter:blur(.7px)}
        .body{stroke:rgba(255,255,255,.62);stroke-width:.65}
        .nucleus{mix-blend-mode:soft-light;opacity:.68}
        .nacre{mix-blend-mode:screen;opacity:.48}
        .reflection{fill:rgba(52,75,66,.09);filter:blur(2px)}
        .rim{fill:none;stroke-width:.8}
        .glint{fill:rgba(255,255,255,.32);filter:blur(.35px)}
        .pin{fill:#fff;opacity:.94}
        .result[data-status=streaming] .nucleus{animation:ember 3.8s ease-in-out infinite}
        .result[data-status=failed] .nacre{opacity:.2}
        .plane{position:fixed;width:min(380px,calc(100vw - 24px));max-height:min(440px,calc(100vh - 24px));overflow:auto;padding:0 0 0 14px;color:#252927;background:linear-gradient(90deg,rgba(248,250,246,.95),rgba(248,250,246,.78) 70%,rgba(248,250,246,.38));border:0;border-left:1px solid rgba(64,88,76,.24);box-shadow:inset 1px 0 rgba(255,255,255,.7);pointer-events:auto;font:12px/1.55 Inter,system-ui,sans-serif}
        .plane p{margin:0;padding:14px 12px 16px 0;white-space:pre-wrap}
        .actions{position:sticky;bottom:0;display:flex;background:rgba(248,250,246,.92);border-top:1px solid rgba(39,58,49,.12)}
        .actions button{flex:1;min-height:42px;border:0;border-right:1px solid rgba(39,58,49,.1);border-radius:0;background:transparent;color:#39413d;font:10px Inter,system-ui,sans-serif}
        .status{display:block;padding:8px 10px 0 0;color:#69736e;font:9px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
        button:focus-visible{outline:1px solid currentColor;outline-offset:3px}
        @keyframes ember{0%,100%{opacity:.58}50%{opacity:.7}}
        @media(prefers-color-scheme:dark){.plane{color:#ecefe9;background:linear-gradient(90deg,rgba(10,13,12,.96),rgba(10,13,12,.78) 70%,rgba(10,13,12,.38));border-left-color:rgba(192,218,204,.22)}.actions{background:rgba(10,13,12,.92)}.actions button{color:#cbd4ce}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      </style>
    `;
    for (const result of results.filter((entry) => !entry.archived && entry.placement)) {
      const placement = screenPlacement(result);
      const gradientId = result.id.replace(/[^a-zA-Z0-9_-]/g, "-");
      const button = document.createElement("button");
      button.className = "result";
      button.dataset.id = result.id;
      button.dataset.status = result.status;
      button.setAttribute("aria-label", `${result.status === "ready" ? "New result" : result.status} Pearl. ${result.expanded ? "Collapse result" : "Open result"}`);
      button.style.cssText = `left:clamp(8px,${placement.x}px,calc(100vw - 40px));top:clamp(8px,${placement.y}px,calc(100vh - 40px))`;
      button.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="body-${gradientId}" cx="38%" cy="58%" r="72%"><stop offset="0" stop-color="#fffdf6"/><stop offset=".38" stop-color="#eef3ea"/><stop offset=".72" stop-color="#dbe7dd"/><stop offset="1" stop-color="#aebdb3"/></radialGradient>
          <radialGradient id="nucleus-${gradientId}" cx="38%" cy="63%" r="58%"><stop offset="0" stop-color="#cfe6d7" stop-opacity=".68"/><stop offset=".48" stop-color="#e7e0b9" stop-opacity=".22"/><stop offset="1" stop-color="#b8d5c4" stop-opacity="0"/></radialGradient>
          <linearGradient id="nacre-${gradientId}" x1="8%" y1="12%" x2="90%" y2="86%"><stop offset="0" stop-color="#c2ddcf" stop-opacity=".18"/><stop offset=".38" stop-color="#eef0c9" stop-opacity=".22"/><stop offset=".72" stop-color="#bdd8ca" stop-opacity=".28"/><stop offset="1" stop-color="#e8d7bf" stop-opacity=".12"/></linearGradient>
          <linearGradient id="rim-${gradientId}" x1="10%" y1="6%" x2="86%" y2="94%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".55" stop-color="#dce9e1" stop-opacity=".18"/><stop offset=".86" stop-color="#74857c" stop-opacity=".32"/></linearGradient>
        </defs>
        <ellipse class="contact" cx="51" cy="94" rx="24" ry="2"/>
        <circle class="body" cx="50" cy="50" r="43" fill="url(#body-${gradientId})"/>
        <ellipse class="nucleus" cx="42" cy="58" rx="25" ry="29" fill="url(#nucleus-${gradientId})"/>
        <circle class="nacre" cx="50" cy="50" r="41" fill="url(#nacre-${gradientId})"/>
        <ellipse class="reflection" cx="60" cy="65" rx="25" ry="12"/>
        <circle class="rim" cx="50" cy="50" r="42" stroke="url(#rim-${gradientId})"/>
        <ellipse class="glint" cx="33" cy="28" rx="7" ry="4" transform="rotate(-38 33 28)"/>
        <circle class="pin" cx="27.5" cy="22.5" r="2"/>
      </svg>`;
      shadow.append(button);
      if (result.expanded) {
        const plane = document.createElement("section");
        plane.className = "plane";
        plane.dataset.resultId = result.id;
        plane.setAttribute("aria-label", "Pearl result");
        const left = placement.x > innerWidth / 2 ? Math.max(12, placement.x - Math.min(380, innerWidth - 24) - 12) : Math.min(innerWidth - Math.min(380, innerWidth - 24) - 12, placement.x + 44);
        const top = Math.max(12, Math.min(innerHeight - 220, placement.y - 20));
        plane.style.cssText = `left:${left}px;top:${top}px`;
        plane.innerHTML = `<span class="status">${result.status}</span><p></p><div class="actions">
          ${result.status === "streaming" ? `<button data-action="cancel">Stop</button>` : ""}
          ${result.status === "failed" ? `<button data-action="retry">Retry</button>` : ""}
          <button data-action="open">Open in new tab</button>
          <button data-action="collapse">Collapse</button>
        </div>`;
        plane.querySelector("p").textContent = result.text || (result.status === "failed" ? "This result stopped before completion. The source checkpoint is preserved." : "Working…");
        shadow.append(plane);
      }
    }
  }

  async function click(event) {
    const resultButton = event.target.closest(".result");
    const action = event.target.closest("[data-action]");
    if (resultButton) {
      const result = results.find((entry) => entry.id === resultButton.dataset.id);
      await send("result-pearl-command", { command: result?.expanded ? "collapseResultPearl" : "expandResultPearl", resultId: result.id });
      return;
    }
    if (!action) return;
    const resultId = action.closest(".plane").dataset.resultId;
    if (action.dataset.action === "collapse") await send("result-pearl-command", { command: "collapseResultPearl", resultId });
    if (action.dataset.action === "open") await send("result-pearl-open-tab", { resultId });
    if (action.dataset.action === "cancel") await send("result-pearl-cancel", { resultId });
    if (action.dataset.action === "retry") await send("result-pearl-retry", { resultId });
  }

  function keydown(event) {
    if (event.key !== "Escape") return;
    const expanded = results.find((entry) => entry.expanded);
    if (expanded) send("result-pearl-command", { command: "collapseResultPearl", resultId: expanded.id });
  }

  function hydrate(next) {
    results = Array.isArray(next) ? next : [];
    render();
  }

  function layout(input) {
    const anchor = sourceAnchor(input.sourceRefs);
    const existing = results.filter((entry) => entry.placement).map((entry) => screenPlacement(entry));
    const placements = placeResultPearls({
        anchor,
        count: input.count,
        obstacles: [...nativeObstacles(), ...existing],
        viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio },
      });
    return {
      anchor,
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio },
      placements: anchor.fallback
        ? placements.map((entry) => ({ ...entry, x: scrollX + innerWidth - entry.width - 8, side: "right", docked: true, anchorFallback: true }))
        : placements,
    };
  }

  addEventListener("scroll", render, { passive: true });
  addEventListener("resize", render, { passive: true });
  ensure();
  return { hydrate, layout, render };
}
