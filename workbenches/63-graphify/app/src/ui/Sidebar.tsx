// ABOUTME: 左侧栏：社区（着色、显隐、单独查看、改名、模型命名）与资料集（添加文件/文件夹、粘贴、抽取引擎、跳过清单）。

import { useState, type DragEvent } from "react";
import { Eye, EyeOff, FolderOpen, FilePlus2, RefreshCw, Sparkles, Trash2, ClipboardPaste, Crosshair } from "lucide-react";
import { colorOf } from "../contracts/analysis.ts";
import { label } from "../contracts/graph.ts";
import type { Desk } from "./useGraphDesk.ts";
import { readDrop, readFileList } from "./files.ts";

const KIND_LABEL: Record<string, string> = { code: "代码", document: "文档", text: "文本", config: "配置" };

export function Sidebar({ d, onHost }: { d: Desk; onHost: () => void }) {
  return (
    <aside className="sidebar" aria-label="社区与资料">
      <div className="seg" role="tablist" aria-label="左侧栏">
        <button role="tab" aria-selected={d.panel === "communities"} onClick={() => d.setPanel("communities")}>
          社区 <b>{d.communities.length}</b>
        </button>
        <button role="tab" aria-selected={d.panel === "sources"} onClick={() => d.setPanel("sources")}>
          资料 <b>{d.p.data.corpus.length}</b>
        </button>
      </div>
      {d.panel === "communities" ? <Communities d={d} onHost={onHost} /> : <Sources d={d} />}
    </aside>
  );
}

