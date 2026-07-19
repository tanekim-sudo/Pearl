import React, { useEffect, useRef, useState } from "react";
import { createLensLibraryBundle } from "../../shared/lens-library.js";
import { detectExtensionBrowser, trackExtensionFunnel, validChromeStoreUrl } from "../lib/extension-funnel.js";

const release = __LENS_EXTENSION_RELEASE__;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  const support = detectExtensionBrowser(typeof navigator === "undefined" ? "" : navigator.userAgent);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState("");
  const [installState, setInstallState] = useState("unknown");
  const [checking, setChecking] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const closeRef = useRef(null);
  const size = formatBytes(release.bytes);
  const lensCount = operators.filter((operator) => operator?.id && !operator.primitive).length;
  const generatorItemCount = generators.reduce((sum, generator) => sum + (generator.items || generator.objects || []).length, 0);
  const storeUrl = validChromeStoreUrl(import.meta.env.VITE_CHROME_WEB_STORE_URL);
  const extensionId = import.meta.env.VITE_LENS_EXTENSION_ID;
  const extensionsUrl = support.name === "Edge" ? "edge://extensions" : "chrome://extensions";
  const folderName = `lens-everywhere-chrome-v${release.version}`;

  useEffect(() => {
    closeRef.current?.focus();
    trackExtensionFunnel("view_install", { mode: storeUrl ? "store" : "manual" });
    checkInstallation(false);
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

  function externalMessage(type, extra = {}) {
    if (!extensionId || !globalThis.chrome?.runtime?.sendMessage) return Promise.reject(new Error("unavailable"));
    const nonce = crypto.randomUUID().replaceAll("-", "");
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(extensionId, { type, version: 1, nonce, ...extra }, (value) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!value?.ok) reject(new Error(value?.error || "Lens did not respond"));
        else resolve(value.value);
      });
    });
  }

  async function checkInstallation(announce = true) {
    setChecking(true);
    if (announce) {
      setHandoffStatus("Checking for Lens…");
      trackExtensionFunnel("check_installed");
    }
    try {
      await externalMessage("lens-install-check");
      setInstallState("installed");
      if (announce) setHandoffStatus("Lens is installed and ready.");
    } catch {
      setInstallState("unknown");
      if (announce) setHandoffStatus("We couldn’t confirm it. Lens may still be installed.");
    } finally {
      setChecking(false);
    }
  }

  async function downloadExtension(event) {
    event.preventDefault();
    setInstructions(true);
    setDownloadStatus("Starting download…");
    trackExtensionFunnel("install_cta", { mode: "manual" });
    trackExtensionFunnel("instructions_viewed");
    try {
      const response = await fetch(release.versionedUrl);
      if (!response.ok) throw new Error("Download failed");
      const total = Number(response.headers.get("content-length")) || release.bytes || 0;
      const reader = response.body?.getReader();
      const chunks = [];
      let received = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setDownloadStatus(total ? `Downloading… ${Math.min(100, Math.round(received / total * 100))}%` : "Downloading…");
        }
      }
      const blob = reader ? new Blob(chunks, { type: "application/zip" }) : await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = release.versionedUrl.split("/").pop();
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadStatus("Downloaded. Finish the 3 steps below.");
      trackExtensionFunnel("download");
    } catch {
      const anchor = document.createElement("a");
      anchor.href = release.versionedUrl;
      anchor.download = "";
      anchor.click();
      setDownloadStatus("Download started. If it did not, use Re-download.");
    }
  }

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setDownloadStatus(`${label} copied.`);
    } catch {
      setDownloadStatus(`Copy failed. Select and copy ${value}.`);
    }
  }

  async function moveLibrary() {
    setExporting(true);
    setHandoffStatus("");
    const bundle = await makeBundle();
    try {
      const response = await externalMessage("lens-library-handoff", { bundle });
      setInstallState("installed");
      setHandoffStatus(response.imported
        ? `${response.counts.lenses} Moves/Functions and ${response.counts.generators} Lenses are ready.`
        : "Open Pearl to review one import choice.");
    } catch {
      downloadJson(bundle);
      setHandoffStatus("Next: open Lens and drop this file.");
    } finally {
      trackExtensionFunnel("library_transferred", { mode: installState === "installed" ? "direct" : "download" });
      setExporting(false);
    }
  }

  async function openLens() {
    try {
      await externalMessage("lens-extension-open");
      setHandoffStatus("Lens opened.");
    } catch {
      setHandoffStatus("Click the Lens icon in Chrome to open it.");
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
            <p className="extension-download-kicker">Pearl Everywhere · v{release.version}{size ? ` · ${size}` : ""}</p>
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

        {installState === "installed" ? (
          <div className="extension-installed-actions">
            <button className="extension-download-button" type="button" onClick={openLens}>Open Pearl</button>
            <button type="button" onClick={moveLibrary} disabled={exporting}>{exporting ? "Sending…" : "Send my library"}</button>
          </div>
        ) : support.supported ? (
          storeUrl ? (
            <a className="extension-download-button" href={storeUrl} onClick={() => trackExtensionFunnel("install_cta", { mode: "store" })}>
              Add Pearl to Chrome
            </a>
          ) : (
            <a className="extension-download-button" href={release.versionedUrl} onClick={downloadExtension}>
              Download for Chrome
            </a>
          )
        ) : (
          <div className="extension-download-desktop" role="status">
            {support.name === "Firefox" || support.name === "Safari"
              ? `Lens is not available for ${support.name} yet. Use desktop Chrome or Edge.`
              : "Open this page in desktop Chrome or Edge to install Lens."}
          </div>
        )}
        {support.name === "Edge" && <p className="extension-browser-note">Using Edge? The same Chrome extension works there.</p>}

        {!storeUrl && support.supported && !instructions && (
          <p className="extension-manual-note">Chrome requires a short manual setup until Lens is published in the Chrome Web Store.</p>
        )}

        {instructions && installState !== "installed" && <section className="extension-setup-card" aria-labelledby="extension-setup-title">
          <div className="extension-setup-heading">
            <div><span>2 minutes</span><h4 id="extension-setup-title">Finish setup</h4></div>
            <button type="button" onClick={() => setInstructions(false)} aria-label="Collapse setup instructions">−</button>
          </div>
          <div className="extension-walkthrough" aria-hidden="true">
            <i>ZIP</i><b>→</b><i>▣</i><b>→</b><i className="extension-walkthrough-pin">Pearl</i>
          </div>
          <ol className="extension-download-steps" aria-label="Developer installation steps">
            <li><b>Unzip</b> the downloaded file.</li>
            <li><b>Copy and paste</b> <code>{extensionsUrl}</code> into the address bar.</li>
            <li>Turn on <b>Developer mode</b>, choose <b>Load unpacked</b>, then select <code>{folderName}</code>.</li>
          </ol>
          <p className="extension-security-note">Chrome blocks websites from opening its settings page, so we copy the address for you.</p>
          <div className="extension-setup-actions">
            <button type="button" onClick={() => copy(extensionsUrl, extensionsUrl)}>Copy extension settings</button>
            <button type="button" onClick={() => copy(folderName, "Folder name")}>Copy folder name</button>
            <a href={release.versionedUrl} download onClick={() => trackExtensionFunnel("download")}>Re-download</a>
            <button type="button" onClick={() => checkInstallation()} disabled={checking}>{checking ? "Checking…" : "Check installation"}</button>
          </div>
          {downloadStatus && <p role="status" className="extension-download-status">{downloadStatus}</p>}
        </section>}

        <section className="extension-library-export">
          <div><h4>Take your library with you</h4><p>{lensCount} Move/Function record{lensCount === 1 ? "" : "s"} and {generators.length} Lens{generators.length === 1 ? "" : "es"} ready to move.</p></div>
          <button className={installState === "installed" ? "extension-library-primary" : ""} type="button" disabled={exporting} onClick={moveLibrary}>{exporting ? "Preparing…" : "Move my library to Lens"}</button>
          <details>
            <summary>Privacy options</summary>
            <p>Your account, private examples, and captured pages are never included. {generatorItemCount} saved material item{generatorItemCount === 1 ? "" : "s"} may be included.</p>
            <label>
              <input type="checkbox" checked={includePrivate} onChange={(event) => setIncludePrivate(event.target.checked)} />
              Include saved source details
            </label>
          </details>
          {handoffStatus && <p role="status">{handoffStatus}</p>}
          {handoffStatus.startsWith("Next:") && <div className="extension-drop-next" aria-label="Next step: drop the library file into Pearl"><span>↓</span><b>Drop .lens-library.json in Pearl</b></div>}
        </section>

        <nav className="extension-download-links" aria-label="Extension resources">
          <button type="button" onClick={() => checkInstallation()} disabled={checking}>{checking ? "Checking installation…" : "Check installation"}</button>
          <a href="/extension/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a>
          <a href="/extension/docs.html" target="_blank" rel="noreferrer">Help</a>
        </nav>
        {release.sha256 && <p className="extension-download-checksum">SHA-256 {release.sha256}</p>}
      </section>
    </div>
  );
}
