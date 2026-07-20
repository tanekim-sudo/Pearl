import { canonicalPageIdentity, PEARL_CANVAS_MODES } from "../../../shared/pearl-page-canvas.js";
import { isOriginDenied, isProtectedField } from "../core/security.js";

const HOST_ID = "pearl-page-canvas-host";
const clampBox = (start, end) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.max(24, Math.abs(end.x - start.x)),
  height: Math.max(24, Math.abs(end.y - start.y)),
});

function pagePoint(event, coordinateSpace = "document") {
  return coordinateSpace === "viewport"
    ? { x: event.clientX, y: event.clientY, pressure: event.pressure || .5 }
    : { x: event.clientX + scrollX, y: event.clientY + scrollY, pressure: event.pressure || .5 };
}

function screenPoint(point, coordinateSpace) {
  return coordinateSpace === "viewport"
    ? point
    : { x: point.x - scrollX, y: point.y - scrollY };
}

function fixedAtPoint(x, y) {
  const target = document.elementFromPoint(x, y);
  if (!target || isProtectedField(target)) return false;
  return getComputedStyle(target).position === "fixed";
}

function domObservationAt(x, y) {
  const prior = document.getElementById(HOST_ID)?.style.pointerEvents;
  const canvasHost = document.getElementById(HOST_ID);
  if (canvasHost) canvasHost.style.pointerEvents = "none";
  const target = document.elementFromPoint(x, y);
  if (canvasHost) canvasHost.style.pointerEvents = prior || "";
  if (!target || isProtectedField(target) || target.closest("input[type=password],[autocomplete*=cc-],[autocomplete*=password]")) return null;
  const link = target.closest("a[href]");
  const image = target.closest("img");
  const text = String(target.innerText || target.textContent || target.getAttribute("alt") || "").trim().slice(0, 4_000);
  if (!text && !link && !image) return null;
  const box = target.getBoundingClientRect();
  return {
    id: `dom:${crypto.randomUUID()}`,
    kind: image ? "image" : link ? "link" : "dom",
    ref: link?.href || image?.currentSrc || null,
    summary: text || link?.textContent || image?.alt || target.tagName.toLowerCase(),
    geometry: { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height },
    provenance: { pageIdentity: canonicalPageIdentity(location.href), tag: target.tagName.toLowerCase(), explicit: true },
  };
}

function artifactIntersects(artifact, box) {
  const left = artifact.box.x;
  const top = artifact.box.y;
  const right = left + artifact.box.width;
  const bottom = top + artifact.box.height;
  return left <= box.x + box.width && right >= box.x && top <= box.y + box.height && bottom >= box.y;
}

function escapePdfText(value) {
  return String(value || "").replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
}

