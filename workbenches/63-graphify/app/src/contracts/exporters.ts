// ABOUTME: 导出：Graphify 原生 graph.json（含社区名称）、GraphML、自包含 HTML 报告与 Markdown 报告。

import {
  colorOf, godNodes, summarizeCommunities, surprisingConnections, graphStats,
  type CommunityMeta, type CommunitySummary,
} from "./analysis.ts";
import { communityOf, degreeMap, field, KIND_NAMES, label, nodeKind, RELATION_NAMES, type Graph } from "./graph.ts";
import type { CorpusFile } from "./corpus.ts";
import type { Point } from "./map.ts";

export function exportGraphJson(graph: Graph, communities: CommunitySummary[]) {
  const meta = { ...(graph.graph as Record<string, unknown> | undefined) };
  meta.community_labels = Object.fromEntries(communities.map((c) => [String(c.id), c.label]));
  return JSON.stringify({ ...graph, graph: meta }, null, 2);
}

// XML 1.0 不允许的控制字符一律去掉
const xmlText = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type KeyType = "string" | "double" | "int" | "boolean";
function collectKeys(items: Record<string, unknown>[], skip: Set<string>) {
  const types = new Map<string, Set<string>>();
  for (const item of items)
    for (const [k, v] of Object.entries(item)) {
      if (skip.has(k) || v === null || v === undefined) continue;
      const t = typeof v === "number" ? (Number.isInteger(v) ? "int" : "double") : typeof v === "boolean" ? "boolean" : "string";
      const set = types.get(k) ?? new Set<string>();
      set.add(t);
      types.set(k, set);
    }
  const out = new Map<string, KeyType>();
  for (const [k, set] of [...types.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.set(k, set.size === 1 ? ([...set][0] as KeyType) : set.has("string") || set.has("boolean") ? "string" : "double");
  }
  return out;
}
const valueText = (v: unknown, type: KeyType) =>
  type === "string" ? (typeof v === "string" ? v : JSON.stringify(v)) : String(v);

export function exportGraphML(graph: Graph, communities: CommunitySummary[]) {
  const names = new Map(communities.map((c) => [c.id, c.label]));
  const nodes = graph.nodes.map((n) => {
    const c = communityOf(n);
    return c !== null && names.has(c) ? { ...n, community_label: names.get(c) } : n;
  });
  const nodeKeys = collectKeys(nodes, new Set(["id"]));
  const edgeKeys = collectKeys(graph.links, new Set(["source", "target", "id"]));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
  ];
  const ids = new Map<string, string>();
  let k = 0;
  for (const [name, type] of nodeKeys) {
    const id = `n${k++}`;
    ids.set(`node:${name}`, id);
    lines.push(`  <key id="${id}" for="node" attr.name="${xmlText(name)}" attr.type="${type}"/>`);
  }
  k = 0;
  for (const [name, type] of edgeKeys) {
    const id = `e${k++}`;
    ids.set(`edge:${name}`, id);
    lines.push(`  <key id="${id}" for="edge" attr.name="${xmlText(name)}" attr.type="${type}"/>`);
  }
  lines.push(`  <graph id="G" edgedefault="${graph.directed ? "directed" : "undirected"}">`);
  for (const n of nodes) {
    lines.push(`    <node id="${xmlText(n.id)}">`);
    for (const [name, type] of nodeKeys) {
      const v = (n as Record<string, unknown>)[name];
      if (v === null || v === undefined) continue;
      lines.push(`      <data key="${ids.get(`node:${name}`)}">${xmlText(valueText(v, type))}</data>`);
    }
    lines.push("    </node>");
  }
  graph.links.forEach((l, i) => {
    lines.push(`    <edge id="edge${i}" source="${xmlText(l.source)}" target="${xmlText(l.target)}">`);
    for (const [name, type] of edgeKeys) {
      const v = (l as Record<string, unknown>)[name];
      if (v === null || v === undefined) continue;
      lines.push(`      <data key="${ids.get(`edge:${name}`)}">${xmlText(valueText(v, type))}</data>`);
    }
    lines.push("    </edge>");
  });
  lines.push("  </graph>", "</graphml>", "");
  return lines.join("\n");
}

const md = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const where = (n: Record<string, unknown> | undefined) => {
  const f = field(n, "source_file");
  const l = field(n, "source_location");
  return f ? `${f}${l ? `:${l.replace(/^L/, "")}` : ""}` : "外部";
};

