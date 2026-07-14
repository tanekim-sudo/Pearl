import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dist = path.join(repo, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(repo, "extension/package.json"), "utf8"));
const versionedName = `lens-everywhere-chrome-v${pkg.version}.zip`;
const latestName = "lens-everywhere-chrome-latest.zip";
const versionedPath = path.join(dist, "downloads", versionedName);
const latestPath = path.join(dist, "downloads", latestName);

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (openError, zip) => {
      if (openError) return reject(openError);
      const entries = [];
      let manifest = null;
      zip.readEntry();
      zip.on("entry", (entry) => {
        entries.push(entry.fileName);
        if (entry.fileName !== "manifest.json") return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError);
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            manifest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve({ entries, manifest }));
      zip.on("error", reject);
    });
  });
}

test("production build emits synchronized safe Chrome archives", async () => {
  assert.ok(fs.existsSync(versionedPath), `missing ${versionedPath}; run npm run build`);
  assert.ok(fs.existsSync(latestPath), `missing ${latestPath}; run npm run build`);
  assert.equal(sha256(versionedPath), sha256(latestPath));

  const { entries, manifest } = await readZip(versionedPath);
  assert.ok(entries.length >= 12, `expected 12+ packaged files, got ${entries.length}`);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, pkg.version);
  assert.ok(entries.includes("assets/background.js"));
  assert.ok(entries.includes("sidepanel.html"));
  assert.equal(entries.some((name) => /(?:^|\/)\.env|\.map$|\.pem$/i.test(name)), false);

  const metadata = JSON.parse(fs.readFileSync(path.join(dist, "downloads/release.json"), "utf8"));
  assert.equal(metadata.version, pkg.version);
  assert.equal(metadata.versionedUrl, `/downloads/${versionedName}`);
  assert.equal(metadata.bytes, fs.statSync(versionedPath).size);
  assert.equal(metadata.sha256, sha256(versionedPath));
  assert.equal(metadata.browser, "chrome");
  assert.equal(metadata.installationType, "developer-mode-load-unpacked");
});

test("download responses have attachment, cache, size, and checksum contracts", async (t) => {
  const server = http.createServer((request, response) => {
    const name = path.basename(new URL(request.url, "http://localhost").pathname);
    const file = path.join(dist, "downloads", name);
    if (![versionedName, latestName].includes(name) || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Content-Type", "application/zip");
    response.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    response.setHeader(
      "Cache-Control",
      name === latestName ? "public, max-age=300, must-revalidate" : "public, max-age=31536000, immutable"
    );
    response.setHeader("Content-Length", fs.statSync(file).size);
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  for (const name of [versionedName, latestName]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/downloads/${name}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/zip");
    assert.match(response.headers.get("content-disposition"), /^attachment;/);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.length, fs.statSync(path.join(dist, "downloads", name)).size);
    assert.equal(crypto.createHash("sha256").update(body).digest("hex"), sha256(path.join(dist, "downloads", name)));
    assert.match(
      response.headers.get("cache-control"),
      name === latestName ? /max-age=300/ : /immutable/
    );
  }
});

test("download UI is linked, responsive, and exposes accessible install guidance", () => {
  const component = fs.readFileSync(path.join(repo, "client/components/ExtensionDownloadModal.jsx"), "utf8");
  const styles = fs.readFileSync(path.join(repo, "client/styles.css"), "utf8");
  const toolbar = fs.readFileSync(path.join(repo, "client/components/TopToolbar.jsx"), "utf8");
  assert.match(toolbar, /Get Lens Everywhere/);
  assert.match(component, /release\.versionedUrl/);
  assert.match(component, /VITE_CHROME_WEB_STORE_URL/);
  assert.match(component, /Add Lens to Chrome/);
  assert.match(component, /Download for Chrome/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /Developer installation steps/);
  assert.match(component, /desktop Chrome or Edge/);
  assert.match(component, /Move my library to Lens/);
  assert.match(component, /Check installation/);
  assert.match(component, /Chrome blocks websites from opening its settings page/);
  assert.match(component, /\/extension\/privacy\.html/);
  assert.match(component, /\/extension\/docs\.html/);
  assert.match(styles, /@media \(max-width: 719px\)/);
  assert.ok(fs.existsSync(path.join(dist, "extension/privacy.html")));
  assert.ok(fs.existsSync(path.join(dist, "extension/docs.html")));
});

test("Vercel headers preserve immutable versioned and short-cache latest downloads", () => {
  const vercel = fs.readFileSync(path.join(repo, "vercel.json"), "utf8");
  assert.match(vercel, /lens-everywhere-chrome-v/);
  assert.match(vercel, /application\/zip/);
  assert.match(vercel, /Content-Disposition/);
  assert.match(vercel, /max-age=31536000, immutable/);
  assert.match(vercel, /max-age=300, must-revalidate/);
});
