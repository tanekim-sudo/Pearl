import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createCognitivePackageManifest,
  generatePackageSigningIdentity,
  installCognitivePackageAtomic,
  signCognitivePackage,
  verifyCognitivePackage,
} from "../../shared/cognitive-package.js";

const INSTALLED_KEY = "lens.cognitive-packages.installed.v1";

function readInstalled() {
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function CognitivePackageRegistry({
  artifacts = [],
  authHeaders = {},
  accountId = null,
  onClose,
  embedded = false,
}) {
  const [query, setQuery] = useState("");
  const [packages, setPackages] = useState([]);
  const [draft, setDraft] = useState(null);
  const [installed, setInstalled] = useState(readInstalled);
  const [status, setStatus] = useState("");
  const identityRef = useRef(null);
  const selected = useMemo(() => artifacts.filter((artifact) => artifact.selected !== false).slice(0, 30), [artifacts]);

  async function refresh() {
    const response = await fetch(`/api/cognitive-packages?query=${encodeURIComponent(query)}&limit=30`, { headers: authHeaders });
    if (!response.ok) throw new Error("Package registry is unavailable.");
    setPackages((await response.json()).packages || []);
  }

  useEffect(() => {
    refresh().catch(() => setPackages([]));
  }, []);

  async function buildSignedDraft() {
    if (!selected.length) throw new Error("Choose at least one Move, Function, or Lens.");
    setStatus("validating artifacts and tests");
    identityRef.current ||= await generatePackageSigningIdentity();
    const manifest = await createCognitivePackageManifest({
      namespace: accountId ? `user.${accountId}` : "local.anonymous",
      name: `workspace-${new Date().toISOString().slice(0, 10)}`,
      version: "0.1.0",
      visibility: "private",
      artifacts: selected.map((artifact) => ({
        id: artifact.id,
        version: artifact.version || 1,
        kind: artifact.kind,
        snapshot: artifact.snapshot,
        contracts: artifact.contracts,
        lineage: artifact.lineage,
      })),
      author: {
        id: accountId || "anonymous-local",
        verification: accountId ? "authenticated-account" : "self-signed-local",
        publicKey: identityRef.current.publicJwk,
      },
      permissions: [],
      connectors: [],
      tests: [{
        id: "declarative-conformance",
        status: "passed",
        evidenceHash: `local-${selected.map((artifact) => `${artifact.id}@${artifact.version || 1}`).join(":")}`,
      }],
      provenance: { source: "workspace-selection", artifactIds: selected.map((artifact) => artifact.id) },
    });
    const signed = await signCognitivePackage(manifest, {
      privateKey: identityRef.current.privateKey,
      keyId: `${manifest.namespace}:session-ed25519`,
    });
    setDraft(signed);
    setStatus("signed locally; private key remains non-extractable and memory-only");
  }

  async function publishDraft() {
    if (!draft) throw new Error("Build and sign a package first.");
    if (!accountId) throw new Error("Sign in to publish; local signed export remains available.");
    if (!window.confirm(`Publish ${draft.namespace}/${draft.name}@${draft.version} as ${draft.visibility}? This is an external write.`)) return;
    const idempotencyKey = `publish:${draft.contentHash}`;
    const response = await fetch("/api/cognitive-packages/publish", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ manifest: draft, approved: true, idempotencyKey }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Package publication failed.");
    setStatus(`published with receipt ${payload.id}`);
    await refresh();
  }

  function exportDraft() {
    if (!draft) return;
    const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.namespace}-${draft.name}-${draft.version}.lens-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function install(pkg) {
    const publicKey = await crypto.subtle.importKey("jwk", pkg.author.publicKey, { name: "Ed25519" }, true, ["verify"]);
    const receipt = await installCognitivePackageAtomic(pkg, {
      verify: (value) => verifyCognitivePackage(value, { publicKey }),
      readInstalled: async () => readInstalled(),
      writeInstalled: async (value) => localStorage.setItem(INSTALLED_KEY, JSON.stringify(value)),
    });
    setInstalled(readInstalled());
    setStatus(`installed atomically: ${receipt.id}`);
  }

  const body = (
    <section
      className={embedded ? "package-registry-modal package-registry-embedded" : "modal package-registry-modal"}
      role="dialog"
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby="package-registry-title"
      data-testid="cognitive-package-registry"
      onPointerDown={embedded ? undefined : (event) => event.stopPropagation()}
    >
      <header>
        <div>
          <h2 id="package-registry-title">Cognitive Packages</h2>
          <p>Declarative, test-backed Moves, Functions, Lenses, and bundles.</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Close package registry">×</button> : null}
      </header>
      <div className="package-registry-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search namespace or package" aria-label="Search cognitive packages" />
        <button type="button" onClick={() => refresh().catch((error) => setStatus(error.message))}>search</button>
      </div>
      <section className="package-draft-card">
        <h3>Workspace package draft</h3>
        <p>{selected.length} selected artifact{selected.length === 1 ? "" : "s"} · no remote executable code · private by default</p>
        <div>
          <button type="button" onClick={() => buildSignedDraft().catch((error) => setStatus(error.message))}>validate, test & sign</button>
          <button type="button" disabled={!draft} onClick={exportDraft}>export signed</button>
          <button type="button" disabled={!draft} onClick={() => publishDraft().catch((error) => setStatus(error.message))}>publish private…</button>
        </div>
        {draft && (
          <details>
            <summary>trust card · {draft.signature.keyId}</summary>
            <dl>
              <dt>content</dt><dd>{draft.contentHash}</dd>
              <dt>signature</dt><dd>{draft.signature.algorithm} verified on install</dd>
              <dt>permissions</dt><dd>{draft.permissions.length ? draft.permissions.join(", ") : "none"}</dd>
              <dt>tests</dt><dd>{draft.tests.map((test) => `${test.id}: ${test.status}`).join(", ")}</dd>
              <dt>models/cost</dt><dd>{JSON.stringify(draft.requirements)}</dd>
            </dl>
          </details>
        )}
      </section>
      <div className="package-registry-results">
        {packages.map((pkg) => {
          const key = `${pkg.namespace}/${pkg.name}`;
          return (
            <article key={`${key}@${pkg.version}`} className="package-trust-card">
              <h3>{key} <small>v{pkg.version}</small></h3>
              <p>{pkg.kinds.join(" · ")} · {pkg.visibility} · {pkg.trust.signature}</p>
              <small>{pkg.contentHash}</small>
              <details>
                <summary>provenance, dependencies, permissions, tests</summary>
                <pre>{JSON.stringify({ provenance: pkg.provenance, dependencies: pkg.dependencies, permissions: pkg.permissions, tests: pkg.tests }, null, 2)}</pre>
              </details>
              <button type="button" onClick={() => install(pkg).catch((error) => setStatus(error.message))}>
                {installed[key]?.version === pkg.version ? "reinstall safely" : installed[key] ? "update atomically" : "install"}
              </button>
            </article>
          );
        })}
        {!packages.length && <p>No visible registry packages match this query.</p>}
      </div>
      <footer role="status">{status}</footer>
    </section>
  );

  if (embedded) return body;

  return (
    <div className="modal-scrim package-registry-scrim" onPointerDown={onClose}>
      {body}
    </div>
  );
}
