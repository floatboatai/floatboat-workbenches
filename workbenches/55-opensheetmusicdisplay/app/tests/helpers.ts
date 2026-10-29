// ABOUTME: 测试共用：内存 SQLite（应用全部迁移）、MXL 打包与较大乐谱生成。
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import { buildScore } from "../src/contracts/score-builder.ts";

export function memoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(name, dir), "utf8"));
  return db;
}

export const utf8 = (text: string) => new TextEncoder().encode(text);

export async function mxl(xml: string, options: { container?: string | null; extra?: Record<string, string> } = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.recordare.musicxml");
  if (options.container !== null)
    zip.file(
      "META-INF/container.xml",
      options.container ??
        '<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>',
    );
  zip.file("score.musicxml", xml);
  for (const [name, content] of Object.entries(options.extra ?? {})) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** 生成较大的多声部乐谱（每小节 6 个音符）。 */
export function largeScore(parts: number, measures: number): string {
  const bars = ["C5:e D5 E5 F5 G5:q E5", "G5:e F5 E5 D5 C5:h", "A4:q B4 C5 D5", "E5:h. r:q"];
  return buildScore({
    title: "Load Study",
    composer: "Test generator",
    rights: "CC0 1.0",
    fifths: -1,
    beats: 4,
    beatType: 4,
    parts: Array.from({ length: parts }, (_, i) => ({
      id: `P${i + 1}`,
      name: `Part ${i + 1}`,
      abbreviation: `Pt.${i + 1}`,
      staves: [{ clef: "G" as const, music: Array.from({ length: measures }, (_, m) => bars[m % 4]).join("|") }],
    })),
  });
}
