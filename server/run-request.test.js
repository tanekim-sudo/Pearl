import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { executeRunRequest, shapeRunRequest } from "./run-request.js";

const valid = {
  prompt: "Plan this request.",
  text: "Open saved work.",
  system: "Return a typed plan.",
  profile: "companion_planning",
  modelPreference: "auto",
  jsonSchema: {
    name: "companion_plan",
    schema: {
      type: "object",
      properties: { version: { type: "integer" } },
      required: ["version"],
    },
  },
  tools: [{
    type: "function",
    function: {
      name: "open_saved_work",
      description: "Open saved work.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  }],
  toolChoice: "auto",
  requiredCapabilities: ["structured", "tools"],
};

test("local and serverless routes share one run request executor", () => {
  const expressSource = fs.readFileSync(new URL("./index.js", import.meta.url), "utf8");
  const serverlessSource = fs.readFileSync(new URL("../api/run.js", import.meta.url), "utf8");
  assert.match(expressSource, /executeRunRequest\(req\.body/);
  assert.match(serverlessSource, /executeRunRequest\(body/);
});

test("validated profile schema tools and message fields reach runPrompt unchanged", async () => {
  let received;
  const result = await executeRunRequest(valid, async (request) => {
    received = request;
    return { output: "ok" };
  });
  assert.equal(result.output, "ok");
  assert.equal(received.profile, "companion_planning");
  assert.equal(received.prompt, valid.prompt);
  assert.equal(received.text, valid.text);
  assert.equal(received.system, valid.system);
  assert.deepEqual(received.jsonSchema, valid.jsonSchema);
  assert.deepEqual(received.tools, valid.tools);
  assert.deepEqual(received.requiredCapabilities, ["structured", "tools"]);
  assert.equal(received.model, "auto");
  assert.equal("modelPreference" in received, false);
});

test("run request rejects oversized or malformed schema and tools", () => {
  assert.throws(() => shapeRunRequest({ ...valid, jsonSchema: { name: "x", schema: "not-an-object" } }), /jsonSchema\.schema/);
  assert.throws(() => shapeRunRequest({
    ...valid,
    jsonSchema: { name: "x", schema: { type: "object", description: "x".repeat(70_000) } },
  }), /jsonSchema is too large/);
  assert.throws(() => shapeRunRequest({
    ...valid,
    tools: Array.from({ length: 33 }, (_, index) => ({
      type: "function",
      function: { name: `tool_${index}`, parameters: { type: "object" } },
    })),
  }), /at most 32 tools/);
  assert.throws(() => shapeRunRequest({ ...valid, tools: [{ type: "function", function: { name: "bad name", parameters: {} } }] }), /tool name/);
  assert.throws(() => shapeRunRequest({ ...valid, requiredCapabilities: ["structured", "root-access"] }), /required capability/);
  assert.throws(() => shapeRunRequest({ ...valid, unexpectedSecret: "no" }), /unexpected run request field/);
});
