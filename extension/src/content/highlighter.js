const ROOT_ID = "lens-everywhere-overlay";

export function createHighlighter() {
  let root = null;
  let shadow = null;
  let enabled = false;
  const marks = new Map();

  function ensureRoot() {
    if (root?.isConnected) return;
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none";
    shadow = root.attachShadow({ mode: "open" });
    document.documentElement.append(root);
  }

  function render() {
    ensureRoot();
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent = ".mark{position:fixed;background:rgba(255,196,45,.34);outline:1px solid rgba(177,119,0,.55);border-radius:3px}.capsule{position:fixed;right:14px;bottom:14px;background:#151515;color:#fff;border:1px solid #e0ad2f;border-radius:99px;padding:8px 11px;font:12px system-ui;pointer-events:auto}";
    shadow.append(style);
    for (const rects of marks.values()) {
      for (const rect of rects) {
        const mark = document.createElement("div");
        mark.className = "mark";
        mark.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;
        shadow.append(mark);
      }
    }
    if (marks.size) {
      const capsule = document.createElement("button");
      capsule.className = "capsule";
      capsule.textContent = `${marks.size} selected · Open Pearl`;
      capsule.addEventListener("click", () => globalThis.chrome?.runtime?.sendMessage({ version: 1, type: "get-session", requestId: "capsule", payload: { open: true } }));
      shadow.append(capsule);
    }
  }

  return {
    get enabled() { return enabled; },
    toggle(force) {
      enabled = force == null ? !enabled : !!force;
      document.documentElement.dataset.lensHighlighter = String(enabled);
      if (enabled) ensureRoot();
      return enabled;
    },
    add(id, rects) {
      marks.set(id, rects);
      render();
    },
    remove(id) {
      marks.delete(id);
      render();
    },
    clear() {
      marks.clear();
      render();
    },
    rerender: render,
    destroy() {
      root?.remove();
      marks.clear();
      root = shadow = null;
    },
  };
}
