import { useEffect, useRef, useImperativeHandle, type Ref } from "react";
import { MapInstanceManager } from "@farmos.org/farmos-map";
import Feature from "ol/Feature.js";
import Polygon from "ol/geom/Polygon.js";
import type Geometry from "ol/geom/Geometry.js";
import Draw from "ol/interaction/Draw.js";
import Modify from "ol/interaction/Modify.js";
import { defaults as defaultInteractions } from "ol/interaction/defaults.js";
import Graticule from "ol/layer/Graticule.js";
import Stroke from "ol/style/Stroke.js";
import Fill from "ol/style/Fill.js";
import Style from "ol/style/Style.js";
import Text from "ol/style/Text.js";
import { area, type Model, type Position } from "../contracts/model";
export type MapMode = "browse" | "draw" | "modify";
export interface MapHandle {
  fit(): void;
  zoom(delta: number): void;
  finish(): void;
  undo(): void;
  cancel(): void;
}
interface Props {
  ref?: Ref<MapHandle>;
  model: Model;
  selected: string;
  mode: MapMode;
  fitToken: number;
  onSelect: (id: string) => void;
  onDraw: (ring: Position[]) => void;
  onModify: (changes: { id: string; coordinates: Position[] }[]) => void;
  onError: (message: string) => void;
  onReady: () => void;
}
function coordinates(geometry: Geometry | undefined): Position[] {
  if (!(geometry instanceof Polygon)) throw new Error("只支持Polygon边界。");
  return geometry
    .clone()
    .transform("EPSG:3857", "EPSG:4326")
    .getCoordinates()[0]
    .map((point) => [Number(point[0].toFixed(8)), Number(point[1].toFixed(8))]);
}
export function FieldMap({ ref, ...props }: Props) {
  const root = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const engine = useRef<{
    instance: ReturnType<MapInstanceManager["create"]>;
    draw: Draw;
    modify: Modify;
    sync: () => void;
    fit: () => void;
  } | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      fit() {
        engine.current?.fit();
      },
      zoom(delta) {
        const view = engine.current?.instance.map.getView();
        if (view) view.setZoom((view.getZoom() ?? 16) + delta);
      },
      finish() {
        engine.current?.draw.finishDrawing();
      },
      undo() {
        engine.current?.draw.removeLastPoint();
      },
      cancel() {
        engine.current?.draw.abortDrawing();
      },
    }),
    [],
  );
  useEffect(() => {
    if (!root.current) return;
    const manager = new MapInstanceManager();
    manager.behaviors = {};
    const target = "field-map-" + crypto.randomUUID();
    root.current.id = target;
    const instance = manager.create(target, {
      units: "metric",
      controls: false,
      interactions: defaultInteractions({
        doubleClickZoom: false,
        altShiftDragRotate: false,
        pinchRotate: false,
        onFocusOnly: true,
      }).getArray(),
    });
    instance.map.getLayers().clear();
    instance.map.getView().setCenter([13375264, 3539220]);
    instance.map.getView().setZoom(16);
    const grid = new Graticule({
      showLabels: true,
      lonLabelPosition: 0.09,
      wrapX: false,
      targetSize: 160,
      intervals: [1, 0.5, 0.1, 0.05, 0.01, 0.005, 0.001, 0.0005, 0.0001],
      strokeStyle: new Stroke({ color: "rgba(81,104,83,.25)", width: 1 }),
      lonLabelFormatter: (value) =>
        Math.abs(value).toFixed(4) + (value < 0 ? "°W" : "°E"),
      latLabelFormatter: (value) =>
        Math.abs(value).toFixed(4) + (value < 0 ? "°S" : "°N"),
    });
    instance.map.addLayer(grid);
    const layer = instance.addLayer("vector", {
      title: "地块边界",
      color: "orange",
    });
    layer.set("fieldLayer", true);
    const source = layer.getSource();
    if (!source) {
      latest.current.onError("地图图层未加载，请刷新重试。");
      manager.destroy(target);
      return;
    }
    const sync = () => {
      source.clear();
      source.addFeatures(
        latest.current.model.plots.map((plot) => {
          const feature = new Feature(
            new Polygon([plot.coordinates]).transform("EPSG:4326", "EPSG:3857"),
          );
          feature.setId(plot.id);
          feature.set("name", plot.name);
          feature.set("area", area(plot.coordinates));
          return feature;
        }),
      );
    };
    layer.setStyle((feature) => {
      const active = feature.getId() === latest.current.selected;
      return new Style({
        stroke: new Stroke({
          color: active ? "#264f3f" : "#70855c",
          width: active ? 3 : 2,
        }),
        fill: new Fill({
          color: active ? "rgba(183,193,90,.42)" : "rgba(199,208,145,.24)",
        }),
        text: new Text({
          text:
            String(feature.get("name")) +
            "\n" +
            (Number(feature.get("area")) / 10000).toFixed(2) +
            " ha",
          font: "600 12px system-ui",
          overflow: false,
          fill: new Fill({ color: "#223c32" }),
          stroke: new Stroke({ color: "rgba(255,255,242,.95)", width: 4 }),
        }),
      });
    });
    const draw = new Draw({ type: "Polygon", maxPoints: 200, stopClick: true }),
      modify = new Modify({ source });
    draw.setActive(false);
    modify.setActive(false);
    instance.map.addInteraction(draw);
    instance.map.addInteraction(modify);
    draw.on("drawend", (event) => {
      try {
        latest.current.onDraw(coordinates(event.feature.getGeometry()));
      } catch (error) {
        latest.current.onError(
          error instanceof Error ? error.message : "圈绘失败，请重试。",
        );
      }
      queueMicrotask(sync);
    });
    modify.on("modifyend", (event) => {
      try {
        const changes = event.features.getArray().map((feature) => ({
          id: String(feature.getId()),
          coordinates: coordinates(feature.getGeometry()),
        }));
        latest.current.onModify(changes);
      } catch (error) {
        latest.current.onError(
          error instanceof Error ? error.message : "边界未更新。",
        );
      }
      queueMicrotask(sync);
    });
    instance.map.on("singleclick", (event) => {
      if (latest.current.mode !== "browse") return;
      const feature = instance.map.forEachFeatureAtPixel(
        event.pixel,
        (item) => item,
        { layerFilter: (item) => item === layer },
      );
      if (feature?.getId()) latest.current.onSelect(String(feature.getId()));
    });
    const fit = () => {
      const extent = source.getExtent();
      if (source.getFeatures().length && extent)
        instance.map
          .getView()
          .fit(extent, { padding: [65, 55, 65, 55], maxZoom: 19, duration: 0 });
    };
    engine.current = { instance, draw, modify, sync, fit };
    sync();
    fit();
    const observer = new ResizeObserver(() => instance.map.updateSize());
    observer.observe(root.current);
    latest.current.onReady();
    return () => {
      observer.disconnect();
      draw.abortDrawing();
      instance.map.removeInteraction(draw);
      instance.map.removeInteraction(modify);
      manager.destroy(target);
      instance.map.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.sync();
  }, [props.model]);
  useEffect(() => {
    const state = engine.current;
    if (!state) return;
    state.instance.map
      .getLayers()
      .getArray()
      .forEach((layer) => layer.changed());
  }, [props.selected]);
  useEffect(() => {
    const state = engine.current;
    if (!state) return;
    state.draw.setActive(props.mode === "draw");
    state.modify.setActive(props.mode === "modify");
    if (props.mode !== "draw") state.draw.abortDrawing();
  }, [props.mode]);
  useEffect(() => {
    const state = engine.current;
    if (!state || !props.model.plots.length) return;
    const extent = new Polygon([props.model.plots[0].coordinates])
      .transform("EPSG:4326", "EPSG:3857")
      .getExtent();
    for (const plot of props.model.plots.slice(1)) {
      const next = new Polygon([plot.coordinates])
        .transform("EPSG:4326", "EPSG:3857")
        .getExtent();
      extent[0] = Math.min(extent[0], next[0]);
      extent[1] = Math.min(extent[1], next[1]);
      extent[2] = Math.max(extent[2], next[2]);
      extent[3] = Math.max(extent[3], next[3]);
    }
    state.instance.map
      .getView()
      .fit(extent, { padding: [65, 55, 65, 55], maxZoom: 19, duration: 0 });
  }, [props.fitToken]);
  return (
    <div
      ref={root}
      className="field-map"
      tabIndex={0}
      role="region"
      aria-label="地块坐标地图，可用方向键平移；边界可在下方坐标表编辑"
    />
  );
}
