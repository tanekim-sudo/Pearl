import React, { useEffect, useRef, useState } from "react";
import { createLensLibraryBundle } from "../../shared/lens-library.js";

const release = __LENS_EXTENSION_RELEASE__;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function browserSupport() {
  if (typeof window === "undefined") return { supported: false, name: "browser" };
  const narrow = window.matchMedia("(max-width: 719px)").matches;
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua) && !narrow) return { supported: true, name: "Edge" };
  if (/Chrome\//.test(ua) && !/(OPR\/|CriOS\/|Android|Mobile)/.test(ua) && !narrow) return { supported: true, name: "Chrome" };
  if (/Firefox\//.test(ua)) return { supported: false, name: "Firefox" };
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return { supported: false, name: "Safari" };
  return { supported: false, name: "browser" };
}

function downloadJson(bundle) {
  const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "my-lens-library.lens-library.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExtensionDownloadModal({ onClose, operators = [], generators = [], rackMeta = {} }) {
  const [support, setSupport] = useState(browserSupport);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState("");
  const closeRef = useRef(null);
  const size = formatBytes(release.bytes);
  const lensCount = operators.filter((operator) => operator?.id && !operator.primitive).length;
  const generatorItemCount = generators.reduce((sum, generator) => sum + (generator.items || generator.objects || []).length, 0);
  const storeUrl = import.meta.env.VITE_CHROME_WEB_STORE_URL;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 719px)");
    const update = () => setSupport(browserSupport());
    query.addEventListener("change", update);
    closeRef.current?.focus();
    return () => query.removeEventListener("change", update);
  }, []);

  function onKeyDown(event) {
    event.stopPropagation();
    if (event.key === "Escape") onClose();
  }

  async function makeBundle() {
    return createLensLibraryBundle({
      operators,
      generators,
      rackMeta,
      includePrivateSources: includePrivate,
    });
  }

  async function exportLibrary() {
    setExporting(true);
    setHandoffStatus("");
    try {
      downloadJson(await makeBundle());
      setHandoffStatus("Library downloaded. Import it from the extension side panel.");
    } catch (error) {
      setHandoffStatus(error.message);
    } finally {
      setExporting(false);
    }
  }

  async function sendLibrary() {
    setExporting(true);
    setHandoffStatus("");
    const bundle = await makeBundle();
    const extensionId = import.meta.env.VITE_LENS_EXTENSION_ID;
    if (!extensionId || !globalThis.chrome?.runtime?.sendMessage) {
      downloadJson(bundle);
      setHandoffStatus("Direct handoff is unavailable for this install. Library downloaded instead.");
      setExporting(false);
      return;
    }
    const nonce = crypto.randomUUID().replaceAll("-", "");
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(extensionId, { type: "lens-library-handoff", version: 1, nonce, bundle }, (value) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(value);
        });
      });
      if (!response?.ok) throw new Error(response?.error || "handoff was rejected");
      setHandoffStatus("Sent. Open Lens Everywhere to review and confirm the import.");
    } catch {
      downloadJson(bundle);
      setHandoffStatus("Extension handoff was unavailable. Library downloaded instead.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="modal-scrim extension-download-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extension-download-title"
      onClick={onClose}
      onKeyDown={onKeyDown}
    >
      <section className="modal extension-download-modal" onClick={(event) => event.stopPropagation()}>
        <div className="extension-download-head">
          <div>
            <p className="extension-download-kicker">Lens Everywhere · v{release.version}{size ? ` · ${size}` : ""}</p>
            <h3 id="extension-download-title">Use Lens on any page</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="extension-download-close"
            onClick={onClose}
            aria-label="Close extension download"
          >
            ×
          </button>
        </div>

        <p className="extension-download-intro">
          Capture selected material and send it through your Lens workspace from desktop Chrome.
        </p>

        {support.supported ? (
          <a className="extension-download-button" href={storeUrl || release.versionedUrl} download={!storeUrl}>
            {storeUrl ? `Add to ${support.name}` : `Download for ${support.name}`}
          </a>
        ) : (
          <div className="extension-download-desktop" role="status">
            {support.name === "Firefox" || support.name === "Safari"
              ? `${support.name} package is not signed or ready yet. Use desktop Chrome or Edge for the verified manual build.`
              : "Installation requires desktop Chrome or Edge. Open this page there to download the extension."}
          </div>
        )}

        <div className="extension-download-warning">
          Developer install: Chrome cannot install an unsigned ZIP directly from a website. Chrome Web Store
          installation will be offered after publication.
        </div>

        <ol className="extension-download-steps" aria-label="Developer installation steps">
          <li>Download the ZIP.</li>
          <li>Unzip it.</li>
          <li>Open <code>{support.name === "Edge" ? "edge://extensions" : "chrome://extensions"}</code>.</li>
          <li>Enable <strong>Developer mode</strong>.</li>
          <li>Choose <strong>Load unpacked</strong> and select the unzipped folder.</li>
        </ol>

        <section className="extension-library-export">
          <h4>Use my library in the extension</h4>
          <p>{lensCount} user lens{lensCount === 1 ? "" : "es"} · {generators.length} generator{generators.length === 1 ? "" : "s"} · {generatorItemCount} material item{generatorItemCount === 1 ? "" : "s"}</p>
          <p>Exports dependency closure, versions, composition/output contracts, rack metadata, generator structure and user-owned material. Tokens, board sync, companion memory, private grind examples, provenance, and raw captured pages are excluded by default.</p>
          <label>
            <input type="checkbox" checked={includePrivate} onChange={(event) => setIncludePrivate(event.target.checked)} />
            Include source provenance and private source fields after privacy review
          </label>
          <div>
            <button type="button" disabled={exporting} onClick={exportLibrary}>{exporting ? "Preparing…" : "Download library"}</button>
            <button type="button" disabled={exporting} onClick={sendLibrary}>Send library to extension</button>
          </div>
          {handoffStatus && <p role="status">{handoffStatus}</p>}
        </section>

        <nav className="extension-download-links" aria-label="Extension resources">
          <a href="/extension/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a>
          <a href="/extension/docs.html" target="_blank" rel="noreferrer">Extension documentation</a>
        </nav>
        {release.sha256 && <p className="extension-download-checksum">SHA-256 {release.sha256}</p>}
      </section>
    </div>
  );
}
