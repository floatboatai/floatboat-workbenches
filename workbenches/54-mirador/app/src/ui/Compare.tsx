import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { viewer, updateViewport, type MiradorInstance } from "mirador";
import { isRecord } from "../contracts/project";
import { viewport, type Collection } from "../contracts/folio";
export interface CompareHandle {
  views(): Collection["views"];
  rotate(side: "left" | "right"): boolean;
}
function readViews(
  instance: MiradorInstance | null,
  base: Collection["views"],
): Collection["views"] {
  const result = { ...base },
    state = instance?.store.getState();
  if (isRecord(state) && isRecord(state.viewers))
    for (const key of ["left", "right"] as const) {
      const raw = state.viewers[key];
      if (isRecord(raw))
        try {
          result[key] = viewport({
            ...raw,
            rotation: raw.rotation ?? 0,
            flip: raw.flip ?? false,
          });
        } catch {
          /* A loading viewport is not a valid saved position. */
        }
    }
  return result;
}
export const Compare = forwardRef<
  CompareHandle,
  {
    left: string;
    right: string;
    initial: Collection["views"];
    session: string;
    side: "left" | "right";
    onError: (text: string) => void;
    onViewsChange: (views: Collection["views"]) => void;
  }
>(function Compare(
  { left, right, initial, session, side, onError, onViewsChange },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<MiradorInstance | null>(null);
  const initialRef = useRef(initial),
    errorRef = useRef(onError),
    changeRef = useRef(onViewsChange);
  initialRef.current = initial;
  errorRef.current = onError;
  changeRef.current = onViewsChange;
  const cache = useRef({ scene: "", views: initial }),
    touched = useRef(false);
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width:760px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width:760px)");
    const update = () => {
      const views = readViews(instance.current, cache.current.views);
      cache.current.views = views;
      if (views.left || views.right) changeRef.current(views);
      setNarrow(media.matches);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      views() {
        return readViews(instance.current, cache.current.views);
      },
      rotate(side) {
        const active = instance.current,
          state = active?.store.getState();
        if (
          !active ||
          !isRecord(state) ||
          !isRecord(state.viewers) ||
          !isRecord(state.viewers[side])
        )
          return false;
        touched.current = true;
        const v = state.viewers[side];
        active.store.dispatch(
          updateViewport(side, {
            ...v,
            rotation:
              ((typeof v.rotation === "number" ? v.rotation : 0) + 90) % 360,
          }),
        );
        return true;
      },
    }),
    [],
  );
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const scene = session + ":" + left + ":" + right;
    if (cache.current.scene !== scene) {
      cache.current = { scene, views: initialRef.current };
      touched.current = false;
    }
    const container = document.createElement("div");
    container.id = "mirador-" + crypto.randomUUID();
    container.className = "mirador-root";
    node.append(container);
    const touch = () => {
      touched.current = true;
    };
    for (const event of ["pointerdown", "wheel", "keydown"])
      container.addEventListener(event, touch, {
        capture: true,
        passive: true,
      });
    try {
      const windows = (["left", "right"] as const)
        .filter((key) => !narrow || key === side)
        .map((key) => ({
          id: key,
          manifestId:
            location.origin +
            "/api/iiif/" +
            (key === "left" ? left : right) +
            "/manifest",
          initialViewerConfig: cache.current.views[key] ?? undefined,
          thumbnailNavigationPosition: "off",
        }));
      const active = viewer({
        id: container.id,
        language: "zh-CN",
        selectedTheme: "dark",
        availableLanguages: ["zh-CN"],
        windows,
        workspaceControlPanel: { enabled: false },
        window: {
          allowClose: false,
          allowMaximize: false,
          allowFullscreen: false,
          allowTopMenuButton: false,
          allowWindowSideBar: false,
          sideBarOpen: false,
        },
        workspace: {
          type: "mosaic",
          allowNewWindows: false,
          draggingEnabled: false,
          showZoomControls: true,
        },
        osdConfig: {
          animationTime: 0,
          blendTime: 0,
          showNavigationControl: false,
          zoomPerClick: 1,
        },
        theme: {
          palette: { primary: { main: "#b4915f" } },
          typography: { fontFamily: 'system-ui, "PingFang SC", sans-serif' },
        },
      });
      instance.current = active;
      const unsubscribe = active.store.subscribe(() => {
        const next = readViews(active, cache.current.views);
        if (JSON.stringify(next) !== JSON.stringify(cache.current.views)) {
          cache.current.views = next;
          if (touched.current) changeRef.current(next);
        }
      });
      return () => {
        unsubscribe();
        cache.current.views = readViews(active, cache.current.views);
        instance.current = null;
        for (const event of ["pointerdown", "wheel", "keydown"])
          container.removeEventListener(event, touch, true);
        queueMicrotask(() => active.unmount());
        container.remove();
      };
    } catch (error) {
      errorRef.current(
        error instanceof Error ? error.message : "图像查看器加载失败，请重试。",
      );
      container.remove();
    }
  }, [left, right, session, narrow, side]);
  return <div className="comparison" ref={host} aria-label="扫描图像对照" />;
});
