import { applyGenericPlan, resolveEditable, snapshotEditable } from "./generic.js";

export function adapterForUrl(url) {
  const host = new URL(url).hostname.toLowerCase();
  if (host === "docs.google.com") return "google-docs";
  if (host.endsWith("mail.google.com")) return "gmail";
  if (host.endsWith("notion.so") || host.endsWith("notion.site")) return "notion";
  if (host.includes("outlook.") || host.endsWith("office.com")) return "outlook";
  return "generic";
}

export function detectAdapter() {
  const specialist = adapterForUrl(location.href);
  return specialist === "generic" ? resolveEditable().adapter : specialist;
}

function scopedPlan(plan, selector, adapter, plain = false) {
  const element = document.querySelector(selector);
  if (!element) return { ok: false, error: `${adapter} editor unavailable` };
  const snapshot = snapshotEditable({ adapter: element.matches("input,textarea") ? "field" : "contenteditable", element });
  return applyGenericPlan({
    ...plan,
    adapter,
    formatting: plain ? "plain" : plan.formatting,
    anchor: { ...plan.anchor, selector },
    revision: plan.revision || snapshot.revision,
  });
}

export function applySpecialistPlan(plan) {
  const adapter = plan.adapter || detectAdapter();
  if (adapter === "google-docs") {
    return {
      ok: false,
      fallback: "clipboard",
      error: "Google Docs write access uses Copy or the Lens Workspace add-on; private editor internals are not accessed.",
    };
  }
  if (adapter === "gmail") {
    return scopedPlan(plan, '[contenteditable="true"][role="textbox"], div[aria-label^="Message Body"]', "gmail");
  }
  if (adapter === "notion") {
    if (plan.anchor?.crossBlock) return { ok: false, fallback: "copy", error: "Notion cross-block replacement is intentionally unsupported." };
    return scopedPlan(plan, '[contenteditable="true"][data-content-editable-leaf="true"], [contenteditable="true"]', "notion", true);
  }
  if (adapter === "outlook") {
    if (plan.formatting === "rich") return { ok: false, fallback: "office-addin", error: "Use the Lens Outlook add-in for verified rich insertion." };
    return scopedPlan(plan, '[contenteditable="true"][role="textbox"], div[aria-label*="Message body"]', "outlook", true);
  }
  return applyGenericPlan(plan);
}
