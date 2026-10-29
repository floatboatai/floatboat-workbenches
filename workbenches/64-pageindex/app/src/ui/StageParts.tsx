// ABOUTME: 原页台的辅助部件：章节路径、页码跳转，以及空白/缺原件/错误/加载状态。
import { useEffect, useState } from "react";
import type { DocumentRef, IndexNode } from "../contracts/reader.ts";
import type { PdfState } from "./useReader.ts";

export const ZOOMS = [0, 75, 100, 125, 150, 200];
/** Path to the section a page is in; when ranges overlap, the most recently started section wins. */
export function chapterAt(nodes: IndexNode[], page: number): IndexNode[] {
  let best: IndexNode | undefined;
  for (const n of nodes)
    if (page >= n.start_index && page <= n.end_index && (!best || n.start_index > best.start_index))
      best = n;
  return best ? [best, ...chapterAt(best.nodes ?? [], page)] : [];
}
export function pathTo(nodes: IndexNode[], id: string): IndexNode[] {
  for (const n of nodes) {
    if (n.node_id === id) return [n];
    const below = pathTo(n.nodes ?? [], id);
    if (below.length) return [n, ...below];
  }
  return [];
}
export function PageJump({
  page,
  pages,
  onGo,
}: {
  page: number;
  pages: number;
  onGo: (p: number) => void;
}) {
  const [value, setValue] = useState(String(page));
  useEffect(() => setValue(String(page)), [page]);
  const commit = () => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= pages) onGo(n);
    else setValue(String(page));
  };
  return (
    <label className="page-jump">
      <span className="sr-only">页码</span>
      <input
        name="page"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <span aria-hidden="true">/ {pages}</span>
    </label>
  );
}
export function StageState({
  doc,
  state,
  message,
  busy,
  mutable,
  onRepair,
  onOpen,
  onSample,
}: {
  doc: DocumentRef | null;
  state: PdfState;
  message: string;
  busy: string;
  mutable: boolean;
  onRepair: () => void;
  onOpen: () => void;
  onSample: () => void;
}) {
  if (doc && state === "missing")
    return (
      <div className="empty-paper">
        <small>原PDF不在当前工作台</small>
        <h2>补齐原PDF，继续这份阅读。</h2>
        <p>
          选择最初的PDF文件（{doc.name}，{doc.pages}页）。已有摘录、问题和草稿会保留。
        </p>
        <button className="solid" disabled={!mutable} onClick={onRepair}>
          补齐原PDF
        </button>
      </div>
    );
  if (doc && state === "error")
    return (
      <div className="empty-paper" role="alert">
        <h2>原页暂时无法显示。</h2>
        <p>{message}</p>
        <button onClick={() => location.reload()}>重新载入</button>
      </div>
    );
  if (doc || busy)
    return (
      <p className="loading-paper" role="status">
        {busy || "正在打开原页…"}
      </p>
    );
  return (
    <div className="empty-paper">
      <small>一份文档，一张阅读桌</small>
      <h2>把问题带回原页。</h2>
      <p>打开一份报告：沿它自己的目录阅读，选中原文摘录，留下带页码的审阅意见。</p>
      <button className="solid" disabled={!mutable} onClick={onOpen}>
        打开 PDF
      </button>
      <button className="text-button" disabled={!mutable} onClick={onSample}>
        打开示例年度报告
      </button>
      <span>支持带文字或扫描的PDF · 最多64MiB / 1000页</span>
    </div>
  );
}
