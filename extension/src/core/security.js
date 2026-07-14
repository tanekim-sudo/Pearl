export const DEFAULT_DENYLIST = Object.freeze([
  "accounts.google.com",
  "paypal.com",
  "stripe.com",
  "checkout.stripe.com",
  "bank",
  "health",
  "medical",
]);

const BLOCKED_FIELD_RE = /password|passcode|credit|card|cvv|cvc|iban|routing|social.?security|ssn/i;

export function isProtectedField(element) {
  if (!element) return true;
  const type = String(element.type || "").toLowerCase();
  const descriptor = [element.name, element.id, element.autocomplete, element.getAttribute?.("aria-label")].join(" ");
  return type === "password" || ["cc-number", "cc-csc", "cc-exp", "one-time-code"].includes(element.autocomplete) || BLOCKED_FIELD_RE.test(descriptor);
}

export function isOriginDenied(url, denylist = DEFAULT_DENYLIST) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return denylist.some((entry) => host === entry || host.endsWith(`.${entry}`) || (entry === "bank" && host.includes("bank")));
  } catch {
    return true;
  }
}

export function sanitizeHtml(html) {
  const source = String(html || "");
  if (typeof DOMParser === "undefined") {
    return source
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript:/gi, "");
  }
  const doc = new DOMParser().parseFromString(source, "text/html");
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "S", "P", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE", "A", "SPAN"]);
  for (const element of [...doc.body.querySelectorAll("*")]) {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attr of [...element.attributes]) {
      if (element.tagName === "A" && attr.name === "href" && /^(https?:|mailto:)/i.test(attr.value)) continue;
      element.removeAttribute(attr.name);
    }
    if (element.tagName === "A") element.setAttribute("rel", "noopener noreferrer");
  }
  return doc.body.innerHTML;
}

export function safeExternalUrl(value) {
  const url = new URL(String(value));
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("unsafe URL protocol");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.hostname.endsWith(".local")) {
    throw new Error("private network URL blocked");
  }
  return url.href;
}

export function treatPageAsMaterial(text) {
  return String(text || "").replace(/\b(ignore|override|disregard)\b[\s\S]{0,80}\b(instruction|system|developer)\b/gi, "[untrusted page instruction removed]");
}
