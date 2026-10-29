import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
import type { SpecFormat } from "../contracts/openapi";
import { PROXY_LIMITS } from "../contracts/proxy";
import type { TryCall } from "./ApiDocs";

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);
  const id = "sheet-" + eyebrow.replace(/\W+/g, "-").toLowerCase();
  return (
    <dialog
      ref={dialog}
      className={"sheet " + (className ?? "")}
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
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h2 id={id}>{title}</h2>
            </div>
            <button className="icon-button" aria-label={"关闭" + title} onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

const when = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
function stamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : when.format(date);
}

export interface ImportProblem {
  name: string;
  message: string;
  text: string;
  format: SpecFormat;
}

export function FileMenu(props: {
  open: boolean;
  onClose: () => void;
  locked: boolean;
  items: ProjectSummary[];
  currentId?: string;
  title: string;
  onRename: (value: string) => void;
  format: SpecFormat;
  sourceLength: number;
  hasDraft: boolean;
  importProblem: ImportProblem | null;
  onNew: () => void;
  onSample: () => void;
  onImport: () => void;
  onImportDraft: () => void;
  onExport: () => void;
  onExportOther: () => void;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onRecoveryDownload: () => void;
  onRecoveryImport: () => void;
  onRemove: () => void;
}) {
  const other = props.format === "yaml" ? "JSON" : "YAML";
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="接口规格"
      eyebrow="规格文件"
      className="file-sheet"
    >
      <section className="sheet-section current-spec" aria-label="当前规格">
        <label className="field">
          <span>规格名称</span>
          <input
            name="spec-title"
            autoComplete="off"
            maxLength={120}
            value={props.title}
            onChange={(event) => props.onRename(event.target.value)}
          />
        </label>
        <p className="meta">
          {props.format === "yaml" ? "YAML" : "JSON"} 原文 ·{" "}
          {props.sourceLength.toLocaleString("zh-CN")} 字符
          {props.hasDraft ? " · 有未通过检查的源码草稿" : ""}
        </p>
        <div className="button-row">
          <button className="primary" onClick={props.onExport}>
            导出原文（.{props.format === "yaml" ? "yaml" : "json"}）
          </button>
          <button onClick={props.onExportOther}>另存为 {other}</button>
        </div>
        {props.hasDraft ? (
          <p className="hint">导出的是上次通过检查的版本；未通过检查的草稿可用「下载恢复稿」保留。</p>
        ) : null}
      </section>
      <section className="sheet-section" aria-label="新建与导入">
        <div className="button-grid">
          <button disabled={props.locked} onClick={props.onNew}>
            新建空白规格
          </button>
          <button disabled={props.locked} onClick={props.onImport}>
            导入 OpenAPI / Swagger…
          </button>
          <button disabled={props.locked} onClick={props.onSample}>
            打开图书馆示例
          </button>
        </div>
        <p className="hint">
          支持 OpenAPI 3.0 / 3.1 / 3.2 与 Swagger 2.0 的 .yaml、.yml、.json；导入保留原文并另建规格，不覆盖当前内容。
        </p>
        {props.importProblem ? (
          <div className="import-problem" role="alert">
            <p>
              <strong>{props.importProblem.name}</strong> 未通过检查：{props.importProblem.message}
            </p>
            <button disabled={props.locked} onClick={props.onImportDraft}>
              作为源码草稿打开并修正
            </button>
          </div>
        ) : null}
      </section>
      <section className="sheet-section" aria-labelledby="recent-heading">
        <div className="section-head">
          <h3 id="recent-heading">最近的规格</h3>
          <button className="link" onClick={props.onRefresh}>
            刷新
          </button>
        </div>
        {props.items.length ? (
          <ul className="recent-list">
            {props.items.map((item) => {
              const local = item.id.startsWith("local:");
              const draft = item.id.startsWith("draft:");
              const current = item.id === props.currentId;
              return (
                <li key={item.id}>
                  <button
                    disabled={props.locked || current}
                    aria-current={current ? "true" : undefined}
                    onClick={() => props.onOpen(item.id)}
                  >
                    <span className="recent-title">{item.title}</span>
                    <small>
                      {current ? "当前 · " : ""}
                      {local ? "本机草稿 · " : draft ? "待完善 · " : ""}
                      {stamp(item.updatedAt)}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">还没有保存过的规格。编辑后会自动保存到这里。</p>
        )}
      </section>
      <section className="sheet-section" aria-label="恢复与删除">
        <div className="button-row">
          <button onClick={props.onRecoveryDownload}>下载恢复稿</button>
          <button disabled={props.locked} onClick={props.onRecoveryImport}>
            导入恢复稿…
          </button>
          <button
            className="danger"
            disabled={props.locked || !props.currentId}
            onClick={props.onRemove}
          >
            删除此规格
          </button>
        </div>
      </section>
    </Sheet>
  );
}

const ERROR_TITLES: Record<string, string> = {
  BLOCKED_PRIVATE: "已阻止本机/内网目标",
  BLOCKED_SELF: "目标是工作台本身",
  RELATIVE: "服务器地址是相对路径",
  DNS: "域名无法解析",
  CONNECT: "无法连接",
  TIMEOUT: "超时",
  TOO_LARGE: "请求体过大",
  BUSY: "请求过多",
  OFFLINE: "工作台服务无响应",
  INVALID: "请求无效",
};
export function callTitle(call: TryCall) {
  return call.code ? (ERROR_TITLES[call.code] ?? "试调失败") : `HTTP ${call.status}`;
}

export function TrySettings({
  open,
  onClose,
  allowPrivate,
  setAllowPrivate,
  calls,
}: {
  open: boolean;
  onClose: () => void;
  allowPrivate: boolean;
  setAllowPrivate: (value: boolean) => void;
  calls: TryCall[];
}) {
  return (
    <Sheet open={open} onClose={onClose} title="试调通道" eyebrow="Try it out" className="side-sheet">
      <section className="sheet-section">
        <p>
          点击端点中的 <strong>Execute</strong> 才会发出请求。外部地址由工作台服务端转发，Swagger
          中显示的 Request URL 与 curl 仍是真实目标。
        </p>
        <ul className="policy">
          <li>支持 GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS</li>
          <li>超时 {PROXY_LIMITS.timeoutMs / 1000} 秒 · 请求体 ≤ 1 MB · 响应 ≤ 5 MB（超出截断）</li>
          <li>不跟随重定向，3xx 原样显示 Location</li>
          <li>Authorize 中的令牌与密钥只在本页内存中，刷新即清除，不写入规格、自动保存或日志</li>
          <li>内置示例服务 /api/sample/… 直接在工作台内执行</li>
        </ul>
        <label className="toggle">
          <input
            type="checkbox"
            name="allow-private"
            checked={allowPrivate}
            onChange={(event) => setAllowPrivate(event.target.checked)}
          />
          <span>
            <strong>允许本机与内网目标</strong>
            <small>
              默认阻止 localhost、127.0.0.0/8、10.0.0.0/8、192.168.0.0/16 等地址，防止规格诱导请求内网。只在调试自己的本机服务时开启；刷新页面后恢复关闭。
            </small>
          </span>
        </label>
      </section>
      <section className="sheet-section" aria-labelledby="calls-heading">
        <h3 id="calls-heading">本次会话的试调</h3>
        {calls.length ? (
          <ol className="call-list">
            {calls.map((call) => (
              <li key={call.id} className={call.code ? "failed" : ""}>
                <span className={"method m-" + call.method.toLowerCase()}>{call.method}</span>
                <code>{call.target}</code>
                <span className="call-result">
                  {callTitle(call)}
                  {call.durationMs !== undefined ? ` · ${call.durationMs} ms` : ""}
                  {call.local ? " · 示例服务" : ""}
                </span>
                {call.message ? <small>{call.message}</small> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">还没有试调。在文档中展开端点 → Try it out → Execute。</p>
        )}
      </section>
    </Sheet>
  );
}

export type HostState = "checking" | "connected" | "not-connected" | "unavailable";

export function DraftPanel({
  open,
  onClose,
  host,
  onRecheck,
  prompt,
  setPrompt,
  busy,
  onGenerate,
  suggestion,
  onApply,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  host: HostState;
  onRecheck: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  busy: boolean;
  onGenerate: () => void;
  suggestion: string | null;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="起草规格" eyebrow="Floatboat 模型" className="side-sheet">
      {host !== "connected" ? (
        <section className="sheet-section host-card" role="status">
          <p>
            <strong>
              {host === "checking"
                ? "正在检查 Floatboat 模型服务…"
                : host === "not-connected"
                  ? "未连接 Floatboat"
                  : "Floatboat 模型服务暂不可用"}
            </strong>
          </p>
          {host !== "checking" ? (
            <p>
              起草需要正在运行并已登录的 Floatboat 客户端：在 Floatboat「我的 → 工作台」中打开本工作台，或保持客户端运行后在本机执行
              <code>pnpm workbench dev swagger-ui</code>。浏览、编辑、导入导出与试调不受影响。
            </p>
          ) : null}
          <button onClick={onRecheck} disabled={host === "checking"}>
            重新检查
          </button>
        </section>
      ) : null}
      <section className="sheet-section">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onGenerate();
          }}
        >
          <label className="field">
            <span>接口需求</span>
            <textarea
              name="draft-prompt"
              rows={5}
              maxLength={12000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：会议室预订服务，包含会议室列表、预订、取消预订与按日期查询，需要 Bearer 令牌…"
              required
            />
          </label>
          <button className="primary" disabled={busy || host !== "connected"}>
            {busy ? "正在起草…" : "生成候选规格"}
          </button>
        </form>
      </section>
      <section className="sheet-section" aria-label="候选规格">
        {suggestion ? (
          <>
            <pre className="suggestion" tabIndex={0}>
              {suggestion}
            </pre>
            <div className="button-row">
              <button className="primary" onClick={onApply}>
                采用为当前规格源码
              </button>
              <button onClick={onDiscard}>放弃候选</button>
            </div>
          </>
        ) : (
          <p className="hint">候选规格以 YAML 显示，确认后才替换当前源码；如需保留当前版本，可先在「规格」菜单下载恢复稿。</p>
        )}
      </section>
    </Sheet>
  );
}
