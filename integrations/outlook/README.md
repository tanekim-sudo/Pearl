# Lens Outlook add-in

This Office Add-in is the reliable Outlook rich-editor integration. Host `taskpane.html` and `taskpane.js` at the HTTPS URLs declared in `manifest.xml`, host the referenced icons, validate the manifest with Microsoft's tooling, and sideload or publish it through Microsoft 365.

The browser extension's Outlook adapter intentionally performs plain-text writes only. Rich insertion is delegated here to the supported Mailbox API.
