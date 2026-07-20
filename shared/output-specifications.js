export const OUTPUT_SPEC_VERSION = 1;
export const OUTPUT_SPEC_LIMITS = Object.freeze({
  depth: 24,
  branches: 64,
  label: 80,
  description: 600,
  instructions: 1200,
  schemaBytes: 8000,
});

export const OUTPUT_MACHINE_KINDS = Object.freeze([
  "text", "richText", "list", "table", "image", "link", "material", "multi",
]);

const KINDS = new Set(OUTPUT_MACHINE_KINDS);
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const RESERVED_LABELS = new Set(["output", "result", "undefined", "null", "multi-output"]);

const PRIMITIVE_SPECS = Object.freeze({
  compress: ["concise invariant summary", "text", "The smallest faithful statement of the source."],
  expand: ["expanded explanation", "richText", "A developed explanation with implications and useful detail."],
  explore: ["possibility map", "list", "Adjacent possibilities and promising directions."],
  research: ["annotated source brief", "richText", "A sourced brief preserving titles, URLs, dates, and snippets."],
  invert: ["counter-position", "text", "The strongest coherent inversion of the source position."],
  reframe: ["reframed perspective", "text", "The source expressed from a meaningfully different vantage point."],
  merge: ["structured synthesis", "richText", "One coherent structure synthesized from multiple inputs."],
  transcend: ["integrative resolution", "richText", "A higher-order resolution that preserves the useful tension."],
  branch: ["possibility map", "list", "Distinct grounded possibilities that preserve the source."],
  deepen: ["underlying-principles brief", "richText", "Assumptions, mechanisms, and principles linked to the source."],
  challenge: ["challenge brief", "richText", "Weak assumptions, counterevidence, failure modes, and the strongest opposition case."],
  embody: ["concrete examples", "list", "Observable examples and artifacts traceable to the source concept."],
});

const clone = (value) => value == null ? value : globalThis.structuredClone
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function plainData(value, depth = 0, seen = new WeakSet()) {
  if (depth > OUTPUT_SPEC_LIMITS.depth) throw new Error("output specification is too deep");
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error("output specification contains an unsupported value");
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error("output specification must contain only plain data");
  }
  if (seen.has(value)) throw new Error("output specification contains a cycle");
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error("output specification contains an unsafe key");
    plainData(value[key], depth + 1, seen);
  }
  seen.delete(value);
}

const bounded = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const titleCase = (value) => bounded(value, OUTPUT_SPEC_LIMITS.label)
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

function cardinality(value, fallback = 1) {
  const source = typeof value === "number" ? { min: value, max: value } : value || {};
  const min = Math.max(1, Math.min(64, Math.floor(Number(source.min ?? source.count) || fallback)));
  const max = Math.max(min, Math.min(64, Math.floor(Number(source.max ?? source.count) || min)));
  return { min, max };
}

function inferKind(text) {
  const value = String(text || "").toLowerCase();
  if (/\b(table|matrix|spreadsheet|scorecard)\b/.test(value)) return "table";
  if (/\b(list|checklist|options|counterexamples|ideas|bullets)\b/.test(value)) return "list";
  if (/\b(image|diagram|illustration|visual|map)\b/.test(value)) return "image";
  if (/\b(link|url|bookmark)\b/.test(value)) return "link";
  if (/\b(material|generator material|source fragment)\b/.test(value)) return "material";
  if (/\b(memo|brief|report|analysis|comparison|annotated|markdown|document)\b/.test(value)) return "richText";
  return "text";
}

export function inferSemanticOutput(op = {}) {
  const source = `${op.name || ""}\n${op.description || ""}\n${op.prompt || ""}`;
  const explicit = source.match(
    /(?:output|produce|return|create|write|draft|generate)(?:\s+(?:only|a|an|the|as|exactly))*\s+([a-z][a-z0-9 -]{2,60}?)(?:[.;,\n]|$)/i
  )?.[1];
  let semanticType = bounded(explicit, OUTPUT_SPEC_LIMITS.label);
  if (!semanticType) {
    semanticType = bounded(op.name, OUTPUT_SPEC_LIMITS.label)
      .replace(/^(?:make|build|create|generate|draft|write|produce|extract|turn into)\s+/i, "");
  }
  if (!semanticType) semanticType = op.kind === "pipeline" ? "finished deliverable" : "transformed text";
  semanticType = semanticType
    .replace(/\b(?:from|using|based on|for)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, OUTPUT_SPEC_LIMITS.label);
  return semanticType || "transformed text";
}

