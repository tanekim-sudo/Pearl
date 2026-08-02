// Pure mapping from Supabase auth error codes to UI copy and follow-up
// actions. Only the codes named here get specific copy — everything else is
// one generic message (enumeration-safe by default).

export const AUTH_MIN_PASSWORD_LENGTH = 8;
export const RESEND_COOLDOWN_MS = 60_000;
export const RESEND_AT_KEY = "lens.auth.resendAt";

const GENERIC_MESSAGE = "That didn't work. Check your details and try again.";

/**
 * @returns {{ message: string, action: string | null, secondaryAction?: string }}
 *   action: "resend" | "reset-request" | null; secondaryAction: "sign-in"
 */
export function describeAuthError(code, type) {
  switch (code) {
    case "email_not_confirmed":
      return {
        message: "This email hasn't been confirmed yet. Check your inbox, or resend the confirmation.",
        action: "resend",
      };
    case "over_email_send_rate_limit":
      return {
        message: "Too many emails sent recently — wait a minute, then try again.",
        action: null,
      };
    case "otp_expired":
      if (type === "signup") {
        return {
          message:
            "That confirmation link has expired or was already used. If you've confirmed before, just sign in — otherwise resend the confirmation.",
          action: "resend",
          secondaryAction: "sign-in",
        };
      }
      return {
        message: "That reset link has expired. Request a new one below.",
        action: "reset-request",
      };
    case "weak_password":
      return {
        message: `Passwords need at least ${AUTH_MIN_PASSWORD_LENGTH} characters, with letters and digits.`,
        action: null,
      };
    case "same_password":
      return {
        message: "The new password must be different from the current one.",
        action: null,
      };
    case "not_configured":
    case "needs-credentials":
      return {
        message:
          "Accounts aren’t set up for this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart — or keep working locally.",
        action: null,
      };
    case "service_unreachable":
      return {
        message:
          "Couldn’t reach the account service. Check your network and that VITE_SUPABASE_URL points at your Supabase project.",
        action: null,
      };
    default:
      return { message: GENERIC_MESSAGE, action: null };
  }
}

// The cooldown is UX only — the enforcement is Supabase's server-side rate
// limit. Stored under lens.auth.resendAt (outside LENS_STORAGE_KEYS, so
// "Start fresh" cannot reset it).
export function resendCooldownRemaining(storedAt, now) {
  const at = Number(storedAt);
  if (!Number.isFinite(at) || at <= 0) return 0;
  const elapsed = now - at;
  if (elapsed < 0) return RESEND_COOLDOWN_MS;
  if (elapsed >= RESEND_COOLDOWN_MS) return 0;
  return RESEND_COOLDOWN_MS - elapsed;
}
