import type { useObservation } from "./useObservation.ts";
import type { analyze } from "../contracts/observation.ts";
export function PageReview({
  desk,
  report,
}: {
  desk: ReturnType<typeof useObservation>;
  report: ReturnType<typeof analyze>;
}) {
  const { p, selected } = desk;
  if (!selected) return null;
  const row = report.pages.find((r) => r.path === selected),
    hits = report.logs.filter((r) => r.path === selected),
    note = p.data.notes.find((n) => n.path === selected);
  return (
    <section className="page-review">
      <div className="review-title">
        <div>
          <span>页面调查</span>
          <h2>{row?.title || selected}</h2>
          <code>{selected}</code>
        </div>
        <button onClick={() => desk.setSelected("")}>关闭详情</button>
      </div>
      <div className="review-grid">
        <div>
          <h3>观察到的请求</h3>
          {hits.length ? (
            <ul className="evidence-list">
              {hits.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <span className={r.status >= 400 ? "http bad" : "http"}>
                    {r.status}
                  </span>
                  <div>
                    <strong>
                      {r.bot.name === "其他" ? "未识别UA" : r.bot.name}
                    </strong>
                    <small>
                      {new Intl.DateTimeFormat("zh-CN", {
                        timeZone: p.data.timezone,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(r.time))}{" "}
                      · {r.method}
                    </small>
                    <p>{r.userAgent}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">
              当前筛选下没有请求证据。没有观察到访问，不代表未被收录。
            </p>
          )}
          {hits.length > 12 ? (
            <p>另有{hits.length - 12}条，请在请求账本中查看。</p>
          ) : null}
        </div>
        <div className="review-fields">
          <label>
            处理状态
            <select
              aria-label="处理状态"
              value={note?.state ?? "todo"}
              onChange={(e) =>
                desk.patchNote(selected, {
                  state: e.target.value as "todo" | "doing" | "done",
                })
              }
            >
              <option value="todo">待核对</option>
              <option value="doing">处理中</option>
              <option value="done">已处理</option>
            </select>
          </label>
          <label>
            负责人
            <input
              aria-label="负责人"
              name="owner"
              autoComplete="off"
              maxLength={80}
              value={note?.owner ?? ""}
              onChange={(e) =>
                desk.patchNote(selected, { owner: e.target.value })
              }
            />
          </label>
          <label>
            处理记录
            <textarea
              aria-label="处理记录"
              name="reviewNote"
              autoComplete="off"
              placeholder="记录证据、处理动作和需要复查的日期…"
              maxLength={1500}
              value={note?.text ?? ""}
              onChange={(e) =>
                desk.patchNote(selected, { text: e.target.value })
              }
            />
          </label>
          <small>处理记录独立保存，不改变原始请求。</small>
        </div>
      </div>
    </section>
  );
}
