import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const extensionPackage = JSON.parse(
  fs.readFileSync(new URL("./extension/package.json", import.meta.url), "utf8")
);
const versionedName = `lens-everywhere-chrome-v${extensionPackage.version}.zip`;
const publicArtifact = path.resolve("client/public/downloads", versionedName);
const metadataPath = path.resolve("client/public/downloads/release.json");
const releaseMetadata = fs.existsSync(metadataPath)
  ? JSON.parse(fs.readFileSync(metadataPath, "utf8"))
  : {};
const extensionRelease = {
  ...releaseMetadata,
  version: extensionPackage.version,
  bytes: fs.existsSync(publicArtifact) ? fs.statSync(publicArtifact).size : null,
  versionedUrl: `/downloads/${versionedName}`,
  latestUrl: "/downloads/lens-everywhere-chrome-latest.zip",
};

export default defineConfig({
  plugins: [react()],
  root: "client",
  define: {
    __LENS_EXTENSION_RELEASE__: JSON.stringify(extensionRelease),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
