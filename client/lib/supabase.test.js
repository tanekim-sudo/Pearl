import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readSupabaseConfig, isSupabaseConfigured, getSupabase } from "./supabase.js";

describe("readSupabaseConfig", () => {
  it("returns url and key when both vars are present", () => {
    const config = readSupabaseConfig({
      VITE_SUPABASE_URL: "https://abc.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_123",
    });
    assert.deepEqual(config, {
      url: "https://abc.supabase.co",
      key: "sb_publishable_123",
    });
  });

  it("returns null when the url is missing", () => {
    assert.equal(
      readSupabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_123" }),
      null
    );
  });

  it("returns null when the key is missing", () => {
    assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: "https://abc.supabase.co" }), null);
  });

  it("returns null when both vars are missing", () => {
    assert.equal(readSupabaseConfig({}), null);
    assert.equal(readSupabaseConfig(undefined), null);
  });

  it("returns null for empty or blank values", () => {
    assert.equal(
      readSupabaseConfig({ VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" }),
      null
    );
    assert.equal(
      readSupabaseConfig({ VITE_SUPABASE_URL: "   ", VITE_SUPABASE_PUBLISHABLE_KEY: "x" }),
      null
    );
  });

  it("trims surrounding whitespace", () => {
    const config = readSupabaseConfig({
      VITE_SUPABASE_URL: " https://abc.supabase.co ",
      VITE_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_123 ",
    });
    assert.deepEqual(config, {
      url: "https://abc.supabase.co",
      key: "sb_publishable_123",
    });
  });
});

describe("unconfigured mode under node", () => {
  it("reports unconfigured and returns no client", () => {
    assert.equal(isSupabaseConfigured(), false);
    assert.equal(getSupabase(), null);
  });
});
