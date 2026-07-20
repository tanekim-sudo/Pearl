import { safeExternalUrl } from "../core/security.js";
import { BrowserPlatform } from "../platform/browser-platform.js";

const DEFAULT_WEB_ORIGIN = "https://representation-eta.vercel.app";

async function settings() {
  const stored = await BrowserPlatform.storage.get("local", ["apiOrigin"]);
  const origin = stored.apiOrigin || (import.meta.env.DEV ? "http://localhost:8787" : DEFAULT_WEB_ORIGIN);
  return { origin: new URL(origin).origin };
}

async function authToken() {
  const stored = await BrowserPlatform.storage.get("session", ["accessToken"]);
  return stored.accessToken || "";
}

export async function authStatus() {
  return { authenticated: !!(await authToken()) };
}

export async function login() {
  const { origin } = await settings();
  const redirect = BrowserPlatform.identity.redirectUrl("auth");
  const state = crypto.randomUUID();
  const verifier = [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const challengeBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...challengeBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const configUrl = new URL("/api/extension/auth/config", origin);
  configUrl.searchParams.set("redirect_uri", redirect);
  configUrl.searchParams.set("state", state);
  configUrl.searchParams.set("code_challenge", challenge);
  const configResponse = await fetch(configUrl, { credentials: "omit" });
  const config = await configResponse.json().catch(() => ({}));
  if (!configResponse.ok || !config.authorizeUrl) throw new Error("hosted login is unavailable");
  const callback = await BrowserPlatform.identity.launch(config.authorizeUrl, true);
  const url = new URL(callback);
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== state) throw new Error("hosted login did not return a valid authorization code");
  const exchange = await fetch(new URL("/api/extension/auth/exchange", origin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ code, verifier, redirectUri: redirect }),
  });
  const payload = await exchange.json().catch(() => ({}));
  const token = payload.accessToken;
  if (!exchange.ok || !token) throw new Error("hosted login authorization failed");
  let profileId = "";
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    profileId = String(claims.sub || "");
  } catch {
    profileId = "";
  }
  if (!profileId) throw new Error("hosted login did not return a stable account identity");
  await BrowserPlatform.storage.switchProfile(profileId);
  await BrowserPlatform.storage.set("session", { accessToken: token });
  return { authenticated: true };
}

export async function logout() {
  await BrowserPlatform.storage.remove("session", ["accessToken"]);
  await BrowserPlatform.storage.switchProfile(null);
  return { authenticated: false };
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
  if (!response.ok) throw new Error(`request failed (${response.status})`);
  return data;
}

export async function openArtifact(id) {
  const { origin } = await settings();
  return safeExternalUrl(`${origin}/?artifact=${encodeURIComponent(id)}`);
}
