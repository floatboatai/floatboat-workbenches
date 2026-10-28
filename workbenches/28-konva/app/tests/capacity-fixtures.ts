import { createHash, randomFillSync } from "node:crypto";
import { deflateSync } from "node:zlib";
import { inspectImage } from "../src/server/images.ts";
import { seed, type Board, type Item } from "../src/contracts/board.ts";
function crc(bytes: Buffer) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type: string, bytes: Buffer) {
  const tag = Buffer.from(type),
    out = Buffer.alloc(12 + bytes.length);
  out.writeUInt32BE(bytes.length);
  tag.copy(out, 4);
  bytes.copy(out, 8);
  out.writeUInt32BE(crc(Buffer.concat([tag, bytes])), 8 + bytes.length);
  return out;
}
export function samplePng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(500);
  header.writeUInt32BE(480, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(480 * 1501);
  for (let y = 0; y < 480; y++) {
    pixels[y * 1501] = 0;
    randomFillSync(pixels, y * 1501 + 1, 1500);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export function boardWithCount(count: number): Board {
  return {
    ...structuredClone(seed),
    items: Array.from({ length: count }, (_, i) => ({
      ...seed.items[1],
      id: `item-${i}`,
      x: 20 + (i % 20) * 30,
      y: 30 + Math.floor(i / 20) * 30,
      width: 25,
      height: 25,
    })),
  };
}
export function imageProject(count: number) {
  const items: Item[] = [],
    originals = [];
  for (let i = 0; i < count; i++) {
    const bytes = samplePng(),
      info = inspectImage(bytes),
      source = {
        id: createHash("sha256").update(bytes).digest("hex"),
        name: `capacity-${i}.png`,
        ...info,
        bytes: bytes.length,
      };
    originals.push({ ...source, base64: bytes.toString("base64") });
    items.push({
      ...seed.items[1],
      id: `image-${i}`,
      kind: "image" as const,
      x: 0,
      y: 0,
      width: 500,
      height: 480,
      source,
    });
  }
  return {
    format: "konva-annotation/v1",
    title: "原图容量验收",
    data: { ...structuredClone(seed), items },
    extra: {},
    originals,
  };
}
