// ABOUTME: “评测”菜单：新建、示例、最近评测、导入（配置/结果/项目/CSV）、导出（YAML/结果/报告/项目）与恢复。
import { useEffect, useRef, type RefObject } from "react";
import type { ProjectSummary } from "../contracts/project";

const when = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export function FileMenu(p: {
  open: boolean;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  locked: boolean;
  items: ProjectSummary[];
  currentId?: string;
  hasRun: boolean;
  conflict: boolean;
  onNew: () => void;
  onSample: () => void;
  onOpen: (id: string) => void;
  onImport: () => void;
  onExportYaml: () => void;
  onExportResults: () => void;
  onExportCsv: () => void;
  onExportHtml: () => void;
  onExportProject: () => void;
  onRemoveRun: () => void;
  onExportDraft: () => void;
  onRetrySave: () => void;
  onServerVersion: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { open, close, trigger } = p;
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        trigger.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open, close, trigger]);
  if (!open) return null;
  const act = (fn: () => void) => () => {
    close();
    trigger.current?.focus();
    fn();
  };
  return (
    <div ref={panel} className="file-menu" role="dialog" aria-modal="false" aria-label="评测文件">
      <section>
        <h2>新建</h2>
        <button disabled={p.locked} onClick={act(p.onSample)}>
          示例：售后助手发布评测<small>36 用例 · 3 提示版本 · 7 列，含示例录制输出</small>
        </button>
        <button disabled={p.locked} onClick={act(p.onNew)}>
          空白评测<small>从一份最小 promptfooconfig 开始</small>
        </button>
      </section>
      <section>
        <h2>最近评测</h2>
        {p.items.length ? (
          <ul className="recent">
            {p.items.map((item) => (
              <li key={item.id}>
                <button disabled={p.locked || item.id === p.currentId} aria-current={item.id === p.currentId ? "true" : undefined} onClick={act(() => p.onOpen(item.id))}>
                  <span>{item.title}</span>
                  <small>
                    {item.id === p.currentId
                      ? "正在打开"
                      : item.id.startsWith("local:")
                        ? "本机未确认草稿"
                        : item.id.startsWith("draft:")
                          ? "服务器草稿"
                          : when.format(new Date(item.updatedAt))}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">还没有保存的评测。</p>
        )}
      </section>
      <section>
        <h2>导入</h2>
        <button disabled={p.locked} onClick={act(p.onImport)}>
          导入文件…<small>promptfooconfig.yaml/JSON 新建评测 · Promptfoo 结果 JSON 加入运行 · 项目文件新建 · 用例 CSV 追加</small>
        </button>
      </section>
      <section>
        <h2>导出</h2>
        <button onClick={act(p.onExportYaml)}>promptfooconfig.yaml<small>工作台配置；自定义 provider 需配套适配器</small></button>
        <button disabled={!p.hasRun} onClick={act(p.onExportResults)}>
          当前运行结果 JSON<small>Promptfoo v3 格式（eval -o results.json）</small>
        </button>
        <button disabled={!p.hasRun} onClick={act(p.onExportHtml)}>
          发布报告 HTML<small>逐项发布判断、矩阵与未通过明细</small>
        </button>
        <button disabled={!p.hasRun} onClick={act(p.onExportCsv)}>
          逐格明细 CSV<small>含基线差异与复核意见</small>
        </button>
        <button onClick={act(p.onExportProject)}>
          评测项目 .json<small>配置、全部运行、复核与发布判断</small>
        </button>
      </section>
      <section>
        <h2>维护与恢复</h2>
        <button disabled={p.locked || !p.hasRun} onClick={act(p.onRemoveRun)}>
          从项目移除当前运行
        </button>
        <button onClick={act(p.onExportDraft)}>导出工作草稿</button>
        <button onClick={act(p.onRetrySave)}>立即重试保存</button>
        {p.conflict ? (
          <button disabled={p.locked} onClick={act(p.onServerVersion)}>
            打开服务器版本
          </button>
        ) : null}
      </section>
    </div>
  );
}
