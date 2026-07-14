const EVENTS = new Set(["sign_in", "continue_local", "library_transferred", "first_go"]);

export function trackFunnel(event, mode = "") {
  const endpoint = import.meta.env.VITE_LENS_ANALYTICS_ENDPOINT;
  if (!endpoint || !EVENTS.has(event)) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    fetch(url, {
      method: "POST",
      body: JSON.stringify({ event, surface: "extension", mode: String(mode).slice(0, 24), at: new Date().toISOString() }),
      headers: { "content-type": "application/json" },
      credentials: "omit",
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
