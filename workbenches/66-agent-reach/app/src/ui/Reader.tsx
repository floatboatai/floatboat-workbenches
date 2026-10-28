import { ExternalLink, Quote, Trash2 } from "lucide-react";
import type { useResearchDesk } from "./useResearchDesk.ts";
export function Reader({ d }: { d: ReturnType<typeof useResearchDesk> }) {
  const { p, selected, item, capture } = d;
  if (!selected || !item || !capture)
    return (
      <section className="reader-empty">
        <Quote size={28} aria-hidden="true" />
        <h2>选一条来源，开始整理证据</h2>
        <p>收藏的资料会保留采集时的原文。摘录和你的判断分开保存。</p>
      </section>
    );
  return (
    <section className="reader" aria-label="来源阅读与证据">
      <article className="document">
        <header>
          <div>
            <span>
              {capture.envelope.channel ?? "导入"} /{" "}
              {capture.envelope.backend ?? "原生结果"}
            </span>
            <h2>{item.title ?? item.url ?? "未命名来源"}</h2>
            <p>
              {item.author ?? "未提供作者"} · 采集于{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(capture.at))}
            </p>
          </div>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              打开来源
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
        </header>
        <div className="reader-tools">
          <span>来源原文</span>
          <button onClick={d.quoteSelection}>
            <Quote size={14} aria-hidden="true" />
            选中文字到摘录框
          </button>
          <button onClick={() => d.exportNative(capture)}>导出原生结果</button>
        </div>
        <pre
          className="source-body"
          ref={d.body}
          tabIndex={0}
          aria-label="来源正文"
        >
          {item.text ?? "该条目没有提供正文，可从原始链接查看。"}
        </pre>
        <div className="source-review">
          <label>
            审阅状态
            <select
              aria-label="来源审阅状态"
              value={selected.status}
              onChange={(e) =>
                d.updateSource({
                  status: e.target.value as typeof selected.status,
                })
              }
            >
              <option value="unreviewed">未核对</option>
              <option value="verified">已核对</option>
              <option value="followup">待跟进</option>
            </select>
          </label>
          <button className="remove" onClick={d.removeSource}>
            <Trash2 size={13} aria-hidden="true" />
            移除来源
          </button>
        </div>
        <label className="source-notes">
          关于这条来源的判断
          <textarea
            id="source-note"
            name="sourceNote"
            maxLength={5000}
            placeholder="记录可靠性、适用范围和待验证的问题…"
            value={selected.note}
            onChange={(e) => d.updateSource({ note: e.target.value })}
          />
        </label>
      </article>
      <aside className="evidence">
        <header>
          <span>EVIDENCE NOTES</span>
          <h3>
            证据摘录 <b>{selected.clips.length}</b>
          </h3>
        </header>
        <label>
          摘录原文
          <textarea
            id="clip-text"
            name="clipText"
            maxLength={4000}
            placeholder="选择正文，或粘贴一段原文…"
            value={d.clipText}
            onChange={(e) => d.setClipDraft({ text: e.target.value })}
          />
        </label>
        <label>
          这段证据说明了什么
          <textarea
            id="clip-note"
            name="clipNote"
            maxLength={2000}
            placeholder="写下你的解释…"
            value={d.clipNote}
            onChange={(e) => d.setClipDraft({ note: e.target.value })}
          />
        </label>
        <button
          className="primary"
          onClick={d.addClip}
          disabled={!d.clipText.trim()}
        >
          添加摘录
        </button>
        <div className="clip-list">
          {selected.clips.map((clip, i) => (
            <section className="clip" key={clip.id}>
              <span>{String(i + 1).padStart(2, "0")} / 原文</span>
              <blockquote>{clip.text}</blockquote>
              <label>
                摘录备注
                <textarea
                  aria-label={`摘录${i + 1}备注`}
                  name={`clip-${i}`}
                  maxLength={2000}
                  value={clip.note}
                  onChange={(e) => {
                    const note = e.target.value;
                    p.setData((data) => ({
                      ...data,
                      sources: data.sources.map((s) =>
                        s.id === selected.id
                          ? {
                              ...s,
                              clips: s.clips.map((c) =>
                                c.id === clip.id ? { ...c, note } : c,
                              ),
                            }
                          : s,
                      ),
                    }));
                  }}
                />
              </label>
              <button
                onClick={() => {
                  if (confirm("删除这条摘录？"))
                    p.setData((data) => ({
                      ...data,
                      sources: data.sources.map((s) =>
                        s.id === selected.id
                          ? {
                              ...s,
                              clips: s.clips.filter((c) => c.id !== clip.id),
                            }
                          : s,
                      ),
                    }));
                }}
              >
                删除摘录
              </button>
            </section>
          ))}
        </div>
      </aside>
    </section>
  );
}
