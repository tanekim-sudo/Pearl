/**
 * Hands-off director tour of current Pearl vision (Companion → Reef → wear →
 * Studio moves → Encode → Install). Disposable Demo · pearls; no classic Stage.
 */

export const PEARL_CAPABILITY_DEMO_ID = "pearl-capability-tour";
export const PEARL_CAPABILITY_DEMO_NAME = "Demo · Series A brief";
export const PEARL_CAPABILITY_DEMO_STORAGE_KEY = "lens.pearl-capability-demo.v1";

export function isPearlCapabilityDemoPearl(pearl) {
  if (!pearl || typeof pearl !== "object") return false;
  const id = String(pearl.id || "");
  const name = String(pearl.name || "");
  return id.startsWith("demo:capability") || /^Demo ·/i.test(name);
}

export function buildPearlCapabilityDemoSteps(options = {}) {
  const name = String(options.name || PEARL_CAPABILITY_DEMO_NAME).trim() || PEARL_CAPABILITY_DEMO_NAME;
  return [
    { verb: "caption", args: { text: "Companion · Reef · gauntlet · Studio", ms: 1200 } },
    { verb: "navigateHome", args: {} },
    {
      verb: "createRolePearl",
      args: {
        name,
        utterance: "demo capability tour",
        openStudio: false,
        wear: false,
        materializeLibrary: false,
      },
    },
    { verb: "wearPearl", args: { name, replace: true } },
    { verb: "caption", args: { text: "Worn into the gauntlet", ms: 800 } },
    { verb: "openPearlStudio", args: { preferPopup: true } },
    { verb: "pause", args: { ms: 640 } },
    { verb: "caption", args: { text: "Studio: Functions as ordered Moves", ms: 1100 } },
    {
      verb: "reorderPearlFunctionMoves",
      args: { functionName: "Investment memo", from: "last", to: "first" },
    },
    { verb: "navigateHome", args: {} },
    { verb: "openEncodeAnything", args: {} },
    { verb: "pause", args: { ms: 720 } },
    { verb: "closeSurface", args: {} },
    { verb: "openExtensionDownload", args: {} },
    { verb: "pause", args: { ms: 720 } },
    { verb: "navigateHome", args: {} },
    { verb: "caption", args: { text: "That’s Pearl today — Talk when ready", ms: 1200 } },
  ];
}

export function markPearlCapabilityDemoPlayed(storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(PEARL_CAPABILITY_DEMO_STORAGE_KEY, JSON.stringify({
      playedAt: Date.now(),
      version: 1,
    }));
  } catch {
    /* private mode */
  }
}

export function hasPlayedPearlCapabilityDemo(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PEARL_CAPABILITY_DEMO_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.playedAt);
  } catch {
    return false;
  }
}
