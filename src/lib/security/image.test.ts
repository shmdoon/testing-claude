import { describe, expect, it } from "vitest";
import { sniffType, stripImageMetadata } from "./image";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const has = (hay: Uint8Array, needle: string) => Buffer.from(hay).includes(Buffer.from(needle));

describe("sniffType", () => {
  it("uses magic bytes", () => {
    expect(sniffType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
    expect(sniffType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffType(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffType(bytes("GIF89a"))).toBeNull();
  });
});

describe("stripImageMetadata", () => {
  it("removes EXIF (GPS) from JPEG but keeps image data", () => {
    const exif = bytes("Exif", [0, 0], "GPSLatitude=12.97");
    const jpg = bytes(
      [0xff, 0xd8],
      [0xff, 0xe0, 0x00, 0x04], "JF",
      [0xff, 0xe1, 0x00, exif.length + 2], [...exif],
      [0xff, 0xfe, 0x00, 0x07], "hello",
      [0xff, 0xda, 0x00, 0x04, 0x01, 0x02], "PIXELS", [0xff, 0xd9],
    );
    const out = stripImageMetadata(jpg, "image/jpeg");
    expect(has(out, "GPSLatitude")).toBe(false);
    expect(has(out, "hello")).toBe(false);
    expect(has(out, "JF")).toBe(true);
    expect(has(out, "PIXELS")).toBe(true);
    expect(sniffType(out)).toBe("image/jpeg");
  });

  it("removes eXIf/tEXt chunks from PNG", () => {
    const chunk = (type: string, data: string) => {
      const len = data.length;
      return bytes([0, 0, 0, len], type, data, [0, 0, 0, 0]);
    };
    const png = new Uint8Array([
      ...bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]),
      ...chunk("IHDR", "hdr"),
      ...chunk("tEXt", "Author=Asha"),
      ...chunk("eXIf", "GPS"),
      ...chunk("IDAT", "pix"),
      ...chunk("IEND", ""),
    ]);
    const out = stripImageMetadata(png, "image/png");
    expect(has(out, "Asha")).toBe(false);
    expect(has(out, "GPS")).toBe(false);
    expect(has(out, "IDAT")).toBe(true);
    expect(has(out, "IEND")).toBe(true);
  });

  it("removes EXIF from WebP and fixes the RIFF size", () => {
    const chunk = (type: string, data: number[]) => bytes(type, [data.length, 0, 0, 0], data, data.length % 2 ? [0] : []);
    const body = new Uint8Array([
      ...chunk("VP8X", [0x08 | 0x04 | 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...chunk("VP8 ", [1, 2, 3]),
      ...chunk("EXIF", [...bytes("GPSLat")]),
    ]);
    const webp = new Uint8Array([...bytes("RIFF", [0, 0, 0, 0], "WEBP"), ...body]);
    const out = stripImageMetadata(webp, "image/webp");
    expect(has(out, "GPSLat")).toBe(false);
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    expect(out[20]! & 0x0c).toBe(0); // VP8X flags cleared
    expect(out[20]! & 0x10).toBe(0x10); // other flags kept
  });

  it("rejects corrupt files", () => {
    expect(() => stripImageMetadata(bytes([0xff, 0xd8], [0x00, 0x00]), "image/jpeg")).toThrow();
  });
});
