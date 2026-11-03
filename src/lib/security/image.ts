/**
 * Upload safety for student work. Pure JS so it runs on any host (no sharp):
 *  - sniffType: trust magic bytes, not the browser-supplied MIME type
 *  - stripImageMetadata: drop EXIF/XMP/IPTC/text chunks — phone photos carry
 *    GPS coordinates, which must never be stored for children.
 */
export type SafeType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

export function sniffType(b: Uint8Array): SafeType | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export class UnsafeImageError extends Error {}

export function stripImageMetadata(bytes: Uint8Array, type: SafeType): Uint8Array {
  switch (type) {
    case "image/jpeg":
      return stripJpeg(bytes);
    case "image/png":
      return stripPng(bytes);
    case "image/webp":
      return stripWebp(bytes);
    case "application/pdf":
      return bytes; // not an image; PDFs are only accepted where the lesson allows them
  }
}

/** Keep everything except APP1 (EXIF/XMP), APP13 (IPTC) and comments. */
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new UnsafeImageError("Corrupt JPEG");
    const marker = b[i + 1]!;
    if (marker === 0xda) {
      out.push(b.subarray(i)); // start of scan: the rest is image data
      break;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > b.length) throw new UnsafeImageError("Corrupt JPEG");
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    const end = i + 2 + len;
    if (len < 2 || end > b.length) throw new UnsafeImageError("Corrupt JPEG");
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(b.subarray(i, end));
    i = end;
  }
  return concat(out);
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= b.length) {
    const len = ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) throw new UnsafeImageError("Corrupt PNG");
    if (!PNG_DROP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(out);
}

function stripWebp(b: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = b[i + 4]! | (b[i + 5]! << 8) | (b[i + 6]! << 16) | ((b[i + 7]! << 24) >>> 0);
    const end = i + 8 + len + (len % 2);
    if (i + 8 + len > b.length) throw new UnsafeImageError("Corrupt WebP");
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = b.slice(i, Math.min(end, b.length));
      if (type === "VP8X") chunk[8] = chunk[8]! & ~(0x08 | 0x04); // clear EXIF + XMP flags
      chunks.push(chunk);
    }
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 4), 0);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  header.set(b.subarray(8, 12), 8);
  return concat([header, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
