import { useMemo } from "react";
import { tabKeys } from "./tabs";
import type { Receipt } from "../contracts/bruno";
import { formatBytes, prettyBody, statusTone } from "./model";

export type ResponseTab = "body" | "headers" | "assert" | "request" | "history";

const time = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const KIND: Record<string, string> = {
  refused: "连接被拒绝",
  dns: "域名解析失败",
  timeout: "超时",
  tls: "TLS 错误",
  reset: "连接中断",
  cancelled: "已取消",
  invalid: "未发送",
  network: "网络错误",
  service: "服务中断",
};

export function statusLabel(r: Receipt) {
  if (r.state === "complete") return String(r.status ?? "—");
  if (r.state === "initiated") return "发送中";
  if (r.state === "unknown") return "回执未知";
  return KIND[r.errorKind ?? ""] ?? "失败";
}

export function ResponseConsole({
  receipt,
  history,
  tab,
  setTab,
  onPick,
  onReconcile,
  onLoadFull,
  onClearHistory,
  running,
  echoHint,
}: {
  receipt: Receipt | undefined;
  history: Receipt[];
  tab: ResponseTab;
  setTab: (t: ResponseTab) => void;
  onPick: (id: string) => void;
  onReconcile: (r: Receipt) => void;
  onLoadFull: (r: Receipt) => void;
  onClearHistory: () => void;
  running: boolean;
  echoHint: string;
}) {
  const body = useMemo(() => (receipt ? prettyBody(receipt) : null), [receipt]);
  const passed = receipt?.assertions?.filter((a) => a.passed).length ?? 0;
  const total = receipt?.assertions?.length ?? 0;
  const tabs: [ResponseTab, string, string | number | null][] = [
    ["body", "正文", null],
    ["headers", "Headers", receipt?.headers ? Object.keys(receipt.headers).length : null],
    ["assert", "断言", total ? `${passed}/${total}` : null],
    ["request", "实际请求", null],
    ["history", "历史", history.length || null],
  ];
  return (
    <section className="response" aria-label="响应控制台" id="response">
      <div className="response-bar">
        {receipt ? (
          <>
            <span className={"status " + statusTone(receipt)} role="status" aria-live="polite">
              {statusLabel(receipt)}
              {receipt.state === "complete" && receipt.statusText ? <small> {receipt.statusText}</small> : null}
            </span>
            <span className="metric">{receipt.durationMs !== undefined ? receipt.durationMs + " ms" : "—"}</span>
            <span className="metric">{formatBytes(receipt.bytes)}</span>
            {total ? (
              <span className={"metric assert-sum " + (passed === total ? "pass" : "fail")}>
                断言 {passed}/{total}
              </span>
            ) : null}
            {receipt.environment ? <span className="metric env">{receipt.environment}</span> : null}
          </>
        ) : (
          <span className="status idle">{running ? "发送中…" : "尚未发送"}</span>
        )}
      </div>
      <div
        className="tabs"
        role="tablist"
        aria-label="响应分页"
        onKeyDown={(e) => tabKeys(e, tabs.map(([id]) => id), tab, setTab, "res-tab-")}
      >
        {tabs.map(([id, label, badge]) => (
          <button
            key={id}
            role="tab"
            id={"res-tab-" + id}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            aria-controls="res-panel"
            onClick={() => setTab(id)}
          >
            {label}
            {badge !== null ? <sup>{badge}</sup> : null}
          </button>
        ))}
      </div>
      <div className="tab-panel" id="res-panel" role="tabpanel" aria-labelledby={"res-tab-" + tab}>
        {tab === "history" ? (
          history.length ? (
            <>
              <ol className="history">
                {history.map((r) => (
                  <li key={r.id}>
                    <button
                      className={receipt?.id === r.id ? "active" : ""}
                      aria-current={receipt?.id === r.id ? "true" : undefined}
                      onClick={() => onPick(r.id)}
                    >
                      <span className={"status small " + statusTone(r)}>{statusLabel(r)}</span>
                      <span className="h-method">{r.method}</span>
                      <span className="h-url">{r.url}</span>
                      <span className="h-meta">
                        {time.format(new Date(r.startedAt))} · {r.durationMs ?? "—"} ms
                        {r.assertions?.length
                          ? ` · 断言 ${r.assertions.filter((a) => a.passed).length}/${r.assertions.length}`
                          : ""}
                        {r.environment ? ` · ${r.environment}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <button className="quiet" disabled={running} onClick={onClearHistory}>
                清空此请求的历史
              </button>
            </>
          ) : (
            <p className="hint">此请求还没有发送记录。</p>
          )
        ) : !receipt ? (
          <div className="empty">
            <h3>{running ? "等待响应…" : "按「发送」查看响应"}</h3>
            <p>状态码、正文、断言结果与每次发送的历史都会出现在这里。快捷键 ⌘/Ctrl + Enter。</p>
            {echoHint ? <p className="hint">{echoHint}</p> : null}
          </div>
        ) : (
          <>
            {receipt.state !== "complete" ? (
              <div className={"outcome " + receipt.state} role="status">
                <p>{receipt.message ?? "发起记录已保存，等待回执。"}</p>
                {receipt.state === "unknown" || receipt.state === "initiated" ? (
                  <button onClick={() => onReconcile(receipt)}>读取回执</button>
                ) : null}
              </div>
            ) : receipt.message && !/^断言|^已接收响应/.test(receipt.message) ? (
              <p className="inline-note">{receipt.message}</p>
            ) : null}
            {receipt.warnings?.length ? (
              <ul className="warnings">
                {receipt.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            {tab === "body" ? (
              receipt.state === "complete" ? (
                <>
                  {receipt.compacted || receipt.snapshotTruncated ? (
                    <p className="inline-note">
                      {receipt.compacted ? "较早的历史只保存摘要。" : "工作稿只保存前 64K 字符。"}
                      <button className="link" onClick={() => onLoadFull(receipt)}>
                        从执行记录载入完整正文
                      </button>
                    </p>
                  ) : null}
                  {receipt.truncated ? <p className="inline-note warn">响应正文已截断。</p> : null}
                  <pre className={"body " + (body?.language ?? "")} tabIndex={0} aria-label="响应正文" translate="no">
                    {body?.text || (receipt.compacted ? "" : "（空正文）")}
                  </pre>
                </>
              ) : null
            ) : null}
            {tab === "headers" ? (
              receipt.headers ? (
                <table className="headers">
                  <tbody>
                    {Object.entries(receipt.headers).map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row">{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">没有响应头。</p>
              )
            ) : null}
            {tab === "assert" ? (
              receipt.assertions?.length ? (
                <table className="assertions">
                  <thead>
                    <tr>
                      <th scope="col">结果</th>
                      <th scope="col">表达式</th>
                      <th scope="col">期望</th>
                      <th scope="col">实际</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.assertions.map((a, i) => (
                      <tr key={i} className={a.passed ? "pass" : "fail"}>
                        <td>
                          <span className={"verdict " + (a.passed ? "pass" : "fail")}>{a.passed ? "通过" : "失败"}</span>
                        </td>
                        <td className="mono">{a.name}</td>
                        <td className="mono">
                          {a.operator} {a.expected}
                        </td>
                        <td className="mono">{a.error ?? a.actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">
                  {receipt.state === "complete" ? "此请求没有启用的断言。在「Assert」分页添加，例如 res.status eq 200。" : "未收到响应，断言未评估。"}
                </p>
              )
            ) : null}
            {tab === "request" ? (
              receipt.request ? (
                <div className="sent">
                  <p className="mono">
                    <b>{receipt.request.method}</b> {receipt.request.url}
                  </p>
                  <table className="headers">
                    <tbody>
                      {Object.entries(receipt.request.headers).map(([k, v]) => (
                        <tr key={k}>
                          <th scope="row">{k}</th>
                          <td>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {receipt.request.body !== undefined ? <pre className="body">{receipt.request.body}</pre> : null}
                  {receipt.captured ? (
                    <>
                      <h3 className="panel-title">捕获的运行时变量</h3>
                      <table className="headers">
                        <tbody>
                          {Object.entries(receipt.captured).map(([k, v]) => (
                            <tr key={k}>
                              <th scope="row">{k}</th>
                              <td>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                  <details>
                    <summary>本次发送的 Bru 源文件</summary>
                    <pre className="body">{receipt.source}</pre>
                  </details>
                </div>
              ) : (
                <p className="hint">{receipt.compacted ? "较早的历史只保存摘要。" : "此记录没有请求明细（工作台未发出请求）。"}</p>
              )
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
