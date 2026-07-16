export const DEPRECATED_API_VERSION = 1;

export const DEPRECATED_APIS = Object.freeze({
  taxonomy: Object.freeze({
    "function:atomic": "move",
    "lens:process": "function",
    generator: "lens",
  }),
  fields: Object.freeze({
    primitive: "primitiveMove",
    generators: "lenses (storage adapter only)",
    "libraryKind:function+prompt": "libraryKind:move",
    "libraryKind:lens+pipeline": "libraryKind:function",
  }),
  commands: Object.freeze({
    createAtomicFunction: "createMove",
    captureLineageAsLens: "captureLineageAsFunction",
    newGenerator: "createLens",
    saveExternalCaptureAsFunction: "saveExternalCaptureAsMove",
  }),
});

export function deprecatedApiTarget(group, name) {
  return DEPRECATED_APIS[group]?.[name] || null;
}
