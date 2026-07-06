import React, { useEffect, useRef, useState } from "react";
import { getSupabase } from "../lib/supabase.js";
import {
  describeAuthError,
  resendCooldownRemaining,
  AUTH_MIN_PASSWORD_LENGTH,
  RESEND_AT_KEY,
} from "../lib/auth-errors.js";

function readResendAt() {
  try {
    return localStorage.getItem(RESEND_AT_KEY);
  } catch {
    return null;
  }
}

function writeResendAt(ts) {
  try {
    localStorage.setItem(RESEND_AT_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

// Cooldown state lives in localStorage (lens.auth.resendAt), not component
// state, so closing and reopening the overlay cannot reset it.
function useResendCooldown() {
  const [remaining, setRemaining] = useState(() =>
    resendCooldownRemaining(readResendAt(), Date.now())
  );
  useEffect(() => {
    const id = setInterval(
      () => setRemaining(resendCooldownRemaining(readResendAt(), Date.now())),
      1000
    );
    return () => clearInterval(id);
  }, []);
  function start() {
    const now = Date.now();
    writeResendAt(now);
    setRemaining(resendCooldownRemaining(String(now), now));
  }
  return [remaining, start];
}

function initialStateFromBootError(bootError) {
  if (!bootError) return { view: "login", notice: null };
  const described = describeAuthError(bootError.errorCode, bootError.type);
  if (bootError.errorCode === "otp_expired" && bootError.type === "recovery") {
    return { view: "resetRequest", notice: described.message };
  }
  if (bootError.errorCode === "otp_expired" && bootError.type === "signup") {
    return { view: "login", notice: described.message, offerResend: true };
  }
  return { view: "login", notice: "That link didn't work. Sign in below, or request a new email." };
}

export default function AuthOverlay({
  forced,
  accountEmail,
  bootError,
  onClose,
  onPasswordUpdated,
}) {
  const boot = useRef(initialStateFromBootError(bootError)).current;
  const [view, setView] = useState(forced ? "updatePassword" : boot.view);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(boot.notice);
  const [checkEmailInfo, setCheckEmailInfo] = useState(null);
  const [cooldownMs, startCooldown] = useResendCooldown();
  const rootRef = useRef(null);

  useEffect(() => {
    if (forced) setView("updatePassword");
  }, [forced]);

  // A consumed boot-error hash is scrubbed so reloads don't re-trigger it.
  useEffect(() => {
    if (bootError && typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
  }, [bootError]);

  function switchView(next) {
    setView(next);
    setError(null);
    setPassword("");
  }

  function handleKeyDown(e) {
    // Canvas key handlers (Escape clears selection etc.) must never fire
    // beneath an auth view.
    e.stopPropagation();
    if (e.key === "Escape" && !forced) onClose();
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      rootRef.current?.querySelectorAll("button, input, a[href]") ?? []
    ).filter((el) => !el.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function submitLogin(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (!err) return; // App closes the overlay when the session lands
    if (err.code === "email_not_confirmed") {
      setCheckEmailInfo({ email, kind: "signup" });
      setNotice(describeAuthError(err.code).message);
      switchView("checkEmail");
      return;
    }
    setError(describeAuthError(err.code));
  }

  async function submitSignup(e) {
    e.preventDefault();
    if (busy) return;
    if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
      setError(describeAuthError("weak_password"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err) {
      setError(describeAuthError(err.code));
      return;
    }
    // Identical state whether or not the address was already registered —
    // Supabase returns an obfuscated user either way; never branch on it.
    startCooldown();
    setNotice(null);
    setCheckEmailInfo({ email, kind: "signup" });
    switchView("checkEmail");
  }

  async function submitResetRequest(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (err) {
      setError(describeAuthError(err.code));
      return;
    }
    startCooldown();
    setNotice(null);
    setCheckEmailInfo({ email, kind: "reset" });
    switchView("checkEmail");
  }

  // Sends (or re-sends) the email for a check-email context. Returns true
  // when the send went through (or was silently absorbed — uniform states
  // stay enumeration-safe); false only on rate-limit, which gets shown.
  async function sendEmailFor(kind, targetEmail) {
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const { error: err } =
      kind === "reset"
        ? await supabase.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: window.location.origin,
          })
        : await supabase.auth.resend({ type: "signup", email: targetEmail });
    setBusy(false);
    if (err && err.code === "over_email_send_rate_limit") {
      setError(describeAuthError(err.code));
      return false;
    }
    startCooldown();
    return true;
  }

  async function resendEmail() {
    if (busy || cooldownMs > 0 || !checkEmailInfo) return;
    await sendEmailFor(checkEmailInfo.kind, checkEmailInfo.email);
  }

  async function submitResendConfirm(e) {
    e.preventDefault();
    if (busy) return;
    if (await sendEmailFor("signup", email)) {
      setNotice(null);
      setCheckEmailInfo({ email, kind: "signup" });
      switchView("checkEmail");
    }
  }

  async function submitUpdatePassword(e) {
    e.preventDefault();
    if (busy) return;
    if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
      setError(describeAuthError("weak_password"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      setError(describeAuthError(err.code));
      return;
    }
    // Other sessions lose their refresh tokens now; already-issued access
    // tokens last until expiry (jwt_expiry bounds the window).
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch {
      /* the password change itself succeeded */
    }
    setBusy(false);
    onPasswordUpdated();
  }

  const cooldownSecs = Math.ceil(cooldownMs / 1000);

  function emailField(autoFocus) {
    return (
      <>
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="email"
          required
        />
      </>
    );
  }

  function passwordField(label, autoComplete, autoFocus) {
    return (
      <>
        <label htmlFor="auth-password">{label}</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          minLength={AUTH_MIN_PASSWORD_LENGTH}
          required
        />
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      className="modal-scrim auth-scrim"
      onClick={forced ? undefined : onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        {notice && view !== "checkEmail" && <div className="auth-notice">{notice}</div>}

        {view === "login" && (
          <form onSubmit={submitLogin}>
            <h3>Sign in</h3>
            {emailField(true)}
            {passwordField("Password", "current-password")}
            {error && <p className="auth-error">{error.message}</p>}
            <div className="modal-foot">
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>
            <div className="auth-links">
              <button type="button" onClick={() => switchView("signup")}>
                Create an account
              </button>
              <button type="button" onClick={() => switchView("resetRequest")}>
                Forgot password?
              </button>
              {boot.offerResend && (
                <button type="button" onClick={() => switchView("resendConfirm")}>
                  Resend confirmation
                </button>
              )}
            </div>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={submitSignup}>
            <h3>Create account</h3>
            {emailField(true)}
            {passwordField(`Password (min ${AUTH_MIN_PASSWORD_LENGTH} characters)`, "new-password")}
            {error && <p className="auth-error">{error.message}</p>}
            <div className="modal-foot">
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Creating…" : "Sign up"}
              </button>
            </div>
            <div className="auth-links">
              <button type="button" onClick={() => switchView("login")}>
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {view === "resetRequest" && (
          <form onSubmit={submitResetRequest}>
            <h3>Reset password</h3>
            <p className="auth-note">We'll email you a link to set a new password.</p>
            {emailField(true)}
            {error && <p className="auth-error">{error.message}</p>}
            <div className="modal-foot">
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </div>
            <div className="auth-links">
              <button type="button" onClick={() => switchView("login")}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {view === "resendConfirm" && (
          <form onSubmit={submitResendConfirm}>
            <h3>Resend confirmation</h3>
            <p className="auth-note">We'll send a fresh confirmation link.</p>
            {emailField(true)}
            {error && <p className="auth-error">{error.message}</p>}
            <div className="modal-foot">
              <button type="submit" className="primary" disabled={busy || cooldownMs > 0}>
                {cooldownMs > 0 ? `Resend in ${cooldownSecs}s` : busy ? "Sending…" : "Send"}
              </button>
            </div>
            <div className="auth-links">
              <button type="button" onClick={() => switchView("login")}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {view === "checkEmail" && checkEmailInfo && (
          <div>
            <h3>Check your email</h3>
            <p className="auth-note">
              {checkEmailInfo.kind === "reset" ? (
                <>
                  If an account exists for <strong>{checkEmailInfo.email}</strong>, a reset link
                  is on its way.
                </>
              ) : (
                <>
                  We sent a confirmation link to <strong>{checkEmailInfo.email}</strong>. Open it
                  to finish signing up.
                </>
              )}
            </p>
            {notice && <div className="auth-notice">{notice}</div>}
            {error && <p className="auth-error">{error.message}</p>}
            <div className="modal-foot">
              <button type="button" onClick={resendEmail} disabled={busy || cooldownMs > 0}>
                {cooldownMs > 0 ? `Resend in ${cooldownSecs}s` : "Resend email"}
              </button>
            </div>
            <div className="auth-links">
              <button type="button" onClick={() => switchView("login")}>
                Already confirmed? Sign in
              </button>
            </div>
          </div>
        )}

        {view === "updatePassword" && (
          <form onSubmit={submitUpdatePassword}>
            <h3>Set a new password</h3>
            <p className="auth-note">
              {accountEmail ? (
                <>
                  Updating the password for <strong>{accountEmail}</strong>.
                </>
              ) : (
                "Choose a new password for your account."
              )}
            </p>
            {passwordField(`New password (min ${AUTH_MIN_PASSWORD_LENGTH} characters)`, "new-password", true)}
            {error && <p className="auth-error">{error.message}</p>}
            <div className="modal-foot">
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
