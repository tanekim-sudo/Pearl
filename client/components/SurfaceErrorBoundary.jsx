import React from "react";
import { redactPrivacyDiagnostic } from "../../shared/local-privacy-vault.js";

/**
 * Recoverable boundary for nested surfaces so one throw does not brick the session.
 */
export default class SurfaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(
      this.props.label || "Pearl surface crashed:",
      redactPrivacyDiagnostic(error),
      { componentStack: Boolean(info?.componentStack) },
    );
    this.props.onError?.(error);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const title = this.props.title || "This screen hit a snag";
    const detail = this.props.detail
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
        <div className="pearl-surface-recovery-actions">
          <button type="button" onClick={this.reset}>Try again</button>
          {this.props.onHome && <button type="button" onClick={this.props.onHome}>Go to Reef (home)</button>}
          <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </section>
    );
  }
}
