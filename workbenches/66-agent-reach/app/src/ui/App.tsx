import { RecoveryHistory } from "./RecoveryHistory.tsx";
import {
  Compass,
  Plus,
  Upload,
  Download,
  Search,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { useResearchDesk } from "./useResearchDesk.ts";
import { ProjectPicker, Notice } from "./workspace.tsx";
import { sourceItem } from "../contracts/research.ts";
import { Reader } from "./Reader.tsx";
import { Candidates } from "./Candidates.tsx";
const actions: Record<string, Array<[string, string]>> = {
  github: [
    ["read", "读取仓库 / Issue"],
    ["search", "搜索仓库"],
  ],
  web: [["read", "读取公开网页"]],
  v2ex: [
    ["hot", "热门主题"],
    ["read", "读取主题"],
    ["node", "浏览节点"],
  ],
};
const states = { unreviewed: "未核对", verified: "已核对", followup: "待跟进" };
export function App() {
  const d = useResearchDesk(),
    { p, mutable } = d;
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在恢复调研资料…
      </main>
    );
  const rows = p.data.sources.filter(
    (s) => d.filter === "all" || s.status === d.filter,
  );
  const availableActions = actions[p.data.input.channel] ?? actions.github;
  return (
    <>
      <a className="skip" href="#research-main">
        跳到调研资料
      </a>
      <header className="masthead">
        <div className="brand">
          <Compass size={26} aria-hidden="true" />
          <div>
            <strong>调研资料台</strong>
            <span>AGENT–REACH / SOURCE DESK</span>
          </div>
        </div>
        <input
          aria-label="调研项目名称"
          name="title"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          disabled={!mutable}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => {
            void p.open(id);
          }}
        />
        <div className="file-actions">
          <button
            disabled={!mutable}
            onClick={() => {
              void p.fresh();
            }}
          >
            <Plus size={15} aria-hidden="true" />
            新调研
          </button>
          <button disabled={!mutable} onClick={() => d.file.current?.click()}>
            <Upload size={15} aria-hidden="true" />
            导入
          </button>
          <button onClick={d.exportProject}>
            <Download size={15} aria-hidden="true" />
            项目
          </button>
        </div>
        <input
          ref={d.file}
          type="file"
          accept=".json"
          hidden
          aria-label="导入资料项目或原生结果"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void d.importFile(f);
            e.target.value = "";
          }}
        />
      </header>
      <div className="savebar">
        <span role="status" className={`save-state ${p.autoState.phase}`}>
          {p.autoState.message}
        </span>
        <span>查询、摘录与笔记</span>
        {["offline", "conflict", "draft"].includes(p.autoState.phase) ? (
          <>
            <button
              onClick={() => {
                void p.save();
              }}
            >
              重试保存
            </button>
            <button onClick={p.exportDraft}>导出工作稿</button>
            {p.current ? (
              <button
                onClick={() => {
                  void p.open(p.current!.id);
                }}
              >
                读取服务器版本
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <Notice error={p.error} notice={p.notice} />
      <main id="research-main" inert={!mutable}>
        <fieldset className="control-guard" disabled={!mutable}>
          <section className="query-dock">
            <div className="dock-top">
              <h1>从来源开始研究</h1>
              <div role="group" aria-label="采集渠道">
                {[
                  ["github", "GitHub"],
                  ["web", "公开网页"],
                  ["v2ex", "V2EX"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    aria-pressed={p.data.input.channel === value}
                    className={p.data.input.channel === value ? "active" : ""}
                    onClick={() =>
                      p.setData((s) => ({
                        ...s,
                        input: {
                          ...s.input,
                          channel: value,
                          action: actions[value][0][0],
                        },
                      }))
                    }
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div className="query-line">
              <label>
                <span>动作</span>
                <select
                  aria-label="采集动作"
                  value={p.data.input.action}
                  onChange={(e) =>
                    p.setData((s) => ({
                      ...s,
                      input: { ...s.input, action: e.target.value },
                    }))
                  }
                >
                  {availableActions.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label className="query-field">
                <span>
                  {p.data.input.action === "search"
                    ? "搜索关键词"
                    : p.data.input.action === "hot"
                      ? "可留空"
                      : p.data.input.action === "node"
                        ? "节点名称"
                        : "链接或来源编号"}
                </span>
                <input
                  id="source-query"
                  name="query"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={2000}
                  value={p.data.input.query}
                  placeholder={
                    p.data.input.channel === "github"
                      ? "例如 octocat/Hello-World…"
                      : p.data.input.channel === "web"
                        ? "例如 https://example.com…"
                        : "例如 https://www.v2ex.com/t/…"
                  }
                  onChange={(e) =>
                    p.setData((s) => ({
                      ...s,
                      input: { ...s.input, query: e.target.value },
                    }))
                  }
                />
              </label>
              <button
                className="collect"
                disabled={
                  d.busy ||
                  !d.status.available ||
                  (!p.data.input.query.trim() && p.data.input.action !== "hot")
                }
                onClick={() => {
                  void d.collect();
                }}
              >
                <Search size={16} aria-hidden="true" />
                {d.busy ? "正在采集…" : "采集来源"}
              </button>
            </div>
            <div className="dock-bottom">
              <span>
                {p.data.input.channel === "web"
                  ? "公开网页由Jina读取；仅输入可公开的链接。"
                  : "通过公开接口读取，不使用浏览器登录或账号凭据。"}
              </span>
              <span className={d.status.available ? "connected" : ""}>
                {d.status.message}
              </span>
              <button
                aria-label="重新检查采集服务"
                onClick={() => {
                  void d.checkStatus();
                }}
              >
                <RefreshCw size={13} aria-hidden="true" />
              </button>
            </div>
          </section>
          <Candidates d={d} />
          <section className="library">
            <header>
              <div>
                <span>COLLECTION</span>
                <h2>
                  资料目录 <b>{p.data.sources.length}</b>
                </h2>
              </div>
              <div className="library-actions">
                <button onClick={() => d.setJsonOpen((v) => !v)}>
                  原生 JSON
                </button>
                <button onClick={d.exportReport}>
                  导出调研报告
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
            </header>
            <div
              className="library-tabs"
              role="group"
              aria-label="筛选审阅状态"
            >
              {[
                ["all", "全部来源"],
                ["unreviewed", "未核对"],
                ["verified", "已核对"],
                ["followup", "待跟进"],
              ].map(([value, text]) => (
                <button
                  key={value}
                  className={d.filter === value ? "active" : ""}
                  aria-pressed={d.filter === value}
                  onClick={() => d.setFilter(value)}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="source-table">
              <table>
                <thead>
                  <tr>
                    <th>来源 / 标题</th>
                    <th>渠道</th>
                    <th>摘录</th>
                    <th>审阅</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const item = sourceItem(p.data, s),
                      capture = p.data.captures.find(
                        (c) => c.id === s.captureId,
                      )!;
                    return (
                      <tr
                        key={s.id}
                        className={p.data.selected === s.id ? "selected" : ""}
                      >
                        <td>
                          <button onClick={() => d.select(s.id)}>
                            <strong>
                              {item.title ?? item.url ?? "未命名来源"}
                            </strong>
                            <small>{item.url ?? "未提供链接"}</small>
                          </button>
                        </td>
                        <td>{capture.envelope.channel ?? "导入"}</td>
                        <td>{s.clips.length}</td>
                        <td>
                          <span className={`state ${s.status}`}>
                            {states[s.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length ? (
                <p className="empty">
                  {p.data.sources.length
                    ? "当前筛选下没有资料。"
                    : "采集一条来源，或导入Agent-Reach原生结果开始整理。"}
                </p>
              ) : null}
            </div>
          </section>
          <Reader d={d} />
          <RecoveryHistory
            history={p.draft.importHistory}
            onExport={d.exportProject}
          />
          <section className="brief">
            <label>
              研究小结
              <textarea
                id="research-brief"
                name="brief"
                maxLength={20000}
                placeholder="把不同来源连起来，写下目前的结论与待确认问题…"
                value={p.data.brief}
                onChange={(e) =>
                  p.setData((s) => ({ ...s, brief: e.target.value }))
                }
              />
            </label>
          </section>
        </fieldset>
      </main>
      <footer>
        <span>来源原文 · 人工判断 · 可追溯摘录</span>
        <span>Agent-Reach 1.6</span>
      </footer>
    </>
  );
}
