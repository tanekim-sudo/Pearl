# Pearl local privacy threat model

Pearl stores user material locally by default in a profile-scoped AES-GCM envelope. Browser storage encryption without a user secret only protects against casual file inspection; it does not protect against malicious code already running with the extension or site origin.

## Lock boundary

Choosing **Lock my Pearls** migrates the current profile to a passphrase-wrapped data key. PBKDF2-SHA-256 uses a per-profile random salt and 310,000 iterations; the wrapping key and passphrase are never persisted. The unwrapped data key exists only while the profile is unlocked and is cleared on lock, logout, account switch, deletion, or the 15-minute inactivity timeout.

Existing pre-wrap profiles remain readable until the user explicitly establishes a passphrase. Migration decrypts and re-encrypts the envelope, verifies it, and keeps temporary recovery material only until the new envelope is verified. Losing the passphrase makes protected local data unrecoverable. Export data before relying on a password manager or platform recovery process.

WebAuthn PRF/key wrapping is not consistently available across the supported extension and web surfaces, so this release uses passphrase-derived wrapping. The browser process, a compromised extension, or same-origin script executing while the vault is unlocked remains inside the trust boundary.

## Cross-surface handoffs

Web pages cannot enumerate extension-private state. A handoff is created only by an explicit extension command and contains a bounded approved payload. Its random nonce is carried in the URL fragment, immediately scrubbed, and bound to profile, tab, origin, scope, and a two-minute expiry. Redemption atomically removes it; replay and mismatches fail closed.

## Deletion

Confirmed profile deletion completes all cleanup before issuing a receipt: active executions and session state are cleared; profile audio and image blobs are removed; handoffs and disclosure metadata disappear with the encrypted profile envelope; and both the envelope and profile key are deleted. Other profiles use different prefixes and keys and are not touched.

## Canvas resource limits

Each canvas enforces cumulative artifact, point, checkpoint, and serialized-byte budgets. Checkpoints reference deduplicated artifact snapshots, and image/audio bodies live in profile-prefixed content-addressed blob stores. Quota rejection is atomic and recoverable.
