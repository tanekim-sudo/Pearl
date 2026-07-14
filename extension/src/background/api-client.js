import { safeExternalUrl } from "../core/security.js";
import { BrowserPlatform } from "../platform/browser-platform.js";

const DEFAULT_WEB_ORIGIN = "https://lens.app";

async function settings() {
  const stored = await BrowserPlatform.storage.get("local", ["apiOrigin"]);
  const origin = stored.apiOrigin || (import.meta.env.DEV ? "http://localhost:8787" : DEFAULT_WEB_ORIGIN);
  return { origin: new URL(origin).origin };
}

async function authToken() {
  const stored = await BrowserPlatform.storage.get("session", ["accessToken"]);
  return stored.accessToken || "";
}

export async function login() {
  const { origin } = await settings();
  const redirect = BrowserPlatform.identity.redirectUrl("auth");
  const authUrl = `${origin}/auth/extension?redirect_uri=${encodeURIComponent(redirect)}`;
  const callback = await BrowserPlatform.identity.launch(authUrl, true);
  const url = new URL(callback);
  const token = url.searchParams.get("access_token") || new URLSearchParams(url.hash.slice(1)).get("access_token");
  if (!token) throw new Error("hosted login did not return an access token");
  await BrowserPlatform.storage.set("session", { accessToken: token });
  return true;
}

export async function apiRequest(path, options = {}) {
  const { origin } = await settings();
  const token = await authToken();
  if (!token) throw new Error("sign in required");
  const controller = options.controller || new AbortController();
  const response = await fetch(`${origin}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-lens-client": "extension",
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: controller.signal,
    credentials: "omit",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `request failed (${response.status})`);
  return data;
}

export async function openArtifact(id) {
  const { origin } = await settings();
  return safeExternalUrl(`${origin}/?artifact=${encodeURIComponent(id)}`);
}