export function suggestedOutputSpec(op = {}) {
  const primitive = PRIMITIVE_SPECS[String(op.name || "").toLowerCase()];
  const semanticType = primitive?.[0] || inferSemanticOutput(op);
  const machineKind = primitive?.[1] || inferKind(`${semanticType} ${op.description || ""} ${op.prompt || ""}`);
  const count = Math.max(1, Math.min(64, Number(op.outputCount) || 1));
  return {
    version: OUTPUT_SPEC_VERSION,
    mode: "suggested",
    semanticType,
    machineKind,
    description: bounded(primitive?.[2] || op.outputDescription || "", OUTPUT_SPEC_LIMITS.description),
    instructions: bounded(op.outputInstructions || "", OUTPUT_SPEC_LIMITS.instructions),
    schema: null,
    cardinality: { min: count, max: count },
    branches: [],
  };
}

export function normalizeOutputSpec(raw, fallbackOp = {}, options = {}) {
  if (raw != null) plainData(raw);
  const suggested = suggestedOutputSpec(fallbackOp);
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const branches = Array.isArray(source.branches)
    ? source.branches.slice(0, OUTPUT_SPEC_LIMITS.branches).map((branch, index) => {
        const spec = normalizeOutputSpec(branch.spec || branch, {
          name: branch.label || branch.semanticType || `branch ${index + 1}`,
        }, { nested: true });
        return {
          id: bounded(branch.id || branch.branchId || `branch-${index + 1}`, 160),
          label: branch.label == null
            ? bounded(spec.semanticType || `branch ${index + 1}`, OUTPUT_SPEC_LIMITS.label)
            : bounded(branch.label, OUTPUT_SPEC_LIMITS.label),
          spec: { ...spec, branches: [], machineKind: spec.machineKind === "multi" ? "text" : spec.machineKind },
        };
      })
    : [];
  const schema = source.schema == null ? null : clone(source.schema);
  if (schema != null && JSON.stringify(schema).length > OUTPUT_SPEC_LIMITS.schemaBytes) {
    throw new Error("output schema is too large");
  }
  const machineKind = branches.length ? "multi" : KINDS.has(source.machineKind || source.kind)
    ? source.machineKind || source.kind
    : suggested.machineKind;
  const spec = {
    version: OUTPUT_SPEC_VERSION,
    mode: ["suggested", "custom", "derived", "override"].includes(source.mode) ? source.mode : suggested.mode,
    semanticType: bounded(source.semanticType || source.name || suggested.semanticType, OUTPUT_SPEC_LIMITS.label),
    machineKind,
    description: bounded(source.description ?? suggested.description, OUTPUT_SPEC_LIMITS.description),
    instructions: bounded(source.instructions ?? suggested.instructions, OUTPUT_SPEC_LIMITS.instructions),
    schema,
    cardinality: cardinality(source.cardinality, branches.length || suggested.cardinality.min),
    branches,
  };
  if (branches.length) {
    spec.semanticType = branches.map((branch) => titleCase(branch.label)).join(" AND ").slice(0, 512);
    spec.cardinality = { min: branches.length, max: branches.length };
  }
  if (!options.nested) {
    const validation = validateOutputSpec(spec);
    if (!validation.ok) throw new Error(validation.errors[0]);
  }
  return spec;
}

