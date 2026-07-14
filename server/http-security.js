const buckets = new Map();
const idempotency = new Map();

export function configuredOrigins(env = process.env) {
  const local = ["http://localhost:5173", "http://localhost:8787"];
  const configured = String(env.CORS_ALLOWED_ORIGINS || env.APP_ORIGIN || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const extensionIds = String(env.EXTENSION_IDS || "").split(",").map((item) => item.trim()).filter(Boolean);
  return new Set([
    ...(env.NODE_ENV === "production" ? [] : local),
    ...configured,
    ...extensionIds.map((id) => `chrome-extension://${id}`),
    ...extensionIds.map((id) => `moz-extension://${id}`),
  ]);
}

export function corsOptions(env = process.env) {
  const allowed = configuredOrigins(env);
  return {
    credentials: false,
    origin(origin, callback) {
      if (!origin || allowed.has(origin.replace(/\/$/, ""))) callback(null, true);
      else callback(new Error("origin not allowed"));
    },
    allowedHeaders: ["authorization", "content-type", "idempotency-key", "x-lens-client"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    maxAge: 600,
  };
}

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
}

export function rateLimit({ windowMs = 60_000, limit = 30 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const identity = req.lensUser?.user?.id || req.ip || "anonymous";
    const key = `${identity}:${req.path}`;
    const bucket = buckets.get(key);
    const current = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + windowMs } : bucket;
    current.count += 1;
    buckets.set(key, current);
    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, limit - current.count));
    if (current.count > limit) return res.status(429).json({ error: "request quota exceeded" });
    next();
  };
}

export function idempotencyKey(req) {
  const value = String(req.headers?.["idempotency-key"] || req.body?.idempotencyKey || "");
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(value)) return "";
  return `${req.lensUser?.user?.id || "local"}:${value}`;
}

export function readIdempotent(req) {
  const key = idempotencyKey(req);
  const record = key && idempotency.get(key);
  if (!record || record.expiresAt < Date.now()) return null;
  return record.value;
}

export function writeIdempotent(req, value, ttlMs = 10 * 60_000) {
  const key = idempotencyKey(req);
  if (key) idempotency.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function resetHttpSecurityForTests() {
  buckets.clear();
  idempotency.clear();
}
