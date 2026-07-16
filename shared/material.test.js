import test from "node:test";
import assert from "node:assert/strict";
import { bundleMaterials, createMaterial, MATERIAL_KINDS, resolveMaterialBridge } from "./material.js";

test("normalizes every universal Material kind", () => {
  for (const machineKind of MATERIAL_KINDS) {
    const material = createMaterial({ machineKind, content: machineKind }, { id: machineKind });
    assert.equal(material.kind, "material");
    assert.equal(material.machineKind, machineKind);
    assert.ok(material.fingerprint);
  }
});

test("bundles mixed material without flattening representations", () => {
  const bundle = bundleMaterials([
    createMaterial({ machineKind: "text", content: "note" }, { id: "text" }),
    createMaterial({ machineKind: "image", content: "data:image/png;base64,AA" }, { id: "image" }),
  ]);
  assert.equal(bundle.machineKind, "multimodal");
  assert.deepEqual(bundle.content.map((entry) => entry.kind), ["text", "image"]);
});

test("unsupported representation remains valid with an explicit Bridge Move prerequisite", () => {
  const bridge = resolveMaterialBridge(createMaterial({ machineKind: "drawing", content: { strokes: [] } }), { machineKind: "table" });
  assert.equal(bridge.status, "bridge-required");
  assert.equal(bridge.bridge.kind, "bridge-move-draft");
  assert.equal(bridge.bridge.primitiveMove, false);
  assert.match(bridge.bridge.name, /drawing → table/);
});
