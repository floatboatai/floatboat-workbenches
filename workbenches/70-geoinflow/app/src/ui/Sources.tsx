import type { useObservation } from "./useObservation.ts";
export function Sources({ desk }: { desk: ReturnType<typeof useObservation> }) {
  const { p, kind, setKind, text, format, candidate } = desk;
  return (
    <section className="sources-panel" aria-label="数据来源">
      <div className="sources-head">
        <div>
          <h2>导入观察资料</h2>
          <p>先核对解析结果，再采用有效记录。未应用的原始输入也会自动保存。</p>
        </div>
        <button onClick={() => desk.setDrawer(false)}>收起</button>
      </div>
      <div className="source-controls">
        <div role="group" aria-label="来源类型">
          <button
            aria-pressed={kind === "logs"}
            onClick={() => setKind("logs")}
          >
            访问日志
          </button>
          <button
            aria-pressed={kind === "pages"}
            onClick={() => setKind("pages")}
          >
            内容清单
          </button>
        </div>
        <label>
          输入格式
          <select
            aria-label="输入格式"
            value={format}
            onChange={(e) =>
              p.setDraft((d) => ({ ...d, [kind + "Format"]: e.target.value }))
            }
          >
            <option value="json">JSON</option>
            {kind === "logs" ? (
              <option value="combined">Combined日志</option>
            ) : (
              <>
                <option value="csv">CSV</option>
                <option value="sitemap">Sitemap URL列表</option>
              </>
            )}
          </select>
        </label>
        <button onClick={() => desk.sourceFile.current?.click()}>
          读取文件
        </button>
      </div>
      <label className="raw-label" htmlFor="source-input">
        {kind === "logs" ? "日志输入" : "内容清单输入"}
        <span>最多200条 / 550KB</span>
      </label>
      <textarea
        id="source-input"
        name="sourceInput"
        autoComplete="off"
        spellCheck={false}
        value={text}
        maxLength={200000}
        onChange={(e) => desk.setText(e.target.value)}
      />
      <div className="parse-bar">
        <button
          className="primary"
          disabled={desk.busy || !desk.mutable || !text.trim()}
          onClick={() => void desk.parse()}
        >
          {desk.busy ? "正在解析…" : "解析并核对"}
        </button>
        <span>
          {kind === "logs"
            ? "时间、路径、HTTP状态、User-Agent；IP不会用于身份认证。"
            : "CSV支持path/url、title、priority（high/normal）。"}
        </span>
      </div>
      {desk.candidateError ? <p role="alert">{desk.candidateError}</p> : null}
      {candidate ? (
        <div className="candidate">
          <div>
            <strong>{candidate.accepted} 条有效</strong>
            <span>
              {candidate.rejected} 条需修改 ·{" "}
              {candidate.kind === "logs" ? "日志" : "内容清单"}
            </span>
            <button
              disabled={!desk.mutable || !candidate.accepted}
              onClick={() => void desk.apply()}
            >
              采用有效记录
            </button>
          </div>
          {candidate.rejected ? (
            <ol>
              {candidate.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  第{e.line}条：{e.reason}
                </li>
              ))}
            </ol>
          ) : (
            <p>记录已通过格式与站点核对，采用后替换当前同类数据。</p>
          )}
          {candidate.errors.length > 20 ? (
            <p>
              其余{candidate.errors.length - 20}条错误保留在项目候选记录中。
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
