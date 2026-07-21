import { FEATURE_BASELINE, FEATURE_CONTRACTS } from "./feature-contracts.js";

export const REQUIREMENTS_LEDGER_VERSION = 1;

const define = (id, requirement, featureIds, evidence = [
  "audit-shots/audit-truth-remediation-2026-07/web/web-results.json",
  "audit-shots/audit-truth-remediation-2026-07/extension/extension-results.json",
  "audit-shots/audit-truth-remediation-2026-07/live-provider-boundary.json",
]) => Object.freeze({
  id,
  requirement,
  featureIds,
  evidence,
});

export const PRODUCT_REQUIREMENTS = Object.freeze([
  define("preservation.pre-orb", "Preserve every pre-orb capability, stable ID, direct entry, companion path, extension path, migration, and undo behavior.", FEATURE_CONTRACTS.slice(0, 27).map((entry) => entry.id)),
  define("experience.pearl-only", "Pearl remains radically minimal, ethereal, companion-first, and progressively discloses only relevant controls.", ["shell.pearl-progressive", "shell.extension-first", "runtime.pearl-action-animation"]),
  define("privacy.local-first", "Pearl data is encrypted, profile-isolated, offline-capable, local-first, and syncs only after scoped consent.", ["privacy.local-profile-vault", "privacy.pearl-policy"]),
  define("privacy.account-isolation", "Logout, profile changes, account reloads, and organization switches clear decrypted/session state without cross-user access.", ["privacy.local-profile-vault", "sharing.organization-trust"]),
  define("privacy.boundaries", "Page observation is bounded, excludes sensitive fields, and records approved disclosure without URL or log leakage.", ["privacy.bounded-page-observation", "privacy.pearl-policy"]),
  define("privacy.delete-lock", "Delete, lock, unlock, timeout, key rotation, recovery warning, migration, and corrupt-envelope handling are complete.", ["privacy.local-profile-vault", "privacy.pearl-policy", "sharing.organization-trust"]),
  define("security.handoffs", "Web, Result, Studio, and recipient handoffs are short-lived, one-time, origin/profile/tab/scope bound, replay-safe, and fragment transported.", ["privacy.local-profile-vault", "studio.pearl", "output.result-pearl", "sharing.pearl-package"]),
  define("canvas.per-pearl", "Every Pearl owns a page canvas with native pass-through, typed tools, coordinate correctness, local persistence, quota defense, and unsupported-page fallback.", ["extension.pearl-page-canvas", "privacy.bounded-page-observation"]),
  define("result.celadon", "Lens generation stages a persisted celadon Result Pearl with provenance and never silently mutates source material.", ["output.result-pearl", "output.two-stage-routing", "visual.physical-pearl"]),
  define("routing.two-stage", "Every output asks destination, interprets a typed PlacementPlan, confirms, then executes once without regeneration.", ["output.two-stage-routing", "output.result-pearl"]),
  define("soundscape.per-pearl", "Per-Pearl lawful local/provider soundscapes support rights gates, crossfade, offscreen continuity, offline, quota, and autoplay fallback.", ["semantic-pearl.soundscape", "privacy.pearl-policy"]),
  define("studio.same-object", "Triple activation and accessible actions open the same Pearl in a secure editable full-tab Studio with CAS, checkpoints, undo, and conflict review.", ["studio.pearl", "runtime.unified-pearl", "interaction.orb-gesture"]),
  define("sharing.package", "Signed scoped Pearl packages preserve provenance, privacy review, ownership, expiry, revocation, updates, recipient onboarding, and atomic install.", ["sharing.pearl-package", "registry.cognitive-packages", "privacy.pearl-policy"]),
  define("sharing.organization", "Organization shares use tenant authorization, role checks, envelope encryption, restrictive inheritance, key rotation, and revocation.", ["sharing.organization-trust", "privacy.pearl-policy"]),
  define("automation.compiler", "Arbitrary pasted prompt systems compile into editable reusable automation Pearls while preserving verbatim evidence and semantic diff.", ["automation.pearl-compiler", "learning.transcript", "learning.before-after"]),
  define("automation.research", "Current research is verified, bounded, injection-resistant, privacy guarded, review-patched, undoable, and refresh-budgeted.", ["automation.pearl-compiler", "privacy.bounded-page-observation", "privacy.pearl-policy"]),
  define("visual.physical", "Every Pearl instance uses one high-fidelity physical renderer without white-dot, emoji, generic-disc, glow, or fallback variants.", ["visual.physical-pearl", "shell.pearl-progressive"]),
  define("interaction.cursor", "The physical Pearl transforms into one precise, non-draggable cursor with native input fallback and Triple-Space arbitration.", ["interaction.orb-gesture", "visual.physical-pearl"]),
  define("runtime.unified", "One versioned canonical Pearl entity and one action/event protocol govern all properties, surfaces, effects, receipts, checkpoints, policy, undo, and idempotency.", ["runtime.unified-pearl", "runtime.pearl-action-animation"]),
  define("runtime.animation", "Every meaningful effect uses restrained effect-synchronized Pearl physics, cancellation, observation receipts, and reduced-motion static state.", ["runtime.pearl-action-animation", "visual.physical-pearl", "companion.effect-trace"]),
  define("cognition.layers", "Primitive, Role, Lens, Move, Function, and Pearl are explicit differentiated versioned editable cognitive layers.", ["cognition.typed-layers", "composition.universal"]),
  define("cognition.uncertainty", "AI organization preserves verbatim evidence, confidence, rationale, questions, conflicts, authorship, mappings, and blocks unresolved executable/shareable facts.", ["cognition.typed-layers", "automation.pearl-compiler", "sharing.pearl-package"]),
  define("cognition.remix", "Studio separates spatial layout from semantic order and supports drag, reorder, nest, link, duplicate, split, merge, fork, remove, export, share, and cross-Pearl composition with bridge Moves.", ["cognition.typed-layers", "studio.pearl", "composition.universal"]),
  define("cognition.playback", "Functions play, step, branch, pause, cancel, rerun, swap inputs/Lenses/Roles, and retain intermediate Result Pearls and exact checkpoints.", ["cognition.typed-layers", "output.result-pearl", "generation.taste-branching"]),
  define("companion.authorized-power", "Companion observes and changes every authorized state through the complete capability graph while stating inaccessible, hidden, cross-origin, locked, or sensitive boundaries.", ["runtime.unified-pearl", "companion.orb-runtime", "companion.transaction-harness", "privacy.pearl-policy"]),
  define("companion.multistep", "Natural language, stream-of-consciousness critique, deixis, interruption, background work, clarification, approval, partial failure, retry, research, and routing remain real and checkpointed.", ["companion.orb-runtime", "companion.orb-swarm", "companion.transaction-harness", "output.two-stage-routing"]),
  define("quality.first-use-e2e", "First-use install through capture, Pearl creation, Lens result, routing, Studio edit, undo, and reload is deterministic and browser verified.", ["extension.distribution", "extension.pearl-page-canvas", "output.result-pearl", "output.two-stage-routing", "studio.pearl"]),
  define("quality.adversarial-stress", "Large data, many Pearls, concurrent workers/tabs, switching, crash recovery, flapping network, quota, prompt injection, malicious packages, and stale observation are bounded and recoverable.", ["companion.transaction-harness", "extension.pearl-page-canvas", "privacy.local-profile-vault", "sharing.pearl-package"]),
  define("quality.visual-accessibility", "All Pearl states pass desktop, 360px, 200% zoom, touch, keyboard, screen-reader, reduced-motion, high-contrast, light/dark, and text-heavy visual inspection.", ["visual.physical-pearl", "shell.pearl-progressive", "studio.pearl"]),
]);

