import { importLensLibrary, prepareLibraryInput, previewLibraryImport } from "../../../shared/lens-library.js";
import { BrowserPlatform } from "../platform/browser-platform.js";

const KEY = "lensEverywhereLibrary";
const empty = () => ({ operators: [], generators: [], rack: {}, importedBundles: [], updatedAt: 0 });

export async function readLocalLibrary() {
  const stored = await BrowserPlatform.storage.get("local", [KEY]);
  return { ...empty(), ...(stored[KEY] || {}) };
}

export async function writeLocalLibrary(value) {
  const next = { ...empty(), ...value, updatedAt: Date.now() };
  await BrowserPlatform.storage.set("local", { [KEY]: next });
  return next;
}

export async function previewLibraryFile(raw) {
  const prepared = await prepareLibraryInput(raw);
  if (!prepared.ok) throw new Error(prepared.error);
  const local = await readLocalLibrary();
  return {
    bundle: prepared.bundle,
    counts: prepared.counts,
    conflicts: previewLibraryImport(prepared.bundle, local.operators, local.generators),
  };
}

export async function importLibraryFile(raw, choices = {}) {
  const prepared = await prepareLibraryInput(raw);
  if (!prepared.ok) throw new Error(prepared.error);
  const current = await readLocalLibrary();
  const imported = importLensLibrary(
    prepared.bundle,
    current.operators,
    current.generators,
    choices,
    () => crypto.randomUUID()
  );
  const importedBundles = [...new Set([...current.importedBundles, prepared.bundle.integrity.payloadHash])];
  return writeLocalLibrary({
    operators: imported.operators,
    generators: imported.generators,
    rack: { ...current.rack, ...(prepared.bundle.rack || {}) },
    importedBundles,
  });
}

export async function mergeRemoteLibrary(remote = {}) {
  const current = await readLocalLibrary();
  const operators = [...current.operators];
  const operatorIds = new Set(operators.map((entry) => entry.id));
  for (const operator of remote.operators || []) {
    const index = operators.findIndex((entry) => entry.id === operator.id);
    if (index < 0) {
      operators.push(operator);
      operatorIds.add(operator.id);
    } else if ((Number(operator.version) || 1) > (Number(operators[index].version) || 1)) {
      operators[index] = operator;
    }
  }
  const generators = [...current.generators];
  for (const generator of remote.generators || []) {
    const index = generators.findIndex((entry) => entry.id === generator.id);
    if (index < 0) generators.push(generator);
    else if ((Number(generator.version) || 1) > (Number(generators[index].version) || 1)) generators[index] = generator;
  }
  return writeLocalLibrary({ ...current, operators, generators });
}
