import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase.js";
import { parseAuthHashError } from "./auth-hash.js";

// Captured at module evaluation, before any Supabase client exists (the
// client is lazy — see supabase.js). An error hash from an expired email
// link is read here before detectSessionInUrl can touch the URL.
const BOOT_AUTH_ERROR =
  typeof window !== "undefined" ? parseAuthHashError(window.location.hash) : null;

export function useSupabaseSession() {
  const [session, setSession] = useState(null);
  const [sessionResolved, setSessionResolved] = useState(!isSupabaseConfigured());
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return undefined;
    // Subscribed synchronously in the same tick the client is first
    // constructed: PASSWORD_RECOVERY from a recovery-link hash must never be
    // emitted before a listener exists. Callback stays synchronous — awaiting
    // supabase calls inside it can deadlock.
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    client.auth.getSession().then(({ data: current }) => {
      setSession((s) => s ?? current?.session ?? null);
      setSessionResolved(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return {
    session,
    sessionResolved,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
    bootAuthError: BOOT_AUTH_ERROR,
  };
}
