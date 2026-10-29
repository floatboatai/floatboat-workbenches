// ABOUTME: 左栏：章节树（PDF书签/版面标题/PageIndex）、全文检索，以及可选PageIndex服务卡片。
import { memo, useDeferredValue, useMemo, useState } from "react";
import { searchPages } from "../contracts/outline.ts";
import {
  flatten,
  type DocumentIndex,
  type IndexNode,
  type OutlineChoice,
  type OutlineSource,
} from "../contracts/reader.ts";
import type { OutlineJob, ServiceStatus } from "./useService.ts";

export const SOURCE_LABEL: Record<string, string> = {
  "pdf-outline": "PDF书签",
  "heading-scan": "版面标题识别",
  "page-ranges": "按页分段",
  flash: "PageIndex Flash",
  imported: "导入",
  "pageindex-flash": "PageIndex Flash",
  "pageindex-classic": "PageIndex 模型树",
};

const Tree = memo(function Tree({
  nodes,
  trail,
  open,
  toggle,
  onSelect,
  level = 0,
}: {
  nodes: IndexNode[];
  trail: string[];
  open: (node: IndexNode) => boolean;
  toggle: (node: IndexNode) => void;
  onSelect: (node: IndexNode) => void;
  level?: number;
}) {
  return (
    <ol className="chapter-list" role={level ? "group" : undefined}>
      {nodes.map((n) => {
        const here = trail.includes(n.node_id),
          expanded = !!n.nodes?.length && open(n);
        return (
          <li key={n.node_id}>
            <div className={here ? "chapter here" : "chapter"} style={{ paddingLeft: 6 + level * 14 }}>
              {n.nodes?.length ? (
                <button
                  className="twisty"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "收起" : "展开"}${n.title}`}
                  onClick={() => toggle(n)}
                >
                  {expanded ? "▾" : "▸"}
                </button>
              ) : (
                <span className="twisty" aria-hidden="true" />
              )}
              <button
                className="chapter-link"
                aria-current={trail[trail.length - 1] === n.node_id ? "location" : undefined}
                title={n.summary || undefined}
                onClick={() => onSelect(n)}
              >
                <span>{n.title}</span>
                <small>{n.start_index === n.end_index ? n.start_index : `${n.start_index}–${n.end_index}`}</small>
              </button>
            </div>
            {expanded ? (
              <Tree
                nodes={n.nodes!}
                trail={trail}
                open={open}
                toggle={toggle}
                onSelect={onSelect}
                level={level + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
});

const COMMANDS = `cd workbenches/64-pageindex/service
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python requirements.lock
.venv/bin/python server.py --port 8784`;

function ServiceCard({
  status,
  job,
  hasDocument,
  disabled,
  onRecheck,
  onBuild,
}: {
  status: { checked: boolean; service: ServiceStatus | null };
  job: OutlineJob | null;
  hasDocument: boolean;
  disabled: boolean;
  onRecheck: () => void;
  onBuild: (mode: OutlineSource) => void;
}) {
  const s = status.service,
    [copied, setCopied] = useState("");
  const running = job?.status === "running";
  return (
    <details className="service-card" open={!!s?.available || running || undefined}>
      <summary>
        <span className={s?.available ? "dot on" : "dot"} aria-hidden="true" />
        PageIndex 章节树
        <small>{!status.checked ? "检查中…" : s?.available ? "已连接" : "可选 · 未连接"}</small>
      </summary>
      {s?.available ? (
        <>
          <p>
            {s.message} · <code>{s.url}</code>
          </p>
          <div className="service-actions">
            <button
              disabled={disabled || !hasDocument || running}
              onClick={() => onBuild("pageindex-flash")}
            >
              生成 Flash 章节树
              <small>版面统计，无需模型</small>
            </button>
            <button
              disabled={disabled || !hasDocument || running || !s.modes.includes("pageindex-classic")}
              onClick={() => onBuild("pageindex-classic")}
            >
              生成模型章节树
              <small>
                {s.modes.includes("pageindex-classic")
                  ? `${s.model} · 节点摘要＋文档描述`
                  : "服务未配置 PAGEINDEX_MODEL"}
              </small>
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            阅读、检索、摘录与问答都不需要它。启动本机服务后，可用 PageIndex 重建章节树。在完整仓库根目录运行：
          </p>
          <pre className="command" tabIndex={0} aria-label="启动命令">
            {COMMANDS}
          </pre>
          <p className="fine">
            模型章节树（<code>page_index</code>，含节点摘要与文档描述）需在启动前设置{" "}
            <code>PAGEINDEX_MODEL</code> 与对应服务商密钥（如 <code>OPENAI_API_KEY</code>）。其他地址用{" "}
            <code>PAGEINDEX_SERVICE_URL</code> 指定。{s ? `当前检查：${s.url} · ${s.message}` : ""}
          </p>
        </>
      )}
      {job ? (
        <p className={job.status === "failed" ? "field-error" : "fine"} role="status">
          {job.status === "running"
            ? `正在生成${SOURCE_LABEL[job.mode]}…（长报告可能需要几分钟）`
            : job.status === "failed"
              ? job.error
              : `${SOURCE_LABEL[job.mode]}已生成。`}
        </p>
      ) : null}
      <div className="service-actions row">
        <button onClick={onRecheck}>重新检查</button>
        {!s?.available ? (
          <button
            onClick={() => {
              void navigator.clipboard
                ?.writeText(COMMANDS)
                .then(() => setCopied("已复制"))
                .catch(() => setCopied("请手动选择复制"));
            }}
          >
            {copied || "复制命令"}
          </button>
        ) : null}
      </div>
    </details>
  );
}

export function ContentsPane({
  index,
  structure,
  trail,
  choice,
  page,
  query,
  disabled,
  status,
  job,
  onChoice,
  onSelect,
  onQuery,
  onHit,
  onRecheck,
  onBuild,
}: {
  index: DocumentIndex | null;
  structure: IndexNode[];
  trail: string[];
  choice: OutlineChoice;
  page: number;
  query: string;
  disabled: boolean;
  status: { checked: boolean; service: ServiceStatus | null };
  job: OutlineJob | null;
  onChoice: (choice: OutlineChoice) => void;
  onSelect: (node: IndexNode) => void;
  onQuery: (query: string) => void;
  onHit: (page: number, quote: string) => void;
  onRecheck: () => void;
  onBuild: (mode: OutlineSource) => void;
}) {
  const [mode, setMode] = useState<"tree" | "search">("tree"),
    [toggled, setToggled] = useState<Record<string, boolean>>({});
  const total = useMemo(() => flatten(structure).length, [structure]);
  const deferred = useDeferredValue(query);
  const hits = useMemo(
    () => (index && mode === "search" ? searchPages(index.pages, deferred) : []),
    [index, deferred, mode],
  );
  const open = (n: IndexNode) =>
    toggled[n.node_id] ?? (total <= 80 || trail.includes(n.node_id) || (page >= n.start_index && page <= n.end_index));
  const description =
    choice === "document"
      ? ""
      : (index?.outlines?.find((o) => o.source === choice)?.description ?? "");
  return (
    <aside className="contents" aria-label="目录与检索">
      <div
        className="pane-tabs"
        role="tablist"
        aria-label="左栏"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const next = mode === "tree" ? "search" : "tree";
          setMode(next);
          e.currentTarget.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
        }}
      >
        <button
          id="tab-tree"
          role="tab"
          aria-selected={mode === "tree"}
          aria-controls="panel-contents"
          tabIndex={mode === "tree" ? 0 : -1}
          onClick={() => setMode("tree")}
        >
          目录
        </button>
        <button
          id="tab-search"
          role="tab"
          aria-selected={mode === "search"}
          aria-controls="panel-contents"
          tabIndex={mode === "search" ? 0 : -1}
          onClick={() => setMode("search")}
        >
          检索
        </button>
      </div>
      {mode === "tree" ? (
        <div className="pane-body" id="panel-contents" role="tabpanel" aria-labelledby="tab-tree">
          {index ? (
            <>
              <label className="tree-source">
                <span>章节来源</span>
                <select
                  name="outlineChoice"
                  value={choice}
                  disabled={disabled}
                  onChange={(e) => onChoice(e.target.value as OutlineChoice)}
                >
                  <option value="document">
                    {SOURCE_LABEL[index.index.toc_source] ?? index.index.toc_source}
                  </option>
                  {index.outlines?.map((o) => (
                    <option key={o.source} value={o.source}>
                      {SOURCE_LABEL[o.source]}
                    </option>
                  ))}
                </select>
              </label>
              {description ? <p className="doc-description">{description}</p> : null}
              <nav aria-label="章节目录">
                <Tree
                  nodes={structure}
                  trail={trail}
                  open={open}
                  toggle={(n) => setToggled((t) => ({ ...t, [n.node_id]: !open(n) }))}
                  onSelect={onSelect}
                />
              </nav>
            </>
          ) : (
            <p className="muted">打开PDF后，这里显示它自己的书签目录；没有书签时按版面标题生成。</p>
          )}
        </div>
      ) : (
        <div className="pane-body" id="panel-contents" role="tabpanel" aria-labelledby="tab-search">
          <label className="search-field">
            <span className="sr-only">在全文中检索</span>
            <input
              type="search"
              name="search"
              autoComplete="off"
              placeholder="在全文中检索…"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              disabled={!index}
            />
          </label>
          {index && deferred.trim().length >= 2 ? (
            <p className="muted" role="status">
              {hits.length >= 200 ? "前200处" : `${hits.length} 处`}
            </p>
          ) : null}
          <ol className="hits">
            {hits.map((hit, i) => (
              <li key={`${hit.page}-${hit.offset}-${i}`}>
                <button onClick={() => onHit(hit.page, deferred.trim())}>
                  <small>第 {hit.page} 页</small>
                  <span>{hit.snippet}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <ServiceCard
        status={status}
        job={job}
        hasDocument={!!index}
        disabled={disabled}
        onRecheck={onRecheck}
        onBuild={onBuild}
      />
    </aside>
  );
}
