import fs from "node:fs";
import path from "node:path";

const output = path.resolve("audit-shots/audit-truth-remediation-2026-07/live-provider-boundary.json");
fs.mkdirSync(path.dirname(output), { recursive: true });

const baseUrl = String(process.env.LIVE_PROVIDER_BASE_URL || "").replace(/\/$/, "");
const configured = Boolean(
  baseUrl &&
  (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY),
);

const evidence = {
  version: 1,
  generatedAt: new Date().toISOString(),
  kind: "live-provider-smoke",
  configured,
  status: configured ? "running" : "skipped-external-only",
  boundaries: configured
    ? []
    : [
        "No LIVE_PROVIDER_BASE_URL plus live model credential was configured.",
        "Runtime model fixtures prove request/schema/planner wiring only, not live provider quality or availability.",
        "No claim of live AI success is made by this artifact.",
      ],
  checks: [],
};

if (configured) {
  const response = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LIVE_PROVIDER_AUTHORIZATION ? { Authorization: process.env.LIVE_PROVIDER_AUTHORIZATION } : {}),
    },
    body: JSON.stringify({
      profile: "companion_planning",
      prompt: "Return a minimal valid typed plan.",
      text: "Open saved work.",
      system: "Return only the requested schema. Do not claim any action executed.",
      jsonSchema: {
        name: "live_provider_smoke",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["version", "title"],
          properties: {
            version: { type: "integer", const: 1 },
            title: { type: "string" },
          },
        },
      },
      maxTokens: 200,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  evidence.checks.push({
    endpoint: "/api/run",
    status: response.status,
    ok: response.ok,
    model: payload.model || null,
    provenance: payload.provenance || null,
    structuredOutputPresent: Boolean(payload.output),
  });
  evidence.status = response.ok && payload.output ? "passed-live-provider" : "failed-live-provider";
  if (evidence.status !== "passed-live-provider") process.exitCode = 1;
}

fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`live provider smoke: ${evidence.status}`);
