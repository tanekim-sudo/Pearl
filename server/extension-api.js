import crypto from "node:crypto";
import { TRANSFORM_PRIMITIVES } from "../shared/transform-primitives.js";
import { lensRackRecord } from "../shared/lens-rack.js";
import { createProvenance } from "../shared/lens-runtime.js";
import { runExecutionPlan } from "./executor.js";
import { sanitizeLibraryValue } from "../shared/lens-library.js";
import { buildBranchPlan, operatorHasFork } from "../shared/operator-branching.js";
import {
  migrateOperatorOutputSpecs,
  normalizeOutputSpec,
  outputContractFor,
  outputContractPrompt,
  typedExecutionOutputs,
} from "../shared/output-specifications.js";
import { getAdminClient, isServerSupabaseConfigured, verifyRequestUser } from "./supabase-auth.js";
import { readIdempotent, writeIdempotent } from "./http-security.js";

const OPERATORS_KEY = "lens.board.operators.v2";
const GENERATORS_KEY = "lens.lenses.v2";
const RACK_KEY = "lens.rack.meta.v1";
const HARD_SELECTION_LIMIT = 120_000;
const LOCAL_ARTIFACTS = new Map();

const parse = (value, fallback) => {
  try { return typeof value === "string" ? JSON.parse(value) : value ?? fallback; } catch { return fallback; }
};

function production() {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
}

export async function requireExtensionUser(req, res) {
  const verified = req.lensUser || await verifyRequestUser(req);
  if (verified) {
    req.lensUser = verified;
    return verified;
  }
  if (!production() && !isServerSupabaseConfigured()) {
    const local = { user: { id: "local-development" }, plan: { kind: "paid" }, local: true };
    req.lensUser = local;
    return local;
  }
  res.status(isServerSupabaseConfigured() ? 401 : 503).json({
    error: isServerSupabaseConfigured() ? "Sign in required for extension APIs." : "Authentication service is not configured.",
  });
  return null;
}

async function snapshotFor(userId) {
  const client = getAdminClient();
  if (!client || userId === "local-development") return {};
  const { data, error } = await client.from("board_snapshots").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Unable to load Lens library.");
  return data?.data || {};
}

