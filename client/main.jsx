import React from "react";
import { createRoot } from "react-dom/client";
import { redactPrivacyDiagnostic } from "../shared/local-privacy-vault.js";
import { installSecureLocalStorage } from "./lib/secure-local-storage.js";
import "../shared/pearl-interface-tokens.css";
import "./styles.css";
import "./styles-idea.css";
import "./orb-visual-tokens.css";
import "./orb-universe.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Pearl failed to render:", redactPrivacyDiagnostic(error), { componentStack: Boolean(info?.componentStack) });
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 32,
            fontFamily: "Inter, system-ui, sans-serif",
            background: "#f4f4f6",
            color: "#101216",
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Pearl hit a crash</h1>
            <p style={{ margin: "0 0 16px", lineHeight: 1.5, color: "#4a4f57" }}>
              The app stopped unexpectedly. Reload to continue. If it keeps happening, clear site data
              for this page, then reopen — your Pearls stay on this device unless you wipe them.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 16px",
                  background: "#101216",
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  this.setState({ error: null });
                  window.location.assign("/");
                }}
              >
                Go to Reef (home)
              </button>
              <button
                type="button"
                style={{
                  border: "1px solid #101216",
                  borderRadius: 8,
                  padding: "10px 16px",
                  background: "transparent",
                  color: "#101216",
                  cursor: "pointer",
                }}
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

async function boot() {
  await installSecureLocalStorage();
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  const incomingStudioRef = fragment.get("pearl-studio");
  if (incomingStudioRef) {
    sessionStorage.setItem("pearlStudioActiveRef", incomingStudioRef);
    history.replaceState(null, "", `${location.pathname}${location.search}#pearl-studio`);
  }
  const studioRef = incomingStudioRef || (location.hash === "#pearl-studio" ? sessionStorage.getItem("pearlStudioActiveRef") : null);
  if (studioRef) {
    const { default: PearlStudioView } = await import("./components/PearlStudioView.jsx");
    createRoot(document.getElementById("root")).render(
      <React.StrictMode><RootErrorBoundary><PearlStudioView localRef={studioRef} /></RootErrorBoundary></React.StrictMode>,
    );
    return;
  }
  const [{ default: App }, { default: OrbUniverseShell }] = await Promise.all([
    import("./App.jsx"),
    import("./components/OrbUniverseShell.jsx"),
  ]);
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <OrbUniverseShell StageComponent={App} />
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

boot().catch((error) => {
  console.error("Pearl privacy boot failed:", redactPrivacyDiagnostic(error));
  document.getElementById("root").textContent = "Pearl could not open local data safely.";
});
