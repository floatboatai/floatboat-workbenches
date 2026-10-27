import { validateScore, originalBytes, type ScoreProject } from "./domain.ts";
import { inspectScore } from "./musicxml.ts";
export async function reviewReport(project: ScoreProject, title: string) {
  const info = inspectScore(project.source.xml);
  const data = validateScore(project),
    bytes = originalBytes(data.source),
    digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return {
    format: "floatboat-score-review",
    version: 1,
    title,
    exportedAt: new Date().toISOString(),
    source: {
      fileName: data.source.fileName,
      kind: data.source.kind,
      bytes: bytes.length,
      sha256: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    },
    score: info,
    view: {
      partId: data.partId,
      layout: data.layout,
      zoom: data.zoom,
      focus: data.focus,
    },
    annotations: data.annotations.map((note) => ({
      ...note,
      partName: info.parts.find((part) => part.id === note.partId)?.name,
      measureNumber: info.parts.find((part) => part.id === note.partId)
        ?.measures[note.measureIndex].number,
    })),
  };
}
