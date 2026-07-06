/** @type {readonly ["pen", "highlight", "select"]} */
export const PRIMARY_UTENSILS = ["pen", "highlight", "select"];

/** @param {string} tool */
export function cyclePrimaryUtensil(tool) {
  const i = PRIMARY_UTENSILS.indexOf(tool);
  const next = i < 0 ? 0 : (i + 1) % PRIMARY_UTENSILS.length;
  return PRIMARY_UTENSILS[next];
}

export const UTENSIL_LABELS = {
  pen: "✎ Pen",
  highlight: "▬ Highlight",
  select: "↖ Select",
};
