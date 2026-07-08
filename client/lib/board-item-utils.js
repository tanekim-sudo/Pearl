import { STICKY_COLORS } from "./worlds.js";

export const TEXT_BOX_DEFAULT_W = 240;
export const TEXT_BOX_MIN_W = 72;
export const TEXT_BOX_MAX_W = 520;

const TEXT_PAD_X = 30;
const TEXT_PAD_Y = 18;
const TEXT_LINE_HEIGHT = 24;
const BOARD_TEXT_FONT =
  '16px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

let measureCanvas = null;

function measureCanvasCtx() {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

/** Widest line of text in px (canvas when available, char estimate in tests). */
export function measureTextNaturalWidth(text, font = BOARD_TEXT_FONT) {
  const lines = (text || "").split("\n");
  if (!lines.length) return 0;
  const ctx = measureCanvasCtx();
  if (ctx) {
    ctx.font = font;
    return Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
  }
  const charW = 8.6;
  return Math.max(0, ...lines.map((line) => line.length * charW));
}

/** Fit box width to content — shrinks short labels, caps long prose. */
export function fitTextBoxWidth(text, opts = {}) {
  const maxW = opts.maxW ?? TEXT_BOX_MAX_W;
  const minW = opts.minW ?? TEXT_BOX_MIN_W;
  const padX = opts.padX ?? TEXT_PAD_X;
  const clean = (text || "").trim();
  if (!clean) return minW;

  const natural = measureTextNaturalWidth(text);
  const contentMax = Math.max(32, maxW - padX);
  if (natural <= contentMax) {
    return Math.max(minW, Math.ceil(natural + padX));
  }
  return maxW;
}

export function fitTextItemWidth(item) {
  if (!item) return TEXT_BOX_MIN_W;
  const text = item.text || "";
  switch (item.type) {
    case "sticky":
      return fitTextBoxWidth(text, { minW: 100, maxW: 280, padX: 36 });
    case "callout":
      return fitTextBoxWidth(text, { minW: 160, maxW: 360, padX: 52 });
    case "code":
    case "math":
      return fitTextBoxWidth(text, { minW: 120, maxW: 400, padX: 40 });
    case "text":
    default:
      return fitTextBoxWidth(text);
  }
}

export function measureBlockHeight(w, text, lineHeight = TEXT_LINE_HEIGHT, padY = TEXT_PAD_Y) {
  const boxW = w || 360;
  const contentW = Math.max(64, boxW - TEXT_PAD_X);
  const charW = 8.6;
  const lines = (text || "").split("\n");
  let rowCount = 0;
  for (const line of lines) {
    if (!line.length) rowCount += 1;
    else rowCount += Math.max(1, Math.ceil((line.length * charW) / contentW));
  }
  return Math.max(28, rowCount * lineHeight + padY);
}

export function blockWidth(it) {
  if (it.type === "image") return it.w || 200;
  if (it.type === "video") return it.w || 280;
  if (it.type === "voice") return it.w || 260;
  if (it.type === "diagram") return it.w || 320;
  if (it.type === "sticky") return it.w || 180;
  if (it.type === "callout") return it.w || 280;
  if (it.type === "table") return it.w || 320;
  if (it.type === "code" || it.type === "math") return it.w || 300;
  if (it.type === "text") return it.w || TEXT_BOX_DEFAULT_W;
  return 0;
}

export function blockHeight(it, measureTextHeight) {
  if (it.type === "image") return it.h || Math.round((it.w || 200) * 0.75);
  if (it.type === "video") return it.h || Math.round((it.w || 280) * 0.56);
  if (it.type === "voice") return 56;
  if (it.type === "diagram") {
    const nodes = it.nodes || [];
    return Math.max(120, 80 + nodes.length * 28);
  }
  if (it.type === "sticky") return measureBlockHeight(it.w || 180, it.text, 22, 36);
  if (it.type === "callout") return measureBlockHeight(it.w || 280, it.text, 22, 52);
  if (it.type === "table") {
    const rows = (it.rows || []).length || 2;
    return 36 + rows * 32;
  }
  if (it.type === "code" || it.type === "math") {
    return measureBlockHeight(it.w || 300, it.text, 20, 40);
  }
  if (it.type === "text") return measureTextHeight(it.w, it.text);
  return 0;
}

export function stickyBackground(color) {
  return STICKY_COLORS[color] || STICKY_COLORS.yellow;
}

export function isTransformableBlock(it) {
  return (
    it &&
    (it.type === "text" ||
      it.type === "image" ||
      it.type === "sticky" ||
      it.type === "callout" ||
      it.type === "code" ||
      it.type === "math")
  );
}

export function isMovableBlock(it) {
  return it && it.type !== "link";
}

export function defaultBlockContent(type) {
  const defaults = {
    sticky: "",
    callout: "Your observation…",
    text: "",
    code: "// your code here",
    math: "E = mc²",
    table: "",
    diagram: "Central idea",
    voice: "",
  };
  return defaults[type] ?? "";
}

export function defaultBlockMeta(type) {
  if (type === "sticky") return { w: 180, color: "yellow" };
  if (type === "callout") return { w: 280, variant: "observation" };
  if (type === "diagram") {
    return {
      w: 320,
      title: "Ideas",
      nodes: [
        { id: "c", label: "Central idea", x: 0.5, y: 0.2 },
        { id: "a", label: "Branch A", x: 0.15, y: 0.65 },
        { id: "b", label: "Branch B", x: 0.5, y: 0.75 },
        { id: "c2", label: "Branch C", x: 0.85, y: 0.65 },
      ],
    };
  }
  if (type === "table") {
    return {
      w: 320,
      rows: [
        ["Column A", "Column B"],
        ["", ""],
      ],
    };
  }
  if (type === "voice") return { w: 260, duration: 0, waveform: [0.3, 0.5, 0.8, 0.4, 0.6, 0.9, 0.5, 0.3, 0.7, 0.4] };
  if (type === "video") return { w: 280, h: 158, duration: "0:00" };
  if (type === "code") return { w: 300 };
  if (type === "math") return { w: 240 };
  if (type === "text") return { w: TEXT_BOX_MIN_W };
  return { w: 280 };
}

/** Top-left anchor at pointer — Google Slides / Docs style. */
export function blockOriginAtPointer(type, atWorld) {
  const meta = defaultBlockMeta(type);
  const w = meta.w || 160;
  if (type === "text" || type === "sticky" || type === "callout") {
    return { x: Math.round(atWorld.x), y: Math.round(atWorld.y), w };
  }
  const h = meta.h || 80;
  return { x: Math.round(atWorld.x - w / 2), y: Math.round(atWorld.y - h / 2), w };
}

/** Centered placement for toolbar / menu inserts without a pointer. */
export function blockOriginAtViewportCenter(type, centerWorld) {
  const meta = defaultBlockMeta(type);
  const w = meta.w || 160;
  return {
    x: Math.round(centerWorld.x - w / 2),
    y: Math.round(centerWorld.y - 48),
    w,
  };
}
