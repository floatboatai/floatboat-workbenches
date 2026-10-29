// ABOUTME: 资料集抽取入口：多文件代码、Markdown、文本 → Graphify 原生 node-link 图谱（含社区）。

import { GraphBuilder, slug, ENGINE, type GNode } from "./builder.ts";
import { parseCodeFiles, linkCode, symbolIndex, type SymbolIndex } from "./code.ts";
import { parseDocument, linkDocuments, type Section } from "./docs.ts";
import { classifyPath, contentProblem, lineCount, normalizePath, type SkippedFile, type SourceFile } from "../corpus.ts";
import { detectCommunities } from "../community.ts";
import type { Graph } from "../graph.ts";

export { ENGINE } from "./builder.ts";
export type ExtractStats = {
  files: number;
  skipped: SkippedFile[];
  nodes: number;
  links: number;
  communities: number;
  byKind: Record<string, number>;
  byRelation: Record<string, number>;
  byConfidence: Record<string, number>;
};
export type UpstreamCode = { nodes: Record<string, unknown>[]; links: Record<string, unknown>[]; engine: string };

const FILE_TYPE = { code: "code", document: "document", text: "document", config: "config" } as const;

export function extractCorpus(input: SourceFile[], options: { upstream?: UpstreamCode } = {}): { graph: Graph; stats: ExtractStats } {
  const b = new GraphBuilder();
  const skipped: SkippedFile[] = [];
  const files: (SourceFile & { kind: keyof typeof FILE_TYPE; language: string })[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    let path: string;
    try {
      path = normalizePath(raw.path);
    } catch (e) {
      skipped.push({ path: raw.path.slice(0, 200), reason: e instanceof Error ? e.message : "路径无效" });
      continue;
    }
    if (seen.has(path)) {
      skipped.push({ path, reason: "重复路径" });
      continue;
    }
    const c = classifyPath(path);
    if ("skip" in c) {
      skipped.push({ path, reason: c.skip });
      continue;
    }
    const problem = contentProblem(raw.text);
    if (problem) {
      skipped.push({ path, reason: problem });
      continue;
    }
    seen.add(path);
    files.push({ path, text: raw.text.replace(/\r\n?/g, "\n"), kind: c.kind, language: c.language });
  }
  files.sort((a, b2) => a.path.localeCompare(b2.path));
  const everyPath = new Set(files.map((f) => f.path));
  const fileNodes = new Map<string, GNode>();
  const upstreamPaths = new Set<string>();
  if (options.upstream) {
    // 上游 Graphify（tree-sitter）结果：保持原编号与字段，文件节点按 source_file 对应
    for (const n of options.upstream.nodes) {
      if (typeof n.id !== "string") continue;
      const id = b.uniqueId(n.id);
      const label = typeof n.label === "string" ? n.label : id;
      const sfLabel = typeof n.source_file === "string" && label === n.source_file.split("/").pop();
      const kind: GNode["kind"] = sfLabel
        ? "file"
        : label.startsWith(".") && label.endsWith("()")
          ? "method"
          : label.endsWith("()")
            ? "function"
            : n._callable_class || n._callable
              ? "class"
              : n.source_file
                ? "variable"
                : "module";
      const node = { ...n, id, label, kind, file_type: String(n.file_type ?? "code") } as GNode;
      b.nodes.set(id, node);
      const sf = typeof n.source_file === "string" ? n.source_file : "";
      if (sf && everyPath.has(sf)) {
        upstreamPaths.add(sf);
        if (label === sf.split("/").pop()) fileNodes.set(sf, node);
      }
    }
    for (const l of options.upstream.links) {
      if (typeof l.source !== "string" || typeof l.target !== "string") continue;
      const link = b.addLink(l.source, l.target, String(l.relation ?? "related"), (l.confidence as "EXTRACTED") ?? "EXTRACTED", Number(l.confidence_score ?? 1));
      if (link) Object.assign(link, l, { weight: Number(l.weight ?? 1) });
    }
  }
  for (const f of files) {
    if (fileNodes.has(f.path)) {
      Object.assign(fileNodes.get(f.path)!, { kind: "file", language: f.language, source_end: lineCount(f.text) });
      continue;
    }
    fileNodes.set(f.path, b.addNode(slug(f.path.replace(/\.[^./]+$/, "")) + (f.kind === "code" ? "" : "_" + (f.path.split(".").pop() ?? "doc")), {
      label: f.path.split("/").pop() ?? f.path,
      kind: "file",
      file_type: FILE_TYPE[f.kind],
      language: f.language,
      source_file: f.path,
      source_location: "L1",
      source_end: lineCount(f.text),
    }));
  }
  // 目录结构：同目录文件之间不连线，避免把整库连成一团；文件归属通过 source_file 表达。
  const codeFiles = parseCodeFiles(
    b,
    files.filter((f) => f.kind === "code" && !upstreamPaths.has(f.path)).map((f) => ({ ...f, fileNode: fileNodes.get(f.path)! })),
    everyPath,
  );
  linkCode(b, codeFiles, fileNodes);
  const symbols: SymbolIndex = symbolIndex(codeFiles);
  if (options.upstream)
    for (const n of b.nodes.values()) {
      if (!upstreamPaths.has(String(n.source_file ?? "")) || n.kind === "file") continue;
      const name = n.label.replace(/^\./, "").replace(/\(\)$/, "");
      if (name.length >= 3) symbols.set(name, [...(symbols.get(name) ?? []), n]);
    }
  const sections: Section[] = [];
  for (const f of files)
    if (f.kind === "document" || f.kind === "text") sections.push(...parseDocument(b, f.path, f.text, f.language, fileNodes.get(f.path)!));
  const codeSummaries = [...b.nodes.values()]
    .filter((n) => n.file_type === "code" && typeof n.summary === "string")
    .map((n) => ({ node: n, text: String(n.summary) }));
  linkDocuments(b, { sections, symbols, fileNodes, everyPath, codeSummaries });

  const nodes = [...b.nodes.values()];
  const links = [...b.links.values()];
  const membership = detectCommunities(nodes.map((n) => n.id), links);
  for (const n of nodes) n.community = membership.get(n.id) ?? null;
  const count = (xs: string[]) => xs.reduce<Record<string, number>>((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {});
  const graph: Graph = {
    directed: true,
    multigraph: false,
    graph: {
      schema_version: 1,
      generator: options.upstream ? `${ENGINE}+${options.upstream.engine}` : ENGINE,
      graphify_compatible: "0.9.97",
    },
    nodes,
    links,
    hyperedges: [],
  };
  return {
    graph,
    stats: {
      files: files.length,
      skipped,
      nodes: nodes.length,
      links: links.length,
      communities: new Set(membership.values()).size,
      byKind: count(nodes.map((n) => n.kind)),
      byRelation: count(links.map((l) => l.relation)),
      byConfidence: count(links.map((l) => l.confidence)),
    },
  };
}
