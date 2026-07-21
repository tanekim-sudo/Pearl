import { placeResultPearls } from "../../../shared/result-pearls.js";
import { PHYSICAL_PEARL_CSS, physicalPearlMarkup } from "../../../shared/physical-pearl.js";
import { createPearlGestureArbiter } from "../../../shared/pearl-gesture-arbiter.js";

const HOST_ID = "pearl-result-pearls-host";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

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
  const gestures = new Map();

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
        .routing{padding:2px 12px 14px 0;border-top:1px solid rgba(39,58,49,.1)}
        .routing label{display:block;padding:12px 0 7px;color:inherit;font:12px/1.4 Inter,system-ui,sans-serif}
        .routing-row{display:flex;border-bottom:1px solid rgba(39,58,49,.24)}
        .routing input{min-width:0;flex:1;border:0;background:transparent;padding:9px 0;color:inherit;font:12px Inter,system-ui,sans-serif;outline:0}
        .routing button{border:0;background:transparent;padding:9px 5px;color:inherit;font:10px Inter,system-ui,sans-serif}
        .routing-confirm{margin:0;white-space:pre-wrap}
        .routing-choices{display:flex;gap:12px;padding-top:8px}
        .routing-choices button{padding:5px 0}
        .sr-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
        button:focus-visible{outline:1px solid currentColor;outline-offset:3px}
        @keyframes ember{0%,100%{opacity:.58}50%{opacity:.7}}
        @media(prefers-color-scheme:dark){.plane{color:#ecefe9;background:linear-gradient(90deg,rgba(10,13,12,.96),rgba(10,13,12,.78) 70%,rgba(10,13,12,.38));border-left-color:rgba(192,218,204,.22)}.actions{background:rgba(10,13,12,.92)}.actions button{color:#cbd4ce}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
        ${PHYSICAL_PEARL_CSS}
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
      button.innerHTML = physicalPearlMarkup({
        id: `result-${gradientId}`,
        variant: "result",
        state: result.status === "ready" ? "new" : result.status === "streaming" ? "executing" : result.status === "failed" ? "failed" : "idle",
        size: 32,
        decorative: true,
      });
      shadow.append(button);
      if (result.expanded) {
        const plane = document.createElement("section");
        plane.className = "plane";
        plane.dataset.resultId = result.id;
        plane.setAttribute("aria-label", "Pearl result");
        const left = placement.x > innerWidth / 2 ? Math.max(12, placement.x - Math.min(380, innerWidth - 24) - 12) : Math.min(innerWidth - Math.min(380, innerWidth - 24) - 12, placement.x + 44);
        const top = Math.max(12, Math.min(innerHeight - 220, placement.y - 20));
        plane.style.cssText = `left:${left}px;top:${top}px`;
        const routing = result.routing;
        const routingMarkup = routing && ["choosing", "clarifying"].includes(routing.stage)
          ? `<form class="routing" data-routing-form>
              <label for="route-${gradientId}">${escapeHtml(routing.clarification || routing.question || "Where should this output go?")}</label>
              <div class="routing-row"><input id="route-${gradientId}" name="answer" autocomplete="off" placeholder="Keep it here, a text box, Studio…"><button type="submit">Interpret</button></div>
            </form>`
          : routing?.stage === "confirming"
            ? `<div class="routing"><p class="routing-confirm">${escapeHtml(routing.plan?.summary || "Confirm this placement?")}</p><div class="routing-choices"><button data-action="confirm-route">Confirm</button><button data-action="revise-route">Revise</button><button data-action="cancel-route">Cancel</button></div></div>`
            : "";
        plane.innerHTML = `<span class="status">${escapeHtml(result.status)}</span><p></p>${routingMarkup}<div class="actions">
          ${result.status === "streaming" ? `<button data-action="cancel">Stop</button>` : ""}
          ${result.status === "failed" ? `<button data-action="retry">Retry</button>` : ""}
          <button data-action="open">Open in new tab</button>
          <button data-action="studio">Open Pearl in Studio</button>
          <button data-action="collapse">Collapse</button>
        </div><span class="sr-status" role="status" aria-live="polite">${escapeHtml(routing?.clarification || routing?.plan?.summary || routing?.question || "")}</span>`;
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
      if (!result) return;
      let gesture = gestures.get(result.id);
      if (!gesture) {
        gesture = createPearlGestureArbiter({
          onSingle: () => send("result-pearl-command", { command: result.expanded ? "collapseResultPearl" : "expandResultPearl", resultId: result.id }),
          onTriple: () => send("result-pearl-open-studio", { resultId: result.id }),
        });
        gestures.set(result.id, gesture);
      }
      gesture.release({ at: event.timeStamp, x: event.clientX, y: event.clientY, pointerType: event.pointerType || "mouse" });
      return;
    }
    if (!action) return;
    const resultId = action.closest(".plane").dataset.resultId;
    if (action.dataset.action === "collapse") await send("result-pearl-command", { command: "collapseResultPearl", resultId });
    if (action.dataset.action === "open") await send("result-pearl-open-tab", { resultId });
    if (action.dataset.action === "studio") await send("result-pearl-open-studio", { resultId });
    if (action.dataset.action === "cancel") await send("result-pearl-cancel", { resultId });
    if (action.dataset.action === "retry") await send("result-pearl-retry", { resultId });
    if (action.dataset.action === "confirm-route") await send("output-routing-confirm", { resultId, targetRevision: placementObservation().targetRevision });
    if (action.dataset.action === "revise-route") await send("output-routing-revise", { resultId });
    if (action.dataset.action === "cancel-route") await send("output-routing-cancel", { resultId });
  }

  async function keydown(event) {
    const resultButton = event.target.closest(".result");
    if (resultButton && event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      await send("result-pearl-open-studio", { resultId: resultButton.dataset.id });
      return;
    }
    if (event.key !== "Escape") return;
    const expanded = results.find((entry) => entry.expanded);
    if (expanded) send("result-pearl-command", { command: "collapseResultPearl", resultId: expanded.id });
  }

  function placementObservation() {
    const selection = getSelection?.();
    let selected = null;
    if (selection && !selection.isCollapsed && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      const box = range.getBoundingClientRect();
      selected = {
        targetId: element?.id || null,
        selector: element?.id ? `#${CSS.escape(element.id)}` : null,
        quote: selection.toString().slice(0, 240),
        editable: Boolean(element?.closest?.("textarea,input,[contenteditable=true]")),
        offset: range.startOffset,
        geometry: { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height, coordinateSpace: "document" },
      };
    }
    const activeEditable = document.activeElement?.matches?.("textarea,input:not([type=button]):not([type=submit]),[contenteditable=true]")
      ? document.activeElement
      : null;
    if (!selected && activeEditable) {
      const box = activeEditable.getBoundingClientRect();
      const textControl = activeEditable instanceof HTMLInputElement || activeEditable instanceof HTMLTextAreaElement;
      const offset = textControl ? activeEditable.selectionStart ?? 0 : selection?.anchorOffset ?? 0;
      const end = textControl ? activeEditable.selectionEnd ?? offset : offset;
      selected = {
        targetId: activeEditable.id || null,
        selector: activeEditable.id ? `#${CSS.escape(activeEditable.id)}` : null,
        quote: textControl ? activeEditable.value.slice(offset, end).slice(0, 240) : selection?.toString().slice(0, 240) || "",
        editable: true,
        offset,
        geometry: { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height, coordinateSpace: "document" },
      };
    }
    const anchor = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const nearest = anchor?.closest?.("p,li,blockquote,h1,h2,h3,h4,h5,h6,[data-pearl-canvas-artifact]");
    const nearestBox = nearest?.getBoundingClientRect?.();
    return {
      selection: selected,
      nearestBlock: nearest ? {
        id: nearest.id || null,
        selector: nearest.id ? `#${CSS.escape(nearest.id)}` : null,
        quote: nearest.textContent?.trim().slice(0, 240),
        geometry: { x: nearestBox.x + scrollX, y: nearestBox.y + scrollY, width: nearestBox.width, height: nearestBox.height, coordinateSpace: "document" },
      } : null,
      targetRevision: document.body?.textContent?.length || 0,
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio },
    };
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
  shadow.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-routing-form]");
    if (!form) return;
    event.preventDefault();
    const resultId = form.closest(".plane").dataset.resultId;
    const answer = new FormData(form).get("answer");
    await send("output-routing-answer", { resultId, answer, observation: placementObservation() });
  });
  return { hydrate, layout, render, observe: placementObservation };
}