export function exportMarkdownReport(title: string, graph: Graph, communityMeta: CommunityMeta[], corpus: CorpusFile[]) {
  const communities = summarizeCommunities(graph, communityMeta);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const degree = degreeMap(graph);
  const stats = graphStats(graph);
  const out = [
    `# ${title} · 图谱报告`,
    "",
    `${stats.nodes} 个节点 · ${stats.links} 条关系 · ${stats.communities} 个社区 · ${corpus.length || stats.files} 份资料`,
    "",
    `关系置信度：${Object.entries(stats.byConfidence).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
    "",
    "## 核心节点",
    "",
    "| 节点 | 类型 | 连接数 | 位置 |",
    "| --- | --- | --- | --- |",
    ...godNodes(graph).map((g) => {
      const n = byId.get(g.id);
      return `| ${md(label(n))} | ${KIND_NAMES[nodeKind(n)] ?? nodeKind(n)} | ${g.degree} | ${md(where(n))} |`;
    }),
    "",
    "## 社区",
    "",
    ...communities.flatMap((c) => [
      `### ${c.id}. ${md(c.label)}（${c.size}）`,
      "",
      ...(c.summary ? [c.summary, ""] : []),
      `主要成员：${c.top.map((id) => label(byId.get(id))).join("、")}`,
      "",
    ]),
    "## 意外关联",
    "",
    "跨社区且跨资料类型或经推断得到的关系，值得核对。",
    "",
    ...surprisingConnections(graph).map(({ link }) => {
      const a = byId.get(link.source), b = byId.get(link.target);
      return `- ${label(a)} —${RELATION_NAMES[String(link.relation)] ?? link.relation}→ ${label(b)}（${link.confidence ?? "EXTRACTED"}，${where(link as Record<string, unknown>)}）`;
    }),
    "",
    "## 资料",
    "",
    "| 文件 | 类型 | 行数 | 节点 |",
    "| --- | --- | --- | --- |",
    ...corpus.map((f) => `| ${md(f.path)} | ${f.language} | ${f.lines} | ${graph.nodes.filter((n) => n.source_file === f.path).length} |`),
    "",
    `_孤立节点 ${graph.nodes.filter((n) => !degree.get(n.id)).length} 个。_`,
    "",
  ];
  return out.join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** 自包含 HTML：静态 SVG 地图（当前布局）、社区筛选、节点详情与报告各节；不加载任何外部资源。 */
