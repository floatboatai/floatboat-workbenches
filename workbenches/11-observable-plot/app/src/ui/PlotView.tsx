import { useEffect, useRef, useState } from "react";
import { plot, barY, lineY, dot, ruleY } from "@observablehq/plot";
import { plotData, type Model } from "../contracts/model";
export function PlotView({
  model,
  onSvg,
  onError,
}: {
  model: Model;
  onSvg: (svg: string) => void;
  onError: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.max(240, Math.floor(entries[0].contentRect.width));
      setWidth((old) => (old === next ? old : next));
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!root.current) return;
    onSvg("");
    let chart: SVGSVGElement | HTMLElement | undefined;
    const timer = setTimeout(() => {
      try {
        const { rows: data, domain } = plotData(model);
        const mark =
          model.kind === "bar"
            ? barY(data, {
                x: "xValue",
                y: "yValue",
                fill: "#388377",
                tip: true,
              })
            : model.kind === "line"
              ? lineY(data, {
                  x: "xValue",
                  y: "yValue",
                  stroke: "#388377",
                  strokeWidth: 2.5,
                  tip: true,
                })
              : dot(data, {
                  x: "xValue",
                  y: "yValue",
                  fill: "#388377",
                  r: 5,
                  tip: true,
                });
        chart = plot({
          width,
          height: 380,
          marginLeft: 64,
          marginBottom: 48,
          style: {
            background: "transparent",
            color: "#51645f",
            fontFamily: "Arial, sans-serif",
            fontSize: "12px",
          },
          x: { label: model.x, domain },
          y: { label: model.y, grid: true },
          marks: [ruleY([0], { stroke: "#cedbd4" }), mark],
        });
        root.current?.replaceChildren(chart);
        const svg =
          chart instanceof SVGSVGElement ? chart : chart.querySelector("svg");
        if (!svg) throw new Error("图形没有生成。");
        onSvg(new XMLSerializer().serializeToString(svg));
        onError("");
      } catch (error) {
        onError(error instanceof Error ? error.message : "无法绘图。");
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      chart?.remove();
    };
  }, [model, width, onSvg, onError]);
  return <div className="plot-view" ref={root} aria-label="数据图表" />;
}
