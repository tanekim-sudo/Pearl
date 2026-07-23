import React from "react";
import { redactPrivacyDiagnostic } from "../../shared/local-privacy-vault.js";
import { formatCrashDiagnostic, recordAndLogExecution } from "../../shared/execution-result.js";

/**
 * Recoverable boundary for nested surfaces so one throw does not brick the session.
 */
export default class SurfaceErrorBoundary extends React.Component {
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
      details: {
        digest: diagnostic.digest,
        surface: this.props.label || "surface",
        componentStack: Boolean(info?.componentStack),
      },
    });
    console.error(
      this.props.label || "Pearl surface crashed:",
      redactPrivacyDiagnostic(error),
      { digest: diagnostic.digest, componentStack: Boolean(info?.componentStack) },
    );
    this.props.onError?.(error, diagnostic);
  }

  reset = () => {
    this.setState({ error: null, diagnostic: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const diagnostic = this.state.diagnostic || formatCrashDiagnostic(this.state.error, {
      isDev: Boolean(import.meta.env?.DEV),
    });
    const title = this.props.title || "This screen hit a snag";
    const detail = this.props.detail
      || diagnostic.message
      || "Something broke while rendering. You can retry this view or go home — your other work is still on this device.";
    return (
      <section
        className="pearl-surface-recovery"
        role="alert"
        data-testid="surface-recovery"
        aria-label={title}
      >
        <h1>{title}</h1>
        <p>{detail}</p>
        <p className="pearl-surface-recovery-digest">
          Digest <code>{diagnostic.digest}</code>
        </p>
        {diagnostic.stackSnippet && (
          <pre className="pearl-surface-recovery-stack">{diagnostic.stackSnippet}</pre>
        )}
        <div className="pearl-surface-recovery-actions">
          <button type="button" onClick={this.reset}>Try again</button>
          {this.props.onHome && <button type="button" onClick={this.props.onHome}>Go to Reef (home)</button>}
          <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </section>
    );
  }
}
