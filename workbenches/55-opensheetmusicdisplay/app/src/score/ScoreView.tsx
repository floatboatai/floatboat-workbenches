// ABOUTME: 谱面：持有 OSMD 实例，负责排版、光标、点击定位、批注图层与回放；通过 ref 暴露给工作台。
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Beat, ViewSettings } from "../contracts/domain";
import {
  configure,
  cursorPosition,
  drawOverlay,
  hitTest,
  loadEngine,
  moveCursorTo,
  snapshotPages,
  toSvgPoint,
  type Hit,
  type OverlayModel,
  type PageSnapshot,
} from "./engine";
import { Player } from "./playback";

export interface ScoreHandle {
  step(direction: 1 | -1): void;
  stepMeasure(direction: 1 | -1): void;
  togglePlay(): Promise<void>;
  stop(): void;
  snapshot(): PageSnapshot[];
  currentPage(): number;
  revealFocus(): void;
}
export interface RenderState {
  phase: "loading" | "ready" | "error";
  message: string;
  pages: number;
}
interface Props {
  xml: string;
  view: ViewSettings;
  overlay: OverlayModel;
  onPick: (hit: Hit) => void;
  onMarker: (id: string) => void;
  onCursor: (position: { measureIndex: number; beat: Beat }) => void;
  onPlayhead: (position: { measureIndex: number; beat: Beat } | null) => void;
  onRender: (state: RenderState) => void;
}

