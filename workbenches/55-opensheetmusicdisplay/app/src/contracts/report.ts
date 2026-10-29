// ABOUTME: 批注 JSON 导出：原件哈希、谱面著录、显示设置与按乐谱顺序编号的批注（含小节号、拍位）。
import { ANNOTATION_KINDS, orderAnnotations, validateScore, type ScoreProject } from "./domain.ts";
import { beatLabel } from "./musicxml.ts";

export function reviewReport(value: ScoreProject, title: string, exportedAt = new Date().toISOString()) {
  const project = validateScore(value);
  const { index } = project;
  return {
    format: "floatboat-score-review",
    version: 2,
    title,
    exportedAt,
    source: { fileName: project.source.fileName, kind: project.source.kind, bytes: project.source.size, sha256: project.source.id },
    score: {
      title: index.title,
      subtitle: index.subtitle,
      composer: index.composer,
      lyricist: index.lyricist,
      arranger: index.arranger,
      rights: index.rights,
      parts: index.parts.map(({ id, name, staves, measures }) => ({ id, name, staves, measures })),
      measures: index.measures.length,
      notes: index.notes,
    },
    view: project.view,
    summary: {
      total: project.annotations.length,
      open: project.annotations.filter((note) => !note.resolved).length,
      resolved: project.annotations.filter((note) => note.resolved).length,
    },
    annotations: orderAnnotations(project).map((note, i) => {
      const measure = index.measures[note.measureIndex];
      return {
        number: i + 1,
        id: note.id,
        partId: note.partId,
        partName: index.parts.find((part) => part.id === note.partId)?.name ?? note.partId,
        measureIndex: note.measureIndex,
        measureNumber: measure?.n ?? String(note.measureIndex + 1),
        beat: note.beat ? beatLabel(note.beat, measure?.t ?? "") : null,
        offset: note.beat ? `${note.beat[0]}/${note.beat[1]}` : null,
        kind: note.kind,
        kindLabel: ANNOTATION_KINDS[note.kind],
        text: note.text,
        resolved: note.resolved,
        createdAt: note.createdAt,
      };
    }),
  };
}
export type ReviewReport = ReturnType<typeof reviewReport>;
