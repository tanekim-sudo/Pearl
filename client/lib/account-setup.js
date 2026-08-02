/**
 * Pure account / Supabase setup copy and status helpers.
 * UI surfaces (Account & privacy, AuthOverlay) must use these so missing
 * credentials show an honest blocker instead of a dead form or unknown error.
 */

export const CLIENT_SUPABASE_ENV = Object.freeze([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
]);

export const SERVER_SUPABASE_ENV = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
]);

/**
 * Honest blocker when the web client has no Supabase project keys.
 * @returns {{ code: string, title: string, message: string, nextSteps: string[] }}
 */
export function describeAccountsUnavailable() {
  return {
    code: "needs-credentials",
    title: "Accounts aren’t set up for this build",
    message:
      "Optional sign-in needs a Supabase project. Without those keys, Pearl still works locally on this device — sync and hosted account features stay off.",
    nextSteps: [
      `Set ${CLIENT_SUPABASE_ENV.join(" and ")} in the web env (.env or Vercel).`,
      `For server JWT / extension OAuth exchange, also set ${SERVER_SUPABASE_ENV.join(" and ")} (never expose the secret as VITE_*).`,
      "Restart the app after saving env, then use Sign in from Settings → Account & privacy.",
    ],
  };
}

/**
 * Map thrown / SDK failures to UI copy. Prefer specific codes from describeAuthError;
 * use this for null-client, network, and unexpected throws.
 * @param {unknown} err
 * @param {{ configured?: boolean }} [opts]
 */
export function describeAuthFailure(err, opts = {}) {
  if (opts.configured === false || err?.code === "not_configured" || err?.code === "needs-credentials") {
    const blocker = describeAccountsUnavailable();
    return { message: blocker.message, action: null, code: blocker.code, blocker };
  }
  const raw = String(err?.message || err || "");
  const code = err?.code || null;
  if (
    /Failed to fetch|NetworkError|Load failed|fetch failed|ERR_NETWORK|timed out|ECONNREFUSED/i.test(raw)
  ) {
    return {
      message:
        "Couldn’t reach the account service. Check your network, then confirm VITE_SUPABASE_URL points at your Supabase project.",
      action: null,
      code: "service_unreachable",
    };
  }
  if (code === "unexpected_failure" || /AuthRetryableFetchError/i.test(String(err?.name || ""))) {
    return {
      message:
        "Account service didn’t respond. Confirm the Supabase project is running and the publishable key matches that project.",
      action: null,
      code: "service_unreachable",
    };
  }
  return null;
}

/**
 * Status model for the Pearl Account & privacy panel.
 * @param {{
 *   accountsConfigured: boolean,
 *   email?: string | null,
 *   syncEnabled?: boolean,
 *   sessionResolved?: boolean,
 * }} input
 */
export function describeAccountPanel(input) {
  const accountsConfigured = Boolean(input?.accountsConfigured);
  const email = typeof input?.email === "string" && input.email.trim() ? input.email.trim() : null;
  const syncEnabled = Boolean(input?.syncEnabled);
  const sessionResolved = input?.sessionResolved !== false;

  if (!accountsConfigured) {
    const blocker = describeAccountsUnavailable();
    return {
      mode: "unavailable",
      status: blocker.message,
      title: blocker.title,
      nextSteps: blocker.nextSteps,
      canSignIn: false,
      canSignOut: false,
      canToggleSync: false,
      syncHint: "Account sync needs Supabase keys and a signed-in session.",
      showLocalPrivacy: true,
    };
  }

  if (!sessionResolved) {
    return {
      mode: "resolving",
      status: "Checking account session…",
      title: "Account & privacy",
      nextSteps: [],
      canSignIn: false,
      canSignOut: false,
      canToggleSync: false,
      syncHint: "Wait for session check to finish.",
      showLocalPrivacy: true,
    };
  }

  if (email) {
    return {
      mode: "signed-in",
      status: `Signed in as ${email}. Pearls stay on this device unless you enable sync.`,
      title: "Account & privacy",
      nextSteps: [],
      canSignIn: false,
      canSignOut: true,
      canToggleSync: true,
      syncHint: syncEnabled
        ? "Sync is on for this profile. It is opt-in and not end-to-end vault encryption."
        : "Sync is off. Enable only if you want this profile’s board metadata on your account.",
      showLocalPrivacy: true,
    };
  }

  return {
    mode: "local",
    status:
      "Working locally on this device. Sign in only if you want optional account sync — Pearls stay device-first.",
    title: "Account & privacy",
    nextSteps: [],
    canSignIn: true,
    canSignOut: false,
    canToggleSync: false,
    syncHint: "Sign in first, then enable sync if you want cloud board metadata.",
    showLocalPrivacy: true,
  };
}
