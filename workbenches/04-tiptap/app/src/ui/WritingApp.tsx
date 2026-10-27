import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import {
  seed,
  validateWriting,
  plainText,
  type WritingProject,
} from "../contracts/domain";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  useProjects,
} from "./workspace";
const RichEditor = lazy(() =>
  import("./RichEditor").then((module) => ({ default: module.RichEditor })),
);
export function WritingApp() {
  const p = useProjects<WritingProject>(
    seed,
    validateWriting,
    "一份清晰的方案",
  );
  const [epoch, setEpoch] = useState(0),
    [assistant, setAssistant] = useState(false),
    [prompt, setPrompt] = useState(""),
    [exporting, setExporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const initial = useMemo(
    () => structuredClone(p.data.content),
    [p.current?.id, epoch],
  );
  const onChange = useCallback(
    (content: JSONContent) => p.setData({ content }),
    [p.setData],
  );
  const count = plainText(p.data.content).replace(/\s/g, "").length;
  function fresh() {
    if (p.fresh()) setEpoch((value) => value + 1);
  }
  async function exportHtml() {
    p.setError("");
    setExporting(true);
    try {
      const [core, kit] = await Promise.all([
        import("@tiptap/core"),
        import("@tiptap/starter-kit"),
      ]);
      const body = core.generateHTML(validateWriting(p.data).content, [
        kit.default,
      ]);
      const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>文档</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 24px;line-height:1.85;color:#272523}blockquote{border-left:3px solid #c4a28b;margin-left:0;padding-left:20px;color:#665850}pre{white-space:pre-wrap;background:#f3f0ed;padding:16px}</style><body>${body}</body></html>`;
      download(new Blob([html], { type: "text/html" }), `${p.title}.html`);
    } catch (error) {
      p.report(error);
    } finally {
      setExporting(false);
    }
  }
  async function importJson(input: File) {
    try {
      if (input.size > 900000) throw new Error("文件超过 900 KB。");
      const next = validateWriting(JSON.parse(await input.text()));
      if (p.dirty && !confirm("使用导入的文档替换未保存内容吗？")) return;
      p.setData(next);
      setEpoch((value) => value + 1);
    } catch (error) {
      p.report(error);
    }
  }
  return (
    <main className={`writing-app ${assistant ? "has-assistant" : ""}`}>
      <a className="skip" href="#writing-main">
        跳到正文
      </a>
      <header className="writing-header">
        <h1 className="sr-only">写作台</h1>
        <a className="wordmark" href="#writing-main" translate="no">
          文<span> / </span>写作台
        </a>
        <div className="writing-projects">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={p.busy}
            onOpen={(id) => void p.open(id)}
          />
          <button onClick={fresh} disabled={p.busy}>
            新建
          </button>
          <button
            onClick={() => void p.remove()}
            disabled={!p.current || p.busy}
          >
            删除
          </button>
        </div>
        <div className="writing-actions">
          <button onClick={() => file.current?.click()} disabled={p.busy}>
            导入
          </button>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(p.data, null, 2)], {
                  type: "application/json",
                }),
                `${p.title}.json`,
              )
            }
          >
            JSON
          </button>
          <button onClick={() => void exportHtml()} disabled={exporting}>
            HTML
          </button>
          <button
            className="save-button"
            disabled={p.busy}
            onClick={() => void p.save()}
          >
            {p.busy ? "保存中…" : "保存文档"}
          </button>
        </div>
      </header>
      <Notice error={p.error} notice={p.notice} />
      <div className="writing-layout">
        <section className="manuscript" id="writing-main" tabIndex={-1}>
          <div className="manuscript-top">
            <span className="eyebrow">WORKING DRAFT</span>
            <span role="status">
              {p.dirty ? "尚未保存" : "就绪"} ·{" "}
              {new Intl.NumberFormat("zh-CN").format(count)} 字符
            </span>
          </div>
          <label className="sr-only" htmlFor="writing-title">
            文档标题
          </label>
          <input
            id="writing-title"
            name="documentTitle"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(event) => p.setTitle(event.target.value)}
          />
          <p className="writing-subtitle">留出空间，让文字自己说话。</p>
          <RenderBoundary key={`${p.current?.id}-${epoch}`}>
            <Suspense fallback={<p role="status">正在准备编辑器…</p>}>
              <RichEditor initial={initial} onChange={onChange} />
            </Suspense>
          </RenderBoundary>
          <footer className="manuscript-footer">
            <span>文档在当前工作空间保存</span>
            <button
              onClick={() => setAssistant((value) => !value)}
              aria-expanded={assistant}
            >
              ✦ {assistant ? "收起写作助手" : "打开写作助手"}
            </button>
          </footer>
        </section>
        {assistant ? (
          <aside className="writing-assistant" aria-label="写作助手">
            <div className="assistant-title">
              <h2>换一个角度</h2>
              <button
                aria-label="关闭写作助手"
                onClick={() => setAssistant(false)}
              >
                ×
              </button>
            </div>
            <p>描述目标读者、语气和想表达的重点。生成稿会先显示在这里。</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void p.generate(prompt);
              }}
            >
              <label htmlFor="writing-prompt">写作要求</label>
              <textarea
                id="writing-prompt"
                name="writingPrompt"
                autoComplete="off"
                required
                value={prompt}
                maxLength={12000}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="例如：为新客户写一份项目启动说明…"
              />
              <button className="save-button" disabled={p.aiBusy}>
                {p.aiBusy ? "正在起草…" : "生成草稿"}
              </button>
            </form>
            {p.suggestion ? (
              <section className="draft-preview">
                <h3>待采用的草稿</h3>
                <pre>{plainText(p.suggestion.content)}</pre>
                <button
                  onClick={() => {
                    if (confirm("用这份草稿替换当前正文吗？")) {
                      p.applySuggestion();
                      setEpoch((value) => value + 1);
                    }
                  }}
                >
                  采用并替换正文
                </button>
                <button onClick={p.discardSuggestion}>放弃生成稿</button>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
      <input
        ref={file}
        className="sr-only"
        type="file"
        aria-label="导入文档文件"
        accept="application/json,.json"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) void importJson(selected);
        }}
      />
    </main>
  );
}
