import React, { useId, useInsertionEffect, useMemo } from "react";
import { PHYSICAL_PEARL_CSS, normalizePhysicalPearl, physicalPearlMarkup } from "../../shared/physical-pearl.js";
import { pearlAestheticStyle } from "../../shared/pearl-aesthetic.js";

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
  animation = null,
  aesthetic = null,
  className = "",
  style,
}) {
  useInsertionEffect(ensurePhysicalPearlStyles, []);
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pearl = useMemo(
    () => normalizePhysicalPearl({
      id: `pearl-${reactId}`,
      variant,
      state,
      size,
      label,
      decorative,
      surrounding: aesthetic?.surrounding || surrounding,
      animation,
      aesthetic,
    }),
    [animation, aesthetic, decorative, label, reactId, size, state, surrounding, variant],
  );
  const aestheticVars = aesthetic ? pearlAestheticStyle(aesthetic) : null;
  return <span
    className={`physical-pearl-host ${className}`.trim()}
    data-pearl-variant={pearl.variant}
    data-pearl-state={pearl.state}
    data-pearl-surrounding={pearl.surrounding}
    data-pearl-animation={pearl.animation || undefined}
    data-pearl-aesthetic={aesthetic?.preset || undefined}
    style={{ display: "inline-block", width: pearl.size, height: pearl.size, ...aestheticVars, ...style }}
    dangerouslySetInnerHTML={{ __html: physicalPearlMarkup(pearl) }}
  />;
}
