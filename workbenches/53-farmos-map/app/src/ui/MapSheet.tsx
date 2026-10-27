import { lazy, Suspense, type RefObject } from "react";
import type { Model, Position } from "../contracts/model";
import type { MapHandle, MapMode } from "./FieldMap";
import { RenderBoundary } from "./workspace";
const FieldMap = lazy(() =>
  import("./FieldMap").then((module) => ({ default: module.FieldMap })),
);
interface Props {
  mapRef: RefObject<MapHandle | null>;
  data: Model;
  selected: string;
  mode: MapMode;
  ready: boolean;
  fitToken: number;
  onReady: () => void;
  onMode: (mode: MapMode) => void;
  onSelect: (id: string) => void;
  onDraw: (coordinates: Position[]) => void;
  onModify: (changes: { id: string; coordinates: Position[] }[]) => void;
  onError: (message: string) => void;
}
export function MapSheet({
  mapRef,
  data,
  selected,
  mode,
  ready,
  fitToken,
  onReady,
  onMode,
  onSelect,
  onDraw,
  onModify,
  onError,
}: Props) {
  return (
    <section className="map-sheet" aria-labelledby="map-heading">
      <div className="sheet-heading">
        <div>
          <h2 id="map-heading">地块坐标视图</h2>
          <p>经纬网参考 · 无卫星底图</p>
        </div>
        <span className="scale-label">WGS84</span>
      </div>
      <div className="map-tools">
        <div>
          <button
            className={mode === "draw" ? "active" : ""}
            aria-pressed={mode === "draw"}
            onClick={() => onMode("draw")}
            disabled={!ready || data.plots.length >= 30}
          >
            圈绘分区
          </button>
          <button
            className={mode === "modify" ? "active" : ""}
            aria-pressed={mode === "modify"}
            onClick={() => onMode(mode === "modify" ? "browse" : "modify")}
            disabled={!ready || !data.plots.length}
          >
            调整顶点
          </button>
        </div>
        <div className="view-tools">
          <button
            onClick={() => mapRef.current?.fit()}
            disabled={!ready || !data.plots.length}
          >
            全图
          </button>
          <button
            aria-label="放大地图"
            onClick={() => mapRef.current?.zoom(1)}
            disabled={!ready}
          >
            ＋
          </button>
          <button
            aria-label="缩小地图"
            onClick={() => mapRef.current?.zoom(-1)}
            disabled={!ready}
          >
            −
          </button>
        </div>
      </div>
      <RenderBoundary>
        <Suspense
          fallback={
            <div className="map-loading" role="status">
              正在加载地块地图…
            </div>
          }
        >
          <FieldMap
            ref={mapRef}
            model={data}
            selected={selected}
            mode={mode}
            fitToken={fitToken}
            onReady={onReady}
            onSelect={onSelect}
            onDraw={onDraw}
            onModify={onModify}
            onError={onError}
          />
        </Suspense>
      </RenderBoundary>
      <div className="map-instruction" role="status">
        {mode === "draw" ? (
          <>
            <span>点击添加至少3个顶点，完成圈绘后自动记录；未闭合可取消。</span>
            <div>
              <button onClick={() => mapRef.current?.undo()}>撤销上一点</button>
              <button
                className="primary"
                onClick={() => mapRef.current?.finish()}
              >
                完成圈绘
              </button>
              <button
                onClick={() => {
                  mapRef.current?.cancel();
                  onMode("browse");
                }}
              >
                取消圈绘
              </button>
            </div>
          </>
        ) : mode === "modify" ? (
          <>
            <span>拖动边界顶点调整；下方坐标表可精确输入。</span>
            <button onClick={() => onMode("browse")}>结束调整</button>
          </>
        ) : (
          <span>
            点击分区查看记录，拖动地图浏览。键盘聚焦地图后可用方向键平移。
          </span>
        )}
      </div>
      <p className="projection-note">
        数据：EPSG:4326（经度、纬度 / °） · 显示：EPSG:3857 · farmOS-map
      </p>
    </section>
  );
}
