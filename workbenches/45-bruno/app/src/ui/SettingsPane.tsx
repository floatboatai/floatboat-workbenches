import type { SourceFile } from "../contracts/bruno";

/** collection.bru / folder.bru / bruno.json: native source editing with official parser feedback. */
export function SettingsPane({
  file,
  kind,
  locked,
  syncLabel,
  syncError,
  warnings,
  sourceText,
  sourceError,
  onSource,
  onPath,
  notes,
  onNotes,
}: {
  file: SourceFile;
  kind: string;
  locked: boolean;
  syncLabel: string;
  syncError: boolean;
  warnings: string[];
  sourceText: string;
  sourceError: string;
  onSource: (text: string) => void;
  onPath: (path: string) => void;
  notes: string;
  onNotes: (text: string) => void;
}) {
  return (
    <section className="settings-pane" aria-label="设置文件">
      <div className="request-title">
        <h1>{kind === "collection" ? "集合设置" : kind === "folder" ? "文件夹设置" : "bruno.json"}</h1>
        <span className="path mono">{file.path}</span>
        <span className={"sync " + (syncError ? "error" : "")}>{syncLabel}</span>
      </div>
      <p className="hint">
        {kind === "collection"
          ? "集合级 headers、auth 与 vars:pre-request 会被每个请求继承（请求 Auth 选「继承」时使用这里的认证）。"
          : kind === "folder"
            ? "文件夹内的请求继承这里的 headers、vars 与认证；更内层的设置优先。"
            : "Bruno 集合配置文件。名称、忽略目录等原样保存。"}
      </p>
      {warnings.map((w) => (
        <p className="inline-note" key={w}>
          {w}
        </p>
      ))}
      <label className="path-field">
        文件路径
        <input className="mono" value={file.path} disabled={locked} onChange={(e) => onPath(e.target.value)} />
      </label>
      <textarea
        className="code tall"
        aria-label="设置源文件"
        spellCheck={false}
        disabled={locked}
        value={sourceText}
        onChange={(e) => onSource(e.target.value)}
      />
      {sourceError ? (
        <p className="inline-note error" role="alert">
          源文件暂未采用：{sourceError}
        </p>
      ) : null}
      {kind === "collection" ? (
        <label>
          集合笔记（随工程导出，不写入 .bru）
          <textarea className="docs" maxLength={20000} disabled={locked} value={notes} onChange={(e) => onNotes(e.target.value)} />
        </label>
      ) : null}
    </section>
  );
}
