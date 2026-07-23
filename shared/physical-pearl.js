export const PHYSICAL_PEARL_VERSION = 3;
export const PHYSICAL_PEARL_VARIANTS = Object.freeze(["primary", "semantic", "result", "worker", "candidate", "cursor", "recipient", "canvas-anchor"]);
export const PHYSICAL_PEARL_STATES = Object.freeze(["idle", "new", "listening", "executing", "blocked", "failed", "loading"]);
export const PHYSICAL_PEARL_SIZES = Object.freeze({ cursor: 18, compact: 30, idle: 34, studio: 112 });
export const PHYSICAL_PEARL_SURROUNDINGS = Object.freeze(["auto", "light", "dark", "colored", "text-heavy"]);
export const PHYSICAL_PEARL_ANIMATIONS = Object.freeze([
  "absorb", "refract", "emerge", "stream", "unfold", "settle", "split", "merge",
  "nest", "compose", "duplicate", "remix", "arrive", "crossfade", "transfer",
  "lock", "unlock", "recover", "fail",
  "charge", "burst", "echo", "fission", "fuse", "filament", "seek", "mark",
]);

const safeToken = (value, fallback) => {
  const token = String(value || fallback).toLowerCase();
  return /^[a-z][a-z0-9_-]{0,48}$/.test(token) ? token : fallback;
};

