// ABOUTME: 采集条与收件区：选择渠道/动作，由工作台服务读取公开来源，勾选后收藏进目录。

import { Search, X, RotateCw } from "lucide-react";
import { canonical, queryValue } from "../contracts/research.ts";
import { CHANNELS, channelLabel } from "../contracts/channels.ts";
import type { Desk } from "./useResearchDesk.ts";

const reasons: Record<string, string> = {
  RATE_LIMITED: "平台报告访问限额，请稍后再采集。",
  PLATFORM_BLOCKED: "平台返回了人工验证页，本次没有继续采集。",
  NEED_LOGIN: "来源需要登录；可在「调研」菜单导入你自行取得的原生结果。",
  TIMEOUT: "读取超时，查询已保留，可稍后重试。",
  NOT_FOUND: "没有找到该来源，请检查链接或编号。",
  BAD_INPUT: "查询格式不符合该渠道要求。",
  BLOCKED_ADDRESS: "只读取公网地址：本机、内网和链路本地地址已被拒绝。",
  TOO_LARGE: "来源超过读取上限，请选择更具体的页面。",
  UNSUPPORTED_TYPE: "该链接不是网页或纯文本（例如 PDF、图片或下载文件）。",
  NETWORK: "无法连接该站点。请检查网络；如需代理，在启动工作台前设置 HTTPS_PROXY。",
  UPSTREAM_BROKEN: "上游暂时无法读取，下面是平台返回的原文。",
};

const host = (url: string | null) => {
  if (!url) return "无链接";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function Collector({ d }: { d: Desk }) {
  const { p, mutable } = d;
  const channel = CHANNELS.find((c) => c.id === p.data.input.channel) ?? CHANNELS[0];
  const action = channel.actions.find((a) => a.id === p.data.input.action) ?? channel.actions[0];
  const ready = !d.busy && mutable && (!action.needsQuery || p.data.input.query.trim().length > 0);
  return (
    <form
      className="collector"
      aria-label="采集来源"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void d.collect({ ...p.data.input, action: action.id, channel: channel.id });
      }}
    >
      <div className="segmented" role="group" aria-label="采集渠道">
        {CHANNELS.map((c) => (
          <button
            type="button"
            key={c.id}
                        aria-pressed={c.id === channel.id}
            onClick={() => d.setInput({ channel: c.id, action: c.actions[0].id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="action-row" role="group" aria-label="采集动作">
        {channel.actions.map((a) => (
          <button
            type="button"
            key={a.id}
                        aria-pressed={a.id === action.id}
            onClick={() => d.setInput({ channel: channel.id, action: a.id })}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="query">
        <label htmlFor="source-query" className="sr-only">
          {action.field}
        </label>
        <input
          id="source-query"
          name="query"
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          disabled={!action.needsQuery}
          placeholder={action.needsQuery ? action.placeholder : "无需填写，直接采集…"}
          value={action.needsQuery ? p.data.input.query : ""}
          onChange={(e) => d.setInput({ query: e.target.value })}
        />
        <button className="primary" type="submit" disabled={!ready}>
          <Search size={15} aria-hidden="true" />
          {d.busy ? "采集中…" : "采集"}
        </button>
      </div>
      <p className="hint">{action.note}</p>
    </form>
  );
}

export function Inbox({ d }: { d: Desk }) {
  const { p, candidate, chosen } = d;
  return (
    <>
      {d.busy ? (
        <p className="inbox-status" role="status">
          正在读取 {channelLabel(p.data.input.channel)}，可以继续阅读和摘录…
        </p>
      ) : null}
      {d.pending && !d.busy ? (
        <div className="inbox-status warn" role="status">
          <span>上次采集没有收到结果，查询已保留。</span>
          <button
            type="button"
            onClick={() => {
              try {
                void d.collect(queryValue(d.pending!.input));
              } catch (e) {
                p.report(e);
              }
            }}
          >
            <RotateCw size={13} aria-hidden="true" />
            重试
          </button>
          <button
            type="button"
            onClick={() =>
              p.setDraft((v) => {
                const n = { ...v };
                delete n.pendingQuery;
                return n;
              })
            }
          >
            忽略
          </button>
        </div>
      ) : null}
      {candidate ? (
        <section className="inbox" aria-labelledby="inbox-title">
          <header>
            <div>
              <h2 id="inbox-title">
                收件区 ·{" "}
                {candidate.envelope.ok
                  ? `${candidate.envelope.items.length} 条结果`
                  : "未取得资料"}
              </h2>
              <p>
                {channelLabel(candidate.envelope.channel)} / {candidate.envelope.backend ?? "—"} ·{" "}
                {candidate.input.query || candidate.input.action}
              </p>
            </div>
            <button type="button" className="icon" aria-label="收起收件区" onClick={d.dismissCandidate}>
              <X size={15} aria-hidden="true" />
            </button>
          </header>
          {candidate.envelope.ok ? (
            <>
              <ul className="candidate-list">
                {candidate.envelope.items.map((item, i) => {
                  let inLibrary = false;
                  try {
                    inLibrary = d.known.has(canonical(item));
                  } catch {
                    inLibrary = false;
                  }
                  return (
                    <li key={i}>
                      <label>
                        <input
                          type="checkbox"
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
                        <span>
                          <strong>{item.title ?? item.url ?? "未命名来源"}</strong>
                          <small>
                            {host(item.url)}
                            {inLibrary ? <em>已在目录</em> : null}
                          </small>
                          {item.text ? <span className="snippet">{item.text.slice(0, 160)}</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {!candidate.envelope.items.length ? <li className="muted">没有匹配的来源，可以调整关键词。</li> : null}
              </ul>
              <div className="inbox-actions">
                <button type="button" className="primary" disabled={!chosen.length} onClick={d.adopt}>
                  收藏 {chosen.length} 条
                </button>
                <button type="button" onClick={() => d.exportNative(candidate)}>
                  导出原生结果
                </button>
              </div>
            </>
          ) : (
            <div className="platform-error" role="alert">
              <p>
                {reasons[candidate.envelope.error?.code ?? ""] ?? "来源暂不可用，请检查链接后重试。"}
              </p>
              <small>
                {candidate.envelope.error?.code} · {candidate.envelope.error?.message}
              </small>
              {Array.isArray(candidate.envelope.meta.attempts) && candidate.envelope.meta.attempts.length ? (
                <ul className="attempts">
                  {candidate.envelope.meta.attempts.map((a, i) => (
                    <li key={i}>{typeof a === "object" && a ? Object.values(a as Record<string, unknown>).join(" · ") : String(a)}</li>
                  ))}
                </ul>
              ) : null}
              <button type="button" onClick={() => void d.collect(candidate.input)} disabled={d.busy}>
                <RotateCw size={13} aria-hidden="true" />
                重试
              </button>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
