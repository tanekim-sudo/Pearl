import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { validateCapabilityNames } from "./companion-capabilities.js";

test("companion whitelist covers every registered director verb", () => {
  const source = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const start = source.indexOf("registerDirectorVerbs({");
  const end = source.indexOf("\n  async function handleCompanionCommand", start);
  assert.ok(start >= 0 && end > start, "director registry is present");

  const registry = source.slice(start, end);
  const registered = [...registry.matchAll(/^\s{4}([A-Za-z]\w*):\s*async\b/gm)].map((match) => match[1]);
  const drift = validateCapabilityNames(registered);

  assert.deepEqual(drift, { undocumented: [], unregistered: [] });
});
