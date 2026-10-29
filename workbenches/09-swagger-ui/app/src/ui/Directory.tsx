import { useDeferredValue, useMemo, useState } from "react";
import type { OperationEntry, SpecAnalysis } from "../contracts/openapi";

export function Directory({
  analysis,
  active,
  onOperation,
  onModels,
  onAuthorize,
}: {
  analysis: SpecAnalysis;
  active: string;
  onOperation: (operation: OperationEntry) => void;
  onModels: () => void;
  onAuthorize: () => void;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const groups = useMemo(() => {
    const map = new Map<string, OperationEntry[]>();
    for (const operation of analysis.operations) {
      if (
        deferred &&
        !(
          operation.path.toLowerCase().includes(deferred) ||
          operation.method.includes(deferred) ||
          operation.summary.toLowerCase().includes(deferred) ||
          operation.operationId.toLowerCase().includes(deferred)
        )
      )
        continue;
      const tag = operation.tags[0];
      const list = map.get(tag);
      if (list) list.push(operation);
      else map.set(tag, [operation]);
    }
    return [...map.entries()];
  }, [analysis.operations, deferred]);
  const shown = groups.reduce((total, [, list]) => total + list.length, 0);
  return (
    <nav className="directory" aria-label="端点目录">
      <div className="directory-head">
        <h2>
          端点 <span className="count">{analysis.operations.length}</span>
        </h2>
        <label className="directory-search">
          <span className="sr-only">搜索端点</span>
          <input
            type="search"
            name="endpoint-search"
            autoComplete="off"
            spellCheck={false}
            placeholder="路径、方法或摘要…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="directory-scroll">
        {groups.length ? (
          groups.map(([tag, list]) => (
            <section key={tag} className="tag-group" aria-label={tag}>
              <h3>
                {tag} <span className="count">{list.length}</span>
              </h3>
              <ul>
                {list.map((operation) => (
                  <li key={operation.method + " " + operation.path}>
                    <button
                      aria-current={active === operation.method + " " + operation.path ? "true" : undefined}
                      className={operation.deprecated ? "endpoint deprecated" : "endpoint"}
                      onClick={() => onOperation(operation)}
                      title={operation.summary || operation.path}
                    >
                      <span className={"method m-" + operation.method}>
                        {operation.method === "delete"
                          ? "DEL"
                          : operation.method === "options"
                            ? "OPT"
                            : operation.method.toUpperCase()}
                      </span>
                      <span className="endpoint-text">
                        <code>{operation.path}</code>
                        {operation.summary ? <small>{operation.summary}</small> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className="directory-empty">
            {analysis.operations.length
              ? `没有匹配“${query.trim()}”的端点。`
              : "规格中还没有端点。打开「并排源码」在 paths 下添加。"}
          </p>
        )}
        {deferred && shown ? <p className="sr-only" role="status">找到 {shown} 个端点</p> : null}
        <section className="spec-facts" aria-label="规格组成">
          <h3>规格组成</h3>
          <dl>
            <div>
              <dt>模型</dt>
              <dd>
                {analysis.schemas.length ? (
                  <button className="link" onClick={onModels}>
                    {analysis.schemas.length} 个 · 查看
                  </button>
                ) : (
                  "无"
                )}
              </dd>
            </div>
            <div>
              <dt>认证</dt>
              <dd>
                {analysis.security.length ? (
                  <>
                    <ul className="facts-list">
                      {analysis.security.map((item) => (
                        <li key={item.name}>
                          <code>{item.name}</code> <small>{item.detail}</small>
                        </li>
                      ))}
                    </ul>
                    <button className="link" onClick={onAuthorize}>
                      填写凭据（仅本次会话）
                    </button>
                  </>
                ) : (
                  "未声明"
                )}
              </dd>
            </div>
            <div>
              <dt>服务器</dt>
              <dd>
                {analysis.servers.length ? (
                  <ul className="facts-list">
                    {analysis.servers.map((server, index) => (
                      <li key={index + server.url}>
                        <code>{server.url}</code>
                        {server.description ? <small>{server.description}</small> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "未声明（相对当前地址）"
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </nav>
  );
}
