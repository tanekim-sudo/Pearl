import { PROCEDURAL_SOUNDSCAPES, normalizePearlTrack } from "./pearl-soundscape.js";

const QUERY_LIMIT = 120;
const CACHE_TTL_MS = 5 * 60 * 1000;
const clean = (value, length = 500) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, length);

function queryOnly(value) {
  const query = clean(value, QUERY_LIMIT);
  if (!query) throw new Error("audio search needs a query");
  return query;
}

export function rightsFromLicenseUrl(rawUrl) {
  const url = clean(rawUrl, 2_000);
  const lower = url.toLowerCase();
  if (!/^https:\/\//.test(url)) return null;
  const publicDomain = /creativecommons\.org\/publicdomain\/(?:zero|mark)\//.test(lower);
  const by = /creativecommons\.org\/licenses\/by\//.test(lower);
  const bySa = /creativecommons\.org\/licenses\/by-sa\//.test(lower);
  const byNc = /creativecommons\.org\/licenses\/by-nc/.test(lower);
  if (!publicDomain && !by && !bySa && !byNc) return null;
  return {
    spdx: publicDomain ? "CC0-1.0" : bySa ? "CC-BY-SA-4.0" : by ? "CC-BY-4.0" : "LicenseRef-CC-BY-NC",
    termsUrl: url,
    terms: publicDomain ? "Public domain / CC0 provider record" : "Creative Commons provider record; follow linked terms.",
    streamAllowed: true,
    offlineAllowed: publicDomain || by || bySa,
    redistributionAllowed: publicDomain || by || bySa,
  };
}

export function createProceduralAudioProvider() {
  return Object.freeze({
    id: "procedural",
    async search(query) {
      const term = queryOnly(query).toLowerCase();
      return PROCEDURAL_SOUNDSCAPES
        .filter((entry) => `${entry.title} ${entry.kind}`.toLowerCase().includes(term) || term.includes(entry.kind.split("-")[0]))
        .map((entry) => normalizePearlTrack({
          source: "procedural",
          externalId: entry.id,
          title: entry.title,
          license: {
            spdx: "LicenseRef-Pearl-Procedural",
            terms: "Generated locally at playback; no recording is bundled or redistributed.",
            streamAllowed: true,
            offlineAllowed: true,
            redistributionAllowed: true,
          },
          provenance: { kind: "procedural-audio", generator: entry.kind, network: false },
        }));
    },
  });
}

export function createInternetArchiveAudioProvider(options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const cache = new Map();
  return Object.freeze({
    id: "internet-archive",
    async search(rawQuery, input = {}) {
      const query = queryOnly(rawQuery);
      const limit = Math.max(1, Math.min(20, Number(input.limit) || 12));
      const cacheKey = `${query}:${limit}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) return structuredClone(cached.value);
      const endpoint = new URL("https://archive.org/advancedsearch.php");
      endpoint.searchParams.set("q", `mediatype:audio AND (${query.replace(/[():"]/g, " ")})`);
      endpoint.searchParams.set("fl[]", "identifier,title,creator,licenseurl,collection");
      endpoint.searchParams.set("rows", String(limit));
      endpoint.searchParams.set("output", "json");
      const response = await fetcher(endpoint, { headers: { accept: "application/json" }, credentials: "omit" });
      if (!response.ok) throw new Error(response.status === 429 ? "audio provider is rate-limited" : "audio provider is unavailable");
      const payload = await response.json();
      const tracks = [];
      for (const document of payload?.response?.docs || []) {
        const license = rightsFromLicenseUrl(Array.isArray(document.licenseurl) ? document.licenseurl[0] : document.licenseurl);
        if (!license) continue;
        const identifier = clean(document.identifier, 300);
        if (!identifier) continue;
        tracks.push(normalizePearlTrack({
          source: "provider",
          provider: "internet-archive",
          externalId: identifier,
          title: clean(document.title, 240) || identifier,
          artist: clean(Array.isArray(document.creator) ? document.creator.join(", ") : document.creator, 240) || "Unknown",
          license: {
            ...license,
            attributionText: `${clean(document.title, 240) || identifier} — ${clean(document.creator, 240) || "Unknown"}`,
            attributionUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
          },
          streamUrl: `https://archive.org/download/${encodeURIComponent(identifier)}`,
          downloadUrl: license.offlineAllowed ? `https://archive.org/download/${encodeURIComponent(identifier)}` : null,
          provenance: { kind: "licensed-provider-result", provider: "internet-archive", searchedAt: Date.now() },
        }));
      }
      cache.set(cacheKey, { at: Date.now(), value: tracks });
      return structuredClone(tracks);
    },
    async resolve(value) {
      const track = normalizePearlTrack(value);
      if (track.provider !== "internet-archive") throw new Error("Internet Archive track required");
      const response = await fetcher(`https://archive.org/metadata/${encodeURIComponent(track.externalId)}`, {
        headers: { accept: "application/json" },
        credentials: "omit",
      });
      if (!response.ok) throw new Error(response.status === 429 ? "audio provider is rate-limited" : "audio item is unavailable");
      const file = (await response.json()).files?.find((entry) =>
        /\.(?:mp3|ogg|m4a|wav)$/i.test(entry.name || "")
        && Number(entry.size || 0) > 0
        && Number(entry.size || 0) <= 200 * 1024 * 1024
      );
      if (!file) throw new Error("this provider item has no supported audio file");
      const mediaUrl = `https://archive.org/download/${encodeURIComponent(track.externalId)}/${String(file.name).split("/").map(encodeURIComponent).join("/")}`;
      return normalizePearlTrack({
        ...track,
        streamUrl: mediaUrl,
        downloadUrl: track.license.offlineAllowed ? mediaUrl : null,
        byteLength: Number(file.size) || 0,
        mime: /\.ogg$/i.test(file.name) ? "audio/ogg" : /\.wav$/i.test(file.name) ? "audio/wav" : "audio/mpeg",
      });
    },
  });
}

export function createJamendoAudioProvider(options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const clientId = clean(options.clientId, 200);
  return Object.freeze({
    id: "jamendo",
    async search(rawQuery, input = {}) {
      if (!clientId) throw new Error("Jamendo search is not configured");
      const query = queryOnly(rawQuery);
      const endpoint = new URL("https://api.jamendo.com/v3.0/tracks/");
      endpoint.searchParams.set("client_id", clientId);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("search", query);
      endpoint.searchParams.set("limit", String(Math.max(1, Math.min(20, Number(input.limit) || 12))));
      endpoint.searchParams.set("include", "licenses");
      const response = await fetcher(endpoint, { headers: { accept: "application/json" }, credentials: "omit" });
      if (!response.ok) throw new Error(response.status === 429 ? "Jamendo is rate-limited" : "Jamendo is unavailable");
      const payload = await response.json();
      return (payload.results || []).flatMap((entry) => {
        const termsUrl = clean(entry.shareurl || "https://www.jamendo.com/legal/licenses", 2_000);
        if (!entry.id || !entry.audio || !termsUrl) return [];
        return [normalizePearlTrack({
          source: "provider",
          provider: "jamendo",
          externalId: String(entry.id),
          title: entry.name,
          artist: entry.artist_name,
          album: entry.album_name,
          artworkUrl: entry.image,
          streamUrl: entry.audio,
          license: {
            spdx: "LicenseRef-Jamendo",
            terms: "Streaming is governed by the linked Jamendo provider terms.",
            termsUrl,
            attributionText: `${clean(entry.name, 240)} — ${clean(entry.artist_name, 240)}`,
            attributionUrl: entry.shareurl,
            streamAllowed: true,
            offlineAllowed: false,
            redistributionAllowed: false,
          },
          provenance: { kind: "licensed-provider-result", provider: "jamendo", searchedAt: Date.now() },
        })];
      });
    },
  });
}
