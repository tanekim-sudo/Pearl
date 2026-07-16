import test from "node:test";
import assert from "node:assert/strict";
import { gatewayAuth, ModelGateway, ModelGatewayError } from "./model-gateway.js";

const model = {
  id: "test/structured-vision",
  provider: "test",
  availability: "available",
  capabilities: { text: true, structured: true, tools: true, vision: true },
  maxOutputTokens: 8192,
  pricing: { input: 0, output: 0 },
};
const catalog = async () => ({ version: 1, models: [model] });

test("uses API key before OIDC and keeps credentials server-only", () => {
  assert.deepEqual(gatewayAuth({ AI_GATEWAY_API_KEY: "key", VERCEL_OIDC_TOKEN: "oidc" }), {
    configured: true, kind: "api-key", token: "key",
  });
  assert.equal(gatewayAuth({ VERCEL_OIDC_TOKEN: "oidc" }).kind, "vercel-oidc");
});

test("normalizes successful Gateway provenance and usage", async () => {
  const gateway = new ModelGateway({
    env: { AI_GATEWAY_API_KEY: "secret" },
    catalog,
    fetchImpl: async (_url, request) => {
      assert.equal(request.headers.authorization, "Bearer secret");
      return {
        ok: true,
        headers: { get: () => "test-provider" },
        json: async () => ({
          id: "gen_test",
          model: model.id,
          choices: [{ message: { content: "done" } }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        }),
      };
    },
  });
  const result = await gateway.generate({
    profile: "lens_encoding",
    model: model.id,
    requiredCapabilities: ["vision"],
    messages: [{ role: "user", content: "encode" }],
  });
  assert.equal(result.text, "done");
  assert.equal(result.usage.totalTokens, 12);
  assert.equal(result.provenance.requestedModel, model.id);
  assert.equal(result.provenance.resolvedModel, model.id);
  assert.equal(result.provenance.generationId, "gen_test");
});

test("fails precisely when gateway setup or capability is missing", async () => {
  const unconfigured = new ModelGateway({ env: {}, catalog });
  await assert.rejects(
    unconfigured.generate({ profile: "move_execution", messages: [{ role: "user", content: "x" }] }),
    (error) => error instanceof ModelGatewayError && error.code === "MODEL_GATEWAY_UNCONFIGURED",
  );
  const incompatible = new ModelGateway({
    env: { AI_GATEWAY_API_KEY: "key" },
    catalog: async () => ({ version: 1, models: [{ ...model, capabilities: { text: true } }] }),
  });
  await assert.rejects(
    incompatible.generate({ profile: "lens_encoding", model: model.id, requiredCapabilities: ["vision"], messages: [{ role: "user", content: "x" }] }),
    (error) => error.code === "MODEL_INCOMPATIBLE",
  );
});

test("streams real SSE deltas and accumulates provenance", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ id: "gen_stream", model: model.id, choices: [{ delta: { content: "hel" } }] })}\n\n`,
    `data: ${JSON.stringify({ id: "gen_stream", model: model.id, choices: [{ delta: { content: "lo" } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } })}\n\n`,
    "data: [DONE]\n\n",
  ];
  const deltas = [];
  const gateway = new ModelGateway({
    env: { AI_GATEWAY_API_KEY: "secret" },
    catalog,
    fetchImpl: async (_url, request) => {
      assert.equal(JSON.parse(request.body).stream, true);
      return new Response(new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
          controller.close();
        },
      }), { status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-gateway-provider": "test-stream" } });
    },
  });
  const result = await gateway.generate({
    profile: "move_execution",
    messages: [{ role: "user", content: "stream" }],
    stream: true,
    onDelta: (delta) => deltas.push(delta.text),
  });
  assert.equal(result.text, "hello");
  assert.deepEqual(deltas, ["hel", "lo"]);
  assert.equal(result.provenance.streamed, true);
  assert.equal(result.provenance.generationId, "gen_stream");
});
