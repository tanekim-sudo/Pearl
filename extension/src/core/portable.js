import { createLensPack } from "../../../shared/lens-rack.js";
import { sanitizeHtml } from "./security.js";

export const LENS_MIME = "application/vnd.lens.pack+json";

export function portableLensPayload(lens, operators, appOrigin = "https://lens.app") {
  const link = `${appOrigin}/?lens=${encodeURIComponent(lens.id)}`;
  const pack = createLensPack([lens.id], operators, { name: lens.name });
  const plain = `${lens.name}\n${lens.description || "Lens transformation"}\n${link}`;
  const html = sanitizeHtml(`<p><strong>${lens.name}</strong></p><p>${lens.description || ""}</p><p><a href="${link}">Open in Lens</a></p>`);
  return { plain, html, uri: link, pack };
}

export function writeDragPayload(dataTransfer, payload) {
  dataTransfer.setData("text/plain", payload.plain);
  dataTransfer.setData("text/html", payload.html);
  dataTransfer.setData("text/uri-list", payload.uri);
  dataTransfer.setData(LENS_MIME, JSON.stringify(payload.pack));
  dataTransfer.effectAllowed = "copy";
}

export function privacySafeGeneratorExport(generator, options = {}) {
  return {
    kind: "lens-generator-export",
    version: 1,
    id: generator.id,
    name: generator.name,
    summary: generator.summary || "",
    itemCount: Number(generator.itemCount) || 0,
    items: options.includeSource ? generator.items || [] : [],
    privacy: { sourceIncluded: !!options.includeSource },
    exportedAt: Date.now(),
  };
}
