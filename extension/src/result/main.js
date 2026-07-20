import { createMessage } from "../core/messages.js";

const root = document.getElementById("result");
const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
const nonce = fragment.get("handoff") || "";
history.replaceState(null, "", `${location.pathname}${location.search}`);

const style = document.createElement("style");
style.textContent = `
  :root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f8faf7;color:#252927}
  body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 50% 42%,rgba(194,221,207,.1),transparent 34%),#f8faf7}
  main{width:min(680px,calc(100vw - 40px));margin:clamp(80px,16vh,180px) auto;padding-left:18px;border-left:1px solid rgba(64,88,76,.2)}
  .pearl{width:32px;height:32px;margin:0 0 30px;border-radius:50%;background:radial-gradient(circle at 34% 27%,#fff 0 5%,transparent 6%),radial-gradient(circle at 40% 62%,rgba(188,221,202,.7),transparent 52%),radial-gradient(circle at 38% 34%,#fffdf6,#dce9df 68%,#aebdb3);box-shadow:0 2px 2px rgba(0,0,0,.12)}
  .status{color:#68736d;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
  article{max-height:58vh;overflow:auto;margin-top:12px;padding-right:18px;font-size:14px;line-height:1.65;white-space:pre-wrap}
  details{margin-top:28px;padding-top:10px;border-top:1px solid rgba(64,88,76,.14);color:#68736d;font-size:11px}
  @media(prefers-color-scheme:dark){:root,body{background:#090c0b;color:#ecefe9}body{background:radial-gradient(ellipse at 50% 42%,rgba(194,221,207,.035),transparent 34%),#090c0b}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important}}
`;
document.head.append(style);

chrome.runtime.sendMessage(createMessage("result-pearl-redeem", { nonce })).then((response) => {
  if (!response?.ok || !response.value?.result) throw new Error("This Pearl result handoff is unavailable.");
  const result = response.value.result;
  root.textContent = "";
  const pearl = document.createElement("div");
  pearl.className = "pearl";
  pearl.setAttribute("aria-hidden", "true");
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
  root.textContent = "This Pearl result could not be opened. Return to the source page and try again.";
});
