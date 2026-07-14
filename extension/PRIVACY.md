# Lens Everywhere privacy policy

Effective: July 13, 2026

Lens Everywhere captures only text the user explicitly selects on a permitted page. Highlighting and queueing are local actions and never execute a lens or transmit page text. Before the user presses **GO**, the side panel shows the exact selected character count and source origins. Pressing GO sends the selected fragments, chosen lens identifiers, and provenance needed to perform the requested transformation to the configured Lens API.

Raw page selections, pending stacks, access tokens, and staged results use browser session storage and expire when the browser session ends. Saved artifacts and generator items are associated with the signed-in Lens account. Short-lived Open in Lens artifacts expire after 15 minutes. Users can clear page selections in the panel and delete all extension data in Settings.

Lens does not sell extension data, use it for advertising, or transfer it for unrelated purposes. Model processing is limited to the user-requested transformation. Content scripts never receive account credentials. Password, payment, protected browser pages, closed shadow roots, inaccessible frames, and denylisted sensitive origins are not captured.

The extension requests site access only when activated. Users can revoke site permissions in browser settings. Incognito use is disabled. For account-data deletion, use the extension Settings page and the Lens account deletion controls or contact the support address listed in the store entry.

Library export and import are explicit, checksummed actions. The default export preserves lenses, dependency and composition metadata, rack metadata, generator structure, and user-owned material while excluding credentials, board synchronization metadata, companion memory, private grinding examples, source provenance, and raw captured pages. Private source fields require a separate opt-in. Anonymous imports remain in extension local storage; signed-in refresh is isolated to the authenticated account.

Direct handoff accepts only strict versioned messages from the configured Lens production or local-development origins. It contains no credentials and remains pending until the user reviews and confirms the import.

Google Docs insertion uses Copy or the separately installed Google Workspace add-on. Outlook rich insertion uses the separately installed Office Add-in. The extension does not scrape private editor internals.
