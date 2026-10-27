import { memo, useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { configure, loadEngine, serializeScore } from "./engine";
import type { ScoreProject } from "../contracts/domain";
export const ScoreView = memo(function ScoreView({
  xml,
  partId,
  layout,
  zoom,
  onOutput,
}: {
  xml: string;
  partId: string;
  layout: ScoreProject["layout"];
  zoom: number;
  onOutput: (svg: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<OpenSheetMusicDisplay | null>(null),
    output = useRef(onOutput),
    settings = useRef({ partId, layout, zoom });
  output.current = onOutput;
  settings.current = { partId, layout, zoom };
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    output.current("");
    if (!host.current) return;
    const container = document.createElement("div");
    host.current.replaceChildren(container);
    let owned: OpenSheetMusicDisplay | undefined;
    void loadEngine()
      .then(async ({ OpenSheetMusicDisplay }) => {
        if (!active) return;
        const engine = new OpenSheetMusicDisplay(container, {
          backend: "svg",
          autoResize: false,
        });
        owned = engine;
        instance.current = engine;
        engine.setLogLevel("error");
        await engine.load(xml);
        if (!active) {
          engine.clear();
          return;
        }
        configure(engine, settings.current);
        engine.render();
        output.current(serializeScore(container));
        setReady(true);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "乐谱渲染失败，请检查文件。",
          );
          output.current("");
        }
      });
    return () => {
      active = false;
      owned?.clear();
      container.remove();
      if (instance.current === owned) instance.current = null;
    };
  }, [xml]);
  useEffect(() => {
    if (!ready || !instance.current || !host.current) return;
    try {
      configure(instance.current, { partId, layout, zoom });
      instance.current.render();
      output.current(serializeScore(host.current));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "版式更新失败。");
      output.current("");
    }
  }, [partId, layout, zoom, ready]);
  return (
    <>
      <p
        className={`render-state ${error ? "error" : ""}`}
        role={error ? "alert" : "status"}
      >
        {error || (!ready ? "正在排版乐谱…" : "乐谱已更新")}
      </p>
      <div ref={host} className="score-render" aria-label="乐谱页面" />
    </>
  );
});
