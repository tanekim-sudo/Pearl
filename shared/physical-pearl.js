export const PHYSICAL_PEARL_VERSION = 2;
export const PHYSICAL_PEARL_VARIANTS = Object.freeze(["primary", "semantic", "result", "worker", "candidate", "cursor", "recipient", "canvas-anchor"]);
export const PHYSICAL_PEARL_STATES = Object.freeze(["idle", "new", "listening", "executing", "blocked", "failed", "loading"]);
export const PHYSICAL_PEARL_SIZES = Object.freeze({ cursor: 18, compact: 30, idle: 34, studio: 112 });
export const PHYSICAL_PEARL_SURROUNDINGS = Object.freeze(["auto", "light", "dark", "colored", "text-heavy"]);

const safeToken = (value, fallback) => {
  const token = String(value || fallback).toLowerCase();
  return /^[a-z][a-z0-9_-]{0,48}$/.test(token) ? token : fallback;
};

export function normalizePhysicalPearl(options = {}) {
  const variant = PHYSICAL_PEARL_VARIANTS.includes(options.variant) ? options.variant : "primary";
  const state = PHYSICAL_PEARL_STATES.includes(options.state) ? options.state : "idle";
  const size = variant === "cursor"
    ? PHYSICAL_PEARL_SIZES.cursor
    : Math.max(16, Math.min(240, Number(options.size) || PHYSICAL_PEARL_SIZES.idle));
  return {
    variant,
    state,
    size,
    id: safeToken(options.id, `pearl-${Math.random().toString(36).slice(2)}`),
    className: String(options.className || "").replace(/[<>"']/g, ""),
    label: String(options.label || "Pearl").replace(/[<>&"]/g, ""),
    decorative: options.decorative === true,
    surrounding: PHYSICAL_PEARL_SURROUNDINGS.includes(options.surrounding) ? options.surrounding : "auto",
  };
}

export function physicalPearlMarkup(options = {}) {
  const pearl = normalizePhysicalPearl(options);
  const prefix = pearl.id;
  return `<svg class="physical-pearl ${pearl.className}" data-pearl-renderer="${PHYSICAL_PEARL_VERSION}" data-pearl-variant="${pearl.variant}" data-pearl-state="${pearl.state}" data-pearl-surrounding="${pearl.surrounding}" width="${pearl.size}" height="${pearl.size}" viewBox="0 0 100 100" ${pearl.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${pearl.label}"`}>
    <defs>
      <clipPath id="${prefix}-sphere"><circle cx="50" cy="50" r="43"/></clipPath>
      <radialGradient id="${prefix}-body" cx="37%" cy="31%" r="75%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".25" stop-color="#f4eee5"/><stop offset=".58" stop-color="#deded7"/><stop offset=".82" stop-color="#b8bfba"/><stop offset=".96" stop-color="#7e8985"/><stop offset="1" stop-color="#65716e"/></radialGradient>
      <radialGradient id="${prefix}-depth" cx="40%" cy="42%" r="62%"><stop offset="0" stop-color="#fff7ea" stop-opacity=".34"/><stop offset=".45" stop-color="#d9d5ca" stop-opacity=".08"/><stop offset=".78" stop-color="#273733" stop-opacity=".16"/><stop offset="1" stop-color="#101917" stop-opacity=".3"/></radialGradient>
      <radialGradient id="${prefix}-nucleus" cx="35%" cy="64%" r="61%"><stop offset="0" stop-color="var(--pearl-nucleus-a,#e8c7bd)" stop-opacity=".66"/><stop offset=".31" stop-color="var(--pearl-nucleus-b,#b8d1c8)" stop-opacity=".44"/><stop offset=".58" stop-color="#e6d19f" stop-opacity=".22"/><stop offset=".86" stop-color="#748d88" stop-opacity=".08"/><stop offset="1" stop-color="#52645f" stop-opacity="0"/></radialGradient>
      <linearGradient id="${prefix}-nacre" x1="6%" y1="16%" x2="94%" y2="82%"><stop offset="0" stop-color="#d7a9a4" stop-opacity=".12"/><stop offset=".27" stop-color="var(--pearl-nacre,#aaccc0)" stop-opacity=".34"/><stop offset=".49" stop-color="#e8d69f" stop-opacity=".2"/><stop offset=".68" stop-color="#cfa7a9" stop-opacity=".24"/><stop offset=".86" stop-color="#a9cabe" stop-opacity=".18"/><stop offset="1" stop-color="#dfc9a8" stop-opacity=".06"/></linearGradient>
      <linearGradient id="${prefix}-rim" x1="16%" y1="7%" x2="84%" y2="93%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".31" stop-color="#e9efea" stop-opacity=".28"/><stop offset=".68" stop-color="var(--pearl-edge-dark,#54615d)" stop-opacity=".52"/><stop offset=".88" stop-color="#202d29" stop-opacity=".62"/><stop offset="1" stop-color="#f0e3d2" stop-opacity=".56"/></linearGradient>
      <linearGradient id="${prefix}-environment" x1="20%" y1="0" x2="78%" y2="100%"><stop offset="0" stop-color="var(--pearl-reflection-light,#fff)" stop-opacity=".15"/><stop offset=".55" stop-color="var(--pearl-reflection-mid,#85938e)" stop-opacity=".05"/><stop offset="1" stop-color="var(--pearl-reflection-dark,#1b2925)" stop-opacity=".2"/></linearGradient>
      <filter id="${prefix}-soft-internal" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.4"/></filter>
    </defs>
    <ellipse class="physical-pearl__contact" cx="51" cy="95" rx="24" ry="2"/>
    <g class="physical-pearl__mass">
      <circle class="physical-pearl__body" cx="50" cy="50" r="43" fill="url(#${prefix}-body)"/>
      <g clip-path="url(#${prefix}-sphere)">
        <ellipse class="physical-pearl__subsurface physical-pearl__subsurface--far" cx="61" cy="60" rx="34" ry="29"/>
        <ellipse class="physical-pearl__nucleus" cx="41" cy="59" rx="24" ry="29" fill="url(#${prefix}-nucleus)"/>
        <ellipse class="physical-pearl__subsurface physical-pearl__subsurface--near" cx="42" cy="45" rx="35" ry="31"/>
        <path class="physical-pearl__caustic" d="M14 59c17-23 31-10 44-25 9-10 18-8 29-2-9 7-12 17-25 20-19 5-22 18-48 7Z" filter="url(#${prefix}-soft-internal)"/>
        <circle class="physical-pearl__depth" cx="50" cy="50" r="42" fill="url(#${prefix}-depth)"/>
        <circle class="physical-pearl__nacre" cx="50" cy="50" r="41.5" fill="url(#${prefix}-nacre)"/>
        <path class="physical-pearl__environment" d="M15 67c18 10 44 11 70-1-8 19-24 28-39 27-13-1-25-9-31-26Z" fill="url(#${prefix}-environment)"/>
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
.physical-pearl{display:block;overflow:visible;--pearl-light-x:0;--pearl-light-y:0;--pearl-motion:0;--pearl-nacre:#aaccc0;--pearl-nucleus-a:#e8c7bd;--pearl-nucleus-b:#b8d1c8;--pearl-edge-dark:#53615c;--pearl-reflection-light:#fff;--pearl-reflection-mid:#84938d;--pearl-reflection-dark:#192722}
.physical-pearl__mass{transform-origin:50px 50px;animation:physical-pearl-breath 6.4s ease-in-out infinite}
.physical-pearl__contact{fill:rgba(0,0,0,.14);filter:blur(1px)}
.physical-pearl__body{stroke:rgba(255,255,255,.56);stroke-width:.54}
.physical-pearl__subsurface{transform-origin:50px 50px;transition:transform .24s ease-out}
.physical-pearl__subsurface--far{fill:rgba(31,58,51,.13);filter:blur(2.4px);transform:translate(calc(var(--pearl-light-x) * -.7px),calc(var(--pearl-light-y) * -.6px))}
.physical-pearl__subsurface--near{fill:rgba(255,244,225,.13);filter:blur(1.5px);transform:translate(calc(var(--pearl-light-x) * .65px),calc(var(--pearl-light-y) * .5px))}
.physical-pearl__nucleus{mix-blend-mode:soft-light;opacity:.7;transform:translate(calc(var(--pearl-light-x) * -1.15px),calc(var(--pearl-light-y) * -.9px));transform-origin:50px 50px;transition:opacity .24s ease-out,transform .22s ease-out}
.physical-pearl__caustic{fill:rgba(255,235,196,.13);mix-blend-mode:screen;transform:translate(calc(var(--pearl-light-x) * .45px),calc(var(--pearl-light-y) * .35px));transition:transform .2s ease-out}
.physical-pearl__depth{mix-blend-mode:multiply;opacity:.62}
.physical-pearl__nacre{mix-blend-mode:screen;opacity:calc(.3 + var(--pearl-motion) * .28);transform:translate(calc(var(--pearl-light-x) * 1.65px),calc(var(--pearl-light-y) * 1.35px));transform-origin:50px 50px;transition:opacity .2s ease-out,transform .18s ease-out}
.physical-pearl__environment{opacity:.76;transform:translate(calc(var(--pearl-light-x) * -.3px),calc(var(--pearl-light-y) * -.22px));transition:transform .24s ease-out}
.physical-pearl__reflection{fill:rgba(39,57,51,.07);filter:blur(1.7px);transform:translate(calc(var(--pearl-light-x) * -.8px),calc(var(--pearl-light-y) * -.65px));transition:transform .22s ease-out}
.physical-pearl__rim{stroke-width:.84}
.physical-pearl__specular{fill:rgba(255,255,255,.46)}
.physical-pearl__pinlight{fill:#fff;opacity:.96}
.physical-pearl__hotspot{display:none;stroke:rgba(20,24,22,.72);stroke-width:2;stroke-linecap:round}
.physical-pearl[data-pearl-variant=result]{--pearl-nacre:#78b89f;--pearl-nucleus-a:#cee2d2;--pearl-nucleus-b:#78ad97}.physical-pearl[data-pearl-variant=result] .physical-pearl__nacre{opacity:calc(.39 + var(--pearl-motion) * .22)}
.physical-pearl[data-pearl-variant=recipient]{--pearl-nacre:#c9bea0;--pearl-nucleus-a:#e2c8bd;--pearl-nucleus-b:#c6d3c8}
.physical-pearl[data-pearl-variant=canvas-anchor]{--pearl-nacre:#b6c8bf}
.physical-pearl[data-pearl-state=listening]{--pearl-nucleus-a:#f0d4c3}.physical-pearl[data-pearl-state=listening] .physical-pearl__nucleus{opacity:.82}
.physical-pearl[data-pearl-state=executing] .physical-pearl__nacre{opacity:calc(.48 + var(--pearl-motion) * .34)}
.physical-pearl[data-pearl-state=blocked],.physical-pearl[data-pearl-state=failed]{filter:saturate(.42) brightness(.88)}
.physical-pearl[data-pearl-state=blocked] .physical-pearl__nucleus,.physical-pearl[data-pearl-state=failed] .physical-pearl__nucleus{opacity:.3}
.physical-pearl[data-pearl-variant=cursor]{pointer-events:none;--pearl-nucleus-a:#c89f93;--pearl-nucleus-b:#6b9888;--pearl-edge-dark:#344641}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__hotspot{display:block}
.physical-pearl[data-pearl-variant=cursor] .physical-pearl__contact{opacity:.35}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__reflection{display:none}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__rim{stroke-width:1.15}
.physical-pearl[data-pearl-variant=cursor] .physical-pearl__nucleus{mix-blend-mode:multiply;opacity:.78}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__depth{opacity:.86}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__nacre{opacity:.34}.physical-pearl[data-pearl-variant=cursor] .physical-pearl__pinlight{opacity:.78}
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
.physical-pearl[data-pearl-animation=split] .physical-pearl__reflection{animation:pearl-effect-split .48s ease-out}
.physical-pearl[data-pearl-animation=merge] .physical-pearl__nacre{animation:pearl-effect-merge .48s cubic-bezier(.2,.72,.2,1)}
.physical-pearl[data-pearl-animation=arrive] .physical-pearl__pinlight{animation:pearl-effect-arrive .42s ease-out}
.physical-pearl[data-pearl-animation=crossfade] .physical-pearl__nucleus{animation:pearl-effect-crossfade .65s ease-in-out}
.physical-pearl[data-pearl-animation=transfer] .physical-pearl__mass{animation:pearl-effect-transfer .76s cubic-bezier(.18,.78,.24,1)}
.physical-pearl[data-pearl-animation=recover] .physical-pearl__reflection{animation:pearl-effect-recover .42s ease-out}
@keyframes pearl-effect-absorb{0%{transform:scale(1)}48%{transform:scale(.91)}72%{transform:scale(1.025)}100%{transform:scale(1)}}
@keyframes pearl-effect-refract{0%{opacity:.68;transform:translate(-1px,1px)}62%{opacity:1;transform:translate(1px,-1px)}100%{opacity:.82;transform:none}}
@keyframes pearl-effect-emerge{0%{opacity:0;transform:scale(.58) translateY(3px)}68%{opacity:1;transform:scale(1.035) translateY(-1px)}100%{transform:scale(1)}}
@keyframes pearl-effect-unfold{0%{opacity:.2;transform:scaleX(.3)}100%{opacity:.74;transform:scaleX(1)}}
@keyframes pearl-effect-settle{0%{transform:translateY(-2px) scale(1.02)}68%{transform:translateY(1px) scale(.99)}100%{transform:none}}
@keyframes pearl-effect-lock{0%{opacity:.82}100%{opacity:.28;transform:scale(.72)}}
@keyframes pearl-effect-unlock{0%{opacity:.28;transform:scale(.72)}100%{opacity:.82;transform:none}}
@keyframes pearl-effect-fail{0%{transform:translateX(0)}45%{transform:translateX(-1.5px)}72%{transform:translateX(1px)}100%{transform:none}}
@keyframes pearl-effect-split{0%{opacity:.18;transform:scaleX(.5)}55%{opacity:.82;transform:scaleX(1.12)}100%{opacity:.34;transform:none}}
@keyframes pearl-effect-merge{0%{opacity:.28;transform:scale(1.08)}58%{opacity:.82;transform:scale(.94)}100%{opacity:.48;transform:none}}
@keyframes pearl-effect-arrive{0%{opacity:0;transform:translate(-5px,3px)}70%{opacity:1;transform:translate(1px,-1px)}100%{transform:none}}
@keyframes pearl-effect-crossfade{0%,100%{opacity:.58}50%{opacity:.86}}
@keyframes pearl-effect-transfer{0%{opacity:.5;transform:translateX(-4px) scale(.96)}62%{opacity:1;transform:translateX(1px) scale(1.02)}100%{transform:none}}
@keyframes pearl-effect-recover{0%{opacity:.12;transform:translateY(2px)}100%{opacity:.34;transform:none}}
@keyframes physical-pearl-breath{0%,100%{transform:scale(.98)}50%{transform:scale(1.02)}}
@media(prefers-color-scheme:dark){.physical-pearl[data-pearl-surrounding=auto]{--pearl-edge-dark:#d6ddd8;--pearl-reflection-light:#eef4ef;--pearl-reflection-mid:#a8b7b0;--pearl-reflection-dark:#51625b}}
@media(prefers-reduced-motion:reduce){.physical-pearl[data-pearl-animation] *,.physical-pearl__mass{animation:none!important}.physical-pearl__nucleus,.physical-pearl__nacre,.physical-pearl__reflection{transform:none!important;transition:none!important}}
@media(forced-colors:active){.physical-pearl{forced-color-adjust:none}.physical-pearl__rim{stroke-width:1.15}.physical-pearl__hotspot{stroke:#111}}
`;
