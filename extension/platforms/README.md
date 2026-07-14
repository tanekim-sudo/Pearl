# Platform ports

`npm run build:extension` emits:

- `extension/dist/chrome`: primary Manifest V3 build with Chrome side panel and Identity login.
- `extension/dist/firefox`: WebExtension build with `sidebar_action`; identity/login behavior must be configured for the final AMO extension ID.
- `extension/dist/safari`: Safari-compatible WebExtension payload. Convert it into the required signed Xcode container with `xcrun safari-web-extension-converter extension/dist/safari`.

Chrome is the verified release target. Firefox and Safari outputs preserve the platform-neutral runtime and avoid `chrome.*` references in domain modules, but store signing, native Safari container entitlements, and live account canaries require vendor developer accounts and therefore are not claimed as completed here.

The production app build packages Chrome with a portable Node ZIP writer and
publishes both `/downloads/lens-everywhere-chrome-v<version>.zip` and
`/downloads/lens-everywhere-chrome-latest.zip`. The direct download remains a
developer-mode install: unzip it, open `chrome://extensions`, enable Developer
mode, and use **Load unpacked**. A website cannot directly install this
unsigned ZIP.
