import { createMessage } from "../core/messages.js";
import { PHYSICAL_PEARL_CSS, physicalPearlMarkup } from "../../../shared/physical-pearl.js";
import { createPearlEntity } from "../../../shared/pearl-entity.js";
import { createPearlStudioViewModel } from "../../../shared/pearl-studio.js";
import React from "react";
import { createRoot } from "react-dom/client";
import CognitiveLayerStudio from "../../../client/components/CognitiveLayerStudio.jsx";

const root = document.getElementById("result");
const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
const nonce = fragment.get("handoff") || "";
history.replaceState(null, "", `${location.pathname}${location.search}`);

const style = document.createElement("style");
style.textContent = `
  :root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f8faf7;color:#252927}
  body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 50% 42%,rgba(194,221,207,.1),transparent 34%),#f8faf7}
  main{position:relative;width:min(680px,calc(100vw - 40px));margin:clamp(80px,16vh,180px) auto}
  .pearl{display:block;width:32px;height:32px;margin:0 0 30px}
  .status{color:#68736d;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
  article{max-height:58vh;overflow:auto;margin-top:12px;padding-right:18px;font-size:14px;line-height:1.65;white-space:pre-wrap}
  details{margin-top:28px;padding-top:10px;border-top:1px solid rgba(64,88,76,.14);color:#68736d;font-size:11px}
  .studio{border:0;margin:0;padding:0}.studio-name,.studio-content{box-sizing:border-box;width:100%;border:0;border-bottom:1px solid rgba(64,88,76,.14);border-radius:0;background:transparent;color:inherit;outline:none}.studio-name{font:500 clamp(24px,4vw,44px)/1.1 inherit;padding:0 0 18px}.studio-content{min-height:42vh;resize:vertical;padding:22px 0;font:400 15px/1.7 inherit}.studio-inspect{position:absolute;top:2px;left:48px;opacity:0;border:0;border-bottom:1px solid currentColor;background:transparent;color:inherit;padding:5px 0}.studio:focus-within~.studio-inspect,.studio-inspect:focus-visible,.studio-inspect:hover{opacity:.65}.studio-actions{display:flex;align-items:center;gap:14px;margin:20px 0;color:#68736d;font-size:11px}.studio-actions button,.studio-actions select{border:0;border-bottom:1px solid rgba(64,88,76,.25);border-radius:0;background:transparent;color:inherit;padding:7px 0}.studio-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.studio-section{margin-top:32px;padding-top:12px;border-top:1px solid rgba(64,88,76,.12)}.studio-section summary{font-size:10px;letter-spacing:.1em;text-transform:uppercase}.studio-section pre{white-space:pre-wrap;font:11px/1.55 ui-monospace,SFMono-Regular,monospace}
  @media(prefers-color-scheme:dark){:root,body{background:#090c0b;color:#ecefe9}body{background:radial-gradient(ellipse at 50% 42%,rgba(194,221,207,.035),transparent 34%),#090c0b}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important}}
  ${PHYSICAL_PEARL_CSS}
`;
document.head.append(style);

async function studioAction(entity, command, args = {}) {
  const response = await chrome.runtime.sendMessage(createMessage("pearl-action", {
    event: {
      pearlId: entity.id,
      command,
      args,
      surface: "studio",
      expectedRevision: entity.revision,
      idempotencyKey: crypto.randomUUID(),
    },
  }));
  if (!response?.ok) throw new Error(response?.error || "Pearl edit failed");
  if (response.value?.conflict) throw Object.assign(new Error("This Pearl changed in another tab. Review the current version before applying your edit."), { conflict: response.value.conflict });
  const refreshed = await chrome.runtime.sendMessage(createMessage("pearl-entity-get", { pearlId: entity.id }));
  if (!refreshed?.ok || !refreshed.value?.entity) throw new Error("Pearl edit could not be reloaded");
  return { entity: createPearlEntity(refreshed.value.entity), domainResult: response.value?.domainResult || null };
}

