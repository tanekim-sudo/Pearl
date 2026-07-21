import React, { useId, useInsertionEffect, useMemo } from "react";
import { PHYSICAL_PEARL_CSS, normalizePhysicalPearl, physicalPearlMarkup } from "../../shared/physical-pearl.js";

const STYLE_ID = "physical-pearl-renderer-v2";

function ensurePhysicalPearlStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PHYSICAL_PEARL_CSS;
  document.head.appendChild(style);
}

export default function PhysicalPearl({
  variant = "primary",
  state = "idle",
  size,
  label = "Pearl",
  decorative = false,
  surrounding = "auto",
  className = "",
  style,
}) {
  useInsertionEffect(ensurePhysicalPearlStyles, []);
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pearl = useMemo(
    () => normalizePhysicalPearl({ id: `pearl-${reactId}`, variant, state, size, label, decorative, surrounding }),
    [decorative, label, reactId, size, state, surrounding, variant],
  );
  return <span
    className={`physical-pearl-host ${className}`.trim()}
    data-pearl-variant={pearl.variant}
    data-pearl-state={pearl.state}
    data-pearl-surrounding={pearl.surrounding}
    style={{ display: "inline-block", width: pearl.size, height: pearl.size, ...style }}
    dangerouslySetInnerHTML={{ __html: physicalPearlMarkup(pearl) }}
  />;
}
