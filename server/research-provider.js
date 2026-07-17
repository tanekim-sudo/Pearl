import { randomUUID } from "node:crypto";

const MAX_SOURCES = 10;
const MAX_SNIPPET = 4_000;

function configuredOrigins(value) {
  return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function allowedUrl(raw, allowedOrigins) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Research providers and sources must use HTTPS.");
  if (
    allowedOrigins.length &&
    !allowedOrigins.some((allowed) => {
      const configured = allowed.includes("://") ? new URL(allowed) : null;
      return configured
        ? url.origin === configured.origin
        : url.hostname === allowed || url.hostname.endsWith(`.${allowed}`);
    })
  ) {
    throw new Error(`Research origin is not approved: ${url.origin}`);
  }
  return url;
}

export function researchConfiguration(env = process.env) {
  return {
    configured: Boolean(env.RESEARCH_PROVIDER_URL),
    provider: env.RESEARCH_PROVIDER_NAME || null,
    sourceOrigins: configuredOrigins(env.RESEARCH_ALLOWED_SOURCE_ORIGINS),
  };
}

export async function verifiedResearch(request = {}, options = {}) {
  const env = options.env || process.env;
  const endpoint = env.RESEARCH_PROVIDER_URL;
  if (!endpoint) {
    const error = new Error("Verified browsing provider is not configured. Set RESEARCH_PROVIDER_URL and approved source origins.");
    error.status = 503;
    error.code = "RESEARCH_PROVIDER_UNAVAILABLE";
    throw error;
  }
  const providerOrigins = configuredOrigins(env.RESEARCH_APPROVED_PROVIDER_ORIGINS);
  const endpointUrl = allowedUrl(endpoint, providerOrigins.length ? providerOrigins : [new URL(endpoint).origin]);
  const sourceOrigins = configuredOrigins(env.RESEARCH_ALLOWED_SOURCE_ORIGINS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(30_000, Math.max(1_000, Number(env.RESEARCH_TIMEOUT_MS) || 15_000)));
  let response;
  try {
    response = await (options.fetch || fetch)(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.RESEARCH_PROVIDER_TOKEN ? { Authorization: `Bearer ${env.RESEARCH_PROVIDER_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        query: String(request.question || "").slice(0, 4_000),
        maxSources: Math.min(MAX_SOURCES, Math.max(1, Number(request.maxSources) || 5)),
        recency: request.recency || null,
      }),
      signal: options.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const error = new Error(`Verified browsing provider failed (${response.status}).`);
    error.status = 502;
    error.code = "RESEARCH_PROVIDER_FAILED";
    throw error;
  }
  const payload = await response.json();
  const sources = (payload.sources || []).slice(0, MAX_SOURCES).map((source) => {
    const url = allowedUrl(source.url, sourceOrigins);
    if (!source.title || !source.snippet) throw new Error("Verified browsing provider returned a source without title or snippet.");
    return {
      id: source.id || randomUUID(),
      title: String(source.title).slice(0, 1_000),
      url: url.href,
      publisher: String(source.publisher || url.hostname).slice(0, 500),
      publishedAt: source.publishedAt || source.date || null,
      retrievedAt: source.retrievedAt || new Date().toISOString(),
      snippet: String(source.snippet).slice(0, MAX_SNIPPET),
      claimRefs: Array.isArray(source.claimRefs) ? source.claimRefs.slice(0, 100) : [],
    };
  });
  if (!sources.length) {
    const error = new Error("Verified browsing returned no citable sources.");
    error.status = 502;
    error.code = "RESEARCH_NO_SOURCES";
    throw error;
  }
  return {
    version: 1,
    provider: env.RESEARCH_PROVIDER_NAME || "configured-provider",
    question: request.question,
    sources,
    readOnly: true,
  };
}
