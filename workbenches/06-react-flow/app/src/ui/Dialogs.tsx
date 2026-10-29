// ABOUTME: 原生 <dialog> 弹层：文件菜单（新建/打开/导入/导出/恢复/删除）、模板库与 AI 起草（含 Host 未连接状态卡）。
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isAppInfo, type AppInfo } from "../contracts/app";
import type { FlowDocument } from "../contracts/flow";
import { spec } from "../contracts/ops";
import type { ProjectSummary } from "../contracts/project";
import { templates, type PipelineTemplate } from "../contracts/templates";
import { opIcons } from "./icons";
import { request } from "./requests";

export function Modal({ open, onClose, title, className = "", children }: { open: boolean; onClose: () => void; title: string; className?: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      if (document.activeElement instanceof HTMLElement && !element.contains(document.activeElement)) opener.current = document.activeElement;
      element.showModal();
    } else if (!open && element.open) {
      element.close();
      const target = opener.current;
      opener.current = null;
      requestAnimationFrame(() => target?.isConnected && target.focus());
    }
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={"sheet " + className}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      {open ? (
        <div className="sheet-body">
          <header className="sheet-head">
            <h2 id={id}>{title}</h2>
            <button type="button" className="icon-button" aria-label={"关闭" + title} onClick={onClose}>
              ×
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
};

export function FileMenu(props: {
  items: ProjectSummary[];
  currentId?: string;
  title: string;
  locked: boolean;
  onNew: () => void;
  onTemplates: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onExport: () => void;
  onRecoveryDownload: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const { items, currentId, locked } = props;
  return (
    <div className="file-menu">
      <section aria-labelledby="file-new">
        <h3 id="file-new">新建</h3>
        <div className="file-actions">
          <button type="button" className="primary" disabled={locked} onClick={props.onNew}>
            空白流水线
          </button>
          <button type="button" disabled={locked} onClick={props.onTemplates}>
            从模板新建…
          </button>
          <button type="button" disabled={locked} onClick={props.onImport}>
            导入流水线 JSON…
          </button>
        </div>
        <p className="hint">导入总是另建新流水线，不覆盖当前文件；也接受 0.3 版单链配置和恢复稿。</p>
      </section>
      <section aria-labelledby="file-recent">
        <div className="section-row">
          <h3 id="file-recent">最近流水线</h3>
          <button type="button" className="link-button" onClick={props.onRefresh}>
            刷新
          </button>
        </div>
        {items.length ? (
          <ul className="recent-list">
            {items.map((item) => {
              const local = item.id.startsWith("local:"),
                draft = item.id.startsWith("draft:");
              return (
                <li key={item.id}>
                  <button type="button" disabled={locked} aria-current={item.id === currentId ? "true" : undefined} onClick={() => props.onOpen(item.id)}>
                    <span className="recent-title">{item.title.replace(/^(本机草稿|草稿) · /, "")}</span>
                    <span className="recent-meta">
                      {local ? "本机草稿 · " : draft ? "草稿 · " : ""}
                      {when(item.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">还没有保存过的流水线。编辑当前流水线后会自动保存到这里。</p>
        )}
      </section>
      <section aria-labelledby="file-current">
        <h3 id="file-current">当前 · {props.title || "未命名"}</h3>
        <div className="file-actions">
          <button type="button" onClick={props.onExport}>
            导出流水线 JSON
          </button>
          <button type="button" onClick={props.onRecoveryDownload}>
            下载恢复稿
          </button>
          <button type="button" className="danger" disabled={locked || !currentId || currentId.startsWith("local:")} onClick={props.onRemove}>
            删除流水线
          </button>
        </div>
      </section>
    </div>
  );
}

function TemplateSketch({ doc }: { doc: FlowDocument }) {
  const xs = doc.nodes.map((n) => n.position.x),
    ys = doc.nodes.map((n) => n.position.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 236,
    h = Math.max(...ys) - minY + 150;
  const at = new Map(doc.nodes.map((n) => [n.id, { x: n.position.x - minX, y: n.position.y - minY }]));
  return (
    <svg className="template-sketch" viewBox={`-20 -20 ${w + 40} ${h + 40}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {doc.edges.map((edge) => {
        const a = at.get(edge.source)!,
          b = at.get(edge.target)!;
        return <path key={edge.id} d={`M${a.x + 224} ${a.y + 60} C${a.x + 290} ${a.y + 60} ${b.x - 54} ${b.y + 60} ${b.x} ${b.y + 60}`} />;
      })}
      {doc.nodes.map((node) => {
        const p = at.get(node.id)!;
        return <rect key={node.id} x={p.x} y={p.y} width={224} height={120} rx={14} data-category={spec(node.data.op).category} />;
      })}
    </svg>
  );
}

export function TemplateGallery({ onPick, locked }: { onPick: (template: PipelineTemplate) => void; locked: boolean }) {
  return (
    <ul className="template-grid">
      {templates.map((template) => (
        <li key={template.id}>
          <button type="button" disabled={locked} onClick={() => onPick(template)}>
            <TemplateSketch doc={template.doc} />
            <strong>{template.title}</strong>
            <span className="template-desc">{template.description}</span>
            <span className="template-ops">
              {[...new Set(template.doc.nodes.map((n) => n.data.op))].map((op) => {
                const Icon = opIcons[op];
                return (
                  <span key={op} title={spec(op).title}>
                    <Icon aria-hidden="true" size={12} />
                    {spec(op).title}
                  </span>
                );
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const platformText: Record<AppInfo["platform"], string> = {
  connected: "Floatboat 已连接，调用时检查模型授权。",
  "not-connected": "Floatboat 未连接 · 本地功能可用",
  unavailable: "暂时无法连接 Floatboat · 本地功能可用",
};

export function AiDraft({
  prompt,
  onPrompt,
  busy,
  error,
  suggestion,
  onGenerate,
  onApply,
  onDiscard,
}: {
  prompt: string;
  onPrompt: (value: string) => void;
  busy: boolean;
  error: string;
  suggestion: FlowDocument | null;
  onGenerate: () => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [state, setState] = useState<"checking" | AppInfo["platform"]>("checking");
  const check = useCallback(async () => {
    setState("checking");
    try {
      const info = await request("/api/app");
      setState(isAppInfo(info) ? info.platform : "unavailable");
    } catch {
      setState("unavailable");
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  const offline = state === "not-connected" || state === "unavailable";
  return (
    <div className="ai-draft">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onGenerate();
        }}
      >
        <label htmlFor="ai-prompt">描述想要的数据处理</label>
        <textarea
          id="ai-prompt"
          rows={4}
          maxLength={12000}
          required
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder="例如：读取员工打卡 CSV，筛出迟到记录，按部门统计次数并画柱状图…"
        />
        <button type="submit" className="primary" disabled={busy || offline || state === "checking"}>
          {busy ? "正在生成…" : "生成候选流水线"}
        </button>
      </form>
      {offline ? (
        <div className="status-card" role="alert">
          <strong>模型服务未连接</strong>
          <p>AI 起草使用 Floatboat 的模型能力；独立本地预览未连接 Floatboat 时无法生成。画布编辑、运行、模板、导入导出都不受影响。</p>
          <p>处理：启动并登录 Floatboat 桌面端，在「设置 → 模型」中启用模型，保持本工作台预览运行（或从 Floatboat 打开），然后点击“重新检测”。</p>
          <div className="status-row">
            <button type="button" onClick={() => void check()}>
              重新检测
            </button>
            <span role="status">{platformText[state]}</span>
          </div>
        </div>
      ) : (
        <p className="hint">
          {error ? (
            <span role="alert" className="error-text">
              {error}
            </span>
          ) : (
            "生成结果先作为候选显示，采用后才替换当前画布（可撤销）。"
          )}{" "}
          <span role="status">{state === "checking" ? "正在检测…" : platformText[state]}</span>
        </p>
      )}
      {suggestion ? (
        <div className="candidate">
          <ol>
            {suggestion.nodes.map((node) => (
              <li key={node.id}>
                {node.data.label} · <span className="muted">{spec(node.data.op).title}</span>
              </li>
            ))}
          </ol>
          <div className="file-actions">
            <button type="button" className="primary" onClick={onApply}>
              采用候选（{suggestion.nodes.length} 个节点）
            </button>
            <button type="button" onClick={onDiscard}>
              丢弃
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
