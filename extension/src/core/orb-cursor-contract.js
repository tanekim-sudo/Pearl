export const ORB_CURSOR_HIDE_CSS = `
html[data-lens-orb-cursor-active="true"],
html[data-lens-orb-cursor-active="true"] * {
  cursor: none !important;
}
`;

export const ORB_CURSOR_TAB_STATE_KEY = "orbCursorTabs";

export function orbCursorTabState(store, tabId, enabled) {
  const next = { ...(store || {}) };
  if (enabled) next[String(tabId)] = { enabled: true, updatedAt: Date.now() };
  else delete next[String(tabId)];
  return next;
}
