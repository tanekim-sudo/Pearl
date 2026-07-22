const CHROME_STORE_HOSTS = new Set(["chromewebstore.google.com", "chrome.google.com"]);
const FUNNEL_EVENTS = new Set([
  "view_install",
  "install_cta",
  "download",
  "instructions_viewed",
  "check_installed",
  "sign_in",
  "continue_local",
  "library_transferred",
  "first_go",
]);

export function validChromeStoreUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && CHROME_STORE_HOSTS.has(url.hostname) ? url.href : "";
  } catch {
    return "";
  }
}

export function detectExtensionBrowser(userAgent = "") {
  if (/Edg\//.test(userAgent)) return { name: "Edge", supported: true };
  if (/Chrome\//.test(userAgent) && !/(OPR\/|CriOS\/|Android|Mobile)/.test(userAgent)) {
    return { name: "Chrome", supported: true };
  }
  if (/Firefox\//.test(userAgent)) return { name: "Firefox", supported: false };
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return { name: "Safari", supported: false };
  return { name: "browser", supported: false };
}

export async function checkTrustedExtensionInstallation(extensionId = import.meta.env.VITE_LENS_EXTENSION_ID) {
  if (!extensionId || !globalThis.chrome?.runtime?.sendMessage || !globalThis.crypto?.randomUUID) {
    return { status: "unknown", trusted: false };
  }
  const nonce = crypto.randomUUID().replaceAll("-", "");
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(extensionId, { type: "lens-install-check", version: 1, nonce }, (value) => {
      if (chrome.runtime.lastError || !value?.ok) resolve({ status: "unknown", trusted: false });
      else resolve({ status: "installed", trusted: true, value: value.value || null });
    });
  });
}

export function configuredExtensionId(extensionId = import.meta.env?.VITE_LENS_EXTENSION_ID) {
  const id = String(extensionId || "").trim();
  return id || "";
}

export async function requestTrustedExtensionHandoff(token, extensionId = import.meta.env?.VITE_LENS_EXTENSION_ID) {
  const trustedId = configuredExtensionId(extensionId);
  if (!/^[a-f0-9]{32}$/i.test(String(token || "")) || !trustedId || !globalThis.chrome?.runtime?.sendMessage) {
    return {
      connected: false,
      handoff: null,
      reason: !/^[a-f0-9]{32}$/i.test(String(token || ""))
        ? "invalid-token"
        : !trustedId
          ? "missing-extension-id"
          : "extension-unavailable",
    };
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(trustedId, { type: "pearl-workspace-handoff", version: 1, nonce: token }, (value) => {
      if (chrome.runtime.lastError || !value?.ok) {
        resolve({ connected: false, handoff: null, reason: "extension-rejected" });
        return;
      }
      resolve({ connected: true, ...(value.value || {}), handoff: value.value?.handoff || null, reason: "ok" });
    });
  });
}

export async function requestTrustedResultHandoff(token, extensionId = import.meta.env?.VITE_LENS_EXTENSION_ID) {
  if (!/^[a-f0-9]{32}$/i.test(String(token || "")) || !extensionId || !globalThis.chrome?.runtime?.sendMessage) {
    return { connected: false, resultPearl: null };
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(extensionId, { type: "pearl-result-handoff", version: 1, nonce: token }, (value) => {
      if (chrome.runtime.lastError || !value?.ok) resolve({ connected: false, resultPearl: null });
      else resolve({ connected: true, ...(value.value || {}), resultPearl: value.value?.resultPearl || null });
    });
  });
}

export function trackExtensionFunnel(event, context = {}) {
  const endpoint = import.meta.env.VITE_LENS_ANALYTICS_ENDPOINT;
  if (!endpoint || !FUNNEL_EVENTS.has(event)) return false;
  try {
    const url = new URL(endpoint, location.origin);
    if (url.origin !== location.origin && url.protocol !== "https:") return false;
    const body = JSON.stringify({
      event,
      surface: String(context.surface || "web").slice(0, 24),
      mode: String(context.mode || "").slice(0, 24),
      at: new Date().toISOString(),
    });
    if (navigator.sendBeacon) return navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    fetch(url, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
