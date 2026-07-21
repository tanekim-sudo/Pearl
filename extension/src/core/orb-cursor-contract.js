export const ORB_CURSOR_HIDE_CSS = `
html[data-lens-orb-cursor-active="true"],
html[data-lens-orb-cursor-active="true"] body,
html[data-lens-orb-cursor-active="true"] body * {
  cursor: none !important;
}
html[data-lens-orb-cursor-active="true"] :is(input,textarea,select,[contenteditable="true"],[data-lens-native-cursor="true"]),
html[data-lens-orb-cursor-active="true"][data-lens-orb-cursor-blocked="true"],
html[data-lens-orb-cursor-active="true"][data-lens-orb-cursor-blocked="true"] * {
  cursor: revert !important;
}
`;

export const ORB_CURSOR_TAB_STATE_KEY = "orbCursorTabs";

export function orbCursorTabState(store, tabId, enabled) {
  const next = { ...(store || {}) };
  if (enabled) next[String(tabId)] = { enabled: true, updatedAt: Date.now() };
  else delete next[String(tabId)];
  return next;
}
