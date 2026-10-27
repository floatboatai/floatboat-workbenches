import { useEffect, useRef, useState } from "react";
import { compile, type TopLevelSpec } from "vega-lite";
import { parse, View, loader } from "vega";
import { expressionInterpreter } from "vega-interpreter";
export function Chart({
  spec,
  onSvg,
  onStatus,
}: {
  spec: Record<string, unknown>;
  onSvg: (svg: string) => void;
  onStatus: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.max(220, Math.floor(entries[0].contentRect.width) - 30);
      setWidth((value) => (value === next ? value : next));
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!root.current) return;
    let disposed = false;
    let view: View | undefined;
    onStatus("正在计算图表…");
    void (async () => {
      try {
        const safeLoader = loader();
        safeLoader.load = async () => {
          throw new Error("仅支持内嵌数据，不能读取外部资源。");
        };
        const compiled = compile({
          ...spec,
          width: Math.min(width, 900),
        } as TopLevelSpec).spec;
        view = new View(parse(compiled, undefined, { ast: true }), {
          expr: expressionInterpreter,
          renderer: "svg",
          container: root.current!,
          hover: true,
          loader: safeLoader,
        });
        await view.runAsync();
        if (disposed) return;
        const svg = await view.toSVG();
        if (!disposed) {
          onSvg(svg);
          onStatus("图表已更新");
        }
      } catch (error) {
        if (!disposed)
          onStatus(
            "图表未更新：" +
              (error instanceof Error ? error.message : "请检查规格。"),
          );
      }
    })();
    return () => {
      disposed = true;
      view?.finalize();
      root.current?.replaceChildren();
    };
  }, [spec, width, onSvg, onStatus]);
  return <div ref={root} className="vega-render" aria-label="Vega-Lite 图表" />;
}
