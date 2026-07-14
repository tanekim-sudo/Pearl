# Chrome Web Store submission

## Direct developer download

Production builds publish the current package at
`/downloads/lens-everywhere-chrome-v1.0.0.zip` and the moving alias
`/downloads/lens-everywhere-chrome-latest.zip` on the deployed Vercel app.
The versioned filename is generated from `extension/package.json`.

This is a developer-mode distribution, not one-click installation. Chrome
cannot install an unsigned ZIP directly from a website. Users must unzip it,
open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
and select the unzipped folder until the Chrome Web Store release is signed
and published.

## Single purpose

Capture user-selected page material, apply an explicitly queued Lens transformation only after GO, preview results, and let the user copy, open, or conservatively insert them.

## Permission justifications

- `activeTab`: one-shot access after user invocation.
- optional `http://*/*` and `https://*/*`: per-site access requested only when Lens is activated; no install-time all-sites grant.
- `scripting`: inject the bundled isolated-world bridge into the active permitted tab.
- `sidePanel`: primary rack, stack, GO, disclosure, and preview UI.
- `storage`: session-only raw selections/tokens and local preferences/library metadata.
- `contextMenus`: explicit Capture selection action.
- `identity`: hosted Lens sign-in; tokens remain in extension storage.
- `clipboardWrite`: explicit Copy action and Google Docs fallback.

Incognito is disabled. There is no remote executable code, `eval`, dynamic code generation, or remotely hosted MV3 script.

## Limited Use disclosure

Data obtained from browser APIs is used only to provide the visible Lens Everywhere features, is not sold, is not used for advertising or credit decisions, and is not transferred except to the Lens API/model processor when the user presses GO.

## Reviewer instructions

1. Load `extension/dist/chrome` unpacked.
2. Open a normal HTTPS page, click the extension, grant that site's permission, and open the side panel.
3. Enable Highlight page, select text, and confirm the golden overlay persists.
4. Queue a built-in lens. Confirm no network execution occurs.
5. Inspect the disclosure and press GO. A configured test account/API is required for model output.
6. Confirm the result is previewed and the page is unchanged.
7. Test Copy. In a textarea/contenteditable fixture, test Insert and Replace; modify the field before Replace to verify conflict refusal.
8. On Google Docs, verify the extension offers clipboard/add-on fallback. On Outlook rich content, verify it directs the reviewer to the Office Add-in.
9. Open Settings to inspect denylist, retention, model-data controls, and Delete all extension data.

## Honest limitations

Cross-origin frames and closed shadow roots are inaccessible. Notion supports current-block plain text only. Gmail writes target the semantic compose textbox and preserve content outside it. Outlook Web extension writes are plain text; reliable rich writes require the Office Add-in. Google Docs requires clipboard or Workspace add-on insertion. Live store signing and Gmail/Notion/Outlook canary accounts are operational release tasks, not simulated by repository tests.