export function generateRequirementsLedger() {
  const byId = new Map(FEATURE_CONTRACTS.map((entry) => [entry.id, entry]));
  const requirements = PRODUCT_REQUIREMENTS.map((entry) => {
    const features = entry.featureIds.map((id) => byId.get(id)).filter(Boolean);
    const merge = (key) => [...new Set(features.flatMap((feature) => feature[key] || []))];
    return {
      id: entry.id,
      requirement: entry.requirement,
      featureContracts: features.map((feature) => feature.id),
      domainCommands: merge("commands"),
      webEntries: merge("ui"),
      companionCapabilities: [...new Set([...merge("companion"), ...merge("extension")])],
      extensionEntries: merge("extension"),
      persistenceAndMigrations: merge("persistence"),
      automatedTests: merge("tests"),
      browserEvidence: [...entry.evidence],
      owners: merge("owner"),
      reachable: features.length === entry.featureIds.length,
    };
  });
  return {
    version: REQUIREMENTS_LEDGER_VERSION,
    featureBaseline: FEATURE_BASELINE,
    counts: {
      requirements: requirements.length,
      featureContracts: FEATURE_CONTRACTS.length,
      domainCommands: new Set(requirements.flatMap((entry) => entry.domainCommands)).size,
      companionCapabilities: new Set(requirements.flatMap((entry) => entry.companionCapabilities)).size,
      extensionEntries: new Set(requirements.flatMap((entry) => entry.extensionEntries)).size,
    },
    requirements,
  };
}

export function validateRequirementsLedger(ledger = generateRequirementsLedger()) {
  const missing = [];
  for (const entry of ledger.requirements) {
    if (!entry.reachable) missing.push(`${entry.id}:feature-contract`);
    for (const [field, values] of Object.entries({
      domainCommands: entry.domainCommands,
      webEntries: entry.webEntries,
      companionCapabilities: entry.companionCapabilities,
      extensionEntries: entry.extensionEntries,
      persistenceAndMigrations: entry.persistenceAndMigrations,
      automatedTests: entry.automatedTests,
      browserEvidence: entry.browserEvidence,
    })) {
      if (!values.length && !["visual.physical", "experience.pearl-only"].includes(entry.id)) missing.push(`${entry.id}:${field}`);
    }
  }
  return { valid: missing.length === 0, missing, counts: ledger.counts };
}
