import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_DENYLIST } from "../core/security.js";
import { createMessage } from "../core/messages.js";

function Options() {
  const [settings, setSettings] = useState({
    denylist: DEFAULT_DENYLIST.join("\n"),
    retention: "session",
    modelData: "selected-only",
    apiOrigin: "",
  });
  const [saved, setSaved] = useState(false);
  const [libraryStatus, setLibraryStatus] = useState("");

  useEffect(() => {
    chrome.storage.local.get(["denylist", "retention", "modelData", "apiOrigin"], (value) => {
      setSettings((current) => ({
        ...current,
        ...value,
        denylist: (value.denylist || DEFAULT_DENYLIST).join("\n"),
      }));
    });
  }, []);

  function update(key, value) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function save() {
    chrome.storage.local.set({
      ...settings,
      denylist: settings.denylist.split(/\n+/).map((item) => item.trim()).filter(Boolean),
    }, () => setSaved(true));
  }

  function deleteData() {
    if (!confirm("Delete extension selections, pending work, settings, and session credentials?")) return;
    chrome.storage.session.clear();
    chrome.storage.local.clear(() => location.reload());
  }

  async function importLibrary(file) {
    if (!file || file.size > 10 * 1024 * 1024) {
      setLibraryStatus("Choose a library file up to 10 MB.");
      return;
    }
    try {
      const bundle = JSON.parse(await file.text());
      const preview = await chrome.runtime.sendMessage(createMessage("library-import-preview", { bundle }));
      if (!preview?.ok) throw new Error(preview?.error);
      const counts = preview.value.counts;
      if (!confirm(`Import ${counts.lenses} lenses and ${counts.generators} generators? Duplicates are skipped and newer versions replace older versions.`)) return;
      const result = await chrome.runtime.sendMessage(createMessage("library-import", { bundle }));
      if (!result?.ok) throw new Error(result?.error);
      setLibraryStatus("Library imported.");
    } catch (error) {
      setLibraryStatus(error.message || "Invalid library file.");
    }
  }

  return <main>
    <h1>Pearl Everywhere settings</h1>
    <p>Highlighting stays in extension session storage. Nothing is sent until you press GO.</p>
    <label>Never capture on these domains<textarea rows="9" value={settings.denylist} onChange={(event) => update("denylist", event.target.value)} /></label>
    <label>Raw selection retention<select value={settings.retention} onChange={(event) => update("retention", event.target.value)}><option value="session">Until browser session ends</option><option value="navigation">Until page navigation</option></select></label>
    <label>Model data<select value={settings.modelData} onChange={(event) => update("modelData", event.target.value)}><option value="selected-only">Selected text only</option><option value="selected-context">Selected text plus requested context</option></select></label>
    <label>API origin (development only)<input value={settings.apiOrigin} placeholder="https://lens.app" onChange={(event) => update("apiOrigin", event.target.value)} /></label>
    <div><button onClick={save}>Save settings</button>{saved && <span> Saved</span>}</div>
    <hr />
    <h2>Site access</h2>
    <p>Pearl requests access only when you activate it on a site. Remove access any time in your browser’s extension settings.</p>
    <h2>Library</h2>
    <label>Import .lens-library.json or .lens.json<input type="file" accept=".json,.lens.json,.lens-library.json,application/json" onChange={(event) => importLibrary(event.target.files?.[0])} /></label>
    {libraryStatus && <p role="status">{libraryStatus}</p>}
    <h2>Delete data</h2>
    <button onClick={deleteData}>Delete all extension data</button>
  </main>;
}

const style = document.createElement("style");
style.textContent = "html{min-height:100%;background:radial-gradient(ellipse at 8% 0,rgba(170,211,200,.2),transparent 34%),radial-gradient(ellipse at 92% 12%,rgba(210,186,216,.18),transparent 34%),#e9ebe7}body{font:15px/1.5 Inter,system-ui;max-width:720px;margin:40px auto;padding:28px;color:#202524;background:rgba(255,255,252,.68);border:1px solid rgba(35,45,44,.08);border-radius:22px;box-shadow:0 28px 80px rgba(35,45,44,.12);backdrop-filter:blur(24px)}main,label{display:grid;gap:12px}h1{font-weight:560;letter-spacing:-.03em}label{font-weight:560}input,textarea,select,button{font:inherit;padding:10px 12px;border:1px solid rgba(35,45,44,.11);border-radius:12px;background:rgba(255,255,255,.48)}button{width:max-content;border-radius:999px;cursor:pointer}hr{width:100%;border:0;border-top:1px solid rgba(35,45,44,.08)}";
document.head.append(style);
createRoot(document.getElementById("root")).render(<Options />);
