// ABOUTME: 摘录夹：当前来源的摘录草稿与证据条；研究小结与可选的 Floatboat 模型概括。

import { Sparkles, RefreshCw } from "lucide-react";
import { sourceItem } from "../contracts/research.ts";
import type { Desk } from "./useResearchDesk.ts";

export function Folder({ d }: { d: Desk }) {
  return (
    <aside className="folder" aria-label="摘录夹">
      <div
        className="tabs"
        role="tablist"
        aria-label="摘录夹页面"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const next = d.folderTab === "clips" ? "brief" : "clips";
          d.setFolderTab(next);
          document.getElementById(next === "clips" ? "tab-clips" : "tab-brief")?.focus();
        }}
      >
        <button
          role="tab"
          id="tab-clips"
          aria-controls="panel-clips"
          aria-selected={d.folderTab === "clips"}
          onClick={() => d.setFolderTab("clips")}
        >
          摘录 {d.selected ? <span>{d.selected.clips.length}</span> : null}
        </button>
        <button
          role="tab"
          id="tab-brief"
          aria-controls="panel-brief"
          aria-selected={d.folderTab === "brief"}
          onClick={() => d.setFolderTab("brief")}
        >
          研究小结
        </button>
      </div>
      {d.folderTab === "clips" ? <Clips d={d} /> : <Brief d={d} />}
    </aside>
  );
}

function Clips({ d }: { d: Desk }) {
  const { selected } = d;
  if (!selected)
    return (
      <div className="panel" id="panel-clips" role="tabpanel" aria-labelledby="tab-clips">
        <p className="muted">选择一条来源后，在这里保存它的证据摘录。</p>
      </div>
    );
  return (
    <div className="panel" id="panel-clips" role="tabpanel" aria-labelledby="tab-clips">
      <div className="clip-form">
        <label>
          <span>摘录原文</span>
          <textarea
            id="clip-text"
            name="clipText"
            maxLength={4000}
            rows={4}
            placeholder="在正文中选中文字后点「摘录选中文字」，或粘贴一段原文…"
            value={d.clipText}
            onChange={(e) => d.setClipDraft({ text: e.target.value })}
          />
        </label>
        <label>
          <span>这段证据说明了什么</span>
          <textarea
            id="clip-note"
            name="clipNote"
            maxLength={2000}
            rows={2}
            placeholder="你的解释…"
            value={d.clipNote}
            onChange={(e) => d.setClipDraft({ note: e.target.value })}
          />
        </label>
        <button className="primary" onClick={d.addClip} disabled={!d.clipText.trim()}>
          加入摘录夹
        </button>
      </div>
      <ol className="clip-list">
        {selected.clips.map((clip, i) => (
          <li className="clip" key={clip.id}>
            <blockquote>{clip.text}</blockquote>
            <label>
              <span className="sr-only">摘录 {i + 1} 说明</span>
              <textarea
                name={`clip-${i}`}
                maxLength={2000}
                rows={2}
                placeholder="说明…"
                value={clip.note}
                onChange={(e) => d.updateClip(clip.id, e.target.value)}
              />
            </label>
            <div className="clip-actions">
              <button className="text" onClick={() => d.locateClip(clip.id)}>
                在原文中定位
              </button>
              <button className="text danger" onClick={() => d.removeClip(clip.id)}>
                删除摘录 {i + 1}
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!selected.clips.length ? <p className="muted">这条来源还没有摘录。</p> : null}
    </div>
  );
}

function Brief({ d }: { d: Desk }) {
  const { p } = d;
  const hostReady = d.host.llm === "available";
  return (
    <div className="panel" id="panel-brief" role="tabpanel" aria-labelledby="tab-brief">
      <label className="brief">
        <span>研究小结（随报告导出）</span>
        <textarea
          id="research-brief"
          name="brief"
          maxLength={20000}
          rows={9}
          placeholder="把不同来源连起来，写下目前的结论与待确认问题…"
          value={p.data.brief}
          onChange={(e) => p.setData((s) => ({ ...s, brief: e.target.value }))}
        />
      </label>
      <section className="assist" aria-labelledby="assist-title">
        <header>
          <h3 id="assist-title">
            <Sparkles size={14} aria-hidden="true" /> 模型概括 <small>可选</small>
          </h3>
        </header>
        <p className="muted">
          把勾选来源的笔记、摘录和正文开头交给 Floatboat 模型，生成带来源编号的要点草稿。不会自动写入小结。
        </p>
        {d.host.llm !== "available" ? (
          <div className={"host-card " + d.host.llm} role="status">
            <span>
              {d.host.llm === "unknown"
                ? "需要运行中的 Floatboat 桌面端。"
                : d.host.message}
            </span>
            <button onClick={() => void d.checkHost()} disabled={d.host.llm === "checking"}>
              <RefreshCw size={13} aria-hidden="true" />
              {d.host.llm === "unknown" ? "检查连接" : "重新检查"}
            </button>
          </div>
        ) : null}
        <fieldset className="pick">
          <legend>概括这些来源（最多 8 条）</legend>
          {p.data.sources.map((s) => {
            const it = sourceItem(p.data, s);
            const on = d.summaryPick.includes(s.id);
            return (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && d.summaryPick.length >= 8}
                  onChange={(e) =>
                    d.setSummaryPick(e.target.checked ? [...d.summaryPick, s.id] : d.summaryPick.filter((x) => x !== s.id))
                  }
                />
                <span>{it.title ?? it.url ?? "未命名来源"}</span>
              </label>
            );
          })}
          {!p.data.sources.length ? <p className="muted">先收藏来源。</p> : null}
        </fieldset>
        <label>
          <span>关注的问题（可空）</span>
          <input
            name="summaryFocus"
            autoComplete="off"
            maxLength={2000}
            placeholder="例如：哪种 OPFS 方案适合单标签应用？"
            value={d.summaryFocus}
            onChange={(e) => d.setSummaryFocus(e.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={!hostReady || d.summarizing || !d.summaryPick.length}
          onClick={() => void d.summarize()}
        >
          {d.summarizing ? "正在生成…" : "生成概括草稿"}
        </button>
        {d.summary ? (
          <div className="summary-draft" aria-live="polite">
            <p className="kicker">
              {d.summary.model || "Floatboat 模型"} · {d.summary.at.slice(0, 16).replace("T", " ")} · 未经核对
            </p>
            <div className="summary-text">{d.summary.text}</div>
            <div className="row">
              <button className="primary" onClick={d.insertSummary}>
                插入研究小结
              </button>
              <button onClick={d.discardSummary}>丢弃</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
