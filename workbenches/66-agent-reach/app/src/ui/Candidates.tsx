import type { useResearchDesk } from "./useResearchDesk.ts";
import { queryValue } from "../contracts/research.ts";
const reasons: Record<string, string> = {
  RATE_LIMITED: "公开接口达到限额，请等待后再采集。",
  PLATFORM_BLOCKED: "平台要求人工验证，本次没有继续采集。",
  NEED_LOGIN: "来源需要登录；可导入你自行取得的原生结果。",
  TIMEOUT: "本次读取超时，查询已保留。",
  NOT_FOUND: "未找到该来源，请检查链接或编号。",
  BAD_INPUT: "查询格式不符合渠道要求。",
};
export function Candidates({ d }: { d: ReturnType<typeof useResearchDesk> }) {
  const { p, candidate, chosen } = d;
  return (
    <>
      {d.pending && !d.busy ? (
        <div className="pending" role="status">
          <span>上次请求未完成，查询已保留。</span>
          <button
            disabled={!d.status.available}
            onClick={() => {
              try {
                void d.collect(queryValue(d.pending!.input));
              } catch (e) {
                p.report(e);
              }
            }}
          >
            重试该查询
          </button>
          <button
            onClick={() =>
              p.setDraft((v) => {
                const n = { ...v };
                delete n.pendingQuery;
                return n;
              })
            }
          >
            收起提示
          </button>
        </div>
      ) : null}
      {candidate ? (
        <section className="candidates" aria-label="采集候选">
          <header>
            <div>
              <span>INBOX / {candidate.envelope.channel ?? "导入"}</span>
              <h2>
                {candidate.envelope.ok
                  ? `${candidate.envelope.items.length} 条采集结果`
                  : "本次未取得资料"}
              </h2>
              <p>{candidate.input.query || candidate.input.action}</p>
            </div>
            <div>
              <button onClick={() => d.exportNative(candidate)}>
                导出本次结果
              </button>
              <button
                onClick={() =>
                  p.setDraft((v) => {
                    const n = { ...v };
                    delete n.candidate;
                    delete n.chosen;
                    return n;
                  })
                }
              >
                收起结果
              </button>
            </div>
          </header>
          {candidate.envelope.ok ? (
            <>
              <div className="candidate-list">
                {candidate.envelope.items.map((item, i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      aria-label={`收藏 ${item.title ?? item.url ?? i + 1}`}
                      checked={chosen.includes(i)}
                      onChange={(e) =>
                        p.setDraft((v) => ({
                          ...v,
                          chosen: e.target.checked
                            ? [...chosen, i]
                            : chosen.filter((n) => n !== i),
                        }))
                      }
                    />
                    <div>
                      <strong>{item.title ?? item.url ?? "未命名来源"}</strong>
                      <small>{item.url ?? "未提供链接"}</small>
                      <p>{(item.text ?? "").slice(0, 190)}</p>
                    </div>
                  </label>
                ))}
                {!candidate.envelope.items.length ? (
                  <p>没有匹配的来源，可以调整关键词。</p>
                ) : null}
              </div>
              <div className="candidate-actions">
                <button
                  className="primary"
                  disabled={!chosen.length}
                  onClick={d.adopt}
                >
                  收藏选中来源
                </button>
                <span>同一链接已收藏时保留原记录与笔记</span>
              </div>
            </>
          ) : (
            <p className="platform-error" role="alert">
              {reasons[candidate.envelope.error?.code ?? ""] ??
                "来源暂不可用，请检查链接后重试。"}
              <small>
                {candidate.envelope.error?.code} ·{" "}
                {candidate.envelope.error?.message}
              </small>
            </p>
          )}
        </section>
      ) : null}
      {d.jsonOpen ? (
        <section className="json-editor">
          <header>
            <h2>原生结果工作稿</h2>
            <button onClick={() => d.setJsonOpen(false)}>收起</button>
          </header>
          <label>
            Agent-Reach JSON
            <textarea
              id="result-json"
              name="resultJson"
              maxLength={500000}
              spellCheck={false}
              value={d.rawJson}
              onChange={(e) =>
                p.setDraft((v) => ({ ...v, resultJson: e.target.value }))
              }
            />
          </label>
          <div>
            <button onClick={d.applyJson}>检查并载入候选</button>
            <span>未完成编辑也会自动保存</span>
          </div>
        </section>
      ) : null}
    </>
  );
}
