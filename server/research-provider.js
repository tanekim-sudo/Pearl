import { randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import net from "node:net";

const MAX_SOURCES = 10;
const MAX_SNIPPET = 4_000;

function configuredOrigins(value) {
  return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function allowedUrl(raw, allowedOrigins) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Research providers and sources must use HTTPS.");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80:")
  ) throw Object.assign(new Error("Private and local research addresses are not permitted."), { code: "RESEARCH_PRIVATE_ADDRESS" });
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

function privateIp(address) {
  const value = String(address || "").toLowerCase();
  if (net.isIP(value) === 4) {
    const [a, b] = value.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIP(value) === 6) {
    return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
  }
  return true;
}

async function approvedAddresses(url, lookup = dnsLookup) {
  const entries = await lookup(url.hostname, { all: true, verbatim: true });
  if (!entries.length || entries.some((entry) => privateIp(entry.address))) {
    throw Object.assign(new Error("Research source resolved to a private or reserved address."), { code: "RESEARCH_PRIVATE_ADDRESS", status: 502 });
  }
  return entries;
}

function pinnedHttpsFetch(url, addresses, options = {}) {
  const maxBytes = Math.min(1_000_000, Math.max(16_000, Number(options.maxBytes) || 250_000));
  return new Promise((resolve, reject) => {
    const pinned = addresses[0];
    const request = https.get(url, {
      headers: { Accept: "text/html, text/plain;q=0.9" },
      timeout: Math.min(20_000, Math.max(1_000, Number(options.timeoutMs) || 10_000)),
      lookup(_hostname, _lookupOptions, callback) {
        callback(null, pinned.address, pinned.family);
      },
      signal: options.signal,
    }, (response) => {
      const location = response.headers.location;
      if (location) {
        response.resume();
        reject(Object.assign(new Error("Cited source redirects require separate policy validation."), { code: "RESEARCH_REDIRECT_DENIED", status: 502 }));
        return;
      }
      let bytes = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) request.destroy(Object.assign(new Error("Cited source exceeded the response limit."), { code: "RESEARCH_SOURCE_TOO_LARGE", status: 502 }));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({
        ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
        status: response.statusCode || 500,
        url: url.href,
        headers: { get: (name) => response.headers[String(name).toLowerCase()] || null },
        text: async () => Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("timeout", () => request.destroy(Object.assign(new Error("Cited source fetch timed out."), { code: "RESEARCH_SOURCE_TIMEOUT", status: 504 })));
    request.on("error", reject);
  });
}

export function researchConfiguration(env = process.env) {
  const sourceOrigins = configuredOrigins(env.RESEARCH_ALLOWED_SOURCE_ORIGINS);
  return {
    configured: Boolean(env.RESEARCH_PROVIDER_URL && sourceOrigins.length),
    provider: env.RESEARCH_PROVIDER_NAME || null,
    sourceOrigins,
  };
}

function pageText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200_000);
}

function materialTokens(value) {
  return new Set(String(value || "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
}

function contentSupportsSnippet(content, snippet) {
  const expected = [...materialTokens(snippet)];
  if (!expected.length) return false;
  const actual = materialTokens(content);
  return expected.filter((token) => actual.has(token)).length / expected.length >= 0.55;
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
  if (!sourceOrigins.length) {
    const error = new Error("Research requires an explicit RESEARCH_ALLOWED_SOURCE_ORIGINS policy.");
    error.status = 503;
    error.code = "RESEARCH_SOURCE_POLICY_REQUIRED";
    throw error;
  }
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
  const candidates = (payload.sources || []).slice(0, MAX_SOURCES).map((source) => {
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
  if (!candidates.length) {
    const error = new Error("Verified browsing returned no citable sources.");
    error.status = 502;
    error.code = "RESEARCH_NO_SOURCES";
    throw error;
  }
  const sources = [];
  for (const source of candidates) {
    const sourceUrl = new URL(source.url);
    const addresses = options.fetch ? [] : await approvedAddresses(sourceUrl, options.lookup || dnsLookup);
    const sourceResponse = options.fetch
      ? await options.fetch(source.url, {
          method: "GET",
          headers: { Accept: "text/html, text/plain;q=0.9" },
          redirect: "manual",
          signal: options.signal || controller.signal,
        })
      : await pinnedHttpsFetch(sourceUrl, addresses, {
          signal: options.signal,
          timeoutMs: env.RESEARCH_SOURCE_TIMEOUT_MS,
          maxBytes: env.RESEARCH_SOURCE_MAX_BYTES,
        });
    if (!sourceResponse.ok) {
      throw Object.assign(new Error(`Cited source could not be fetched (${sourceResponse.status}).`), { code: "RESEARCH_SOURCE_FETCH_FAILED", status: 502 });
    }
    const finalUrl = allowedUrl(sourceResponse.url || source.url, sourceOrigins);
    if (finalUrl.origin !== new URL(source.url).origin) {
      throw Object.assign(new Error("Cited source redirected to a different origin."), { code: "RESEARCH_REDIRECT_DENIED", status: 502 });
    }
    const contentType = sourceResponse.headers?.get?.("content-type") || "";
    if (contentType && !/text\/(?:html|plain)|application\/(?:xhtml\+xml|json)/i.test(contentType)) {
      throw Object.assign(new Error("Cited source returned unsupported content."), { code: "RESEARCH_CONTENT_TYPE_DENIED", status: 502 });
    }
    const content = pageText(await sourceResponse.text());
    if (!contentSupportsSnippet(content, source.snippet)) {
      throw Object.assign(new Error("Provider snippet does not match the fetched cited page."), { code: "RESEARCH_CONTENT_MISMATCH", status: 502 });
    }
    sources.push({
      ...source,
      url: finalUrl.href,
      verification: {
        status: "page-fetched",
        fetchedAt: new Date().toISOString(),
        contentType: contentType || null,
        snippetMatched: true,
      },
    });
  }
  const claimCounts = new Map();
  sources.forEach((source) => source.claimRefs.forEach((claim) => claimCounts.set(claim, (claimCounts.get(claim) || 0) + 1)));
  sources.forEach((source) => {
    source.verification.corroboratedClaimRefs = source.claimRefs.filter((claim) => claimCounts.get(claim) >= 2);
    source.verification.uncorroboratedClaimRefs = source.claimRefs.filter((claim) => claimCounts.get(claim) < 2);
  });
  return {
    version: 1,
    provider: env.RESEARCH_PROVIDER_NAME || "configured-provider",
    question: request.question,
    sources,
    verification: {
      providerMetadataOnly: false,
      fetchedSources: sources.length,
      corroboratedClaims: [...claimCounts].filter(([, count]) => count >= 2).map(([claim]) => claim),
      uncorroboratedClaims: [...claimCounts].filter(([, count]) => count < 2).map(([claim]) => claim),
    },
    readOnly: true,
  };
}
