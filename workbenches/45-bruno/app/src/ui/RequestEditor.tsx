import { useCallback } from "react";
import { tabKeys } from "./tabs";
import { KeyValueTable } from "./KeyValueTable";
import { syncToUrl } from "./model";
import type { AssertionResult, RequestModel, Row } from "../contracts/bruno";

export type RequestTab = "params" | "body" | "headers" | "auth" | "vars" | "assert" | "docs" | "source";

const BODY_LABELS: Record<string, string> = {
  none: "无",
  json: "JSON",
  text: "Text",
  xml: "XML",
  formUrlEncoded: "Form URL Encoded",
  multipartForm: "Multipart Form",
  graphql: "GraphQL",
};
const AUTH_LABELS: Record<string, string> = {
  inherit: "继承集合/文件夹",
  none: "无认证",
  bearer: "Bearer Token",
  basic: "Basic Auth",
  apikey: "API Key",
};

export function RequestEditor({
  model,
  onChange,
  disabled,
  tab,
  setTab,
  source,
  rawPending,
  onSource,
  sourceError,
  assertions,
  inheritedAuth,
}: {
  model: RequestModel | null;
  onChange: (next: RequestModel) => void;
  disabled: boolean;
  tab: RequestTab;
  setTab: (t: RequestTab) => void;
  source: string;
  rawPending: boolean;
  onSource: (text: string) => void;
  sourceError: string;
  assertions?: AssertionResult[];
  inheritedAuth: string;
}) {
  const set = useCallback(
    <K extends keyof RequestModel>(key: K, value: RequestModel[K]) => {
      if (model) onChange({ ...model, [key]: value });
    },
    [model, onChange],
  );
  const counts: Partial<Record<RequestTab, number>> = model
    ? {
        params: model.query.filter((r) => r.enabled).length + model.path.length,
        headers: model.headers.filter((r) => r.enabled).length,
        vars: model.vars.length + model.postVars.length,
        assert: model.assertions.filter((r) => r.enabled).length,
      }
    : {};
  const tabs: [RequestTab, string][] = [
    ["params", "Params"],
    ["body", "Body"],
    ["headers", "Headers"],
    ["auth", "Auth"],
    ["vars", "Vars"],
    ["assert", "Assert"],
    ["docs", "Docs"],
    ["source", "Bru 源"],
  ];
  const locked = disabled || !model || rawPending;
  return (
    <section className="request-editor" aria-label="请求编辑器">
      <div
        className="tabs"
        role="tablist"
        aria-label="请求分页"
        onKeyDown={(e) => tabKeys(e, tabs.map(([id]) => id), tab, setTab, "req-tab-")}
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={"req-tab-" + id}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            aria-controls="req-panel"
            onClick={() => setTab(id)}
          >
            {label}
            {counts[id] ? <sup>{counts[id]}</sup> : null}
            {id === "body" && model && model.bodyMode !== "none" ? <i className="dot" aria-hidden="true" /> : null}
            {id === "auth" && model && model.authMode !== "none" ? <i className="dot" aria-hidden="true" /> : null}
            {id === "source" && rawPending ? <i className="dot warn" aria-label="有未解析修改" /> : null}
          </button>
        ))}
      </div>
      <div className="tab-panel" id="req-panel" role="tabpanel" aria-labelledby={"req-tab-" + tab}>
        {tab !== "source" && rawPending ? (
          <p className="inline-note warn" role="status">
            Bru 源文件有尚未解析通过的修改，结构化编辑暂停。请在「Bru 源」中修复。
          </p>
        ) : null}
        {tab === "params" && model ? (
          <>
            <h3 className="panel-title">Query</h3>
            <KeyValueTable
              label="查询参数"
              rows={model.query}
              disabled={locked}
              namePlaceholder="page…"
              valuePlaceholder="1 或 {{变量}}…"
              onChange={(rows) => onChange(syncToUrl(model, rows))}
            />
            <h3 className="panel-title">
              Path <small>URL 中的 <code>/:name</code> 段</small>
            </h3>
            {model.path.length ? (
              <KeyValueTable
                label="路径参数"
                rows={model.path}
                fixed
                disabled={locked}
                onChange={(rows) => set("path", rows)}
              />
            ) : (
              <p className="hint">在 URL 中写 <code>/users/:id</code> 即可添加路径参数。</p>
            )}
          </>
        ) : null}
        {tab === "body" && model ? (
          <>
            <div className="mode-picker" role="radiogroup" aria-label="请求体类型">
              {Object.entries(BODY_LABELS).map(([mode, label]) => (
                <label key={mode} className={model.bodyMode === mode ? "on" : ""}>
                  <input
                    type="radio"
                    name="body-mode"
                    value={mode}
                    checked={model.bodyMode === mode}
                    disabled={locked}
                    onChange={() => set("bodyMode", mode)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {model.bodyMode === "json" || model.bodyMode === "text" || model.bodyMode === "xml" ? (
              <textarea
                className="code"
                aria-label={`${BODY_LABELS[model.bodyMode]} 正文`}
                spellCheck={false}
                disabled={locked}
                value={model.body[model.bodyMode]}
                placeholder={model.bodyMode === "json" ? '{\n  "name": "{{customer}}"\n}' : "正文…"}
                onChange={(e) => set("body", { ...model.body, [model.bodyMode]: e.target.value })}
              />
            ) : null}
            {model.bodyMode === "formUrlEncoded" ? (
              <KeyValueTable
                label="表单字段"
                rows={model.body.formUrlEncoded}
                disabled={locked}
                onChange={(rows) => set("body", { ...model.body, formUrlEncoded: rows })}
              />
            ) : null}
            {model.bodyMode === "multipartForm" ? (
              <>
                <KeyValueTable
                  label="Multipart 字段"
                  rows={model.body.multipartForm}
                  disabled={locked}
                  onChange={(rows: Row[]) =>
                    set("body", {
                      ...model.body,
                      multipartForm: rows.map((r) => ({ type: "text", contentType: "", ...r })),
                    })
                  }
                />
                <p className="hint">支持文本字段；文件字段原文保留但不发送。</p>
              </>
            ) : null}
            {model.bodyMode === "graphql" ? (
              <div className="graphql">
                <label>
                  Query
                  <textarea
                    className="code"
                    spellCheck={false}
                    disabled={locked}
                    value={model.body.graphql.query}
                    onChange={(e) =>
                      set("body", { ...model.body, graphql: { ...model.body.graphql, query: e.target.value } })
                    }
                  />
                </label>
                <label>
                  Variables（JSON）
                  <textarea
                    className="code short"
                    spellCheck={false}
                    disabled={locked}
                    value={model.body.graphql.variables}
                    onChange={(e) =>
                      set("body", { ...model.body, graphql: { ...model.body.graphql, variables: e.target.value } })
                    }
                  />
                </label>
              </div>
            ) : null}
            {model.bodyMode === "none" ? <p className="hint">此请求不发送正文。</p> : null}
          </>
        ) : null}
        {tab === "headers" && model ? (
          <KeyValueTable
            label="请求头"
            rows={model.headers}
            disabled={locked}
            namePlaceholder="Content-Type…"
            valuePlaceholder="application/json…"
            onChange={(rows) => set("headers", rows)}
          />
        ) : null}
        {tab === "auth" && model ? (
          <div className="auth">
            <label>
              认证方式
              <select
                value={model.authMode}
                disabled={locked}
                onChange={(e) => set("authMode", e.target.value)}
              >
                {Object.entries(AUTH_LABELS).map(([mode, label]) => (
                  <option key={mode} value={mode}>
                    {label}
                  </option>
                ))}
                {AUTH_LABELS[model.authMode] ? null : (
                  <option value={model.authMode}>{model.authMode}（不受支持）</option>
                )}
              </select>
            </label>
            {model.authMode === "inherit" ? <p className="hint">{inheritedAuth}</p> : null}
            {model.authMode === "bearer" ? (
              <label>
                Token
                <input
                  className="mono"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={locked}
                  value={model.auth.bearer.token}
                  placeholder="{{apiToken}}…"
                  onChange={(e) => set("auth", { ...model.auth, bearer: { token: e.target.value } })}
                />
              </label>
            ) : null}
            {model.authMode === "basic" ? (
              <>
                <label>
                  用户名
                  <input
                    className="mono"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={locked}
                    value={model.auth.basic.username}
                    onChange={(e) =>
                      set("auth", { ...model.auth, basic: { ...model.auth.basic, username: e.target.value } })
                    }
                  />
                </label>
                <label>
                  密码
                  <input
                    className="mono"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={locked}
                    value={model.auth.basic.password}
                    placeholder="{{password}}…"
                    onChange={(e) =>
                      set("auth", { ...model.auth, basic: { ...model.auth.basic, password: e.target.value } })
                    }
                  />
                </label>
              </>
            ) : null}
            {model.authMode === "apikey" ? (
              <>
                <label>
                  Key
                  <input
                    className="mono"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={locked}
                    value={model.auth.apikey.key}
                    placeholder="X-API-Key…"
                    onChange={(e) =>
                      set("auth", { ...model.auth, apikey: { ...model.auth.apikey, key: e.target.value } })
                    }
                  />
                </label>
                <label>
                  Value
                  <input
                    className="mono"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={locked}
                    value={model.auth.apikey.value}
                    placeholder="{{apiKey}}…"
                    onChange={(e) =>
                      set("auth", { ...model.auth, apikey: { ...model.auth.apikey, value: e.target.value } })
                    }
                  />
                </label>
                <label>
                  位置
                  <select
                    value={model.auth.apikey.placement}
                    disabled={locked}
                    onChange={(e) =>
                      set("auth", { ...model.auth, apikey: { ...model.auth.apikey, placement: e.target.value } })
                    }
                  >
                    <option value="header">请求头</option>
                    <option value="queryparams">查询参数</option>
                  </select>
                </label>
              </>
            ) : null}
            {["bearer", "basic", "apikey"].includes(model.authMode) ? (
              <p className="hint">
                建议写成 <code>{"{{变量}}"}</code>，并在环境里把值标为「秘密」：秘密值只留在本次会话内存，不写入文件和导出。
              </p>
            ) : null}
          </div>
        ) : null}
        {tab === "vars" && model ? (
          <>
            <h3 className="panel-title">
              Pre Request <small>发送前定义，优先级高于环境</small>
            </h3>
            <KeyValueTable label="请求变量" rows={model.vars} disabled={locked} onChange={(rows) => set("vars", rows)} />
            <h3 className="panel-title">
              Post Response <small>从响应取值，存为本次会话的运行时变量</small>
            </h3>
            <KeyValueTable
              label="响应变量"
              rows={model.postVars}
              disabled={locked}
              valuePlaceholder="res.body.id…"
              onChange={(rows) => set("postVars", rows)}
            />
          </>
        ) : null}
        {tab === "assert" && model ? (
          <>
            <KeyValueTable
              label="断言"
              rows={model.assertions}
              disabled={locked}
              nameLabel="表达式"
              valueLabel="操作符 与 期望值"
              namePlaceholder="res.status…"
              valuePlaceholder="eq 200…"
              onChange={(rows) => set("assertions", rows)}
              renderStatus={(row) => {
                const hit = assertions?.find((a) => a.name === row.name && row.enabled);
                return hit ? (
                  <span className={"verdict " + (hit.passed ? "pass" : "fail")}>{hit.passed ? "通过" : "失败"}</span>
                ) : null;
              }}
            />
            <p className="hint">
              操作符：eq neq gt gte lt lte in notIn contains notContains length matches startsWith endsWith between
              isEmpty isNotEmpty isNull isUndefined isDefined isTruthy isFalsy isJson isNumber isString isBoolean
              isArray。表达式只按属性路径读取 <code>res.status</code>、<code>res.headers.x</code>、
              <code>res.body.items[0].id</code>、<code>res.responseTime</code>，不执行 JavaScript。
            </p>
          </>
        ) : null}
        {tab === "docs" && model ? (
          <textarea
            className="docs"
            aria-label="请求文档"
            disabled={locked}
            value={model.docs}
            placeholder="说明这个接口的用途、前置条件…"
            onChange={(e) => set("docs", e.target.value)}
          />
        ) : null}
        {tab === "source" ? (
          <div className="source">
            <textarea
              className="code tall"
              aria-label="Bru 源文件编辑器"
              spellCheck={false}
              disabled={disabled}
              value={source}
              onChange={(e) => onSource(e.target.value)}
            />
            <p className={"inline-note " + (sourceError ? "error" : "")} role="status">
              {sourceError
                ? "源文件暂未采用：" + sourceError
                : rawPending
                  ? "正在用官方解析器检查…"
                  : "与结构化编辑双向同步；由 @usebruno/lang 解析与序列化。"}
            </p>
          </div>
        ) : null}
        {!model && tab !== "source" ? (
          <p className="hint">此文件无法结构化编辑，请在「Bru 源」中查看与修改。</p>
        ) : null}
      </div>
    </section>
  );
}
