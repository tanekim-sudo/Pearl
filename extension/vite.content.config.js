import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  publicDir: false,
  build: {
    outDir: "dist/chrome/assets",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/content/bridge.js"),
      name: "LensEverywhereContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