export function validateOutputSpec(spec) {
  const errors = [];
  try {
    plainData(spec);
  } catch (error) {
    errors.push(error.message);
    return { ok: false, errors };
  }
  if (spec?.version !== OUTPUT_SPEC_VERSION) errors.push("unsupported output specification version");
  if (!bounded(spec?.semanticType, OUTPUT_SPEC_LIMITS.label) && !spec?.branches?.length) errors.push("output type is required");
  if (!KINDS.has(spec?.machineKind)) errors.push("unsupported output machine kind");
  if (!spec?.cardinality || spec.cardinality.min < 1 || spec.cardinality.max < spec.cardinality.min || spec.cardinality.max > 64) {
    errors.push("output cardinality must be between 1 and 64");
  }
  const labels = new Set();
  for (const branch of spec?.branches || []) {
    const label = bounded(branch.label, OUTPUT_SPEC_LIMITS.label);
    const key = label.toLowerCase();
    if (!label) errors.push("branch output labels cannot be empty");
    else if (RESERVED_LABELS.has(key)) errors.push(`"${label}" is a reserved output label`);
    else if (labels.has(key)) errors.push(`duplicate branch output label "${label}"`);
    labels.add(key);
    if (!branch.id) errors.push("branch output requires a stable ID");
    if (branch.spec?.machineKind === "multi") errors.push("nested branch specifications cannot use multi kind");
  }
  if (spec?.machineKind === "multi" && !(spec.branches || []).length) errors.push("multi output requires branches");
  if (spec?.machineKind !== "multi" && (spec?.branches || []).length) errors.push("branch outputs require multi kind");
  return { ok: errors.length === 0, errors };
}

function terminalLeaves(op, opMap, state, path = []) {
  if (!op || state.depth > OUTPUT_SPEC_LIMITS.depth || state.leaves.length >= OUTPUT_SPEC_LIMITS.branches) return;
  if (state.visiting.has(op.id)) {
    state.cycles.push(op.id);
    return;
  }
  state.visiting.add(op.id);
  if (op.kind !== "pipeline" || !(op.steps || []).length) {
    state.leaves.push({ op, path: [...path, op.id] });
  } else {
    const steps = (op.steps || []).map((id) => opMap[id]).filter(Boolean);
    const forkIndex = steps.findIndex((step) => step?.fork);
    if (forkIndex >= 0) {
      const prefix = steps.slice(0, forkIndex);
      const fork = steps[forkIndex];
      const suffix = steps.slice(forkIndex + 1);
      for (const branchId of fork.steps || []) {
        const branch = opMap[branchId];
        if (suffix.length) {
          const last = suffix[suffix.length - 1];
          terminalLeaves(last, opMap, { ...state, depth: state.depth + 1 }, [...path, fork.id, branch?.id].filter(Boolean));
        } else {
          terminalLeaves(branch, opMap, { ...state, depth: state.depth + 1 }, [...path, fork.id]);
        }
      }
      if (!fork.steps?.length && prefix.length) terminalLeaves(prefix[prefix.length - 1], opMap, { ...state, depth: state.depth + 1 }, path);
    } else {
      terminalLeaves(steps[steps.length - 1], opMap, { ...state, depth: state.depth + 1 }, [...path, op.id]);
    }
  }
  state.visiting.delete(op.id);
}

export function deriveOutputSpec(op, opMap = {}) {
  const explicit = op?.outputSpec;
  if (explicit?.mode === "override" || explicit?.mode === "custom") return normalizeOutputSpec(explicit, op);
  const state = { visiting: new Set(), leaves: [], cycles: [], depth: 0 };
  terminalLeaves(op, { ...opMap, [op?.id]: op }, state);
  if (!state.leaves.length) return { ...suggestedOutputSpec(op), mode: "derived", derivation: { cycleDetected: !!state.cycles.length } };
  const branches = [];
  const identical = new Set();
  for (const leaf of state.leaves) {
    const child = leaf.op.outputSpec?.mode === "override" || leaf.op.outputSpec?.mode === "custom"
      ? normalizeOutputSpec(leaf.op.outputSpec, leaf.op)
      : suggestedOutputSpec(leaf.op);
    const identity = JSON.stringify([child.semanticType.toLowerCase(), child.machineKind, child.cardinality]);
    if (identical.has(identity)) continue;
    identical.add(identity);
    branches.push({
      id: `branch:${leaf.path.join(">")}`,
      label: child.semanticType,
      spec: { ...child, mode: child.mode === "custom" ? "custom" : "suggested", branches: [] },
    });
  }
  if (branches.length <= 1) {
    const single = branches[0]?.spec || suggestedOutputSpec(op);
    return { ...single, mode: "derived", derivation: { terminalIds: state.leaves.map((entry) => entry.op.id), cycleDetected: !!state.cycles.length } };
  }
  return normalizeOutputSpec({
    version: OUTPUT_SPEC_VERSION,
    mode: "derived",
    machineKind: "multi",
    branches,
    derivation: { terminalIds: state.leaves.map((entry) => entry.op.id), cycleDetected: !!state.cycles.length },
  }, op);
}

