import { useState } from "react";
import type { EnvVar, SourceFile } from "../contracts/bruno";
import { Modal } from "./Modal";

export function EnvironmentDialog({
  open,
  onClose,
  envs,
  active,
  onActivate,
  varsFor,
  errorFor,
  onVars,
  secrets,
  onSecret,
  onToggleSecret,
  onAdd,
  onRename,
  onRemove,
  runtime,
  onClearRuntime,
  echoUrl,
  locked,
}: {
  open: boolean;
  onClose: () => void;
  envs: { file: SourceFile; name: string }[];
  active: string;
  onActivate: (name: string) => void;
  varsFor: (fileId: string) => EnvVar[] | null;
  errorFor: (fileId: string) => string;
  onVars: (fileId: string, vars: EnvVar[]) => void;
  secrets: Record<string, Record<string, string>>;
  onSecret: (env: string, name: string, value: string) => void;
  onToggleSecret: (fileId: string, env: string, index: number, secret: boolean) => void;
  onAdd: (name: string) => void;
  onRename: (fileId: string, name: string) => void;
  onRemove: (fileId: string) => void;
  runtime: Record<string, string>;
  onClearRuntime: () => void;
  echoUrl: string | null;
  locked: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const current = envs.find((e) => e.file.id === picked) ?? envs.find((e) => e.name === active) ?? envs[0];
  const vars = current ? varsFor(current.file.id) : null;
  const err = current ? errorFor(current.file.id) : "";
  const update = (index: number, patch: Partial<EnvVar>) =>
    current && vars && onVars(current.file.id, vars.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const validName = /^[^/\\:*?"<>|]{1,60}$/.test(newName.trim()) && !envs.some((e) => e.name === newName.trim());
  return (
    <Modal open={open} onClose={onClose} title="环境与变量" eyebrow="ENVIRONMENTS" className="env-dialog">
      <div className="env-layout">
        <nav aria-label="环境列表" className="env-list">
          <ul>
            {envs.map((e) => (
              <li key={e.file.id}>
                <button aria-current={current?.file.id === e.file.id ? "true" : undefined} onClick={() => setPicked(e.file.id)}>
                  {e.name}
                  {e.name === active ? <small>使用中</small> : null}
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!validName || locked) return;
              onAdd(newName.trim());
              setNewName("");
            }}
          >
            <label>
              新环境名称
              <input value={newName} maxLength={60} placeholder="例如 生产…" onChange={(e) => setNewName(e.target.value)} />
            </label>
            <button type="submit" disabled={!validName || locked}>
              ＋ 新建环境
            </button>
          </form>
        </nav>
        <div className="env-editor">
          {current ? (
            <>
              <div className="env-title">
                <label>
                  环境名称
                  <input
                    key={current.file.id}
                    defaultValue={current.name}
                    maxLength={60}
                    disabled={locked}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== current.name && !envs.some((x) => x.name === v) && /^[^/\\:*?"<>|]{1,60}$/.test(v))
                        onRename(current.file.id, v);
                      else e.target.value = current.name;
                    }}
                  />
                </label>
                <button disabled={locked || current.name === active} onClick={() => onActivate(current.name)}>
                  {current.name === active ? "正在使用" : "使用此环境"}
                </button>
                <button
                  className="danger"
                  disabled={locked}
                  onClick={() => {
                    if (confirm(`删除环境「${current.name}」？`)) {
                      onRemove(current.file.id);
                      setPicked(null);
                    }
                  }}
                >
                  删除
                </button>
              </div>
              {err ? (
                <p className="inline-note error" role="alert">
                  {err}
                </p>
              ) : null}
              {vars ? (
                <table className="env-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">启用</span>
                      </th>
                      <th scope="col">变量</th>
                      <th scope="col">值</th>
                      <th scope="col">秘密</th>
                      <th scope="col">
                        <span className="sr-only">删除</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vars.map((v, i) => (
                      <tr key={i} className={v.enabled ? "" : "off"}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`启用 ${v.name}`}
                            checked={v.enabled}
                            disabled={locked}
                            onChange={(e) => update(i, { enabled: e.target.checked })}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`变量名 ${i + 1}`}
                            className="mono"
                            value={v.name}
                            spellCheck={false}
                            autoComplete="off"
                            disabled={locked}
                            onChange={(e) => update(i, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          {v.secret ? (
                            <input
                              aria-label={`${v.name} 的秘密值（仅本次会话）`}
                              className="mono"
                              type="password"
                              autoComplete="off"
                              placeholder="仅保存在本次会话内存…"
                              value={secrets[current.name]?.[v.name] ?? ""}
                              onChange={(e) => onSecret(current.name, v.name, e.target.value)}
                            />
                          ) : (
                            <input
                              aria-label={`${v.name} 的值`}
                              className="mono"
                              value={v.value}
                              spellCheck={false}
                              autoComplete="off"
                              disabled={locked}
                              onChange={(e) => update(i, { value: e.target.value })}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${v.name} 是秘密值`}
                            checked={v.secret}
                            disabled={locked}
                            onChange={(e) => onToggleSecret(current.file.id, current.name, i, e.target.checked)}
                          />
                        </td>
                        <td>
                          <button
                            className="icon"
                            aria-label={`删除变量 ${v.name}`}
                            disabled={locked}
                            onClick={() => onVars(current.file.id, vars.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">正在读取环境文件…</p>
              )}
              <button
                className="kv-add"
                disabled={locked || !vars}
                onClick={() => vars && onVars(current.file.id, [...vars, { name: "", value: "", enabled: true, secret: false }])}
              >
                ＋ 添加变量
              </button>
              <p className="hint">
                秘密值只保存在本页面内存：不写入 .bru、自动保存、导出与执行记录，刷新后需重新填写。取消「秘密」会把当前值写回环境文件。
              </p>
            </>
          ) : (
            <p className="hint">集合还没有环境。新建一个环境来定义 baseUrl 等变量。</p>
          )}
          <h3 className="panel-title">内置动态变量</h3>
          <p className="hint mono">
            {"{{$localEcho}}"} → {echoUrl ?? "本机回声服务未启动"} · {"{{$randomUUID}}"} · {"{{$timestamp}}"} ·{" "}
            {"{{$isoTimestamp}}"} · {"{{$randomInt}}"}
          </p>
          <h3 className="panel-title">运行时变量（vars:post-response）</h3>
          {Object.keys(runtime).length ? (
            <>
              <table className="headers">
                <tbody>
                  {Object.entries(runtime).map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="quiet" onClick={onClearRuntime}>
                清除运行时变量
              </button>
            </>
          ) : (
            <p className="hint">发送含 Post Response 变量的请求后，捕获值显示在这里（只在本次会话内存中）。</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