export function pearlCanvasPdfBytes(state) {
  const lines = (state.artifacts || []).filter((entry) => ["text", "output"].includes(entry.type) && entry.text).flatMap((entry) =>
    String(entry.text).split(/\r?\n/).slice(0, 200)
  ).slice(0, 500);
  const content = lines.map((line, index) => `BT /F1 10 Tf 40 ${800 - index * 14} Td (${escapePdfText(line.slice(0, 140))}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function createPearlPageCanvas({ send }) {
  let host;
  let shadow;
  let surface;
  let state = null;
  let gesture = null;
  let draft = null;
  const imageSources = new Map();

  function ensure() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483644;pointer-events:none";
    shadow = host.attachShadow({ mode: "open" });
    surface = document.createElement("div");
    surface.className = "surface";
    shadow.append(surface);
    document.documentElement.append(host);
    surface.addEventListener("pointerdown", pointerDown);
    surface.addEventListener("pointermove", pointerMove);
    surface.addEventListener("pointerup", pointerUp);
    surface.addEventListener("pointercancel", cancelGesture);
    surface.addEventListener("dragover", (event) => {
      if (state?.mode === "image") event.preventDefault();
    });
    surface.addEventListener("drop", dropImage);
    surface.addEventListener("paste", pasteImage);
  }

  function command(name, args = {}) {
    return send("page-canvas-command", {
      command: name,
      args: {
        pearlId: state?.pearlId,
        pageIdentity: state?.pageIdentity || canonicalPageIdentity(location.href),
        ...args,
      },
    }).then((response) => {
      if (response?.canvas) hydrate(response.canvas);
      return response;
    });
  }

  function render() {
    ensure();
    const active = state?.active === true;
    const mode = state?.mode || "native";
    host.dataset.active = String(active);
    host.dataset.mode = mode;
    surface.style.pointerEvents = active && mode !== "native" ? "auto" : "none";
    const artifacts = state?.artifacts || [];
    surface.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box}
        .surface{position:fixed;inset:0;overflow:hidden;touch-action:none;cursor:default}
        :host([data-mode="select-type"]) .surface{cursor:crosshair}
        :host([data-mode="pen"]) .surface,:host([data-mode="highlighter"]) .surface{cursor:crosshair}
        :host([data-mode="eraser"]) .surface{cursor:cell}
        svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
        path{fill:none;stroke-linecap:round;stroke-linejoin:round}
        .box{position:absolute;min-width:24px;min-height:24px;padding:6px 7px;border:1px solid rgba(35,40,38,.28);background:rgba(250,250,247,.76);color:#242827;font:12px/1.45 Inter,system-ui,sans-serif;white-space:pre-wrap;overflow:auto;pointer-events:none}
        .box.selected{border-color:rgba(35,40,38,.7)}
        .box.editable{pointer-events:auto;outline:none}
        .box.editable:focus{border-color:rgba(35,40,38,.58)}
        .image{position:absolute;object-fit:contain;pointer-events:none}
        .preview{position:absolute;border:1px solid rgba(46,52,49,.55);background:rgba(248,248,244,.12);pointer-events:none}
        .mode{position:fixed;left:12px;bottom:10px;color:rgba(45,50,48,.58);font:9px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
        @media(prefers-color-scheme:dark){.box{background:rgba(10,12,12,.78);color:#eeede8;border-color:rgba(238,241,238,.25)}.mode{color:rgba(238,241,238,.52)}}
        @media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
      </style>
      <svg aria-hidden="true"></svg>
      <div class="objects"></div>
      ${draft?.box ? `<div class="preview" style="left:${draft.box.x}px;top:${draft.box.y}px;width:${draft.box.width}px;height:${draft.box.height}px"></div>` : ""}
      ${active && mode !== "native" ? `<span class="mode">${mode.replace("-", " ")}</span>` : ""}
    `;
    const svg = surface.querySelector("svg");
    const objects = surface.querySelector(".objects");
    for (const artifact of artifacts) {
      if (["ink", "highlight"].includes(artifact.type)) {
        const points = artifact.points.map((point) => screenPoint(point, artifact.coordinateSpace));
        if (!points.length) continue;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" "));
        path.setAttribute("stroke", artifact.style.color);
        path.setAttribute("stroke-width", artifact.style.width);
        path.setAttribute("opacity", artifact.style.opacity);
        svg.append(path);
        continue;
      }
      const point = screenPoint(artifact.box, artifact.coordinateSpace);
      if (artifact.type === "image") {
        const image = document.createElement("img");
        image.className = "image";
        image.alt = "";
        image.src = imageSources.get(artifact.source) || "";
        image.style.cssText = `left:${point.x}px;top:${point.y}px;width:${artifact.box.width}px;height:${artifact.box.height}px`;
        objects.append(image);
      } else {
        const box = document.createElement("div");
        box.className = `box${state.selectedIds.includes(artifact.id) ? " selected" : ""}`;
        box.dataset.id = artifact.id;
        box.textContent = artifact.text;
        if (state.active && state.mode === "select-type" && ["text", "output"].includes(artifact.type)) {
          box.classList.add("editable");
          box.contentEditable = "plaintext-only";
          box.addEventListener("pointerdown", (event) => event.stopPropagation());
          box.addEventListener("blur", () => {
            if (box.textContent !== artifact.text) command("updatePearlCanvasArtifact", { artifactId: artifact.id, patch: { text: box.textContent } });
          });
        }
        box.style.cssText = `left:${point.x}px;top:${point.y}px;width:${artifact.box.width}px;height:${artifact.box.height}px`;
        objects.append(box);
      }
    }
    if (draft?.points?.length) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", draft.points.map((point, index) => `${index ? "L" : "M"}${point.clientX} ${point.clientY}`).join(" "));
      path.setAttribute("stroke", mode === "highlighter" ? "rgba(233,213,126,.5)" : "#2a2c2b");
      path.setAttribute("stroke-width", mode === "highlighter" ? "14" : "2");
      svg.append(path);
    }
  }

  function pointerDown(event) {
    if (!state?.active || state.mode === "native") return;
    if (event.button !== 0) return;
    const coordinateSpace = fixedAtPoint(event.clientX, event.clientY) ? "viewport" : "document";
    gesture = {
      pointerId: event.pointerId,
      mode: state.mode,
      coordinateSpace,
      start: pagePoint(event, coordinateSpace),
      startClient: { x: event.clientX, y: event.clientY },
      points: [pagePoint(event, coordinateSpace)],
    };
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function pointerMove(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (["pen", "highlighter", "voice"].includes(gesture.mode)) {
      gesture.points.push(pagePoint(event, gesture.coordinateSpace));
      draft = { points: [...(draft?.points || []), { clientX: event.clientX, clientY: event.clientY }] };
    } else {
      const end = { x: event.clientX, y: event.clientY };
      draft = { box: clampBox(gesture.startClient, end) };
    }
    render();
  }

  async function pointerUp(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const current = gesture;
    cancelGesture();
    if (["pen", "highlighter", "voice"].includes(current.mode)) {
      await command("createPearlCanvasArtifact", {
        artifact: {
          type: current.mode === "highlighter" ? "highlight" : "ink",
          coordinateSpace: current.coordinateSpace,
          points: current.points,
          box: { x: current.start.x, y: current.start.y, width: 1, height: 1 },
          provenance: current.mode === "voice" ? { kind: "voice-linked-drawing", explicit: true } : { kind: "direct-drawing", explicit: true },
        },
      });
      return;
    }
    const end = pagePoint(event, current.coordinateSpace);
    const box = clampBox(current.start, end);
    if (current.mode === "select-type") {
      await send("page-canvas-create-textbox", {
        pearlId: state.pearlId,
        pageIdentity: state.pageIdentity,
        box,
        coordinateSpace: current.coordinateSpace,
      }).then((response) => response?.canvas && hydrate(response.canvas));
    } else if (current.mode === "lasso") {
      const ids = state.artifacts.filter((artifact) => artifactIntersects(artifact, box)).map((artifact) => artifact.id);
      await command("selectPearlCanvasArtifacts", { artifactIds: ids });
    } else if (current.mode === "eraser") {
      const ids = state.artifacts.filter((artifact) => artifactIntersects(artifact, box)).map((artifact) => artifact.id);
      if (ids.length) await command("deletePearlCanvasArtifacts", { artifactIds: ids });
    } else if (current.mode === "dom-select") {
      const entry = domObservationAt(event.clientX, event.clientY);
      if (entry) await command("bindPearlCanvasContext", { entries: [entry] });
    }
  }

  function cancelGesture() {
    gesture = null;
    draft = null;
    render();
  }

  async function dropImage(event) {
    if (state?.mode !== "image") return;
    event.preventDefault();
    const file = [...(event.dataTransfer?.files || [])].find((entry) => entry.type.startsWith("image/"));
    if (!file || file.size > 5_000_000) return;
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const stored = await send("page-canvas-blob-store", { dataUrl: source, mime: file.type });
    try {
      await command("createPearlCanvasArtifact", {
        artifact: {
          type: "image",
          source: stored.blobRef,
          mime: file.type,
          box: { x: event.clientX + scrollX, y: event.clientY + scrollY, width: 320, height: 220 },
          provenance: { kind: "explicit-local-drop", name: file.name, size: file.size },
        },
      });
    } catch (error) {
      if (!stored.duplicate) await send("page-canvas-blob-delete", { blobRef: stored.blobRef }).catch(() => {});
      throw error;
    }
  }

  async function pasteImage(event) {
    if (state?.mode !== "image") return;
    const file = [...(event.clipboardData?.files || [])].find((entry) => entry.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    await dropImage({
      preventDefault() {},
      dataTransfer: { files: [file] },
      clientX: innerWidth / 2,
      clientY: innerHeight / 2,
    });
  }

  async function hydrate(next) {
    state = next || null;
    if (!state) imageSources.clear();
    for (const artifact of state?.artifacts || []) {
      if (artifact.type !== "image" || imageSources.has(artifact.source)) continue;
      try {
        const image = await send("page-canvas-blob-read", { blobRef: artifact.source });
        if (image?.dataUrl) imageSources.set(artifact.source, image.dataUrl);
      } catch {
        imageSources.set(artifact.source, "");
      }
    }
    render();
  }

  function downloadPdf() {
    if (!state) throw new Error("activate a Pearl canvas before exporting");
    const blob = new Blob([pearlCanvasPdfBytes(state)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pearl-${state.pearlId || "canvas"}.pdf`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { exported: true, scope: "pearl-canvas", artifactCount: state.artifacts.length };
  }

  function keydown(event) {
    if (!state?.active || event.target?.closest?.("input,textarea,[contenteditable=true]")) return;
    if (event.key === "Escape" && state.mode !== "native") {
      command("setPearlCanvasInputMode", { mode: "native" });
      event.preventDefault();
      return;
    }
    if (!(event.altKey && event.shiftKey)) return;
    const modes = { V: "native", T: "select-type", P: "pen", H: "highlighter", E: "eraser", L: "lasso", I: "image", D: "dom-select" };
    const mode = modes[event.key.toUpperCase()];
    if (!mode) return;
    command("setPearlCanvasInputMode", { mode });
    event.preventDefault();
  }

  addEventListener("scroll", render, { passive: true });
  addEventListener("resize", render, { passive: true });
  addEventListener("keydown", keydown, true);
  ensure();
  if (!isOriginDenied(location.href)) {
    send("page-canvas-get", { pageIdentity: canonicalPageIdentity(location.href) }).then((response) => hydrate(response?.canvas)).catch(() => {});
  }
  return { hydrate, render, downloadPdf, get state() { return state; } };
}
