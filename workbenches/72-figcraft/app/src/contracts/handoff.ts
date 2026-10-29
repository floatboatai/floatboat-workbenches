// ABOUTME: 生成交付说明（Markdown）：画板顺序、交付状态、逐屏备注与文案清单。
import { descendants, outline, nodeOf, type DevStatus, type FigDocument } from "./figdoc.ts";

export const STATUS_LABEL: Record<DevStatus, string> = { none: "未标记", readyForDev: "可交付", completed: "已完成" };

export function handoffMarkdown(doc: FigDocument, notes: Record<string, string>, title: string, at: Date): string {
  const o = outline(doc);
  const count = (s: DevStatus) => o.frames.filter((f) => f.status === s).length;
  const changed = o.frames.filter((f) => f.changed).length;
  const lines = [
    `# ${title} · 交付说明`,
    "",
    `- 设计：${o.name}（${o.nodeCount} 个图层）`,
    `- 导出：${at.toISOString()}`,
    `- 画板：${o.frames.length}；可交付 ${count("readyForDev")}；已完成 ${count("completed")}；未标记 ${count("none")}${changed ? `；可交付后又变更 ${changed}` : ""}`,
    "",
  ];
  for (const page of o.pages) {
    if (!page.frames.length) continue;
    lines.push(`## 页面：${page.name}`, "");
    page.frames.forEach((id, index) => {
      const f = o.frames.find((x) => x.id === id);
      const node = nodeOf(doc, id);
      if (!f || !node) return;
      lines.push(
        `### ${String(index + 1).padStart(2, "0")} ${f.name}`,
        "",
        `- 尺寸：${Math.round(f.width)} × ${Math.round(f.height)}`,
        `- 状态：${STATUS_LABEL[f.status]}${f.changed ? "（标记后已变更，需重新确认）" : ""}`,
      );
      const note = notes[String(id)]?.trim();
      lines.push(note ? `- 备注：${note.replace(/\n+/g, " / ")}` : "- 备注：无");
      const texts = descendants(doc, node).filter((n) => n.type === "text" && n.visible !== false);
      if (texts.length) {
        lines.push("", "| 图层 | 文案 |", "| --- | --- |");
        for (const t of texts)
          lines.push(
            `| ${t.name.replace(/\|/g, "\\|").slice(0, 60)} | ${String(t.characters ?? "")
              .replace(/\|/g, "\\|")
              .replace(/\n/g, "<br>")} |`,
          );
      }
      lines.push("");
    });
  }
  return lines.join("\n");
}
