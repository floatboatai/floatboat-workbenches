// ABOUTME: 写作助手：通过 Floatboat Host 生成候选稿；未连接时显示状态卡和重新检测，候选稿渲染预览后由用户选择替换、插入或放弃。
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import type { WritingProject } from "../contracts/domain";
import { isAppInfo, type AppInfo } from "../contracts/app";
import { request } from "./workspace";

type HostState = AppInfo["platform"] | "checking" | "error";

export function useHostStatus(enabled: boolean) {
  const [state, setState] = useState<HostState>("checking");
  const check = useCallback(async () => {
    setState("checking");
    try {
      const info = await request("/api/app");
      setState(isAppInfo(info) ? info.platform : "error");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => {
    if (enabled) void check();
  }, [enabled, check]);
  return { state, check };
}

function Preview({ suggestion }: { suggestion: WritingProject }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    import("./render")
      .then((module) => {
        if (live) setHtml(module.renderFragment(suggestion.content));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [suggestion]);
  if (failed) return <p className="field-error">预览渲染失败，候选稿仍可采用。</p>;
  if (html === null) return <p className="assistant-muted">正在排版预览…</p>;
  // html 由 generateHTML 从通过 validateWriting 的 JSON 生成，不含脚本或外部资源。
  return <div className="draft-body tiptap" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AssistantPanel({
  onClose,
  prompt,
  setPrompt,
  withContext,
  setWithContext,
  busy,
  suggestion,
  onGenerate,
  onReplace,
  onInsert,
  onDiscard,
}: {
  onClose: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  withContext: boolean;
  setWithContext: (value: boolean) => void;
  busy: boolean;
  suggestion: WritingProject | null;
  onGenerate: () => void;
  onReplace: () => void;
  onInsert: () => void;
  onDiscard: () => void;
}) {
  const host = useHostStatus(true);
  const ready = host.state === "connected";
  return (
    <aside className="writing-assistant" aria-label="写作助手">
      <div className="assistant-title">
        <h2>写作助手</h2>
        <button type="button" aria-label="关闭写作助手" title="关闭写作助手" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="assistant-muted">描述读者、语气和要点。生成稿先在这里预览，由你决定替换、插入还是放弃。</p>
      {ready ? null : (
        <section className={`host-card ${host.state === "checking" ? "is-checking" : ""}`} role="status">
          {host.state === "checking" ? (
            <p>正在检测 Floatboat 连接…</p>
          ) : (
            <>
              <h3>{host.state === "not-connected" ? "Floatboat 未连接" : "暂时无法连接 Floatboat"}</h3>
              <p>
                写作助手通过 Floatboat 的模型服务生成草稿。请启动并登录 Floatboat 客户端，或在 Floatboat 中打开本工作台，然后重新检测。
              </p>
              <p className="assistant-muted">正文编辑、导入导出和自动保存不受影响。</p>
            </>
          )}
          <button type="button" onClick={() => void host.check()} disabled={host.state === "checking"}>
            <RefreshCw size={14} aria-hidden="true" /> 重新检测
          </button>
        </section>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && prompt.trim()) onGenerate();
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
          placeholder="例如：把「预算」一节改写成给街道办的正式说明，突出资金来源…"
        />
        <label className="check">
          <input
            type="checkbox"
            name="withContext"
            checked={withContext}
            onChange={(event) => setWithContext(event.target.checked)}
          />
          参考当前正文（图片不发送）
        </label>
        <button className="primary" disabled={!ready || busy || !prompt.trim()}>
          {busy ? "正在起草…" : "生成候选稿"}
        </button>
      </form>
      {suggestion ? (
        <section className="draft-preview" aria-label="待采用的候选稿">
          <h3>候选稿</h3>
          <Preview suggestion={suggestion} />
          <div className="draft-actions">
            <button type="button" className="primary" onClick={onInsert}>
              插入到光标处
            </button>
            <button type="button" onClick={onReplace}>
              替换全部正文…
            </button>
            <button type="button" onClick={onDiscard}>
              放弃
            </button>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
