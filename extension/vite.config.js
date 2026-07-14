import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist/chrome",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(import.meta.dirname, "sidepanel.html"),
        options: path.resolve(import.meta.dirname, "options.html"),
        background: path.resolve(import.meta.dirname, "src/background/service-worker.js"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
