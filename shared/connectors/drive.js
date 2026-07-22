/**
 * Google Drive connector: live OAuth when client credentials exist;
 * otherwise paste-link / upload fallback (always available).
 */

export function driveConnectorStatus(env = typeof import.meta !== "undefined" ? import.meta.env : process.env) {
  const clientId = env?.VITE_GOOGLE_DRIVE_CLIENT_ID || env?.GOOGLE_DRIVE_CLIENT_ID || "";
  const configured = Boolean(String(clientId || "").trim());
  return {
    id: "google-drive",
    label: "Google Drive",
    configured,
    mode: configured ? "oauth-picker" : "paste-or-upload",
    fallback: "Paste a Drive/Docs link or upload the file. Live folder pull requires Drive OAuth credentials.",
  };
}

export function extractDriveLinks(text = "") {
  return [...String(text).matchAll(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s)]+/gi)].map((match) => match[0]);
}

export async function beginDrivePicker({ clientId, onPicked } = {}) {
  const status = driveConnectorStatus({ VITE_GOOGLE_DRIVE_CLIENT_ID: clientId });
  if (!status.configured) {
    return { ok: false, mode: "paste-or-upload", detail: status.fallback };
  }
  // GIS picker is loaded only when a client id is configured in the host app.
  if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
    return { ok: false, mode: "paste-or-upload", detail: "Google Identity Services is unavailable in this surface; paste a Drive link instead." };
  }
  return new Promise((resolve) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          resolve({ ok: false, mode: "paste-or-upload", detail: tokenResponse.error });
          return;
        }
        onPicked?.({ accessToken: tokenResponse.access_token });
        resolve({ ok: true, mode: "oauth-picker", accessToken: tokenResponse.access_token });
      },
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}