export function exportHtmlReport(
  title: string,
  graph: Graph,
  communityMeta: CommunityMeta[],
  corpus: CorpusFile[],
  positions: Map<string, Point>,
  generatedAt: string,
) {
  const communities = summarizeCommunities(graph, communityMeta);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const degree = degreeMap(graph);
  const stats = graphStats(graph);
  const pts = graph.nodes.map((n, i) => positions.get(n.id) ?? { x: Math.cos(i) * 300, y: Math.sin(i) * 300 });
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(0, ...xs) - 40, maxX = Math.max(1, ...xs) + 40, minY = Math.min(0, ...ys) - 40, maxY = Math.max(1, ...ys) + 40;
  const index = new Map(graph.nodes.map((n, i) => [n.id, i]));
  const radius = (id: string) => 3 + Math.min(9, Math.sqrt(degree.get(id) ?? 0) * 1.6);
  const labelled = new Set(godNodes(graph, 30).map((g) => g.id));
  const edges = graph.links
    .map((l) => {
      const a = pts[index.get(l.source)!], b = pts[index.get(l.target)!];
      const ca = communityOf(byId.get(l.source)), cb = communityOf(byId.get(l.target));
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" data-c="${ca ?? ""} ${cb ?? ""}"${l.confidence && l.confidence !== "EXTRACTED" ? ' stroke-dasharray="4 3"' : ""}/>`;
    })
    .join("");
  const nodes = graph.nodes
    .map((n, i) => {
      const p = pts[i], c = communityOf(n);
      return `<g class="n" data-i="${i}" data-c="${c ?? ""}" tabindex="0" role="button" aria-label="${esc(label(n))}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius(n.id).toFixed(1)}" fill="${colorOf(c)}"/>${labelled.has(n.id) ? `<text x="${(p.x + radius(n.id) + 3).toFixed(1)}" y="${(p.y + 4).toFixed(1)}">${esc(label(n))}</text>` : ""}</g>`;
    })
    .join("");
  const data = {
    nodes: graph.nodes.map((n) => ({
      label: label(n),
      kind: KIND_NAMES[nodeKind(n)] ?? nodeKind(n),
      c: communityOf(n),
      where: where(n),
      summary: field(n, "summary"),
    })),
    links: graph.links.map((l) => [index.get(l.source), index.get(l.target), RELATION_NAMES[String(l.relation)] ?? String(l.relation ?? ""), String(l.confidence ?? "")]),
    communities: Object.fromEntries(communities.map((c) => [c.id, c.label])),
  };
  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · 图谱报告</title>
<style>
:root{color-scheme:light;--ink:#18212b;--muted:#5d6977;--line:#d6dde4;--paper:#f6f8fa}
*{box-sizing:border-box}body{margin:0;font:14px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);background:#fff}
header,main{max-width:1180px;margin:0 auto;padding:24px 20px}header h1{margin:0 0 4px;font-size:24px}header p{margin:0;color:var(--muted)}
.map{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px}@media(max-width:820px){.map{grid-template-columns:1fr}}
svg{width:100%;height:auto;max-height:72vh;background:var(--paper);border:1px solid var(--line);border-radius:8px}
line{stroke:#9aa6b2;stroke-opacity:.45;stroke-width:1}g.n{cursor:pointer}g.n circle{stroke:#fff;stroke-width:1.2}g.n:focus{outline:none}g.n:focus circle,g.n.sel circle{stroke:#111;stroke-width:2.5}
text{font-size:11px;fill:#33404d;paint-order:stroke;stroke:#f6f8fa;stroke-width:3px}.off{display:none}
aside{border:1px solid var(--line);border-radius:8px;padding:12px;align-self:start}aside h2{font-size:15px;margin:0 0 8px}
.legend label{display:flex;gap:6px;align-items:center;font-size:13px}.sw{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}
#detail{margin-top:12px;border-top:1px solid var(--line);padding-top:10px;font-size:13px}#detail ul{padding-left:18px;margin:6px 0}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600}
section{margin-top:28px}section h2{font-size:18px;margin:0 0 10px}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
</style>
</head>
<body>
<header><h1>${esc(title)}</h1><p>${stats.nodes} 个节点 · ${stats.links} 条关系 · ${stats.communities} 个社区 · ${corpus.length || stats.files} 份资料 · 生成于 ${esc(generatedAt)}</p></header>
<main>
<div class="map">
<svg viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}" role="img" aria-label="知识地图"><g id="edges">${edges}</g><g id="nodes">${nodes}</g></svg>
<aside><h2>社区</h2><div class="legend">${communities
    .map((c) => `<label><input type="checkbox" checked data-c="${c.id}"><span class="sw" style="background:${colorOf(c.id)}"></span>${esc(c.label)}（${c.size}）</label>`)
    .join("")}</div><div id="detail"><p>点击节点查看来源与关系。</p></div></aside>
</div>
<section><h2>核心节点</h2><table><thead><tr><th>节点</th><th>类型</th><th>连接数</th><th>位置</th></tr></thead><tbody>${godNodes(graph)
    .map((g) => {
      const n = byId.get(g.id);
      return row([esc(label(n)), esc(KIND_NAMES[nodeKind(n)] ?? nodeKind(n)), String(g.degree), `<code>${esc(where(n))}</code>`]);
    })
    .join("")}</tbody></table></section>
<section><h2>社区</h2><table><thead><tr><th>社区</th><th>规模</th><th>主要成员</th><th>说明</th></tr></thead><tbody>${communities
    .map((c) => row([`<span class="sw" style="background:${colorOf(c.id)}"></span> ${esc(c.label)}`, String(c.size), esc(c.top.map((id) => label(byId.get(id))).join("、")), esc(c.summary)]))
    .join("")}</tbody></table></section>
<section><h2>意外关联</h2><table><thead><tr><th>关系</th><th>置信度</th><th>位置</th></tr></thead><tbody>${surprisingConnections(graph)
    .map(({ link }) => row([`${esc(label(byId.get(link.source)))} —${esc(RELATION_NAMES[String(link.relation)] ?? String(link.relation))}→ ${esc(label(byId.get(link.target)))}`, esc(String(link.confidence ?? "")), `<code>${esc(where(link as Record<string, unknown>))}</code>`]))
    .join("")}</tbody></table></section>
<section><h2>资料</h2><table><thead><tr><th>文件</th><th>类型</th><th>行数</th></tr></thead><tbody>${corpus
    .map((f) => row([`<code>${esc(f.path)}</code>`, esc(f.language), String(f.lines)]))
    .join("")}</tbody></table></section>
</main>
<script type="application/json" id="graph-data">${jsonForScript(data)}</script>
<script>
(function(){var d=JSON.parse(document.getElementById("graph-data").textContent);var nodes=document.querySelectorAll("g.n"),lines=document.querySelectorAll("#edges line"),detail=document.getElementById("detail");
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function show(i){nodes.forEach(function(g){g.classList.toggle("sel",+g.dataset.i===i)});var n=d.nodes[i],rel=[];d.links.forEach(function(l){if(l[0]===i)rel.push(l[2]+" → "+d.nodes[l[1]].label);else if(l[1]===i)rel.push(d.nodes[l[0]].label+" → "+l[2])});
detail.innerHTML="<h2>"+esc(n.label)+"</h2><p>"+esc(n.kind)+" · "+esc(d.communities[n.c]||"未分组")+"<br><code>"+esc(n.where)+"</code></p>"+(n.summary?"<p>"+esc(n.summary)+"</p>":"")+"<ul>"+rel.slice(0,40).map(function(r){return"<li>"+esc(r)+"</li>"}).join("")+"</ul>"}
nodes.forEach(function(g){g.addEventListener("click",function(){show(+g.dataset.i)});g.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();show(+g.dataset.i)}})});
document.querySelectorAll(".legend input").forEach(function(box){box.addEventListener("change",function(){var off={};document.querySelectorAll(".legend input").forEach(function(b){if(!b.checked)off[b.dataset.c]=1});
nodes.forEach(function(g){g.classList.toggle("off",!!off[g.dataset.c])});lines.forEach(function(l){var c=l.dataset.c.split(" ");l.classList.toggle("off",!!(off[c[0]]||off[c[1]]))})})})})();
</script>
</body>
</html>
`;
}
