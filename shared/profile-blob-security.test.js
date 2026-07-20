import test from "node:test";
import assert from "node:assert/strict";
import { validatePearlImageSignature } from "./profile-blob-security.js";

test("canvas blobs accept matching raster signatures and reject SVG or MIME confusion", () => {
  assert.equal(validatePearlImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer, "image/png"), "image/png");
  assert.equal(validatePearlImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]).buffer, "image/jpeg"), "image/jpeg");
  assert.throws(() => validatePearlImageSignature(new TextEncoder().encode("<svg onload=alert(1)>"), "image/svg+xml"), /supported raster/);
  assert.throws(() => validatePearlImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer, "image/jpeg"), /does not match/);
});
