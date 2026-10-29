// ABOUTME: 结构目录、校样文稿与校订面板：选择同步、源文与校订对照、逐格表格、类型/级别、同级顺序与复核备注。
import { memo, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronRight, Table2, Image as ImageIcon } from "lucide-react";
import { boxes, type Item, type Row } from "../contracts/docling.ts";
import type { Correction } from "../contracts/review.ts";
import { isRecord } from "../contracts/project.ts";
export const labels: Record<string, string> = {
  title: "标题",
  section_header: "章节",
  text: "正文",
  paragraph: "正文",
  table: "表格",
  list_item: "列表项",
  caption: "题注",
  footnote: "脚注",
  picture: "图片",
  chart: "图表",
  page_header: "页眉",
  page_footer: "页脚",
  code: "代码",
  formula: "公式",
  list: "列表",
  ordered_list: "编号列表",
  unspecified: "分组",
  section: "分节",
  inline: "行内组",
  key_value_area: "键值区",
  form_area: "表单区",
  checkbox_selected: "勾选",
  checkbox_unselected: "未勾选",
  document_index: "目录",
  reference: "参考文献",
};
export const editableLabels = ["title", "section_header", "text", "list_item", "caption", "footnote", "page_header", "page_footer", "code", "formula"];
export const labelOf = (n: Item) => labels[n.label] ?? n.label;
export type Filter = "all" | "todo" | "edited" | "tables";
const isGroup = (n: Item) => n.self_ref.startsWith("#/groups/");
function preview(n: Item) {
  if (n.data) return `${n.data.num_rows} 行 × ${n.data.num_cols} 列`;
  if (n.self_ref.startsWith("#/pictures")) return "图像";
  if (isGroup(n)) return `${n.children.length} 项`;
  return n.text || "（空）";
}
export const StructureRail = memo(function StructureRail({
  rows,
  active,
  corrections,
  onSelect,
  source,
}: {
  rows: Row[];
  active: string;
  corrections: Record<string, Correction>;
  onSelect: (ref: string) => void;
  source: string;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<Filter>("all");
  const list = useRef<HTMLOListElement>(null);
  const q = query.trim().toLowerCase();
  const visible = rows.filter(({ item: n }) => {
    const c = corrections[n.self_ref];
    if (filter === "todo" && (c?.reviewed || isGroup(n))) return false;
    if (filter === "edited" && !(c && (c.text !== undefined || c.cells || c.label !== undefined || c.level !== undefined || c.note))) return false;
    if (filter === "tables" && !n.data) return false;
    return !q || ((c?.text ?? n.text ?? "") + " " + labelOf(n) + " " + (n.data ? n.data.table_cells.map((x) => x.text).join(" ") : "")).toLowerCase().includes(q);
  });
  const countable = rows.filter((r) => !isGroup(r.item));
  const reviewed = countable.filter((r) => corrections[r.item.self_ref]?.reviewed).length;
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-ref="${CSS.escape(active)}"]`);
    if (!el || !list.current) return;
    const a = el.getBoundingClientRect(),
      b = list.current.getBoundingClientRect();
    if (a.top < b.top || a.bottom > b.bottom) el.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <nav className="structure" aria-label="文档结构">
      <div className="panel-label">
        <span>结构</span>
        <span>{countable.length} 项</span>
      </div>
      <input className="search" type="search" name="structureQuery" autoComplete="off" aria-label="查找结构项" placeholder="查找文字、类型或单元格…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="filters" role="group" aria-label="筛选">
        {(
          [
            ["all", "全部"],
            ["todo", "未复核"],
            ["edited", "已校订"],
            ["tables", "表格"],
          ] as const
        ).map(([k, v]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {v}
          </button>
        ))}
      </div>
      <ol ref={list}>
        {visible.map(({ item: n, depth }) => {
          const c = corrections[n.self_ref];
          const pages = [...new Set(boxes(n).map((b) => b.page))];
          return (
            <li key={n.self_ref}>
              <button
                type="button"
                data-ref={n.self_ref}
                className={(n.self_ref === active ? "selected " : "") + (isGroup(n) ? "group " : "") + (n.content_layer === "furniture" ? "furniture" : "")}
                onClick={() => onSelect(n.self_ref)}
                style={{ paddingLeft: Math.min(depth, 4) * 10 + 10 }}
                aria-current={n.self_ref === active ? "true" : undefined}
              >
                <span className="structure-text">
                  <small>
                    {labelOf(n)}
                    {pages.length ? ` · p${pages.join(",")}` : ""}
                    {c && (c.text !== undefined || c.cells || c.label !== undefined || c.level !== undefined) ? " · 已校订" : ""}
                  </small>
                  <span>{c?.text ?? preview(n)}</span>
                </span>
                {c?.reviewed ? <Check size={13} aria-label="已复核" /> : <ChevronRight size={13} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      {!visible.length ? <p className="hint no-results">没有匹配的结构项。</p> : null}
      <div className="structure-footer">
        <span>
          {reviewed} / {countable.length} 已复核
        </span>
        <div className="progress" aria-hidden="true">
          <i style={{ width: (countable.length ? (reviewed / countable.length) * 100 : 0) + "%" }} />
        </div>
        <p>{source}</p>
      </div>
    </nav>
  );
});
function TablePreview({ node }: { node: Item }) {
  const data = node.data!;
  return (
    <div className="table-scroll">
      <table>
        <tbody>
          {Array.from({ length: data.num_rows }, (_, r) => (
            <tr key={r}>
              {data.table_cells
                .filter((cell) => cell.start_row_offset_idx === r)
                .sort((a, b) => a.start_col_offset_idx - b.start_col_offset_idx)
                .map((cell) =>
                  cell.column_header ? (
                    <th key={cell.start_col_offset_idx} rowSpan={cell.row_span} colSpan={cell.col_span} scope="col">
                      {cell.text}
                    </th>
                  ) : (
                    <td key={cell.start_col_offset_idx} rowSpan={cell.row_span} colSpan={cell.col_span}>
                      {cell.text}
                    </td>
                  ),
                )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export const ProofView = memo(function ProofView({
  rows,
  effective,
  active,
  view,
  onView,
  onSelect,
  version,
  corrections,
}: {
  rows: Row[];
  effective: Map<string, Item>;
  active: string;
  view: "review" | "source";
  onView: (v: "review" | "source") => void;
  onSelect: (ref: string) => void;
  version: string;
  corrections: number;
}) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = host.current?.querySelector<HTMLElement>(`[data-ref="${CSS.escape(active)}"]`);
    if (!el) return;
    const scroller = el.closest<HTMLElement>(".proof-scroll");
    if (!scroller) return;
    const a = el.getBoundingClientRect(),
      b = scroller.getBoundingClientRect();
    if (a.top < b.top + 20 || a.bottom > b.bottom - 20) el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);
  return (
    <div className="proof">
      <div className="view-tools" role="toolbar" aria-label="校样工具">
        <div className="segmented" role="group" aria-label="文稿视图">
          <button type="button" aria-pressed={view === "review"} onClick={() => onView("review")}>
            校订稿
          </button>
          <button type="button" aria-pressed={view === "source"} onClick={() => onView("source")}>
            解析原样
          </button>
        </div>
        <span className="hint">{corrections} 项校订</span>
      </div>
      <div className="proof-scroll">
        <article ref={host} className="paper" id="document">
          <div className="paper-meta">
            <span>DoclingDocument {version}</span>
            <span>{view === "review" ? "校订稿" : "解析原样"}</span>
          </div>
          {rows.map(({ item: n }) => {
            if (isGroup(n)) return null;
            const shown = view === "source" ? n : (effective.get(n.self_ref) ?? n);
            const picture = n.self_ref.startsWith("#/pictures");
            return (
              <section className={"paper-block " + (n.content_layer === "furniture" ? "furniture " : "") + (active === n.self_ref ? "active" : "")} key={n.self_ref} data-ref={n.self_ref}>
                <button type="button" className="block-select" aria-label={"选择 " + labelOf(shown) + " " + (shown.text ?? "").slice(0, 30)} onClick={() => onSelect(n.self_ref)}>
                  <span className="block-marker">{labelOf(shown)}</span>
                  {shown.data ? (
                    <span className="table-heading">
                      <Table2 size={15} aria-hidden="true" />
                      表格 · {shown.data.num_rows} × {shown.data.num_cols}
                    </span>
                  ) : picture ? (
                    <span className="picture-slot">
                      <ImageIcon size={18} aria-hidden="true" /> 图像（原页中查看）
                    </span>
                  ) : (
                    <span className={"body-text " + shown.label + (shown.label === "section_header" ? " h" + Math.min(4, Number(shown.level) || 1) : "")}>
                      {shown.label === "list_item" ? <b className="marker">{typeof shown.marker === "string" && shown.marker ? shown.marker : "•"}</b> : null}
                      {shown.text || "［空结构项］"}
                    </span>
                  )}
                </button>
                {shown.data ? <TablePreview node={shown} /> : null}
              </section>
            );
          })}
          <footer className="paper-end">— 文档结束 —</footer>
        </article>
      </div>
    </div>
  );
});
export function Inspector({
  active,
  correction,
  onPatch,
  onMove,
  onRevert,
  onSelect,
  onCsv,
}: {
  active: Item | undefined;
  correction: Correction | undefined;
  onPatch: (value: Partial<Correction>) => void;
  onMove: (delta: number) => void;
  onRevert: () => void;
  onSelect: (ref: string) => void;
  onCsv: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [active?.self_ref]);
  if (!active)
    return (
      <aside className="inspector" aria-label="校订面板">
        <p className="hint">在原页、结构或文稿中选择一项。</p>
      </aside>
    );
  const label = correction?.label ?? active.label;
  const pages = [...new Set(boxes(active).map((b) => b.page))];
  const group = isGroup(active);
  return (
    <aside className="inspector" aria-label="校订面板">
      <div className="panel-label">
        <span>校订</span>
        <span>{labelOf(active)}</span>
      </div>
      <div className="ref-tag">
        <code>{active.self_ref}</code>
        {pages.length ? <span>第 {pages.join("、")} 页</span> : null}
      </div>
      {group ? (
        <div className="inspector-section">
          <p className="hint">分组本身没有文字；选择其中的子项进行校订。</p>
        </div>
      ) : (
        <div className="inspector-section">
          <label className="review-check">
            <input type="checkbox" checked={correction?.reviewed ?? false} onChange={(e) => onPatch({ reviewed: e.target.checked })} />
            <span>此项已复核</span>
          </label>
          {active.text !== undefined ? (
            <div className="type-row">
              <label>
                结构类型
                <select value={label} onChange={(e) => onPatch({ label: e.target.value, reviewed: false })}>
                  {Array.from(new Set([active.label, ...editableLabels])).map((x) => (
                    <option value={x} key={x}>
                      {labels[x] ?? x}
                    </option>
                  ))}
                </select>
              </label>
              {label === "section_header" ? (
                <label>
                  级别
                  <select value={correction?.level ?? (Number(active.level) || 1)} onChange={(e) => onPatch({ level: Number(e.target.value), reviewed: false })}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {active.text !== undefined ? (
            <>
              <label>
                校订文本
                <textarea className="text-edit" value={correction?.text ?? active.text} onChange={(e) => onPatch({ text: e.target.value, reviewed: false })} />
              </label>
              <details className="source-compare" open>
                <summary>解析原文</summary>
                <p>{active.text || "（空）"}</p>
              </details>
            </>
          ) : null}
          {active.data ? (
            <div className="cell-editor">
              <div className="section-heading">
                <h3>表格单元格</h3>
                <button type="button" className="quiet" onClick={onCsv}>
                  导出 CSV
                </button>
              </div>
              <p className="hint">保留原表合并范围；逐格修订文本。已改的格以墨蓝标出。</p>
              <div className="cell-grid">
                {active.data.table_cells.map((cell, i) => {
                  const value = correction?.cells?.[String(i)];
                  return (
                    <label key={i} className={value !== undefined && value !== cell.text ? "changed" : ""}>
                      <span>
                        R{cell.start_row_offset_idx + 1}·C{cell.start_col_offset_idx + 1}
                        {cell.row_span > 1 || cell.col_span > 1 ? ` (${cell.row_span}×${cell.col_span})` : ""}
                        {cell.column_header ? " · 表头" : ""}
                      </span>
                      <input
                        aria-label={`第 ${cell.start_row_offset_idx + 1} 行第 ${cell.start_col_offset_idx + 1} 列`}
                        value={value ?? cell.text}
                        autoComplete="off"
                        onChange={(e) => onPatch({ cells: { ...correction?.cells, [String(i)]: e.target.value }, reviewed: false })}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div className="inspector-section">
        <h3>阅读次序</h3>
        <div className="actions">
          <button type="button" onClick={() => onMove(-1)}>
            <ArrowUp size={14} aria-hidden="true" />
            同级上移
          </button>
          <button type="button" onClick={() => onMove(1)}>
            <ArrowDown size={14} aria-hidden="true" />
            同级下移
          </button>
        </div>
        {isRecord(active.parent) && typeof active.parent.$ref === "string" ? (
          <p className="hint">
            父级 <button type="button" className="link" onClick={() => onSelect(String((active.parent as { $ref: string }).$ref))}>{String(active.parent.$ref)}</button>
          </p>
        ) : null}
        {!group ? (
          <label>
            复核备注
            <textarea className="notes" value={correction?.note ?? ""} onChange={(e) => onPatch({ note: e.target.value })} placeholder="记录歧义或需要回查的内容…" />
          </label>
        ) : null}
        {confirm ? (
          <div className="confirm" role="alert">
            <p>移除此项的校订、复核与备注？</p>
            <button type="button" className="danger" onClick={() => { setConfirm(false); onRevert(); }}>确认撤销</button>
            <button type="button" onClick={() => setConfirm(false)}>取消</button>
          </div>
        ) : (
          <button type="button" className="quiet" disabled={!correction} onClick={() => setConfirm(true)}>
            撤销此项校订…
          </button>
        )}
      </div>
    </aside>
  );
}
