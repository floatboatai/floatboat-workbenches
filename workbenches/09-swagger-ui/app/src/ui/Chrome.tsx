import type { ReactNode } from "react";
import { Code2, FileText, FlaskConical, Sparkles, X } from "lucide-react";
import type { SpecFormat } from "../contracts/openapi";
import type { TryCall } from "./ApiDocs";
import { callTitle } from "./Panels";

export type Pane = "directory" | "docs" | "source";
export type Sheet = "file" | "try" | "draft" | null;

/** 文件条：规格菜单入口、API 身份与安静的保存状态、视图与试调/起草入口。 */
export function FileBar(props: {
  title: string;
  apiVersion: string;
  versionLabel: string;
  format: SpecFormat;
  saveStatus: ReactNode;
  sheet: Sheet;
  split: boolean;
  setSplit: (value: boolean) => void;
  draftErrors: number;
  allowPrivate: boolean;
  onSheet: (sheet: Sheet) => void;
}) {
  return (
    <header className="file-bar">
      <button
        className="file-trigger"
        aria-haspopup="dialog"
        aria-expanded={props.sheet === "file"}
        onClick={() => props.onSheet("file")}
      >
        <FileText size={16} aria-hidden="true" />
        <span>规格</span>
      </button>
      <div className="spec-identity">
        <h1 title={props.title}>{props.title}</h1>
        <p className="spec-meta">
          {props.apiVersion ? <span>v{props.apiVersion}</span> : null}
          {props.versionLabel ? <span>{props.versionLabel}</span> : null}
          <span>{props.format.toUpperCase()}</span>
          {props.saveStatus}
        </p>
      </div>
      <div className="bar-actions">
        <div className="mode-switch" role="group" aria-label="视图">
          <button aria-pressed={!props.split} onClick={() => props.setSplit(false)}>
            文档
          </button>
          <button aria-pressed={props.split} onClick={() => props.setSplit(true)}>
            <Code2 size={15} aria-hidden="true" />
            并排源码
            {props.draftErrors ? <span className="badge error">{props.draftErrors}</span> : null}
          </button>
        </div>
        <button
          className={props.allowPrivate ? "tool-button armed" : "tool-button"}
          aria-haspopup="dialog"
          aria-expanded={props.sheet === "try"}
          onClick={() => props.onSheet("try")}
        >
          <FlaskConical size={15} aria-hidden="true" />
          <span>试调</span>
          {props.allowPrivate ? <span className="sr-only">（已允许本机目标）</span> : null}
        </button>
        <button
          className="tool-button"
          aria-haspopup="dialog"
          aria-expanded={props.sheet === "draft"}
          onClick={() => props.onSheet("draft")}
        >
          <Sparkles size={15} aria-hidden="true" />
          <span>起草</span>
        </button>
      </div>
    </header>
  );
}

/** 窄屏三段切换：一次显示一个区域，文档 iframe 不卸载。 */
export function PaneTabs({
  pane,
  setPane,
  operations,
  draftErrors,
}: {
  pane: Pane;
  setPane: (pane: Pane) => void;
  operations: number;
  draftErrors: number;
}) {
  const tabs: [Pane, string, number | null][] = [
    ["directory", "目录", operations],
    ["docs", "文档", null],
    ["source", "源码", draftErrors || null],
  ];
  return (
    <nav className="pane-tabs" aria-label="区域">
      {tabs.map(([value, label, count]) => (
        <button key={value} aria-pressed={pane === value} onClick={() => setPane(value)}>
          {label}
          {count !== null ? <span className="count">{count}</span> : null}
        </button>
      ))}
    </nav>
  );
}

/** 试调被阻止或失败时贴在文档底部的状态卡，给出下一步操作。 */
export function TryAlert({
  call,
  onClose,
  onAllow,
  onEditServers,
}: {
  call: TryCall;
  onClose: () => void;
  onAllow: () => void;
  onEditServers: () => void;
}) {
  return (
    <div className="try-alert" role="alert">
      <div>
        <strong>
          {callTitle(call)} · {call.method} {call.target}
        </strong>
        <p>{call.message}</p>
      </div>
      <div className="button-row">
        {call.code === "BLOCKED_PRIVATE" ? (
          <button className="primary" onClick={onAllow}>
            允许本机与内网目标
          </button>
        ) : null}
        {call.code === "RELATIVE" ? <button onClick={onEditServers}>编辑 servers</button> : null}
        <button className="icon-button" aria-label="关闭提示" onClick={onClose}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function missingMessage(what: string) {
  return what === "authorize"
    ? "规格没有声明认证方案，Swagger 中没有 Authorize 按钮。"
    : what === "models"
      ? "规格没有可显示的模型。"
      : "文档中找不到该端点，可能仍在加载或被 Swagger 筛选框隐藏。";
}
