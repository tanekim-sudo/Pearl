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
