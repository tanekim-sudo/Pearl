import React from "react";
import { createRoot } from "react-dom/client";
import { redactPrivacyDiagnostic } from "../shared/local-privacy-vault.js";
import { formatCrashDiagnostic, recordAndLogExecution } from "../shared/execution-result.js";
import { installSecureLocalStorage } from "./lib/secure-local-storage.js";
import "../shared/pearl-interface-tokens.css";
import "./styles.css";
import "./styles-idea.css";
import "./orb-visual-tokens.css";
import "./orb-universe.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, diagnostic: null };
  }
  static getDerivedStateFromError(error) {
    const isDev = Boolean(import.meta.env?.DEV);
    return { error, diagnostic: formatCrashDiagnostic(error, { isDev }) };
  }
  componentDidCatch(error, info) {
    const isDev = Boolean(import.meta.env?.DEV);
    const diagnostic = formatCrashDiagnostic(error, { isDev });
    recordAndLogExecution({
      status: "failed",
      code: "crash",
      message: diagnostic.message,
      stage: "execute",
      details: { digest: diagnostic.digest, componentStack: Boolean(info?.componentStack) },
    });
    console.error(
      "Pearl failed to render:",
      redactPrivacyDiagnostic(error),
      { digest: diagnostic.digest, componentStack: Boolean(info?.componentStack) },
    );
  }
  render() {
    if (this.state.error) {
      const diagnostic = this.state.diagnostic || formatCrashDiagnostic(this.state.error, {
        isDev: Boolean(import.meta.env?.DEV),
      });
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
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Pearl hit a crash</h1>
            <p style={{ margin: "0 0 10px", lineHeight: 1.5, color: "#4a4f57" }}>
              {diagnostic.message}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6a707a" }}>
              Digest <code style={{ fontSize: 11 }}>{diagnostic.digest}</code>
              {" · "}Reload to continue. Pearls stay on this device unless you wipe site data.
            </p>
            {diagnostic.stackSnippet && (
              <pre
                style={{
                  textAlign: "left",
                  fontSize: 11,
                  lineHeight: 1.4,
                  padding: 12,
                  margin: "0 0 16px",
                  maxHeight: 160,
                  overflow: "auto",
                  background: "#ebecef",
                  borderRadius: 8,
                  color: "#2a2f38",
                }}
              >
                {diagnostic.stackSnippet}
              </pre>
            )}
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
                  this.setState({ error: null, diagnostic: null });
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
