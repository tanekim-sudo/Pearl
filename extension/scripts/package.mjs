import fs from "node:fs";
import path from "node:path";
import { createWriteStream } from "node:fs";
import crypto from "node:crypto";
import { ZipArchive } from "archiver";

const root = path.resolve(import.meta.dirname, "..");
const releaseDir = path.join(root, "release");
const sourceDir = path.join(root, "dist/chrome");
const appPublicDir = path.resolve(root, "../client/public/downloads");
const extensionPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const versionedName = `lens-everywhere-chrome-v${extensionPackage.version}.zip`;
const latestName = "lens-everywhere-chrome-latest.zip";
const output = path.join(releaseDir, versionedName);
fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(appPublicDir, { recursive: true });
fs.rmSync(output, { force: true });

const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Chrome package must use Manifest V3");
if (manifest.version !== extensionPackage.version) {
  throw new Error(`manifest version ${manifest.version} does not match package version ${extensionPackage.version}`);
}
const files = fs.readdirSync(sourceDir, { recursive: true })
  .filter((file) => fs.statSync(path.join(sourceDir, file)).isFile())
  .sort();
const supplementalFiles = [{ name: "PRIVACY.md", source: path.join(root, "PRIVACY.md") }];
if (files.some((file) => /\.(map|pem|env)$/i.test(file))) throw new Error("package contains forbidden development or secret files");
if (files.length + supplementalFiles.length < 12) {
  throw new Error(`Chrome package unexpectedly contains only ${files.length + supplementalFiles.length} files`);
}

await new Promise((resolve, reject) => {
  const stream = createWriteStream(output);
  const archive = new ZipArchive({
    zlib: { level: 9 },
    forceLocalTime: false,
    platform: "UNIX",
  });
  stream.on("close", resolve);
  stream.on("error", reject);
  archive.on("error", reject);
  archive.pipe(stream);
  for (const file of files) {
    archive.append(fs.readFileSync(path.join(sourceDir, file)), {
      name: file.split(path.sep).join("/"),
      date: new Date("1980-01-01T00:00:00.000Z"),
      mode: 0o644,
    });
  }
  for (const file of supplementalFiles) {
    archive.append(fs.readFileSync(file.source), {
      name: file.name,
      date: new Date("1980-01-01T00:00:00.000Z"),
      mode: 0o644,
    });
  }
  archive.finalize();
});

for (const name of [versionedName, latestName]) {
  fs.copyFileSync(output, path.join(appPublicDir, name));
}

const bytes = fs.statSync(output).size;
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(output)).digest("hex");
fs.writeFileSync(
  path.join(appPublicDir, "release.json"),
  `${JSON.stringify({
    name: "Lens Everywhere",
    version: extensionPackage.version,
    browser: "chrome",
    bytes,
    sha256,
    installationType: "developer-mode-load-unpacked",
    buildCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
    versionedUrl: `/downloads/${versionedName}`,
    latestUrl: `/downloads/${latestName}`,
  }, null, 2)}\n`
);
console.log(`${output} (${files.length + supplementalFiles.length} files, ${bytes} bytes)`);