export async function extensionLibrary(req, res) {
  const identity = await requireExtensionUser(req, res);
  if (!identity) return;
  let snapshot = await snapshotFor(identity.user.id);
  if (req.method === "POST") {
    const incomingOperators = req.body?.operators;
    const incomingGenerators = req.body?.generators;
    if (!Array.isArray(incomingOperators) || incomingOperators.length > 1000 || !Array.isArray(incomingGenerators) || incomingGenerators.length > 100) {
      return res.status(400).json({ error: "invalid library sync payload" });
    }
    try {
      for (const operator of incomingOperators) {
        if (operator?.outputSpec) normalizeOutputSpec(operator.outputSpec, operator);
      }
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const mergeByVersion = (remote, incoming) => {
      const merged = new Map(remote.map((entry) => [entry.id, entry]));
      for (const entry of incoming) {
        if (!entry?.id) continue;
        const prior = merged.get(entry.id);
        if (!prior || (Number(entry.version) || 1) >= (Number(prior.version) || 1)) merged.set(entry.id, sanitizeLibraryValue(entry));
      }
      return [...merged.values()];
    };
    const operators = mergeByVersion(parse(snapshot[OPERATORS_KEY], []), incomingOperators.filter((entry) => !entry.primitive));
    const generators = mergeByVersion(parse(snapshot[GENERATORS_KEY], []), incomingGenerators);
    const next = {
      ...snapshot,
      [OPERATORS_KEY]: operators,
      [GENERATORS_KEY]: generators,
      [RACK_KEY]: { ...parse(snapshot[RACK_KEY], {}), ...sanitizeLibraryValue(req.body?.rack || {}) },
    };
    const client = getAdminClient();
    if (!client || identity.user.id === "local-development") snapshot = next;
    else {
      const { error } = await client.from("board_snapshots").upsert(
        { user_id: identity.user.id, data: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw new Error("Unable to sync Lens library.");
      snapshot = next;
    }
  }
  const stored = parse(snapshot[OPERATORS_KEY], []);
  const rack = parse(snapshot[RACK_KEY], {});
  const byId = new Map([...TRANSFORM_PRIMITIVES, ...stored].map((op) => [op.id, op]));
  const operators = migrateOperatorOutputSpecs([...byId.values()]).map((operator) => ({
    ...operator,
    rack: lensRackRecord(operator, rack[operator.id] || {}),
  }));
  const generators = parse(snapshot[GENERATORS_KEY], []).map((entry) => {
    const safe = sanitizeLibraryValue(entry);
    return {
      ...safe,
      id: entry.id,
      name: entry.title || entry.name || "Lens",
      summary: entry.description || entry.interpretation?.summary || "",
      itemCount: (entry.objects || entry.items || []).length,
      updatedAt: entry.updatedAt || entry.createdAt || 0,
    };
  });
  res.json({ version: 1, operators, generators });
}

function validateExecutionBody(body) {
  if (body?.kind !== "lens-execution-request" || body?.version !== 1) throw Object.assign(new Error("invalid execution request"), { status: 400 });
  if (!Array.isArray(body.fragments) || !body.fragments.length) throw Object.assign(new Error("at least one fragment is required"), { status: 400 });
  const characters = body.fragments.reduce((sum, fragment) => sum + String(fragment.quote || "").length, 0);
  if (characters > HARD_SELECTION_LIMIT) throw Object.assign(new Error("selection exceeds 120,000 characters"), { status: 413 });
  if (characters !== body.disclosure?.characters) throw Object.assign(new Error("disclosure character count mismatch"), { status: 409 });
  if (!Array.isArray(body.queue) || body.queue.length > 12) throw Object.assign(new Error("queue must contain at most 12 lenses"), { status: 400 });
  return characters;
}

export async function extensionExecute(req, res) {
  const identity = await requireExtensionUser(req, res);
  if (!identity) return;
  const existing = readIdempotent(req);
  if (existing) return res.json(existing);
  validateExecutionBody(req.body);
  const snapshot = await snapshotFor(identity.user.id);
  const operators = migrateOperatorOutputSpecs([...TRANSFORM_PRIMITIVES, ...parse(snapshot[OPERATORS_KEY], [])]);
  const opMap = Object.fromEntries(operators.map((op) => [op.id, op]));
  const queue = req.body.queue.map((entry) => opMap[entry.id]);
  if (queue.some((op) => !op)) return res.status(409).json({ error: "queued lens is unavailable or changed" });
  let values = req.body.fragments.map((fragment) => ({ text: fragment.quote, lineage: [] }));
  const runId = crypto.randomUUID();
  async function executeOne(op, input) {
    const contract = outputContractFor(op, opMap);
    if (!(op.kind === "pipeline" && operatorHasFork(op, opMap))) {
      const result = await runExecutionPlan({
        op,
        opMap,
        operators,
        material: `${input.text}\n\n${outputContractPrompt(contract)}`,
      });
      return [{ text: result.output, lineage: [...input.lineage, { opId: op.id }] }];
    }
    const plan = buildBranchPlan(op, opMap);
    const branchValues = [];
    async function runNode(node, material, lineage) {
      let current = material;
      let nextLineage = lineage;
      for (const segmentId of node.segments) {
        const segment = opMap[segmentId];
        if (!segment) continue;
        const result = await runExecutionPlan({
          op: segment,
          opMap,
          operators,
          material: current,
        });
        current = result.output;
        nextLineage = [...nextLineage, { opId: segment.id }];
      }
      if (node.branches) {
        for (const branch of node.branches) await runNode(branch, current, nextLineage);
      } else {
        branchValues.push({ text: current, lineage: nextLineage });
      }
    }
    await runNode(plan, `${input.text}\n\n${outputContractPrompt(contract)}`, input.lineage);
    return typedExecutionOutputs(branchValues, contract, {}, {
      runId,
      idFactory: (seed) => crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24),
    });
  }
  for (let qi = 0; qi < queue.length; qi += 1) {
    const next = [];
    for (let vi = 0; vi < values.length; vi += 1) {
      if (req.signal?.aborted) throw Object.assign(new Error("execution cancelled"), { status: 499 });
      next.push(...await executeOne(queue[qi], values[vi]));
    }
    values = next;
  }
  const finalContract = queue.length ? outputContractFor(queue[queue.length - 1], opMap) : null;
  const outputs = finalContract
    ? typedExecutionOutputs(values, finalContract, {}, {
        runId,
        idFactory: (seed) => crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24),
      }).map((output, index) => ({
        ...output,
        lineage: [...output.lineage, { outputIndex: index, queue: req.body.queue.map((entry) => entry.id) }],
      }))
    : [];
  const value = {
    runId,
    outputs,
    provenance: createProvenance(req.body.fragments, { actor: identity.user.id }),
    audit: { userId: identity.user.id, characters: req.body.disclosure.characters, lensCount: queue.length, createdAt: Date.now() },
  };
  writeIdempotent(req, value);
  res.json(value);
}

export async function extensionArtifact(req, res) {
  const identity = await requireExtensionUser(req, res);
  if (!identity) return;
  if (req.method === "DELETE") {
    const id = String(req.params?.id || req.query?.id || "");
    const client = getAdminClient();
    if (client) await client.from("extension_artifacts").delete().eq("id", id).eq("user_id", identity.user.id);
    LOCAL_ARTIFACTS.delete(id);
    return res.status(204).end();
  }
  const id = crypto.randomUUID();
  const record = {
    id,
    user_id: identity.user.id,
    payload: req.body,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
  const client = getAdminClient();
  if (client && identity.user.id !== "local-development") {
    const { error } = await client.from("extension_artifacts").insert(record);
    if (error) throw new Error("Unable to create artifact.");
  } else {
    LOCAL_ARTIFACTS.set(id, record);
  }
  res.status(201).json({ id, expiresAt: record.expires_at });
}

export async function extensionGenerator(req, res) {
  const identity = await requireExtensionUser(req, res);
  if (!identity) return;
  if (!req.body?.generatorId || !req.body?.result) return res.status(400).json({ error: "generatorId and result are required" });
  const client = getAdminClient();
  if (!client || identity.user.id === "local-development") return res.json({ saved: true, localOnly: true });
  const { error } = await client.from("extension_generator_items").insert({
    user_id: identity.user.id,
    generator_id: req.body.generatorId,
    result: req.body.result,
    provenance: req.body.provenance || {},
  });
  if (error) throw new Error("Unable to save generator item.");
  res.status(201).json({ saved: true });
}
