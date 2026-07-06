import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAuthHashError } from "./auth-hash.js";

describe("parseAuthHashError", () => {
  it("parses an expired recovery-link hash", () => {
    assert.deepEqual(
      parseAuthHashError("#error=access_denied&error_code=otp_expired&type=recovery"),
      { errorCode: "otp_expired", type: "recovery" }
    );
  });

  it("parses an expired signup-link hash", () => {
    assert.deepEqual(
      parseAuthHashError("#error=access_denied&error_code=otp_expired&type=signup"),
      { errorCode: "otp_expired", type: "signup" }
    );
  });

  it("falls back to the error param when error_code is absent", () => {
    assert.deepEqual(parseAuthHashError("#error=access_denied"), {
      errorCode: "access_denied",
      type: null,
    });
  });

  it("returns null for an empty hash", () => {
    assert.equal(parseAuthHashError(""), null);
    assert.equal(parseAuthHashError("#"), null);
    assert.equal(parseAuthHashError(undefined), null);
  });

  it("returns null for a share-link hash", () => {
    assert.equal(parseAuthHashError("#share=abc123"), null);
  });

  it("returns null for a success-token hash (Supabase's to consume)", () => {
    assert.equal(
      parseAuthHashError("#access_token=xyz&refresh_token=abc&type=recovery"),
      null
    );
  });
});
