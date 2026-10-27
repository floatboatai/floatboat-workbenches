import { isRecord } from "./project.ts";
export type Position = [number, number];
export interface Plot {
  id: string;
  name: string;
  note: string;
  coordinates: Position[];
}
export interface Model {
  schemaVersion: 1;
  crs: "EPSG:4326";
  plots: Plot[];
}
export const RADIUS = 6371008.8;
const radians = Math.PI / 180;
export function area(coordinates: Position[]): number {
  let sum = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i],
      b = coordinates[i + 1];
    sum +=
      (b[0] - a[0]) *
      radians *
      (2 + Math.sin(a[1] * radians) + Math.sin(b[1] * radians));
  }
  return Math.abs((sum * RADIUS * RADIUS) / 2);
}
function cross(a: Position, b: Position, c: Position) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(a: Position, b: Position, p: Position) {
  return (
    Math.abs(cross(a, b, p)) < 1e-14 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-12 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-12 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-12
  );
}
function intersects(a: Position, b: Position, c: Position, d: Position) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  return (
    (x * y < 0 && z * w < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
export function ring(value: unknown): Position[] {
  if (!Array.isArray(value) || value.length < 4 || value.length > 201)
    throw new Error("每个外环需要闭合的3–200个顶点。");
  const points: Position[] = value.map((point) => {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !point.every((v) => typeof v === "number" && Number.isFinite(v))
    )
      throw new Error(
        "坐标必须为两个有限数字：[经度, 纬度]，不接受高程或字符串。",
      );
    const [x, y] = point;
    if (x < -180 || x > 180 || y < -85 || y > 85)
      throw new Error("经度须在−180至180°、纬度须在−85至85°内。");
    return [x, y];
  });
  const first = points[0],
    last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1])
    throw new Error("GeoJSON外环没有闭合：首尾坐标必须一致。");
  const vertices = points.slice(0, -1);
  if (new Set(vertices.map((p) => p.join(","))).size !== vertices.length)
    throw new Error("边界包含重复顶点，请删除重复坐标。");
  for (let a = 0; a < vertices.length; a++)
    for (let b = a + 1; b < vertices.length; b++) {
      if (b === a + 1 || (a === 0 && b === vertices.length - 1)) continue;
      if (intersects(points[a], points[a + 1], points[b], points[b + 1]))
        throw new Error("边界自交或边重叠，请调整顶点。");
    }
  const xs = vertices.map((p) => p[0]),
    ys = vertices.map((p) => p[1]);
  if (
    Math.max(...xs) - Math.min(...xs) > 1 ||
    Math.max(...ys) - Math.min(...ys) > 1
  )
    throw new Error("单个地块经纬跨度须小于等于1°，不支持跨日界线。");
  const m2 = area(points);
  if (m2 < 1 || m2 > 100000000)
    throw new Error("分区面积须在1m²至100km²之间，且边界不可退化。");
  let signed = 0;
  for (let i = 0; i < vertices.length; i++)
    signed +=
      (points[i][0] - first[0]) * (points[i + 1][1] - first[1]) -
      (points[i + 1][0] - first[0]) * (points[i][1] - first[1]);
  return signed < 0 ? [...points].reverse() : points;
}
function text(value: unknown, max: number, label: string, empty = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    throw new Error(`${label}需为${empty ? "0" : "1"}–${max}个字符。`);
  return value;
}
export function validate(value: unknown): Model {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.crs !== "EPSG:4326" ||
    !Array.isArray(value.plots) ||
    value.plots.length > 30
  )
    throw new Error("项目需要schemaVersion=1、EPSG:4326，最多30个分区。");
  const plots = value.plots.map((item): Plot => {
    if (!isRecord(item)) throw new Error("分区对象无效。");
    const id = text(item.id, 100, "分区编号");
    if (!/^[a-zA-Z0-9_-]+$/.test(id))
      throw new Error("分区编号只允许字母、数字、下划线与短横线。");
    return {
      id,
      name: text(item.name, 80, "分区名称"),
      note: text(item.note, 2000, "备注", true),
      coordinates: ring(item.coordinates),
    };
  });
  if (new Set(plots.map((p) => p.id)).size !== plots.length)
    throw new Error("分区编号重复。");
  if (plots.reduce((n, p) => n + p.coordinates.length - 1, 0) > 2000)
    throw new Error("项目总顶点不能超过2000个。");
  return { schemaVersion: 1, crs: "EPSG:4326", plots };
}
export const seed: Model = validate({
  schemaVersion: 1,
  crs: "EPSG:4326",
  plots: [
    {
      id: "east-field",
      name: "东侧田块（示例）",
      note: "示例边界，用于练习圈绘与坐标编辑。",
      coordinates: [
        [120.15, 30.25],
        [120.153, 30.25],
        [120.1534, 30.252],
        [120.1504, 30.2522],
        [120.15, 30.25],
      ],
    },
    {
      id: "west-field",
      name: "北侧试验区（示例）",
      note: "这里可记录作物、批次与现场情况。",
      coordinates: [
        [120.1508, 30.2525],
        [120.1533, 30.2525],
        [120.1533, 30.2538],
        [120.1508, 30.2538],
        [120.1508, 30.2525],
      ],
    },
  ],
});
export function geojson(model: Model) {
  return {
    type: "FeatureCollection",
    features: model.plots.map((plot) => ({
      type: "Feature",
      id: plot.id,
      properties: {
        name: plot.name,
        note: plot.note,
        area_m2: area(plot.coordinates),
        area_method: "sphere_radius_6371008.8m",
      },
      geometry: { type: "Polygon", coordinates: [plot.coordinates] },
    })),
  };
}
export function importDocument(value: unknown): {
  data: Model;
  title?: string;
} {
  if (!isRecord(value))
    throw new Error("请输入GeoJSON或本工作台项目JSON对象。");
  if (value.format === "floatboat.field-atlas" && value.version !== 1)
    throw new Error("项目格式版本不受支持。");
  if (value.format === "floatboat.field-atlas")
    return {
      title: text(value.title, 120, "项目名称"),
      data: validate(value.data),
    };
  if ("crs" in value)
    throw new Error(
      "仅接受RFC7946 WGS84经纬度GeoJSON，请移除旧crs并先转换坐标。",
    );
  const features =
    value.type === "FeatureCollection"
      ? value.features
      : value.type === "Feature"
        ? [value]
        : value.type === "Polygon"
          ? [{ type: "Feature", geometry: value, properties: {} }]
          : null;
  if (!Array.isArray(features) || features.length > 30)
    throw new Error("请提供0–30个Polygon分区，或包含它们的FeatureCollection。");
  const plots = features.map((feature, index) => {
    if (
      !isRecord(feature) ||
      feature.type !== "Feature" ||
      !isRecord(feature.geometry) ||
      feature.geometry.type !== "Polygon" ||
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length !== 1
    )
      throw new Error(
        "首版只接受单外环Polygon；不支持孔洞、MultiPolygon或其他几何类型。",
      );
    const props = isRecord(feature.properties) ? feature.properties : {};
    const id =
      typeof feature.id === "string" &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(feature.id)
        ? feature.id
        : `import-${index + 1}`;
    return {
      id,
      name: typeof props.name === "string" ? props.name : `分区 ${index + 1}`,
      note: typeof props.note === "string" ? props.note : "",
      coordinates: feature.geometry.coordinates[0],
    };
  });
  return { data: validate({ schemaVersion: 1, crs: "EPSG:4326", plots }) };
}
export function projectDocument(title: string, data: Model) {
  return {
    format: "floatboat.field-atlas",
    version: 1,
    title: text(title, 120, "项目名称"),
    data: validate(data),
  };
}
export function areaCsv(model: Model) {
  const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      "分区编号,分区名称,面积_m2,面积_ha,估算方法,备注",
      ...model.plots.map((p) =>
        [
          quote(p.id),
          quote(/^\s*[=+@-]/.test(p.name) ? "'" + p.name : p.name),
          area(p.coordinates).toFixed(2),
          (area(p.coordinates) / 10000).toFixed(4),
          "球面_6371008.8m",
          quote(/^\s*[=+@-]/.test(p.note) ? "'" + p.note : p.note),
        ].join(","),
      ),
    ].join("\r\n")
  );
}