const motion = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export const ScoreView = memo(
  forwardRef<ScoreHandle, Props>(function ScoreView({ xml, view, overlay, onPick, onMarker, onCursor, onPlayhead, onRender }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const engine = useRef<OpenSheetMusicDisplay | null>(null);
    const player = useRef<Player | null>(null);
    const latest = useRef({ view, overlay, onPick, onMarker, onCursor, onPlayhead, onRender });
    latest.current = { view, overlay, onPick, onMarker, onCursor, onPlayhead, onRender };
    const [ready, setReady] = useState(0);
    const [playing, setPlaying] = useState(false);
    const viewKey = JSON.stringify(view);
    const rendered = useRef("");

    const paint = () => {
      const instance = engine.current;
      if (instance && host.current) drawOverlay(host.current, instance, latest.current.overlay);
    };
    const placeCursor = () => {
      const instance = engine.current;
      if (!instance?.cursor) return;
      instance.cursor.show();
      const { focus } = latest.current.overlay;
      moveCursorTo(instance, focus.measureIndex, focus.beat);
    };
    const report = (phase: RenderState["phase"], message: string) =>
      latest.current.onRender({ phase, message, pages: host.current?.querySelectorAll("svg").length ?? 0 });

    // 原件变化：新建实例并完整排版。
    useEffect(() => {
      let active = true;
      setReady(0);
      if (!host.current) return;
      const container = document.createElement("div");
      container.className = "osmd-root";
      host.current.replaceChildren(container);
      let owned: OpenSheetMusicDisplay | undefined;
      report("loading", "正在载入乐谱引擎…");
      void (async () => {
        try {
          const { OpenSheetMusicDisplay } = await loadEngine();
          if (!active) return;
          owned = new OpenSheetMusicDisplay(container, { backend: "svg", autoResize: false });
          engine.current = owned;
          owned.setLogLevel("error");
          report("loading", "正在解析 MusicXML…");
          await nextFrame();
          await owned.load(xml);
          if (!active) return;
          report("loading", "正在排版…");
          await nextFrame();
          if (!active) return;
          await configure(owned, latest.current.view);
          owned.render();
          rendered.current = JSON.stringify(latest.current.view);
          placeCursor();
          paint();
          setReady((value) => value + 1);
          report("ready", "");
        } catch (reason) {
          if (active) report("error", reason instanceof Error && reason.message ? `乐谱无法渲染：${reason.message}` : "乐谱无法渲染，请检查文件。");
        }
      })();
      return () => {
        active = false;
        player.current?.dispose();
        player.current = null;
        setPlaying(false);
        owned?.clear();
        container.remove();
        if (engine.current === owned) engine.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [xml]);

    // 显示设置变化：重排同一实例。
    useEffect(() => {
      const instance = engine.current;
      if (!ready || !instance || rendered.current === viewKey) return;
      rendered.current = viewKey;
      let active = true;
      player.current?.stop();
      setPlaying(false);
      report("loading", "正在重新排版…");
      void (async () => {
        await nextFrame();
        if (!active) return;
        try {
          await configure(instance, latest.current.view);
          instance.render();
          placeCursor();
          paint();
          report("ready", "");
        } catch (reason) {
          report("error", reason instanceof Error ? `版式更新失败：${reason.message}` : "版式更新失败。");
        }
      })();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewKey, ready]);

    // 批注或当前位置变化：只重绘批注层；不在回放中时把光标带到当前位置。
    useEffect(() => {
      if (!ready) return;
      paint();
      if (!player.current?.playing) placeCursor();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overlay, ready]);

    const cursorMoved = () => {
      const instance = engine.current;
      if (!instance) return;
      const position = cursorPosition(instance);
      if (position) latest.current.onCursor(position);
    };

    useImperativeHandle(
      ref,
      () => ({
        step(direction) {
          const instance = engine.current;
          if (!instance?.cursor) return;
          instance.cursor.show();
          if (direction > 0) instance.cursor.next();
          else instance.cursor.previous();
          if (instance.cursor.Iterator.EndReached) instance.cursor.previous();
          cursorMoved();
        },
        stepMeasure(direction) {
          const instance = engine.current;
          if (!instance?.cursor) return;
          const position = cursorPosition(instance);
          const target = Math.max(0, Math.min(instance.Sheet.SourceMeasures.length - 1, (position?.measureIndex ?? 0) + direction));
          moveCursorTo(instance, target, null);
          cursorMoved();
        },
        async togglePlay() {
          const instance = engine.current;
          if (!instance) return;
          if (player.current?.playing) {
            player.current.stop();
            setPlaying(false);
            cursorMoved();
            latest.current.onPlayhead(null);
            return;
          }
          player.current ??= new Player(instance, {
            tempo: () => latest.current.view.tempo,
            transpose: () => latest.current.view.transpose,
            hidden: () => latest.current.view.hiddenParts,
            onStep: () => {
              const position = cursorPosition(instance);
              latest.current.onPlayhead(position);
            },
            onEnd: () => {
              setPlaying(false);
              latest.current.onPlayhead(null);
              instance.cursor.previous();
              cursorMoved();
            },
          });
          setPlaying(true);
          try {
            await player.current.start();
            latest.current.onPlayhead(cursorPosition(instance));
          } catch {
            setPlaying(false);
            report("error", "浏览器拒绝了音频输出，请检查系统声音设置后重试。");
          }
        },
        stop() {
          if (player.current?.playing) {
            player.current.stop();
            setPlaying(false);
            latest.current.onPlayhead(null);
            cursorMoved();
          }
        },
        snapshot() {
          const instance = engine.current;
          if (!host.current || !instance) throw new Error("请等待乐谱渲染完成。");
          // 导出不带“选中”高亮：临时按未选中重绘批注层，快照后恢复。
          drawOverlay(host.current, instance, { ...latest.current.overlay, selectedId: null });
          try {
            return snapshotPages(host.current);
          } finally {
            paint();
          }
        },
        currentPage() {
          const pages = Array.from(host.current?.querySelectorAll("svg") ?? []);
          const viewport = host.current?.closest(".paper-scroll")?.getBoundingClientRect();
          if (!viewport) return 0;
          let best = 0,
            area = -1;
          pages.forEach((page, i) => {
            const rect = page.getBoundingClientRect();
            const w = Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left));
            const h = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
            if (w * h > area) {
              area = w * h;
              best = i;
            }
          });
          return best;
        },
        revealFocus() {
          host.current?.querySelector(".fb-focus")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motion() });
        },
      }),
      [],
    );

    function click(event: React.MouseEvent<HTMLDivElement>) {
      const target = event.target as Element;
      const mark = target.closest(".fb-mark");
      if (mark) {
        latest.current.onMarker(mark.getAttribute("data-id") ?? "");
        return;
      }
      const svg = target.closest("svg");
      const instance = engine.current;
      if (!svg || !instance || !host.current) return;
      const page = Array.from(host.current.querySelectorAll("svg")).indexOf(svg as SVGSVGElement);
      const point = toSvgPoint(svg as SVGSVGElement, event.clientX, event.clientY);
      if (page < 0 || !point) return;
      const hit = hitTest(instance, page, point.x, point.y);
      if (hit) latest.current.onPick(hit);
    }
    function key(event: KeyboardEvent<HTMLDivElement>) {
      const mark = (event.target as Element).closest?.(".fb-mark");
      if (mark && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        latest.current.onMarker(mark.getAttribute("data-id") ?? "");
      }
    }
    return (
      <div className={`score-render${playing ? " is-playing" : ""}`} ref={host} onClick={click} onKeyDown={key} data-layout={view.layout} />
    );
  }),
);