function Communities({ d, onHost }: { d: Desk; onHost: () => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  if (!d.communities.length)
    return (
      <div className="side-empty">
        <p>还没有社区。先在「资料」中加入文件并抽取，社区会由 Louvain 检测自动分出。</p>
        <button className="primary" onClick={() => d.setPanel("sources")}>
          加入资料
        </button>
      </div>
    );
  const big = d.communities.filter((c) => c.size > 1);
  const singles = d.communities.filter((c) => c.size === 1);
  return (
    <div className="side-body">
      <div className="side-actions">
        <button onClick={d.showAll} disabled={!d.p.data.hidden.length}>
          全部显示
        </button>
        <button onClick={onHost} title="可选：用 Floatboat 模型为社区命名">
          <Sparkles size={14} aria-hidden="true" />
          模型命名
        </button>
      </div>
      <ul className="community-list">
        {big.map((c) => {
          const off = d.hidden.has(c.id);
          return (
            <li key={c.id} className={off ? "off" : ""}>
              <span className="swatch" style={{ background: colorOf(c.id) }} aria-hidden="true" />
              <div className="community-main">
                {editing === c.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      d.renameCommunity(c.id, draft);
                      setEditing(null);
                    }}
                  >
                    <input
                      aria-label={`社区 ${c.id} 名称`}
                      name="communityName"
                      autoComplete="off"
                      value={draft}
                      maxLength={80}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => {
                        d.renameCommunity(c.id, draft);
                        setEditing(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                  </form>
                ) : (
                  <button
                    className="community-name"
                    title="点击改名"
                    onClick={() => {
                      setEditing(c.id);
                      setDraft(c.label);
                    }}
                  >
                    {c.label}
                    {c.origin !== "auto" ? <em>{c.origin === "host" ? "模型" : "人工"}</em> : null}
                  </button>
                )}
                <small>
                  {c.size} 个节点 · {c.files} 份资料 · 外连 {c.external}
                </small>
                {c.summary ? <p>{c.summary}</p> : null}
                <div className="community-top">
                  {c.top.slice(0, 4).map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        d.select(id);
                        d.setMobile("detail");
                      }}
                    >
                      {label(d.byId.get(id))}
                    </button>
                  ))}
                </div>
              </div>
              <div className="community-tools">
                <button className="icon" aria-label={off ? `显示 ${c.label}` : `隐藏 ${c.label}`} aria-pressed={!off} onClick={() => d.toggleCommunity(c.id)}>
                  {off ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
                <button className="icon" aria-label={`只看 ${c.label}`} onClick={() => d.soloCommunity(c.id)}>
                  <Crosshair size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {singles.length ? (
        <details className="singles">
          <summary>{singles.length} 个孤立节点</summary>
          <div className="community-top">
            {singles.map((c) => (
              <button key={c.id} onClick={() => d.select(c.members[0])}>
                {label(d.byId.get(c.members[0]))}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Sources({ d }: { d: Desk }) {
  const { p, mutable } = d;
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState(typeof p.draft.pasteText === "string" && !!p.draft.pasteText);
  const busy = !!d.progress || !mutable;
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (busy) return;
    void d.addFiles(await readDrop(e.dataTransfer));
  };
  const g = d.engine.graphify;
  return (
    <div className="side-body">
      <div
        className={`dropzone${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p>
          拖入<strong>文件夹或多份文件</strong>：代码、Markdown、文本与配置。依赖与构建目录、二进制文件会自动跳过。
        </p>
        <div className="drop-actions">
          <label className={`button primary${busy ? " disabled" : ""}`}>
            <FolderOpen size={15} aria-hidden="true" />
            选择文件夹…
            <input
              type="file"
              className="sr-only"
              multiple
              disabled={busy}
              {...({ webkitdirectory: "" } as Record<string, string>)}
              onChange={async (e) => {
                const list = e.target.files;
                if (list?.length) void d.addFiles(await readFileList(list));
                e.target.value = "";
              }}
            />
          </label>
          <label className={`button${busy ? " disabled" : ""}`}>
            <FilePlus2 size={15} aria-hidden="true" />
            选择文件…
            <input
              type="file"
              className="sr-only"
              multiple
              disabled={busy}
              onChange={async (e) => {
                const list = e.target.files;
                if (list?.length) void d.addFiles(await readFileList(list));
                e.target.value = "";
              }}
            />
          </label>
          <button disabled={busy} aria-expanded={paste} onClick={() => setPaste((v) => !v)}>
            <ClipboardPaste size={15} aria-hidden="true" />
            粘贴文字
          </button>
        </div>
        {d.progress ? (
          <p className="progress" role="status">
            {d.progress.phase}… {d.progress.total > 1 ? `${d.progress.done}/${d.progress.total}` : ""}
          </p>
        ) : null}
      </div>
      {paste ? (
        <div className="paste">
          <label>
            文件名
            <input
              name="pasteName"
              autoComplete="off"
              placeholder="会议纪要.md…"
              value={typeof p.draft.pasteName === "string" ? p.draft.pasteName : ""}
              maxLength={120}
              onChange={(e) => p.setDraft((x) => ({ ...x, pasteName: e.target.value }))}
            />
          </label>
          <label>
            内容
            <textarea
              name="pasteText"
              rows={6}
              placeholder="粘贴纪要、说明或代码片段…"
              value={typeof p.draft.pasteText === "string" ? p.draft.pasteText : ""}
              onChange={(e) => p.setDraft((x) => ({ ...x, pasteText: e.target.value }))}
            />
          </label>
          <button className="primary" disabled={busy} onClick={() => void d.addPasted()}>
            加入资料并抽取
          </button>
        </div>
      ) : null}
      <fieldset className="engine">
        <legend>抽取引擎</legend>
        <label>
          <input type="radio" name="engine" checked={!d.useService} onChange={() => d.setUseService(false)} />
          <span>
            内置（Node）<small>符号、导入、调用、继承、标题、链接、术语与共现；无需安装</small>
          </span>
        </label>
        <label className={g?.available ? "" : "unavailable"}>
          <input type="radio" name="engine" checked={d.useService} disabled={!g?.available} onChange={() => d.setUseService(true)} />
          <span>
            Graphify tree-sitter（可选 Python 服务）
            <small role="status">{d.engine.checking ? "正在检查…" : g?.message ?? "未检查"}</small>
          </span>
        </label>
        {!g?.available && g?.start.length ? (
          <details className="start">
            <summary>启动方式</summary>
            <pre>{g.start.join("\n")}</pre>
            <p>服务只解析不执行源码；连接后代码文件交给上游 graphifyy 0.9.97，文档与文本仍由内置抽取。</p>
          </details>
        ) : null}
        <button className="ghost" onClick={() => void d.checkEngine()}>
          <RefreshCw size={13} aria-hidden="true" />
          重新检查
        </button>
      </fieldset>
      <div className="corpus-head">
        <h3>资料集 · {p.data.corpus.length} 份</h3>
        <button disabled={busy || !p.data.corpus.length} onClick={() => void d.reextract()}>
          <RefreshCw size={14} aria-hidden="true" />
          重新抽取
        </button>
      </div>
      {p.data.corpus.length ? (
        <ul className="corpus">
          {p.data.corpus.map((f) => (
            <li key={f.path}>
              <button className="corpus-file" onClick={() => d.openFileAt(f.path, 1)} title={f.path}>
                <span className={`kind ${f.kind}`}>{KIND_LABEL[f.kind]}</span>
                <span className="path">{f.path}</span>
                <small>
                  {f.lines} 行 · {d.counts.get(f.path) ?? 0} 节点
                </small>
              </button>
              <button className="icon" aria-label={`移除 ${f.path} 并重新抽取`} disabled={busy} onClick={() => void d.removeFile(f.path)}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">还没有资料。导入的 graph.json 没有原文时，节点仍可浏览，但不能回到原文位置。</p>
      )}
      {p.data.skipped.length ? (
        <details className="skipped">
          <summary>跳过 {p.data.skipped.length} 个文件</summary>
          <ul>
            {p.data.skipped.map((s, i) => (
              <li key={i}>
                <code>{s.path}</code> {s.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
