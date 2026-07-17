import test from "node:test";
import assert from "node:assert/strict";

import { researchConfiguration, verifiedResearch } from "./research-provider.js";

test("verified research fails before work when provider is unavailable", async () => {
  assert.equal(researchConfiguration({}).configured, false);
  await assert.rejects(() => verifiedResearch({ question: "company" }, { env: {} }), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, "RESEARCH_PROVIDER_UNAVAILABLE");
    return true;
  });
});

test("verified research preserves complete source metadata within approved origins", async () => {
  const env = {
    RESEARCH_PROVIDER_URL: "https://research.example/search",
    RESEARCH_APPROVED_PROVIDER_ORIGINS: "https://research.example",
    RESEARCH_ALLOWED_SOURCE_ORIGINS: "sec.gov,company.example",
    RESEARCH_PROVIDER_NAME: "fixture",
  };
  const result = await verifiedResearch(
    { question: "What changed?", maxSources: 3 },
    {
      env,
      fetch: async () => ({
        ok: true,
        json: async () => ({
          sources: [{
            title: "Annual report",
            url: "https://www.sec.gov/filing",
            publisher: "SEC",
            date: "2026-04-01",
            snippet: "Revenue increased.",
            claimRefs: ["revenue"],
          }],
        }),
      }),
    }
  );
  assert.equal(result.readOnly, true);
  assert.equal(result.sources[0].publisher, "SEC");
  assert.ok(result.sources[0].retrievedAt);
  assert.deepEqual(result.sources[0].claimRefs, ["revenue"]);
});

test("verified research rejects unapproved source origins", async () => {
  const env = {
    RESEARCH_PROVIDER_URL: "https://research.example/search",
    RESEARCH_ALLOWED_SOURCE_ORIGINS: "sec.gov",
  };
  await assert.rejects(
    () => verifiedResearch({ question: "company" }, {
      env,
      fetch: async () => ({
        ok: true,
        json: async () => ({
          sources: [{ title: "Untrusted", url: "https://example.net/post", snippet: "Claim" }],
        }),
      }),
    }),
    /not approved/
  );
});