function renderStudio(initialEntity) {
  let entity = createPearlEntity(initialEntity);
  let saveTimer;
  const channel = new BroadcastChannel(`pearl-studio:${entity.id}`);
  root.textContent = "";
  const pearl = document.createElement("div");
  pearl.className = "pearl";
  pearl.innerHTML = physicalPearlMarkup({ id: "studio-pearl", variant: entity.kind === "result" ? "result" : "primary", state: "idle", size: 32, decorative: true });
  const form = document.createElement("form");
  form.className = "studio";
  const name = document.createElement("input");
  name.className = "studio-name";
  name.value = entity.identity.name;
  name.setAttribute("aria-label", "Pearl name");
  const content = document.createElement("textarea");
  content.className = "studio-content";
  content.value = entity.results[0]?.text || entity.identity.description || "";
  content.setAttribute("aria-label", "Pearl content");
  const actions = document.createElement("div");
  actions.className = "studio-actions";
  const representation = document.createElement("select");
  representation.setAttribute("aria-label", "Representation");
  const undo = document.createElement("button");
  undo.type = "button";
  undo.textContent = "Undo";
  const redo = document.createElement("button");
  redo.type = "button";
  redo.textContent = "Redo";
  const status = document.createElement("span");
  status.className = "studio-status";
  status.setAttribute("role", "status");
  status.textContent = "Local · encrypted";
  actions.append(representation, undo, redo, status);
  form.append(name, content, actions);
  const detailsHost = document.createElement("div");
  const cognitionHost = document.createElement("div");
  const cognitionRoot = createRoot(cognitionHost);
  const inspect = document.createElement("button");
  inspect.type = "button";
  inspect.className = "studio-inspect";
  inspect.textContent = "Inspect structure";
  inspect.setAttribute("aria-expanded", "false");
  inspect.setAttribute("aria-keyshortcuts", "Meta+K Control+K");
  let structureOpen = false;
  const setStructureOpen = (open) => {
    structureOpen = open;
    actions.hidden = !open;
    cognitionHost.hidden = !open;
    detailsHost.hidden = !open;
    inspect.setAttribute("aria-expanded", String(open));
  };
  inspect.addEventListener("click", () => setStructureOpen(!structureOpen));
  addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setStructureOpen(true);
      representation.focus();
    } else if (event.key === "Escape") {
      setStructureOpen(false);
      content.focus();
    }
  });

  function refresh() {
    const view = createPearlStudioViewModel(entity, { representation: entity.representation.mode });
    representation.textContent = "";
    for (const optionName of view.representations) {
      const option = document.createElement("option");
      option.value = optionName;
      option.textContent = optionName.replaceAll("-", " ");
      option.selected = optionName === view.representation;
      representation.append(option);
    }
    detailsHost.textContent = "";
    for (const section of view.sections.filter((entry) => !["identity", "outputs"].includes(entry.id))) {
      const details = document.createElement("details");
      details.className = "studio-section";
      const summary = document.createElement("summary");
      summary.textContent = section.label;
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(section.value, null, 2);
      details.append(summary, pre);
      detailsHost.append(details);
    }
    cognitionRoot.render(entity.cognition.layers.length
      ? React.createElement(CognitiveLayerStudio, {
          cognition: entity.cognition,
          onCommand: async (command, args) => {
            const executed = await studioAction(entity, command, { pearlId: entity.id, ...args });
            entity = executed.entity;
            channel.postMessage({ pearlId: entity.id, revision: entity.revision });
            refresh();
            return executed.domainResult;
          },
        })
      : null);
  }

  async function save() {
    status.textContent = "Saving…";
    try {
      const nextResults = entity.results.length
        ? entity.results.map((entry, index) => index === 0 ? { ...entry, text: content.value } : entry)
        : [{ id: entity.id, text: content.value, status: "ready" }];
      entity = (await studioAction(entity, "editPearlEntity", {
        pearlId: entity.id,
        expectedRevision: entity.revision,
        idempotencyKey: crypto.randomUUID(),
        patch: { identity: { ...entity.identity, name: name.value }, results: nextResults },
      })).entity;
      status.textContent = "Saved locally";
      channel.postMessage({ pearlId: entity.id, revision: entity.revision });
      refresh();
    } catch (error) {
      status.textContent = error.message;
      status.setAttribute("role", "alert");
    }
  }
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  };
  name.addEventListener("input", scheduleSave);
  content.addEventListener("input", scheduleSave);
  form.addEventListener("submit", (event) => event.preventDefault());
  representation.addEventListener("change", async () => {
    try {
      entity = (await studioAction(entity, "setPearlStudioRepresentation", {
        pearlId: entity.id,
        representation: representation.value,
        expectedRevision: entity.revision,
        idempotencyKey: crypto.randomUUID(),
      })).entity;
      channel.postMessage({ pearlId: entity.id, revision: entity.revision });
      refresh();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  undo.addEventListener("click", async () => {
    entity = (await studioAction(entity, "undoPearlEntityEdit", { pearlId: entity.id })).entity;
    name.value = entity.identity.name;
    content.value = entity.results[0]?.text || entity.identity.description || "";
    refresh();
  });
  redo.addEventListener("click", async () => {
    entity = (await studioAction(entity, "redoPearlEntityEdit", { pearlId: entity.id })).entity;
    name.value = entity.identity.name;
    content.value = entity.results[0]?.text || entity.identity.description || "";
    refresh();
  });
  channel.addEventListener("message", (event) => {
    if (event.data?.revision > entity.revision) {
      status.textContent = "Changed in another tab · review before editing";
      status.setAttribute("role", "alert");
    }
  });
  root.append(pearl, form, inspect, cognitionHost, detailsHost);
  setStructureOpen(false);
  refresh();
}

chrome.runtime.sendMessage(createMessage("result-pearl-redeem", { nonce })).then(async (response) => {
  if (!response?.ok || !response.value?.result) throw new Error("This Pearl result handoff is unavailable.");
  const result = response.value.result;
  if (response.value.studio) {
    const canonical = await chrome.runtime.sendMessage(createMessage("pearl-entity-get", { pearlId: result.id }));
    renderStudio(canonical?.ok && canonical.value?.entity ? canonical.value.entity : { ...result, kind: "result" });
    return;
  }
  root.textContent = "";
  const pearl = document.createElement("div");
  pearl.className = "pearl";
  pearl.innerHTML = physicalPearlMarkup({ id: "result-tab-pearl", variant: "result", state: result.status === "failed" ? "failed" : "new", size: 32, decorative: true });
  const status = document.createElement("span");
  status.className = "status";
  status.textContent = `${result.status} · same persisted result`;
  const article = document.createElement("article");
  article.textContent = result.text || "This result has no text.";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Provenance";
  const provenance = document.createElement("pre");
  provenance.textContent = JSON.stringify({
    resultId: result.id,
    sourceRefs: result.sourceRefs,
    lens: result.lens,
    branch: result.branch,
    outputSpec: result.outputSpec,
    disclosureReceipt: result.disclosureReceipt,
    provenance: result.provenance,
  }, null, 2);
  details.append(summary, provenance);
  root.append(pearl, status, article, details);
}).catch(() => {
  root.innerHTML = `${physicalPearlMarkup({ id: "result-tab-blocked", variant: "result", state: "blocked", size: 32, decorative: true })}<p role="alert">This Pearl result could not be opened. Return to the source page and try again.</p>`;
});
