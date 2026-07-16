import { contentFingerprint } from "./lens-grammar.js";
import { normalizeOutputSpec } from "./output-specifications.js";

export const MATERIAL_VERSION = 1;
export const MATERIAL_KINDS = Object.freeze(["text", "richText", "list", "table", "image", "link", "drawing", "json", "multimodal", "lensMaterial"]);
const KINDS = new Set(MATERIAL_KINDS);

const clone = (value) => value == null ? value : structuredClone(value);

export function createMaterial(value = {}, options = {}) {
  const kind = KINDS.has(value.kind || value.machineKind) ? value.kind || value.machineKind : "text";
  const content = value.content ?? value.text ?? value.value ?? "";
  const envelope = {
    kind: "material",
    version: MATERIAL_VERSION,
    id: String(value.id || options.id || globalThis.crypto?.randomUUID?.() || `material-${Date.now()}`),
    machineKind: kind,
    mime: String(value.mime || (kind === "json" ? "application/json" : kind === "image" ? "image/*" : "text/plain")),
    content: clone(content),
    representations: clone(value.representations || {}),
    outputSpec: value.outputSpec ? normalizeOutputSpec(value.outputSpec) : null,
    provenance: clone(value.provenance || null),
  };
  envelope.fingerprint = contentFingerprint({
    version: envelope.version,
    machineKind: envelope.machineKind,
    mime: envelope.mime,
    content: envelope.content,
    representations: envelope.representations,
    outputSpec: envelope.outputSpec,
  });
  return envelope;
}

const DIRECT = new Set([
  "text:text", "richText:richText", "list:list", "table:table", "image:image",
  "link:link", "drawing:drawing", "json:json", "multimodal:multimodal", "lensMaterial:lensMaterial",
]);

const DETERMINISTIC = Object.freeze({
  "richText:text": (value) => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  "list:text": (value) => (Array.isArray(value) ? value : [value]).map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join("\n"),
  "list:json": (value) => Array.isArray(value) ? value : [value],
  "table:json": (value) => value,
  "table:text": (value) => Array.isArray(value) ? value.map((row) => Array.isArray(row) ? row.join("\t") : JSON.stringify(row)).join("\n") : JSON.stringify(value),
  "json:text": (value) => JSON.stringify(value, null, 2),
  "link:text": (value) => typeof value === "string" ? value : String(value?.url || ""),
  "drawing:image": (value) => value?.rasterDataUrl || value?.dataUrl || value,
  "image:multimodal": (value) => ({ images: [value], text: "" }),
  "text:multimodal": (value) => ({ images: [], text: String(value) }),
});

export function resolveMaterialBridge(materialValue, target = {}) {
  const material = materialValue?.kind === "material" ? materialValue : createMaterial(materialValue);
  const targetKind = target.machineKind || target.type || "text";
  if (targetKind === "any" || DIRECT.has(`${material.machineKind}:${targetKind}`)) {
    return { status: "direct", material, bridge: null };
  }
  const adapter = DETERMINISTIC[`${material.machineKind}:${targetKind}`];
  if (adapter) {
    return {
      status: "adapted",
      material: createMaterial({
        machineKind: targetKind,
        content: adapter(material.content),
        provenance: { kind: "deterministic-material-bridge", source: material.fingerprint, from: material.machineKind, to: targetKind },
      }),
      bridge: { kind: "representation-adapter", version: 1, from: material.machineKind, to: targetKind, deterministic: true },
    };
  }
  return {
    status: "bridge-required",
    material,
    bridge: {
      kind: "bridge-move-draft",
      version: 1,
      from: material.machineKind,
      to: targetKind,
      name: `Bridge ${material.machineKind} → ${targetKind}`,
      prompt: `Convert the supplied ${material.machineKind} material into ${targetKind} without losing information.`,
      primitiveMove: false,
      requiredCapabilities: material.machineKind === "image" || material.machineKind === "drawing" ? ["vision"] : ["text"],
      provenance: { generated: true, editable: true, deterministic: false, source: material.fingerprint },
    },
  };
}

export function bundleMaterials(values = []) {
  const materials = values.map((value) => value?.kind === "material" ? value : createMaterial(value));
  return createMaterial({
    machineKind: "multimodal",
    content: materials.map((material) => ({ kind: material.machineKind, content: material.content, fingerprint: material.fingerprint })),
    provenance: { kind: "material-fan-in", sources: materials.map((material) => material.fingerprint) },
  });
}