export function normalizePhysicalPearl(options = {}) {
  const variant = PHYSICAL_PEARL_VARIANTS.includes(options.variant) ? options.variant : "primary";
  const state = PHYSICAL_PEARL_STATES.includes(options.state) ? options.state : "idle";
  const animation = PHYSICAL_PEARL_ANIMATIONS.includes(options.animation) ? options.animation : null;
  const size = variant === "cursor"
    ? PHYSICAL_PEARL_SIZES.cursor
    : Math.max(16, Math.min(240, Number(options.size) || PHYSICAL_PEARL_SIZES.idle));
  return {
    variant,
    state,
    size,
    animation,
    id: safeToken(options.id, `pearl-${Math.random().toString(36).slice(2)}`),
    className: String(options.className || "").replace(/[<>"']/g, ""),
    label: String(options.label || "Pearl").replace(/[<>&"]/g, ""),
    decorative: options.decorative === true,
    surrounding: PHYSICAL_PEARL_SURROUNDINGS.includes(options.surrounding) ? options.surrounding : "auto",
    aesthetic: options.aesthetic && typeof options.aesthetic === "object" ? options.aesthetic : null,
  };
}

export function physicalPearlMarkup(options = {}) {
  const pearl = normalizePhysicalPearl(options);
  const prefix = pearl.id;
  const animationAttr = pearl.animation ? ` data-pearl-animation="${pearl.animation}"` : "";
  return `<svg class="physical-pearl ${pearl.className}" data-pearl-renderer="${PHYSICAL_PEARL_VERSION}" data-pearl-variant="${pearl.variant}" data-pearl-state="${pearl.state}" data-pearl-surrounding="${pearl.surrounding}"${animationAttr} width="${pearl.size}" height="${pearl.size}" viewBox="0 0 100 100" ${pearl.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${pearl.label}"`}>
    <defs>
      <clipPath id="${prefix}-sphere"><circle cx="50" cy="50" r="43"/></clipPath>
      <radialGradient id="${prefix}-body" cx="42%" cy="36%" r="72%"><stop offset="0" stop-color="var(--pearl-body-highlight,#f4fcff)"/><stop offset=".22" stop-color="var(--pearl-body-highlight,#e8f6fc)"/><stop offset=".52" stop-color="var(--pearl-body-mid,#b9d4e0)"/><stop offset=".78" stop-color="var(--pearl-body-mid,#7fa3b4)"/><stop offset=".94" stop-color="var(--pearl-body-shadow,#3d5a66)"/><stop offset="1" stop-color="var(--pearl-body-shadow,#2a414c)"/></radialGradient>
      <radialGradient id="${prefix}-core" cx="50%" cy="48%" r="42%"><stop offset="0" stop-color="var(--pearl-specular,#f7fcff)" stop-opacity=".98"/><stop offset=".28" stop-color="var(--pearl-nucleus-a,#e8f7ff)" stop-opacity=".88"/><stop offset=".58" stop-color="var(--pearl-nucleus-b,#7ec8e0)" stop-opacity=".42"/><stop offset=".86" stop-color="var(--pearl-nacre,#9fd4e8)" stop-opacity=".12"/><stop offset="1" stop-color="var(--pearl-body-shadow,#2a414c)" stop-opacity="0"/></radialGradient>
      <radialGradient id="${prefix}-depth" cx="40%" cy="42%" r="62%"><stop offset="0" stop-color="var(--pearl-body-highlight,#f4fcff)" stop-opacity=".4"/><stop offset=".42" stop-color="var(--pearl-body-mid,#b9d4e0)" stop-opacity=".08"/><stop offset=".76" stop-color="var(--pearl-body-shadow,#273733)" stop-opacity=".18"/><stop offset="1" stop-color="var(--pearl-reflection-dark,#0e171c)" stop-opacity=".34"/></radialGradient>
      <radialGradient id="${prefix}-nucleus" cx="48%" cy="52%" r="58%"><stop offset="0" stop-color="var(--pearl-nucleus-a,#e8f7ff)" stop-opacity=".82"/><stop offset=".34" stop-color="var(--pearl-nucleus-b,#7ec8e0)" stop-opacity=".52"/><stop offset=".62" stop-color="var(--pearl-caustic,#d4f4ff)" stop-opacity=".28"/><stop offset=".88" stop-color="var(--pearl-edge-dark,#4a6570)" stop-opacity=".1"/><stop offset="1" stop-color="var(--pearl-body-shadow,#2a414c)" stop-opacity="0"/></radialGradient>
      <linearGradient id="${prefix}-nacre" x1="8%" y1="14%" x2="92%" y2="86%"><stop offset="0" stop-color="var(--pearl-nucleus-a,#e8f7ff)" stop-opacity=".18"/><stop offset=".28" stop-color="var(--pearl-nacre,#9fd4e8)" stop-opacity=".42"/><stop offset=".5" stop-color="var(--pearl-caustic,#d4f4ff)" stop-opacity=".28"/><stop offset=".72" stop-color="var(--pearl-nucleus-b,#7ec8e0)" stop-opacity=".3"/><stop offset=".9" stop-color="var(--pearl-nacre,#9fd4e8)" stop-opacity=".16"/><stop offset="1" stop-color="var(--pearl-caustic,#d4f4ff)" stop-opacity=".06"/></linearGradient>
      <linearGradient id="${prefix}-rim" x1="16%" y1="7%" x2="84%" y2="93%"><stop offset="0" stop-color="var(--pearl-specular,#f7fcff)" stop-opacity=".96"/><stop offset=".3" stop-color="var(--pearl-reflection-light,#e6f4fa)" stop-opacity=".42"/><stop offset=".66" stop-color="var(--pearl-edge-dark,#4a6570)" stop-opacity=".5"/><stop offset=".88" stop-color="var(--pearl-reflection-dark,#152028)" stop-opacity=".64"/><stop offset="1" stop-color="var(--pearl-caustic,#d4f4ff)" stop-opacity=".62"/></linearGradient>
      <linearGradient id="${prefix}-environment" x1="20%" y1="0" x2="78%" y2="100%"><stop offset="0" stop-color="var(--pearl-reflection-light,#f4fbff)" stop-opacity=".2"/><stop offset=".55" stop-color="var(--pearl-reflection-mid,#7a9aaa)" stop-opacity=".06"/><stop offset="1" stop-color="var(--pearl-reflection-dark,#152028)" stop-opacity=".24"/></linearGradient>
      <filter id="${prefix}-soft-internal" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.25"/></filter>
    </defs>
    <ellipse class="physical-pearl__contact" cx="51" cy="95" rx="24" ry="2"/>
    <g class="physical-pearl__mass">
      <circle class="physical-pearl__body" cx="50" cy="50" r="43" fill="url(#${prefix}-body)"/>
      <g clip-path="url(#${prefix}-sphere)">
        <ellipse class="physical-pearl__subsurface physical-pearl__subsurface--far" cx="61" cy="60" rx="34" ry="29"/>
        <circle class="physical-pearl__core" cx="50" cy="50" r="18" fill="url(#${prefix}-core)"/>
        <ellipse class="physical-pearl__nucleus" cx="50" cy="52" rx="19" ry="21" fill="url(#${prefix}-nucleus)"/>
        <ellipse class="physical-pearl__subsurface physical-pearl__subsurface--near" cx="42" cy="45" rx="35" ry="31"/>
        <path class="physical-pearl__caustic" d="M18 54c14-18 28-12 40-22 8-7 16-6 26-1-8 6-11 14-22 17-16 4-20 14-44 6Z" filter="url(#${prefix}-soft-internal)"/>
        <circle class="physical-pearl__depth" cx="50" cy="50" r="42" fill="url(#${prefix}-depth)"/>
        <circle class="physical-pearl__nacre" cx="50" cy="50" r="41.5" fill="url(#${prefix}-nacre)"/>
        <path class="physical-pearl__environment" d="M15 67c18 10 44 11 70-1-8 19-24 28-39 27-13-1-25-9-31-26Z" fill="url(#${prefix}-environment)"/>
        <circle class="physical-pearl__ring physical-pearl__ring--outer" cx="50" cy="50" r="30" fill="none"/>
        <circle class="physical-pearl__ring physical-pearl__ring--inner" cx="50" cy="50" r="22" fill="none"/>
      </g>
      <ellipse class="physical-pearl__reflection" cx="59" cy="63" rx="27" ry="15"/>
      <circle class="physical-pearl__rim" cx="50" cy="50" r="42.2" fill="none" stroke="url(#${prefix}-rim)"/>
      <ellipse class="physical-pearl__specular" cx="31.5" cy="25.5" rx="7.5" ry="3.1" transform="rotate(-38 31.5 25.5)"/>
      <circle class="physical-pearl__pinlight" cx="27" cy="22" r="1.55"/>
      <path class="physical-pearl__hotspot" d="M44 50h12M50 44v12"/>
    </g>
  </svg>`;
}

export const PHYSICAL_PEARL_CSS = `
.physical-pearl{display:block;overflow:visible;--pearl-light-x:0;--pearl-light-y:0;--pearl-motion:0;--pearl-nacre:#9fd4e8;--pearl-nucleus-a:#e8f7ff;--pearl-nucleus-b:#7ec8e0;--pearl-edge-dark:#3d5a66;--pearl-caustic:#d4f4ff;--pearl-body-highlight:#f4fcff;--pearl-body-mid:#b9d4e0;--pearl-body-shadow:#2a414c;--pearl-reflection-light:#f4fbff;--pearl-reflection-mid:#7a9aaa;--pearl-reflection-dark:#0e171c;--pearl-specular:#f7fcff;--pearl-nacre-intensity:.42;--pearl-nucleus-intensity:.86;--pearl-gloss:.62;--pearl-contrast:.52;--pearl-warmth:.22;--pearl-saturation:.4;--pearl-brightness:.68}
.physical-pearl-host[data-pearl-aesthetic]{filter:saturate(calc(.72 + var(--pearl-saturation,.4) * .65)) brightness(calc(.84 + var(--pearl-brightness,.68) * .36)) contrast(calc(.88 + var(--pearl-contrast,.52) * .28))}
.physical-pearl__mass{transform-origin:50px 50px;animation:physical-pearl-breath 6.4s ease-in-out infinite}
.physical-pearl__contact{fill:rgba(0,0,0,.14);filter:blur(1px)}
.physical-pearl__body{stroke:color-mix(in srgb,var(--pearl-specular,#f7fcff) 68%,transparent);stroke-width:.62}
.physical-pearl__subsurface{transform-origin:50px 50px;transition:transform .24s ease-out}
.physical-pearl__subsurface--far{fill:color-mix(in srgb,var(--pearl-body-shadow,#1a2c34) 14%,transparent);filter:blur(2.2px);transform:translate(calc(var(--pearl-light-x) * -.7px),calc(var(--pearl-light-y) * -.6px))}
.physical-pearl__subsurface--near{fill:color-mix(in srgb,var(--pearl-body-highlight,#f4fcff) 18%,transparent);filter:blur(1.35px);transform:translate(calc(var(--pearl-light-x) * .65px),calc(var(--pearl-light-y) * .5px))}
.physical-pearl__core{mix-blend-mode:screen;opacity:calc(.9 + var(--pearl-motion) * .1);animation:physical-pearl-core-breath 3.8s ease-in-out infinite;transform-origin:50px 50px}
.physical-pearl__ring{stroke:color-mix(in srgb,var(--pearl-specular,#f7fcff) 82%,var(--pearl-nucleus-b,#7ec8e0));stroke-width:1.35;opacity:.78;mix-blend-mode:screen}
.physical-pearl__ring--outer{stroke-width:1.05;opacity:.58;stroke-dasharray:3.4 1.8}
.physical-pearl__ring--inner{opacity:.9;animation:physical-pearl-ring-breath 4.6s ease-in-out infinite}
.physical-pearl__nucleus{mix-blend-mode:screen;opacity:var(--pearl-nucleus-intensity,.86);transform:translate(calc(var(--pearl-light-x) * -.85px),calc(var(--pearl-light-y) * -.7px));transform-origin:50px 50px;transition:opacity .24s ease-out,transform .22s ease-out}
.physical-pearl__caustic{fill:color-mix(in srgb,var(--pearl-caustic,#d4f4ff) 68%,transparent);mix-blend-mode:screen;transform:translate(calc(var(--pearl-light-x) * .45px),calc(var(--pearl-light-y) * .35px));transition:transform .2s ease-out}
.physical-pearl__depth{mix-blend-mode:multiply;opacity:.48}
.physical-pearl__nacre{mix-blend-mode:screen;opacity:calc(var(--pearl-nacre-intensity,.42) + var(--pearl-motion) * .28);transform:translate(calc(var(--pearl-light-x) * 1.45px),calc(var(--pearl-light-y) * 1.2px));transform-origin:50px 50px;transition:opacity .2s ease-out,transform .18s ease-out}
.physical-pearl__environment{opacity:.7;transform:translate(calc(var(--pearl-light-x) * -.3px),calc(var(--pearl-light-y) * -.22px));transition:transform .24s ease-out}
.physical-pearl__reflection{fill:color-mix(in srgb,var(--pearl-edge-dark,#3d5a66) 14%,transparent);filter:blur(1.5px);transform:translate(calc(var(--pearl-light-x) * -.8px),calc(var(--pearl-light-y) * -.65px));transition:transform .22s ease-out}
.physical-pearl__rim{stroke-width:.92}
.physical-pearl__specular{fill:color-mix(in srgb,var(--pearl-specular,#f7fcff) calc(var(--pearl-gloss,.62) * 100%),transparent)}
.physical-pearl__pinlight{fill:var(--pearl-specular,#f7fcff);opacity:calc(.78 + var(--pearl-gloss,.62) * .22)}
.physical-pearl__hotspot{display:none;stroke:rgba(12,22,28,.78);stroke-width:2;stroke-linecap:round}
.physical-pearl[data-pearl-variant=primary]{--pearl-nacre:#9fd4e8;--pearl-nucleus-a:#e8f7ff;--pearl-nucleus-b:#7ec8e0;--pearl-caustic:#d4f4ff;--pearl-body-highlight:#f4fcff;--pearl-body-mid:#b9d4e0;--pearl-body-shadow:#2a414c;--pearl-nacre-intensity:.46;--pearl-nucleus-intensity:.9;--pearl-gloss:.68;--pearl-brightness:.72}
.physical-pearl[data-pearl-variant=semantic] .physical-pearl__core{opacity:calc(.7 + var(--pearl-motion) * .2)}.physical-pearl[data-pearl-variant=semantic] .physical-pearl__ring{opacity:.62}
.physical-pearl[data-pearl-variant=result]{--pearl-nacre:#78b89f;--pearl-nucleus-a:#cee2d2;--pearl-nucleus-b:#78ad97;--pearl-caustic:#d8f0e4}.physical-pearl[data-pearl-variant=result] .physical-pearl__nacre{opacity:calc(.39 + var(--pearl-motion) * .22)}
.physical-pearl[data-pearl-variant=recipient]{--pearl-nacre:#c9bea0;--pearl-nucleus-a:#e2c8bd;--pearl-nucleus-b:#c6d3c8}
.physical-pearl[data-pearl-variant=canvas-anchor]{--pearl-nacre:#b6c8bf}
.physical-pearl[data-pearl-state=listening]{--pearl-nucleus-a:#f0fbff}.physical-pearl[data-pearl-state=listening] .physical-pearl__nucleus,.physical-pearl[data-pearl-state=listening] .physical-pearl__core{opacity:.94}
.physical-pearl[data-pearl-state=executing] .physical-pearl__nacre{opacity:calc(.52 + var(--pearl-motion) * .34)}
.physical-pearl[data-pearl-state=executing] .physical-pearl__nucleus,.physical-pearl[data-pearl-state=executing] .physical-pearl__core{opacity:.98}
.physical-pearl[data-pearl-state=executing] .physical-pearl__caustic{fill:rgba(212,244,255,.34)}
.physical-pearl[data-pearl-state=executing] .physical-pearl__ring{opacity:.82}
.physical-pearl[data-pearl-state=blocked],.physical-pearl[data-pearl-state=failed]{filter:saturate(.42) brightness(.88)}
.physical-pearl[data-pearl-state=blocked] .physical-pearl__nucleus,.physical-pearl[data-pearl-state=failed] .physical-pearl__nucleus,.physical-pearl[data-pearl-state=blocked] .physical-pearl__core,.physical-pearl[data-pearl-state=failed] .physical-pearl__core{opacity:.28}
.physical-pearl[data-pearl-variant=cursor]{pointer-events:none;--pearl-nucleus-a:#c8dde8;--pearl-nucleus-b:#5a8fa4;--pearl-edge-dark:#243844}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__hotspot{display:block}
.physical-pearl[data-pearl-variant=cursor] .physical-pearl__contact{opacity:.35}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__reflection{display:none}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__rim{stroke-width:1.15}
.physical-pearl[data-pearl-variant=cursor] .physical-pearl__nucleus{mix-blend-mode:multiply;opacity:.78}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__core{opacity:.55;animation:none}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__ring{opacity:.35;animation:none}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__depth{opacity:.86}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__nacre{opacity:.34}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__pinlight{opacity:.78}
.physical-pearl[data-pearl-surrounding=light]{--pearl-edge-dark:#46534f;--pearl-reflection-dark:#18231f}
.physical-pearl[data-pearl-surrounding=dark]{--pearl-edge-dark:#d6ddd8;--pearl-reflection-light:#eef4ef;--pearl-reflection-mid:#a8b7b0;--pearl-reflection-dark:#51625b}.physical-pearl[data-pearl-surrounding=dark] .physical-pearl__contact{fill:rgba(0,0,0,.28)}
.physical-pearl[data-pearl-surrounding=colored]{--pearl-edge-dark:#4d5d57}.physical-pearl[data-pearl-surrounding=colored] .physical-pearl__nacre{opacity:calc(.25 + var(--pearl-motion) * .22)}
.physical-pearl[data-pearl-surrounding=text-heavy] .physical-pearl__rim{stroke-width:1.05}.physical-pearl[data-pearl-surrounding=text-heavy] .physical-pearl__body{stroke-width:.75}.physical-pearl[data-pearl-surrounding=text-heavy] .physical-pearl__contact{opacity:.7}
.physical-pearl[data-pearl-animation=absorb] .physical-pearl__mass{animation:pearl-effect-absorb .42s cubic-bezier(.2,.72,.2,1)}
.physical-pearl[data-pearl-animation=refract] .physical-pearl__nacre{animation:pearl-effect-refract .36s ease-out}
.physical-pearl[data-pearl-animation=emerge] .physical-pearl__mass{animation:pearl-effect-emerge .52s cubic-bezier(.18,.78,.24,1)}
.physical-pearl[data-pearl-animation=unfold] .physical-pearl__reflection{animation:pearl-effect-unfold .42s ease-out}
.physical-pearl[data-pearl-animation=settle] .physical-pearl__mass{animation:pearl-effect-settle .36s cubic-bezier(.2,.78,.2,1)}
.physical-pearl[data-pearl-animation=lock] .physical-pearl__nucleus{animation:pearl-effect-lock .3s ease-out both}
.physical-pearl[data-pearl-animation=unlock] .physical-pearl__nucleus{animation:pearl-effect-unlock .36s ease-out}
.physical-pearl[data-pearl-animation=fail] .physical-pearl__mass{animation:pearl-effect-fail .26s ease-out}
.physical-pearl[data-pearl-animation=split] .physical-pearl__mass{animation:pearl-effect-fission .72s cubic-bezier(.16,.78,.22,1)}
.physical-pearl[data-pearl-animation=split] .physical-pearl__nucleus{animation:pearl-effect-fission-core .72s ease-out}
.physical-pearl[data-pearl-animation=merge] .physical-pearl__nacre{animation:pearl-effect-fuse .56s cubic-bezier(.2,.72,.2,1)}
.physical-pearl[data-pearl-animation=arrive] .physical-pearl__pinlight{animation:pearl-effect-arrive .42s ease-out}
.physical-pearl[data-pearl-animation=crossfade] .physical-pearl__nucleus{animation:pearl-effect-crossfade .65s ease-in-out}
.physical-pearl[data-pearl-animation=transfer] .physical-pearl__mass{animation:pearl-effect-transfer .76s cubic-bezier(.18,.78,.24,1)}
.physical-pearl[data-pearl-animation=recover] .physical-pearl__reflection{animation:pearl-effect-recover .42s ease-out}
.physical-pearl[data-pearl-animation=nest] .physical-pearl__mass{animation:pearl-effect-nest .44s cubic-bezier(.2,.72,.2,1)}
.physical-pearl[data-pearl-animation=compose] .physical-pearl__nacre{animation:pearl-effect-compose .52s cubic-bezier(.18,.78,.24,1)}
.physical-pearl[data-pearl-animation=duplicate] .physical-pearl__mass{animation:pearl-effect-echo .64s cubic-bezier(.18,.78,.24,1)}
.physical-pearl[data-pearl-animation=remix] .physical-pearl__nucleus{animation:pearl-effect-remix .56s ease-in-out}
.physical-pearl[data-pearl-animation=stream] .physical-pearl__nucleus{animation:pearl-effect-charge .9s ease-in-out}
.physical-pearl[data-pearl-animation=charge] .physical-pearl__nucleus{animation:pearl-effect-charge .9s ease-in-out}
.physical-pearl[data-pearl-animation=charge] .physical-pearl__caustic{animation:pearl-effect-charge-caustic .9s ease-in-out}
.physical-pearl[data-pearl-animation=burst] .physical-pearl__nacre{animation:pearl-effect-burst .42s ease-out}
.physical-pearl[data-pearl-animation=echo] .physical-pearl__mass{animation:pearl-effect-echo .64s cubic-bezier(.18,.78,.24,1)}
.physical-pearl[data-pearl-animation=fission] .physical-pearl__mass{animation:pearl-effect-fission .72s cubic-bezier(.16,.78,.22,1)}
.physical-pearl[data-pearl-animation=fission] .physical-pearl__nucleus{animation:pearl-effect-fission-core .72s ease-out}
.physical-pearl[data-pearl-animation=fuse] .physical-pearl__nacre{animation:pearl-effect-fuse .56s cubic-bezier(.2,.72,.2,1)}
.physical-pearl[data-pearl-animation=filament] .physical-pearl__caustic{animation:pearl-effect-filament .9s ease-out}
.physical-pearl[data-pearl-animation=filament] .physical-pearl__nacre{animation:pearl-effect-filament-nacre .9s ease-out}
.physical-pearl[data-pearl-animation=seek] .physical-pearl__mass{animation:pearl-effect-seek .7s cubic-bezier(.2,.7,.2,1)}
.physical-pearl[data-pearl-animation=mark] .physical-pearl__pinlight{animation:pearl-effect-mark .55s ease-out}
@keyframes pearl-effect-absorb{0%{transform:scale(1)}48%{transform:scale(.91)}72%{transform:scale(1.025)}100%{transform:scale(1)}}
@keyframes pearl-effect-refract{0%{opacity:.68;transform:translate(-1px,1px)}62%{opacity:1;transform:translate(1px,-1px)}100%{opacity:.82;transform:none}}
@keyframes pearl-effect-emerge{0%{opacity:0;transform:scale(.58) translateY(3px)}68%{opacity:1;transform:scale(1.035) translateY(-1px)}100%{transform:scale(1)}}
@keyframes pearl-effect-unfold{0%{opacity:.2;transform:scaleX(.3)}100%{opacity:.74;transform:scaleX(1)}}
@keyframes pearl-effect-settle{0%{transform:translateY(-2px) scale(1.02)}68%{transform:translateY(1px) scale(.99)}100%{transform:none}}
@keyframes pearl-effect-lock{0%{opacity:.82}100%{opacity:.28;transform:scale(.72)}}
@keyframes pearl-effect-unlock{0%{opacity:.28;transform:scale(.72)}100%{opacity:.82;transform:none}}
@keyframes pearl-effect-fail{0%{transform:translateX(0)}45%{transform:translateX(-1.5px)}72%{transform:translateX(1px)}100%{transform:none}}
@keyframes pearl-effect-arrive{0%{opacity:0;transform:translate(-5px,3px)}70%{opacity:1;transform:translate(1px,-1px)}100%{transform:none}}
@keyframes pearl-effect-crossfade{0%,100%{opacity:.58}50%{opacity:.86}}
@keyframes pearl-effect-transfer{0%{opacity:.5;transform:translateX(-4px) scale(.96)}62%{opacity:1;transform:translateX(1px) scale(1.02)}100%{transform:none}}
@keyframes pearl-effect-recover{0%{opacity:.12;transform:translateY(2px)}100%{opacity:.34;transform:none}}
@keyframes pearl-effect-nest{0%{transform:scale(1)}42%{transform:scale(.88) translate(2px,-1px)}78%{transform:scale(1.03)}100%{transform:none}}
@keyframes pearl-effect-compose{0%{opacity:.3;transform:scale(1.06) translateX(-2px)}55%{opacity:.9;transform:scale(.96) translateX(1px)}100%{opacity:.48;transform:none}}
@keyframes pearl-effect-remix{0%{opacity:.45;transform:scale(.9)}50%{opacity:.95;transform:scale(1.06)}100%{opacity:.72;transform:none}}
@keyframes pearl-effect-charge{0%,100%{opacity:.48;transform:scale(.94)}45%{opacity:1;transform:scale(1.1)}72%{opacity:.88;transform:scale(1.04)}}
@keyframes pearl-effect-charge-caustic{0%,100%{opacity:.55;transform:translate(0,0) scale(1)}50%{opacity:1;transform:translate(1px,-1px) scale(1.08)}}
@keyframes pearl-effect-burst{0%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1.12)}100%{opacity:.48;transform:none}}
@keyframes pearl-effect-echo{0%{opacity:0;transform:scale(.55) translateX(-8px)}28%{opacity:1;transform:scale(1.08) translateX(2px)}62%{transform:scale(.97) translateX(-1px)}100%{transform:none}}
@keyframes pearl-effect-fission{0%{transform:scale(1)}18%{transform:scale(1.14)}42%{transform:scale(.82)}68%{transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes pearl-effect-fission-core{0%{opacity:.7;transform:scale(1)}30%{opacity:1;transform:scale(1.28)}100%{opacity:.72;transform:none}}
@keyframes pearl-effect-fuse{0%{opacity:.2;transform:scale(1.2)}48%{opacity:.95;transform:scale(.88)}100%{opacity:.48;transform:none}}
@keyframes pearl-effect-filament{0%{opacity:.35;transform:translate(0,0) scale(1)}40%{opacity:1;transform:translate(2px,-2px) scale(1.12)}100%{opacity:.55;transform:none}}
@keyframes pearl-effect-filament-nacre{0%{opacity:.3}45%{opacity:.95}100%{opacity:.48}}
@keyframes pearl-effect-seek{0%{transform:translate(0,0) scale(1)}35%{transform:translate(3px,-4px) scale(1.06)}100%{transform:none}}
@keyframes pearl-effect-mark{0%{opacity:.3;transform:scale(.5)}45%{opacity:1;transform:scale(1.4)}100%{opacity:.96;transform:none}}
@keyframes physical-pearl-breath{0%,100%{transform:scale(.98)}50%{transform:scale(1.02)}}
@keyframes physical-pearl-core-breath{0%,100%{opacity:.86;transform:scale(.97)}50%{opacity:1;transform:scale(1.05)}}
@keyframes physical-pearl-ring-breath{0%,100%{opacity:.7}50%{opacity:.98}}
@media(prefers-color-scheme:dark){.physical-pearl[data-pearl-surrounding=auto]{--pearl-edge-dark:#d6e4ea;--pearl-reflection-light:#eef7fb;--pearl-reflection-mid:#9ab0bc;--pearl-reflection-dark:#516670}}
@media(prefers-reduced-motion:reduce){.physical-pearl[data-pearl-animation] *,.physical-pearl__mass,.physical-pearl__core,.physical-pearl__ring{animation:none!important}.physical-pearl__core{opacity:.88}.physical-pearl__ring--inner{opacity:.66}.physical-pearl__nucleus,.physical-pearl__nacre,.physical-pearl__reflection,.physical-pearl__caustic{transform:none!important;transition:none!important}}
@media(forced-colors:active){.physical-pearl{forced-color-adjust:none}.physical-pearl__rim{stroke-width:1.15}.physical-pearl__hotspot{stroke:#111}}
`;
