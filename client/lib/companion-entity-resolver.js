const ORDINALS = Object.freeze({ first: 0, second: 1, third: 2, fourth: 3, fifth: 4, last: -1 });

const normalized = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function resolveCompanionEntity(reference, snapshot, context = {}) {
  if (reference && typeof reference === "object" && reference.id) reference = reference.id;
  const query = normalized(reference);
  const candidates = [
    ...(snapshot.selection || []).map((value) => ({ ...value, selected: true })),
    ...(snapshot.objects || []),
    ...(snapshot.lenses || []),
    ...(snapshot.generators || []),
  ].filter((entry, index, all) => entry?.id && all.findIndex((value) => value.id === entry.id) === index);
  const exactId = candidates.find((entry) => normalized(entry.id) === query);
  if (exactId) return { status: "resolved", entity: exactId, score: 1, reason: "stable-id" };
  if (/^(?:it|this|that|this one|that one)$/.test(query)) {
    const recent = context.lastCreated || context.lastReferenced || snapshot.selection?.[0];
    if (recent) return { status: "resolved", entity: recent, score: 0.9, reason: "discourse-recency" };
  }
  const ordinal = Object.entries(ORDINALS).find(([word]) => new RegExp(`\\b${word}(?: one)?\\b`).test(query));
  if (ordinal) {
    const source = snapshot.selection?.length ? snapshot.selection : candidates;
    const index = ordinal[1] < 0 ? source.length - 1 : ordinal[1];
    if (source[index]) return { status: "resolved", entity: source[index], score: snapshot.selection?.length ? 0.94 : 0.72, reason: "ordinal" };
  }
  const scored = candidates.map((entity) => {
    const label = normalized(entity.name || entity.title || entity.summary || entity.label);
    let score = label === query ? 0.98 : label.includes(query) || query.includes(label) ? 0.78 : 0;
    if (entity.selected) score += 0.08;
    if (context.lastReferenced?.id === entity.id) score += 0.05;
    return { entity, score: Math.min(1, score) };
  }).filter((entry) => entry.score > 0.5).sort((a, b) => b.score - a.score);
  if (!scored.length) return { status: "unresolved", entity: null, score: 0, reason: "no-match" };
  if (scored[1] && scored[0].score - scored[1].score < 0.1) {
    return { status: "ambiguous", entity: null, score: scored[0].score, candidates: scored.slice(0, 5), reason: "close-matches" };
  }
  return { status: "resolved", ...scored[0], reason: "name-or-summary" };
}
