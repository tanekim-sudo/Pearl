export const PEARL_IMAGE_MIME_TYPES = Object.freeze(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

export function validatePearlImageSignature(bytes, rawMime) {
  const mime = String(rawMime || "").toLowerCase();
  if (!PEARL_IMAGE_MIME_TYPES.includes(mime)) throw new Error("local canvas blob must use a supported raster image type");
  const view = new Uint8Array(bytes instanceof ArrayBuffer ? bytes.slice(0, 16) : new Uint8Array(bytes || []).slice(0, 16));
  const ascii = (start, end) => String.fromCharCode(...view.slice(start, end));
  const valid = (
    (mime === "image/png" && view[0] === 0x89 && ascii(1, 4) === "PNG")
    || (mime === "image/jpeg" && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff)
    || (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(ascii(0, 6)))
    || (mime === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    || (mime === "image/avif" && ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12)))
  );
  if (!valid) throw new Error("local canvas image signature does not match its type");
  return mime;
}
