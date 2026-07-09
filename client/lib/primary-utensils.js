/**
 * Three cursor modes, Google Slides style: the select cursor doubles as the
 * text cursor (clean click on empty paper creates a text box).
 * @type {readonly ["select", "pen", "highlight"]}
 */
export const PRIMARY_UTENSILS = ["select", "pen", "highlight"];

/** @param {string} tool */
export function cyclePrimaryUtensil(tool) {
  const i = PRIMARY_UTENSILS.indexOf(tool);
  const next = i < 0 ? 0 : (i + 1) % PRIMARY_UTENSILS.length;
  return PRIMARY_UTENSILS[next];
}

export const UTENSIL_LABELS = {
  pen: "✎ Pen",
  highlight: "▬ Highlight",
  select: "↖ Select · type",
};
