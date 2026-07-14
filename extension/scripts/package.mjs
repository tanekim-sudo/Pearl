import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const releaseDir = path.join(root, "release");
const sourceDir = path.join(root, "dist/chrome");
const output = path.join(releaseDir, "lens-everywhere-chrome-v1.0.0.zip");
fs.mkdirSync(releaseDir, { recursive: true });
fs.rmSync(output, { force: true });

const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Chrome package must use Manifest V3");
const files = fs.readdirSync(sourceDir, { recursive: true }).filter((file) => fs.statSync(path.join(sourceDir, file)).isFile());
if (files.some((file) => /\.(map|pem|env)$/i.test(file))) throw new Error("package contains forbidden development or secret files");

const result = spawnSync("zip", ["-q", "-r", output, "."], { cwd: sourceDir, stdio: "inherit" });
if (result.status !== 0) throw new Error("zip command failed");
console.log(`${output} (${files.length} files)`);
