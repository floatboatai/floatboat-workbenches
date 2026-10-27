import { useEffect, useRef } from "react";
type Props = {
  source: string;
  onSvg: (svg: string) => void;
  onStatus: (status: string) => void;
};
let engine: Promise<(typeof import("mermaid"))["default"]> | undefined;
function load() {
  return (engine ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "neutral",
      fontFamily: "Arial, sans-serif",
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      maxTextSize: 40000,
      maxEdges: 300,
      suppressErrorRendering: true,
    });
    return mermaid;
  }));
}
export function Diagram({ source, onSvg, onStatus }: Props) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    const id = "m" + crypto.randomUUID().replaceAll("-", "");
    onStatus("正在渲染…");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const mermaid = await load();
          await mermaid.parse(source);
          const result = await mermaid.render(id, source);
          if (!disposed && container.current) {
            container.current.innerHTML = result.svg;
            onSvg(result.svg);
            onStatus("预览已更新");
          }
        } catch (error) {
          document.getElementById("d" + id)?.remove();
          if (!disposed)
            onStatus(
              "预览未更新：" +
                (error instanceof Error
                  ? error.message.split("\n").slice(0, 3).join(" ")
                  : "请检查图形语法。"),
            );
        }
      })();
    }, 250);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [source, onSvg, onStatus]);
  return (
    <div className="diagram-canvas" ref={container} aria-label="图形预览" />
  );
}
