import { Ledger, ObservationBand } from "./Ledger.tsx";
import { useMemo } from "react";
import { useObservation } from "./useObservation.ts";
import { ProjectPicker, Notice } from "./workspace.tsx";
import {
  analyze,
  observationValue,
  hostname,
} from "../contracts/observation.ts";
import { Sources } from "./Sources.tsx";
import { PageReview } from "./PageReview.tsx";
export function App() {
  const desk = useObservation(),
    { p, mutable } = desk;
  const computed = useMemo(() => {
    try {
      return { report: analyze(p.data), error: "" };
    } catch (e) {
      return {
        report: null,
        error: e instanceof Error ? e.message : "筛选无效",
      };
    }
  }, [
    p.data.logs,
    p.data.pages,
    p.data.filters,
    p.data.timezone,
    p.data.domain,
    p.data.notes,
  ]);
  const report = computed.report;
  const raw =
    typeof p.draft.inputJson === "string"
      ? p.draft.inputJson
      : JSON.stringify(p.data, null, 2);
  const rangeLabel =
    p.data.filters.from || p.data.filters.to
      ? `${p.data.filters.from || "不限"} — ${p.data.filters.to || "不限"}`
      : "全部导入时间";
  return (
    <div className="geo-app">
      <a className="skip" href="#ledger">
        跳到观察账本
      </a>
      <header className="masthead">
        <div className="wordmark">
          <span aria-hidden="true">◈</span>
          <div>
            <h1>抓取观测</h1>
            <small>GEOINFLOW / CRAWL OBSERVATORY</small>
          </div>
        </div>
        <input
          className="project-title"
          aria-label="项目名称"
          autoComplete="off"
          name="projectTitle"
          maxLength={120}
          value={p.title}
          disabled={!mutable}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => {
            void desk.openProject(id);
          }}
        />
        <div className="top-actions">
          <button disabled={!mutable} onClick={() => void desk.newSite()}>
            新建站点
          </button>
          <button
            disabled={!mutable}
            onClick={() => desk.file.current?.click()}
          >
            导入项目
          </button>
          <button disabled={!mutable} onClick={desk.exportProject}>
            导出项目
          </button>
        </div>
      </header>
      <div className="save-strip">
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <span>筛选、原始输入和处理记录自动保存</span>
        <details>
          <summary>恢复</summary>
          <div>
            <button onClick={() => void p.save()}>重试保存</button>
            <button onClick={p.exportDraft}>导出恢复草稿</button>
            {p.current ? (
              <button onClick={() => void desk.openProject(p.current!.id)}>
                读取服务器版本
              </button>
            ) : null}
          </div>
        </details>
      </div>
      <Notice error={p.error} notice={p.notice} />
      <input
        ref={desk.file}
        hidden
        type="file"
        accept="application/json,.json"
        aria-label="导入完整观测项目"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) void desk.importProject(file);
        }}
      />
      <input
        ref={desk.sourceFile}
        hidden
        type="file"
        accept=".json,.csv,.log,.txt,.xml"
        aria-label="读取来源文件"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) void desk.loadSource(file);
        }}
      />
      <main>
        <fieldset className="work-controls" disabled={!mutable}>
          <div className="site-heading">
            <div>
              <span className="eyebrow">网站观察范围</span>
              <label>
                <span className="sr-only">站点域名</span>
                <input
                  aria-label="站点域名"
                  autoComplete="off"
                  name="domain"
                  spellCheck={false}
                  value={p.data.domain}
                  maxLength={253}
                  disabled={
                    !mutable ||
                    p.data.logs.length > 0 ||
                    p.data.pages.length > 0
                  }
                  onChange={(e) =>
                    p.setData((d) => ({ ...d, domain: e.target.value }))
                  }
                />
              </label>
              <p>把访问证据与内容清单放在同一张账本里。</p>
            </div>
            <div className="site-actions">
              <button
                onClick={() => void desk.openSample()}
                disabled={!mutable}
              >
                打开示例站点
              </button>
              <button
                className="primary"
                onClick={() => desk.setDrawer((v) => !v)}
                aria-expanded={desk.drawer}
              >
                导入观察资料
              </button>
            </div>
          </div>
          <div className="filters">
            <label>
              从
              <input
                aria-label="开始日期"
                name="from"
                autoComplete="off"
                placeholder="YYYY-MM-DD"
                inputMode="numeric"
                value={p.data.filters.from}
                maxLength={10}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    filters: { ...d.filters, from: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              至
              <input
                aria-label="结束日期"
                name="to"
                autoComplete="off"
                placeholder="YYYY-MM-DD"
                inputMode="numeric"
                value={p.data.filters.to}
                maxLength={10}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    filters: { ...d.filters, to: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              统计时区
              <select
                aria-label="统计时区"
                value={p.data.timezone}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, timezone: e.target.value }))
                }
              >
                <option value="America/New_York">纽约</option>
                <option value="Asia/Shanghai">上海</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <label>
              提供方
              <select
                aria-label="提供方"
                value={p.data.filters.vendor}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    filters: { ...d.filters, vendor: e.target.value },
                  }))
                }
              >
                <option value="all">全部</option>
                {(report?.vendors ?? []).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              声明用途
              <select
                aria-label="声明用途"
                value={p.data.filters.purpose}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    filters: { ...d.filters, purpose: e.target.value },
                  }))
                }
              >
                {[
                  ["all", "全部"],
                  ["ai", "AI用途"],
                  ["训练", "训练"],
                  ["搜索", "AI搜索"],
                  ["用户触发", "用户触发"],
                  ["传统搜索", "传统搜索"],
                  ["其他", "其他"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              HTTP
              <select
                aria-label="HTTP状态筛选"
                value={p.data.filters.http}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    filters: {
                      ...d.filters,
                      http: e.target.value as "all" | "errors" | "success",
                    },
                  }))
                }
              >
                <option value="all">全部响应</option>
                <option value="errors">400及以上</option>
                <option value="success">400以下</option>
              </select>
            </label>
            <button
              onClick={() =>
                p.setData((d) => ({
                  ...d,
                  filters: {
                    from: "",
                    to: "",
                    vendor: "all",
                    purpose: "all",
                    http: "all",
                  },
                }))
              }
            >
              重置筛选
            </button>
          </div>
          {computed.error ? (
            <div className="filter-error" role="alert">
              {computed.error} 当前筛选尚未完成，输入会按草稿保留。
            </div>
          ) : null}
          {desk.drawer ? <Sources desk={desk} /> : null}
          {report ? (
            <>
              <ObservationBand report={report} rangeLabel={rangeLabel} />
              <Ledger desk={desk} report={report} />
              <PageReview desk={desk} report={report} />
            </>
          ) : null}
          <details className="advanced" open={desk.jsonOpen}>
            <summary
              onClick={(e) => {
                e.preventDefault();
                desk.setJsonOpen((v) => !v);
              }}
            >
              项目 JSON 草稿
            </summary>
            {desk.jsonOpen ? (
              <div>
                <label htmlFor="project-json">未应用的修改也会保存</label>
                <textarea
                  id="project-json"
                  name="projectJson"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={200000}
                  value={raw}
                  onChange={(e) =>
                    p.setDraft((d) => ({ ...d, inputJson: e.target.value }))
                  }
                />
                <button
                  onClick={() => {
                    try {
                      const next = observationValue(JSON.parse(raw));
                      let previousHost: string | undefined;
                      try { previousHost = hostname(p.data.domain); } catch { /* Allow repairing an unfinished restored domain. */ }
                      if (previousHost && hostname(next.domain) !== previousHost)
                        throw new Error("不同站点请导入为新项目。");
                      p.setData(next);
                      p.setError("");
                      p.setNotice("已采用项目数据。");
                    } catch (e) {
                      p.report(e);
                    }
                  }}
                >
                  应用 JSON
                </button>
              </div>
            ) : null}
          </details>
        </fieldset>
      </main>
      <footer>
        <span>GEOINFLOW · 观察、核对、留下处理记录</span>
        <span>统计只覆盖当前导入资料</span>
      </footer>
    </div>
  );
}
