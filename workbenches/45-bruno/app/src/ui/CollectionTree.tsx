import { memo } from "react";
import type { Receipt, SourceFile } from "../contracts/bruno";
import { statusTone, type TreeFolder } from "./model";

function Folder({
  node,
  selected,
  onSelect,
  latest,
  depth,
}: {
  node: TreeFolder;
  selected: string;
  onSelect: (id: string) => void;
  latest: Map<string, Receipt>;
  depth: number;
}) {
  return (
    <ul className="tree-list" role={depth ? "group" : undefined}>
      {node.folders.map((f) => (
        <li key={f.path}>
          <details open>
            <summary>
              <span className="folder-name">{f.name}</span>
              <span className="count">{f.requests.length}</span>
            </summary>
            {f.settings ? (
              <button
                className={"tree-item settings" + (f.settings.id === selected ? " active" : "")}
                aria-current={f.settings.id === selected ? "true" : undefined}
                onClick={() => onSelect(f.settings!.id)}
              >
                <span className="method set">SET</span>
                <span className="name">文件夹设置</span>
              </button>
            ) : null}
            <Folder node={f} selected={selected} onSelect={onSelect} latest={latest} depth={depth + 1} />
          </details>
        </li>
      ))}
      {node.requests.map((r) => {
        const last = latest.get(r.file.id);
        return (
          <li key={r.file.id}>
            <button
              className={"tree-item" + (r.file.id === selected ? " active" : "")}
              aria-current={r.file.id === selected ? "true" : undefined}
              onClick={() => onSelect(r.file.id)}
              title={r.file.path}
            >
              <span className={"method m-" + r.method.toLowerCase()}>{r.method === "DELETE" ? "DEL" : r.method}</span>
              <span className="name">{r.name}</span>
              {last ? <i className={"pip " + statusTone(last)} aria-label={"最近结果 " + (last.status ?? last.state)} /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const CollectionTree = memo(function CollectionTree({
  tree,
  title,
  selected,
  onSelect,
  onNew,
  settingsFiles,
  results,
  locked,
}: {
  tree: TreeFolder;
  title: string;
  selected: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  settingsFiles: SourceFile[];
  results: Receipt[];
  locked: boolean;
}) {
  const latest = new Map<string, Receipt>();
  for (const r of results) {
    const prev = latest.get(r.requestId);
    if (!prev || prev.startedAt < r.startedAt) latest.set(r.requestId, r);
  }
  return (
    <nav className="tree" aria-label="集合请求">
      <div className="tree-head">
        <h2 title={title}>{title}</h2>
        <button className="add" disabled={locked} onClick={onNew}>
          ＋ 新请求
        </button>
      </div>
      <Folder node={tree} selected={selected} onSelect={onSelect} latest={latest} depth={0} />
      {settingsFiles.length ? (
        <div className="tree-foot">
          <h3>集合设置</h3>
          {settingsFiles.map((f) => (
            <button
              key={f.id}
              className={"tree-item settings" + (f.id === selected ? " active" : "")}
              aria-current={f.id === selected ? "true" : undefined}
              onClick={() => onSelect(f.id)}
            >
              <span className="method set">{f.path.endsWith(".json") ? "JSON" : "SET"}</span>
              <span className="name">{f.path}</span>
            </button>
          ))}
        </div>
      ) : null}
    </nav>
  );
});
