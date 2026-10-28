import { useEffect, useRef, useState } from "react";
import {
  seed,
  validateEmail,
  restoreEmail,
  importEmail,
  variablesValue,
  recipientsValue,
  kinds,
  type Kind,
  type Block,
  type EmailDoc,
} from "../contracts/email";
import { isRecord } from "../contracts/project";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";
const names: Record<Kind, string> = {
  heading: "标题",
  text: "段落",
  button: "按钮",
  divider: "分隔线",
  columns: "双栏",
};
interface Proof {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  missing: string[];
}
function proofValue(raw: unknown): Proof {
  if (
    !isRecord(raw) ||
    typeof raw.html !== "string" ||
    typeof raw.text !== "string" ||
    typeof raw.subject !== "string" ||
    typeof raw.preheader !== "string" ||
    !Array.isArray(raw.missing) ||
    !raw.missing.every((x) => typeof x === "string")
  )
    throw Error("校样响应无效。");
  return raw as unknown as Proof;
}
export function App() {
  const p = useProjects(seed, validateEmail, "十月来信", {
    storageKey: "react-email-v1",
    restoreDraftData: restoreEmail,
  });
  const [selected, setSelected] = useState("a"),
    [transitioning, setTransitioning] = useState(false),
    [proof, setProof] = useState<{ key: string; value: Proof } | null>(null),
    [renderError, setRenderError] = useState(""),
    [mode, setMode] = useState("desktop"),
    [mobileTab, setMobileTab] = useState("write");
  const transitionRef = useRef(false),
    keyRef = useRef(p.documentKey);
  keyRef.current = p.documentKey;
  const blocked = transitioning || p.loading,
    block = p.data.blocks.find((b) => b.id === selected) ?? p.data.blocks[0],
    renderKey = p.documentKey + JSON.stringify(p.data),
    currentProof = proof?.key === renderKey ? proof.value : null;
  const raw = typeof p.draft.json === "string" ? p.draft.json : "",
    varRaw =
      typeof p.draft.variables === "string"
        ? p.draft.variables
        : JSON.stringify(p.data.variables, null, 2),
    recipientRaw =
      typeof p.draft.recipients === "string"
        ? p.draft.recipients
        : JSON.stringify(p.data.recipients, null, 2);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setRenderError("");
    if (p.loading) return;
    const timer = setTimeout(() => {
      void request("/api/render", {
        method: "POST",
        body: JSON.stringify({ data: p.data }),
        signal: controller.signal,
      })
        .then(proofValue)
        .then((v) => {
          if (alive) setProof({ key: renderKey, value: v });
        })
        .catch((e) => {
          if (alive)
            setRenderError(e instanceof Error ? e.message : "校样失败。");
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [renderKey, p.loading]);
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      if (await action()) setSelected("");
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  function setEmail(update: (d: EmailDoc) => EmailDoc) {
    const next = update(p.data);
    if (new TextEncoder().encode(JSON.stringify(next)).length > 850000) {
      p.setError("邮件内容超过850KB，请先导出并减少内容。");
      return;
    }
    p.setData(next);
  }
  const edit = (value: Partial<Block>) => {
    if (!block || blocked) return;
    setEmail((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === block.id ? { ...b, ...value } : b)),
    }));
  };
  function add(kind: Kind) {
    if (p.data.blocks.length >= 80) {
      p.setError("最多80个邮件组件。");
      return;
    }
    const b: Block = {
      id: crypto.randomUUID(),
      kind,
      text:
        kind === "heading"
          ? "新的标题"
          : kind === "button"
            ? "了解更多"
            : kind === "divider"
              ? ""
              : "写下这一段内容…",
      secondary: kind === "columns" ? "第二栏内容…" : "",
      href: kind === "button" ? "https://example.com" : "",
    };
    setEmail((d) => ({ ...d, blocks: [...d.blocks, b] }));
    setSelected(b.id);
  }
  function move(delta: number) {
    if (!block) return;
    const i = p.data.blocks.findIndex((b) => b.id === block.id),
      target = i + delta;
    if (target < 0 || target >= p.data.blocks.length) return;
    setEmail((d) => {
      const blocks = [...d.blocks];
      [blocks[i], blocks[target]] = [blocks[target], blocks[i]];
      return { ...d, blocks };
    });
  }
  function applyRaw(kind: "variables" | "recipients") {
    try {
      if (kind === "variables") {
        const variables = variablesValue(JSON.parse(varRaw));
        setEmail((d) => ({ ...d, variables }));
      } else {
        const recipients = recipientsValue(JSON.parse(recipientRaw));
        setEmail((d) => ({
          ...d,
          recipients,
          selectedRecipient: recipients.some(
            (r) => r.id === d.selectedRecipient,
          )
            ? d.selectedRecipient
            : (recipients[0]?.id ?? ""),
        }));
      }
      p.setNotice("已应用到校样。");
      p.setError("");
    } catch (e) {
      p.report(e);
    }
  }
  async function importFile(file: File) {
    await transition(async () => {
      if (file.size > 4000000) throw Error("工程文件超过4MB。");
      const v = importEmail(JSON.parse(await file.text()));
      return p.replace(v.data, v.title, v.extra);
    });
  }
  function exportProject() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "react-email-workbench/v1",
              title: p.title,
              data: p.data,
              extra: p.draft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      p.title + ".email-project.json",
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        跳到邮件编辑
      </a>
      <header>
        <div className="brand">
          <span className="seal" aria-hidden="true">
            ✉
          </span>
          <div>
            <h1>
              信笺 <small>REACT EMAIL</small>
            </h1>
            <p>写一封值得打开的邮件</p>
          </div>
        </div>
        <div className="filebar">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={blocked}
            onOpen={(id) => void transition(() => p.open(id))}
          />
          <button
            disabled={blocked}
            onClick={() => void transition(() => p.fresh())}
          >
            新建邮件
          </button>
          <label className="file-button">
            导入工程
            <input
              name="project-import"
              autoComplete="off"
              aria-label="导入工程"
              type="file"
              accept=".json"
              disabled={blocked}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
          </label>
        </div>
      </header>
      <main id="main">
        <div className="documentline">
          <input
            name="project-title"
            autoComplete="off"
            aria-label="稿件名称"
            className="title"
            maxLength={120}
            value={p.title}
            disabled={blocked}
            onChange={(e) => p.setTitle(e.target.value)}
          />
          <span className={"save " + p.autoState.phase} role="status">
            {p.autoState.message}
          </span>
          <button disabled={blocked} onClick={() => void p.save()}>
            立即保存
          </button>
        </div>
        <Notice error={p.error} notice={p.notice} />
        {p.autoState.phase === "conflict" && (
          <button
            disabled={blocked}
            onClick={() =>
              p.current && void transition(() => p.open(p.current!.id))
            }
          >
            打开服务端版本
          </button>
        )}
        <fieldset className="envelope" disabled={blocked}>
          <label>
            邮件主题
            <input
              name="subject"
              autoComplete="off"
              aria-label="邮件主题"
              maxLength={300}
              value={p.data.subject}
              onChange={(e) =>
                setEmail((d) => ({ ...d, subject: e.target.value }))
              }
            />
          </label>
          <label>
            收件箱预览文案
            <input
              name="preheader"
              autoComplete="off"
              aria-label="收件箱预览文案"
              maxLength={500}
              value={p.data.preheader}
              onChange={(e) =>
                setEmail((d) => ({ ...d, preheader: e.target.value }))
              }
            />
          </label>
        </fieldset>
        <div className="mobile-tabs">
          <button
            aria-pressed={mobileTab === "write"}
            onClick={() => setMobileTab("write")}
          >
            编写内容
          </button>
          <button
            aria-pressed={mobileTab === "proof"}
            onClick={() => setMobileTab("proof")}
          >
            查看校样
          </button>
        </div>
        <div className={"studio tab-" + mobileTab}>
          <fieldset className="writer" disabled={blocked}>
            <div className="section-title">
              <h2>邮件内容</h2>
              <span>{p.data.blocks.length} 个组件</span>
            </div>
            <div className="blocks">
              {p.data.blocks.map((b, i) => (
                <button
                  key={b.id}
                  className={block?.id === b.id ? "active" : ""}
                  onClick={() => setSelected(b.id)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <b>{names[b.kind]}</b>
                  <small>{b.text || "—"}</small>
                </button>
              ))}
            </div>
            <div className="add-tools" aria-label="添加邮件组件">
              {kinds.map((k) => (
                <button key={k} onClick={() => add(k)}>
                  ＋ {names[k]}
                </button>
              ))}
            </div>
            {block ? (
              <section className="block-editor">
                <div className="section-title">
                  <h3>编辑{names[block.kind]}</h3>
                  <div>
                    <button
                      aria-label="组件上移"
                      onClick={() => move(-1)}
                      disabled={p.data.blocks[0]?.id === block.id}
                    >
                      ↑
                    </button>
                    <button
                      aria-label="组件下移"
                      onClick={() => move(1)}
                      disabled={p.data.blocks.at(-1)?.id === block.id}
                    >
                      ↓
                    </button>
                    <button
                      aria-label="删除组件"
                      onClick={() => {
                        if (confirm("删除这个邮件组件？"))
                          setEmail((d) => ({
                            ...d,
                            blocks: d.blocks.filter((b) => b.id !== block.id),
                          }));
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                {block.kind !== "divider" ? (
                  <label>
                    {block.kind === "button"
                      ? "按钮文字"
                      : block.kind === "columns"
                        ? "左栏文字"
                        : "内容"}
                    <textarea
                      name="block-content"
                      autoComplete="off"
                      aria-label="组件内容"
                      rows={
                        block.kind === "text" || block.kind === "columns"
                          ? 6
                          : 3
                      }
                      maxLength={20000}
                      value={block.text}
                      onChange={(e) => edit({ text: e.target.value })}
                    />
                  </label>
                ) : (
                  <p className="muted">分隔线帮助读者区分邮件中的段落。</p>
                )}
                {block.kind === "columns" && (
                  <label>
                    右栏文字
                    <textarea
                      name="right-column"
                      autoComplete="off"
                      aria-label="右栏文字"
                      rows={5}
                      maxLength={20000}
                      value={block.secondary}
                      onChange={(e) => edit({ secondary: e.target.value })}
                    />
                  </label>
                )}
                {block.kind === "button" && (
                  <label>
                    按钮链接
                    <input
                      name="button-url"
                      autoComplete="off"
                      aria-label="按钮链接"
                      type="text"
                      inputMode="url"
                      spellCheck={false}
                      maxLength={2000}
                      value={block.href}
                      onChange={(e) => edit({ href: e.target.value })}
                    />
                  </label>
                )}
                <p className="muted">
                  使用 {"{{name}}"} 插入变量。示例收件人只用于预览。
                </p>
              </section>
            ) : (
              <p className="muted">添加一个标题或段落，开始这封信。</p>
            )}
            <details>
              <summary>信纸与品牌</summary>
              <label>
                署名 / 品牌
                <input
                  name="brand"
                  autoComplete="off"
                  aria-label="署名品牌"
                  maxLength={120}
                  value={p.data.brand}
                  onChange={(e) =>
                    setEmail((d) => ({ ...d, brand: e.target.value }))
                  }
                />
              </label>
              <div className="inline">
                <label>
                  主题色
                  <input
                    name="accent"
                    autoComplete="off"
                    aria-label="主题色"
                    maxLength={100}
                    spellCheck={false}
                    value={p.data.accent}
                    onChange={(e) =>
                      setEmail((d) => ({ ...d, accent: e.target.value }))
                    }
                  />
                </label>
                <label>
                  邮件宽度 / px
                  <input
                    name="email-width"
                    autoComplete="off"
                    aria-label="邮件宽度"
                    inputMode="numeric"
                    maxLength={100}
                    value={p.data.width}
                    onChange={(e) =>
                      setEmail((d) => ({ ...d, width: e.target.value }))
                    }
                  />
                </label>
              </div>
            </details>
            <details>
              <summary>变量与示例收件人</summary>
              <label>
                默认变量 JSON
                <textarea
                  name="variables-json"
                  autoComplete="off"
                  aria-label="默认变量 JSON"
                  rows={5}
                  spellCheck={false}
                  maxLength={350000}
                  value={varRaw}
                  onChange={(e) =>
                    p.setDraft((d) => ({ ...d, variables: e.target.value }))
                  }
                />
              </label>
              <button onClick={() => applyRaw("variables")}>
                应用默认变量
              </button>
              <label>
                示例收件人 JSON
                <textarea
                  name="recipients-json"
                  autoComplete="off"
                  aria-label="示例收件人 JSON"
                  rows={7}
                  spellCheck={false}
                  maxLength={350000}
                  value={recipientRaw}
                  onChange={(e) =>
                    p.setDraft((d) => ({ ...d, recipients: e.target.value }))
                  }
                />
              </label>
              <button onClick={() => applyRaw("recipients")}>
                应用示例收件人
              </button>
              <p className="muted">
                每项包含 id、label 和
                values。收件人变量覆盖默认值；变量名使用字母、数字与下划线。
              </p>
            </details>
            <details>
              <summary>工作稿与备注</summary>
              <label>
                编辑备注
                <textarea
                  name="notes"
                  autoComplete="off"
                  aria-label="编辑备注"
                  rows={3}
                  maxLength={30000}
                  value={p.data.notes}
                  onChange={(e) =>
                    setEmail((d) => ({ ...d, notes: e.target.value }))
                  }
                />
              </label>
              <div className="exports">
                <button onClick={exportProject}>导出工程 JSON</button>
                <button onClick={p.exportDraft}>导出恢复稿</button>
              </div>
              <label>
                工程 JSON 工作稿
                <textarea
                  name="project-json"
                  autoComplete="off"
                  aria-label="工程 JSON 工作稿"
                  rows={6}
                  spellCheck={false}
                  maxLength={500000}
                  value={raw}
                  onChange={(e) =>
                    p.setDraft((d) => ({ ...d, json: e.target.value }))
                  }
                />
              </label>
              <button
                onClick={() =>
                  p.setDraft((d) => ({
                    ...d,
                    json: JSON.stringify(
                      { title: p.title, data: p.data, extra: {} },
                      null,
                      2,
                    ),
                  }))
                }
              >
                载入当前工程
              </button>
              <button
                onClick={() =>
                  void transition(async () => {
                    const v = importEmail(JSON.parse(raw));
                    return p.replace(v.data, v.title, v.extra);
                  })
                }
              >
                作为新副本应用
              </button>
            </details>
          </fieldset>
          <section className="proof">
            <div className="proof-tools">
              <div className="modes">
                <button
                  aria-pressed={mode === "desktop"}
                  onClick={() => setMode("desktop")}
                >
                  桌面
                </button>
                <button
                  aria-pressed={mode === "mobile"}
                  onClick={() => setMode("mobile")}
                >
                  手机
                </button>
                <button
                  aria-pressed={mode === "text"}
                  onClick={() => setMode("text")}
                >
                  纯文本
                </button>
              </div>
              <label>
                示例
                <select
                  name="proof-recipient"
                  autoComplete="off"
                  aria-label="校样收件人"
                  value={p.data.selectedRecipient}
                  disabled={blocked}
                  onChange={(e) =>
                    setEmail((d) => ({
                      ...d,
                      selectedRecipient: e.target.value,
                    }))
                  }
                >
                  <option value="">默认变量</option>
                  {p.data.recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inbox">
              <span className="avatar" aria-hidden="true">
                L
              </span>
              <div>
                <b>{p.data.brand || "未填写品牌"}</b>
                <strong>{currentProof?.subject ?? p.data.subject}</strong>
                <small>{currentProof?.preheader ?? p.data.preheader}</small>
              </div>
              <span>校样</span>
            </div>
            <div className={"paper-stage " + mode}>
              {currentProof ? (
                mode === "text" ? (
                  <pre className="plain">{currentProof.text}</pre>
                ) : (
                  <iframe
                    title="邮件 HTML 校样"
                    sandbox=""
                    srcDoc={currentProof.html}
                    className="email-frame"
                  />
                )
              ) : (
                <div className="proof-state" role="status">
                  {renderError ? (
                    <>
                      <strong>这封信还差一步</strong>
                      <p>{renderError}</p>
                      <p>当前输入已保留，完成后会重新校样。</p>
                    </>
                  ) : (
                    <p>正在生成校样…</p>
                  )}
                </div>
              )}
            </div>
            {currentProof?.missing.length ? (
              <p className="warning" role="status">
                未填写变量：{currentProof.missing.join("、")}
                。导出会保留这些占位符。
              </p>
            ) : null}
            <div className="proof-footer">
              <span role="status">
                {currentProof
                  ? "校样已更新"
                  : renderError
                    ? "等待完成编辑"
                    : "校样更新中…"}
              </span>
              <button
                disabled={!currentProof || blocked}
                onClick={() =>
                  currentProof &&
                  download(
                    new Blob([currentProof.html], {
                      type: "text/html;charset=utf-8",
                    }),
                    p.title + ".html",
                  )
                }
              >
                导出 HTML
              </button>
              <button
                disabled={!currentProof || blocked}
                onClick={() =>
                  currentProof &&
                  download(
                    new Blob([currentProof.text], {
                      type: "text/plain;charset=utf-8",
                    }),
                    p.title + ".txt",
                  )
                }
              >
                导出纯文本
              </button>
            </div>
            <p className="compatibility">
              这是浏览器校样。实际邮箱的字体、间距和双栏表现可能不同；正式使用前请在目标邮件客户端检查。
            </p>
          </section>
        </div>
        <footer>
          信笺 / A LETTER, WELL CONSIDERED <span>编写 · 校样 · 交付</span>
        </footer>
      </main>
    </>
  );
}