export function outputContractFor(op, opMap = {}) {
  return normalizeOutputSpec(
    op?.outputSpec?.mode === "override" || op?.outputSpec?.mode === "custom"
      ? op.outputSpec
      : deriveOutputSpec(op, opMap),
    op
  );
}

export function outputContractLabel(specOrOp, opMap = {}) {
  const spec = specOrOp?.version === OUTPUT_SPEC_VERSION && specOrOp?.machineKind
    ? normalizeOutputSpec(specOrOp)
    : outputContractFor(specOrOp, opMap);
  return spec.branches.length
    ? spec.branches.map((branch) => titleCase(branch.label)).join(" AND ")
    : titleCase(spec.semanticType);
}

export function outputContractPrompt(specOrOp, opMap = {}) {
  const spec = specOrOp?.version === OUTPUT_SPEC_VERSION && specOrOp?.machineKind
    ? normalizeOutputSpec(specOrOp)
    : outputContractFor(specOrOp, opMap);
  const lines = [`OUTPUT SPECIFICATION v${spec.version}: ${outputContractLabel(spec)}`];
  if (spec.branches.length) {
    lines.push("Return each branch as a separate output in this exact order:");
    spec.branches.forEach((branch, index) => {
      lines.push(`${index + 1}. ${branch.label} [${branch.spec.machineKind}; ${branch.id}]${branch.spec.instructions ? ` — ${branch.spec.instructions}` : ""}`);
    });
  } else {
    lines.push(`Machine kind: ${spec.machineKind}. Cardinality: ${spec.cardinality.min}${spec.cardinality.max !== spec.cardinality.min ? `-${spec.cardinality.max}` : ""}.`);
    if (spec.description) lines.push(`Description: ${spec.description}`);
    if (spec.instructions) lines.push(`Instructions: ${spec.instructions}`);
  }
  lines.push("Conform to this contract. Do not emit meta commentary about the contract.");
  return `[${lines.join("\n")}]`;
}

export function resetOutputSpec(op, opMap = {}) {
  const suggested = op?.kind === "pipeline" ? deriveOutputSpec({ ...op, outputSpec: undefined }, opMap) : suggestedOutputSpec(op);
  return { ...suggested, mode: op?.kind === "pipeline" ? "derived" : "suggested" };
}

export function migrateOperatorOutputSpecs(operators = []) {
  const first = operators.filter(Boolean).map((op) => ({ ...op }));
  const map = Object.fromEntries(first.map((op) => [op.id, op]));
  return first.map((op) => {
    let outputSpec;
    try {
      outputSpec = op.outputSpec
        ? normalizeOutputSpec(op.outputSpec, op)
        : op.kind === "pipeline"
          ? deriveOutputSpec(op, map)
          : suggestedOutputSpec(op);
    } catch {
      outputSpec = suggestedOutputSpec(op);
    }
    return {
      ...op,
      outputSpec,
      outputType: op.outputType || (outputSpec.machineKind === "multi" ? "text" : outputSpec.machineKind),
      outputCount: op.outputCount || outputSpec.cardinality.max,
    };
  });
}

export function typedExecutionOutputs(values, specOrOp, opMap = {}, options = {}) {
  const spec = specOrOp?.version === OUTPUT_SPEC_VERSION && specOrOp?.machineKind
    ? normalizeOutputSpec(specOrOp)
    : outputContractFor(specOrOp, opMap);
  const list = Array.isArray(values) ? values : [values];
  return list.slice(0, 64).map((value, index) => {
    const branch = spec.branches[index] || null;
    const branchSpec = branch?.spec || spec;
    const branchId = branch?.id || null;
    const stableSeed = `${options.runId || "run"}:${branchId || "single"}:${index}`;
    return {
      id: options.idFactory?.(stableSeed) || stableSeed,
      text: String(value?.text ?? value?.output ?? value ?? ""),
      html: String(value?.html || ""),
      outputSpec: clone(branchSpec),
      semanticType: branch?.label || branchSpec.semanticType,
      machineKind: branchSpec.machineKind,
      branchId,
      branchIndex: branch ? index : null,
      provenance: { branchId, branchIndex: branch ? index : null, terminalId: options.terminalIds?.[index] || null },
      lineage: clone(value?.lineage || []),
    };
  });
}
