// ABOUTME: 图表舞台：加载数据集、按容器尺寸渲染已应用规格；失败时保留上一版图形并给出可读错误。
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { View } from "vega";
import type { DatasetRef } from "../contracts/datasets";
import { referencedDatasets, wantsContainerSize } from "../contracts/render-spec";
import { datasetTable } from "./data-client";
import { renderChart, type RenderLog } from "./engine";

export interface ChartHandle {
  view: () => View | null;
  vega: () => Record<string, unknown> | null;
}
export type ChartState =
  | { phase: "loading"; message: string }
  | { phase: "ready"; log: RenderLog }
  | { phase: "error"; message: string; stale: boolean };

function friendly(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/Unrecognized (?:data set|signal|scale)/i.test(text)) return "规格引用了不存在的数据、参数或比例尺：" + text;
  if (/Duplicate signal name/i.test(text))
    return text + "。顶层图层中的选择参数会复制到每个子图层，请把 params 移到其中一个图层，或给参数换名（使用英文名）。";
  return text;
}

export function Chart({
  spec,
  datasets,
  handle,
  onState,
}: {
  spec: Record<string, unknown>;
  datasets: DatasetRef[];
  handle: Ref<ChartHandle>;
  onState: (state: ChartState) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const current = useRef<{ view: View; vega: Record<string, unknown> } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const report = useRef(onState);
  report.current = onState;

  useImperativeHandle(handle, () => ({ view: () => current.current?.view ?? null, vega: () => current.current?.vega ?? null }), []);

  useEffect(() => {
    // 以图表区整体尺寸（减去工具条）为准，提示条出现或消失不会触发重绘。
    const element = stage.current?.parentElement;
    if (!element || !stage.current) return;
    let timer = 0;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = { width: Math.floor(rect.width - 56), height: Math.floor(rect.height - 46 - 64) };
      setSize((old) => (old && Math.abs(old.width - next.width) < 4 && Math.abs(old.height - next.height) < 4 ? old : next));
    };
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(measure, current.current ? 140 : 0);
    });
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const responsive = wantsContainerSize(spec);
  const sizeKey = size ? (responsive ? `${size.width}x${size.height}` : "fixed") : "";
  useEffect(() => {
    if (!size || !paper.current) return;
    let disposed = false;
    report.current({ phase: "loading", message: "正在计算图表…" });
    const target = paper.current;
    void (async () => {
      try {
        const used = referencedDatasets(spec, datasets);
        const rows = new Map<string, Record<string, unknown>[]>();
        await Promise.all(
          datasets
            .filter((ref) => used.has(ref.name))
            .map(async (ref) => {
              rows.set(ref.name, (await datasetTable(ref)).rows);
            }),
        );
        if (disposed) return;
        const holder = document.createElement("div");
        holder.className = "vega-holder";
        const rendered = await renderChart({
          spec,
          datasets,
          rows,
          size: { width: Math.max(240, size.width), height: Math.max(180, Math.min(size.height, size.width * 0.75)) },
          container: holder,
        });
        if (disposed) {
          rendered.view.finalize();
          return;
        }
        current.current?.view.finalize();
        current.current = { view: rendered.view, vega: rendered.vega };
        target.replaceChildren(holder);
        const blocked = [...rendered.log.errors, ...rendered.log.warnings].find((line) => line.includes("已阻止外部资源"));
        if (blocked) report.current({ phase: "error", message: blocked.replace(/^.*?已阻止/, "已阻止"), stale: false });
        else if (rendered.log.errors.length)
          report.current({ phase: "error", message: friendly(rendered.log.errors[0]), stale: false });
        else report.current({ phase: "ready", log: rendered.log });
      } catch (error) {
        if (!disposed) report.current({ phase: "error", message: friendly(error), stale: !!current.current });
      }
    })();
    return () => {
      disposed = true;
    };
    // 尺寸只影响需要填满容器的单视图/图层；拼接、分面等固定尺寸图表不因窗口变化重建，交互状态得以保留。
  }, [spec, datasets, sizeKey]);

  useEffect(
    () => () => {
      current.current?.view.finalize();
      current.current = null;
    },
    [],
  );

  return (
    <div className="stage" ref={stage}>
      <div className="paper" ref={paper} role="figure" aria-label="Vega-Lite 图表" />
    </div>
  );
}
