import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "api");
const HOBBY_FUNCTION_LIMIT = 12;

function listApiEntrypoints(dir = apiDir, prefix = "") {
  const entries = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) entries.push(...listApiEntrypoints(path.join(dir, name.name), rel));
    else if (name.isFile() && name.name.endsWith(".js")) entries.push(rel);
  }
  return entries.sort();
}

test("Vercel Hobby deploy stays at or under 12 serverless functions", () => {
  const entrypoints = listApiEntrypoints();
  assert.ok(entrypoints.length <= HOBBY_FUNCTION_LIMIT, `expected ≤${HOBBY_FUNCTION_LIMIT} functions, found ${entrypoints.length}: ${entrypoints.join(", ")}`);
  assert.deepEqual(entrypoints, [
    "execute.js",
    "extension.js",
    "health.js",
    "infer-transformation.js",
    "phase.js",
    "pipeline.js",
    "plan.js",
    "run.js",
    "share.js",
  ]);
});

test("vercel.json rewrites preserve consolidated API paths", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rewrites = Object.fromEntries(vercel.rewrites.map((row) => [row.source, row.destination]));
  assert.equal(rewrites["/api/infer-automation"], "/api/infer-transformation?route=automation");
  assert.equal(rewrites["/api/infer-transcript-artifacts"], "/api/infer-transformation?route=transcript-artifacts");
  assert.equal(rewrites["/api/extension/library"], "/api/extension?route=library");
  assert.equal(rewrites["/api/extension/execute"], "/api/extension?route=execute");
  assert.equal(rewrites["/api/extension/artifacts"], "/api/extension?route=artifacts");
  assert.equal(rewrites["/api/extension/artifacts/:id"], "/api/extension?route=artifacts&id=:id");
  assert.equal(rewrites["/api/extension/generators"], "/api/extension?route=generators");
  assert.equal(rewrites["/api/models"], "/api/run?route=models");
  assert.match(fs.readFileSync(path.join(root, "api/infer-transformation.js"), "utf8"), /inferAutomationPearl/);
  assert.match(fs.readFileSync(path.join(root, "api/extension.js"), "utf8"), /extensionLibrary/);
});
