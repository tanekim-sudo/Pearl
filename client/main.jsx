import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import OrbUniverseShell from "./components/OrbUniverseShell.jsx";
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
    console.error("Lens failed to render:", error, info);
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
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Lens couldn&apos;t load</h1>
            <p style={{ margin: "0 0 16px", lineHeight: 1.5, color: "#4a4f57" }}>
              Something crashed on startup. Try a hard refresh (Cmd+Shift+R). If it persists, clear site
              data for this page.
            </p>
            {this.state.error?.message && (
              <pre
                style={{
                  margin: "0 0 16px",
                  padding: 12,
                  textAlign: "left",
                  fontSize: 12,
                  lineHeight: 1.4,
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  overflow: "auto",
                  maxHeight: 160,
                }}
              >
                {this.state.error.message}
              </pre>
            )}
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
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <OrbUniverseShell StageComponent={App} />
    </RootErrorBoundary>
  </React.StrictMode>
);
