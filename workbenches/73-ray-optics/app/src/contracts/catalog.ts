// Equipment catalog: Chinese names for every upstream scene-object type, the
// categorised shelf (mirrors the upstream toolbar groups) and the preset geometry
// used when an item is placed from the shelf. Presets only choose initial points;
// the upstream classes build and simulate the objects.
export interface Point {
  x: number;
  y: number;
}
export type OpticalObject = {
  type: string;
  name?: string;
  [key: string]: unknown;
};

export const objectNames: Record<string, string> = {
  SingleRay: "单束光",
  Beam: "平行光束",
  PointSource: "点光源",
  AngleSource: "角度光源",
  Mirror: "平面镜",
  ArcMirror: "圆弧镜",
  ParabolicMirror: "抛物面镜",
  IdealMirror: "理想曲面镜",
  BeamSplitter: "分光镜",
  CustomMirror: "函数曲面镜",
  ParamMirror: "参数曲线镜",
  CurveMirror: "贝塞尔曲线镜",
  ConcaveDiffractionGrating: "凹面光栅",
  IdealLens: "理想透镜",
  SphericalLens: "球面透镜",
  PlaneGlass: "半平面玻璃",
  CircleGlass: "圆形玻璃",
  Glass: "多边形玻璃",
  CustomGlass: "函数透光物",
  ParamGlass: "参数曲线玻璃",
  CurveGlass: "贝塞尔曲线玻璃",
  GrinGlass: "渐变折射率多边形",
  CircleGrinGlass: "渐变折射率圆",
  ParamGrinGlass: "渐变折射率参数曲线",
  CurveGrinGlass: "渐变折射率贝塞尔曲线",
  Blocker: "吸光片",
  CircleBlocker: "圆形遮光物",
  Aperture: "光圈",
  DiffractionGrating: "衍射光栅",
  Detector: "探测器",
  Ruler: "直尺",
  Protractor: "量角器",
  TextLabel: "文字",
  LineArrow: "线段 / 箭头",
  Drawing: "手绘",
  CustomSurface: "自定义表面",
  CustomArcSurface: "自定义弧形表面",
  CustomParamSurface: "自定义参数表面",
  CustomCurveSurface: "自定义贝塞尔表面",
  Handle: "控制柄",
  CropBox: "裁切框",
  ModuleObj: "模块",
};

export interface ShelfItem {
  type: string;
  label: string;
  glyph: string;
  hint: string;
}
export interface ShelfGroup {
  id: string;
  label: string;
  items: ShelfItem[];
}
const item = (type: string, glyph: string, hint: string, label = objectNames[type]): ShelfItem => ({
  type,
  label,
  glyph,
  hint,
});
export const shelf: ShelfGroup[] = [
  {
    id: "lightSource",
    label: "光源",
    items: [
      item("SingleRay", "↗", "一条光线，拖动方向点改变方向"),
      item("Beam", "≋", "平行光束，宽度由两端点决定"),
      item("PointSource", "✺", "向四周发光的点光源"),
      item("AngleSource", "◁", "限定发射角的点光源"),
    ],
  },
  {
    id: "mirror",
    label: "镜面",
    items: [
      item("Mirror", "╱", "平面反射镜"),
      item("ArcMirror", "◜", "三点确定的圆弧镜，可作凹/凸面镜"),
      item("ParabolicMirror", "∪", "端点与顶点确定的抛物面镜"),
      item("IdealMirror", "⟩", "满足面镜公式的理想曲面镜，直接设焦距"),
      item("BeamSplitter", "⧄", "按透射比分光的半透镜"),
      item("CustomMirror", "ƒ", "形状为 y = f(x) 的镜面"),
    ],
  },
  {
    id: "glass",
    label: "透镜与玻璃",
    items: [
      item("IdealLens", "↕", "满足薄透镜公式的理想透镜"),
      item("SphericalLens", "()", "按曲率半径与厚度定义的厚透镜"),
      item("Glass", "△", "多边形玻璃（默认三棱镜）", "三棱镜"),
      item("PlaneGlass", "◩", "半无限玻璃界面"),
      item("CircleGlass", "◯", "圆形玻璃，可作雨滴或球透镜"),
      item("CustomGlass", "ƒ", "形状为 f(x) < y < g(x) 的透光物"),
      item("GrinGlass", "▦", "折射率 n(x,y) 渐变的多边形"),
      item("CircleGrinGlass", "◍", "折射率渐变的圆形透光物"),
    ],
  },
  {
    id: "blocker",
    label: "遮光与光栅",
    items: [
      item("Blocker", "┃", "吸收光线的线段"),
      item("CircleBlocker", "●", "圆形遮光物"),
      item("Aperture", "┋", "可调孔径的光圈"),
      item("DiffractionGrating", "┆", "按波长分光的衍射光栅"),
    ],
  },
  {
    id: "other",
    label: "测量与标注",
    items: [
      item("Detector", "▤", "测量通过的功率与动量分量"),
      item("Ruler", "┄", "带刻度的直尺"),
      item("Protractor", "◠", "量角器，单位为度"),
      item("TextLabel", "T", "文字标注"),
      item("LineArrow", "→", "线段或箭头"),
    ],
  },
];
export const shelfTypes = shelf.flatMap((g) => g.items.map((i) => i.type));

const r = (v: number) => Math.round(v * 100) / 100;
const pt = (x: number, y: number): Point => ({ x: r(x), y: r(y) });

/**
 * Preset geometry for an item placed from the shelf, centred on `c` (scene
 * coordinates) with a characteristic size `u` (scene units).
 */
export function presetObject(type: string, c: Point, u: number, ordinal = 1): OpticalObject {
  if (!shelfTypes.includes(type)) throw Error("元件类型无效。");
  const { x, y } = c;
  const name = objectNames[type] + " " + ordinal;
  const vertical = { p1: pt(x, y - u), p2: pt(x, y + u) };
  const base: OpticalObject = { type, name };
  switch (type) {
    case "SingleRay":
      return { ...base, p1: pt(x - 2 * u, y), p2: pt(x - u, y), brightness: 1 };
    case "Beam":
      return { ...base, ...vertical, brightness: 0.5 };
    case "PointSource":
      return { type, name, x: r(x), y: r(y), brightness: 0.5 };
    case "AngleSource":
      return { ...base, p1: pt(x, y), p2: pt(x + u, y), emisAngle: 30 };
    case "Mirror":
    case "PlaneGlass":
    case "Blocker":
    case "Detector":
      return { ...base, ...vertical };
    case "ArcMirror":
      return { ...base, ...vertical, p3: pt(x + 0.35 * u, y) };
    case "ParabolicMirror":
      return { ...base, ...vertical, p3: pt(x + 0.4 * u, y) };
    case "IdealMirror":
    case "IdealLens":
      return { ...base, ...vertical, focalLength: r(2 * u) };
    case "BeamSplitter":
      return { ...base, p1: pt(x - 0.7 * u, y - 0.7 * u), p2: pt(x + 0.7 * u, y + 0.7 * u), transRatio: 0.5 };
    case "CustomMirror":
    case "CustomGlass":
    case "LineArrow":
      return {
        ...base,
        p1: pt(x - u, y),
        p2: pt(x + u, y),
        ...(type === "LineArrow" ? { arrow: true } : {}),
      };
    case "SphericalLens":
      return { ...base, ...vertical, defBy: "DR1R2", params: { d: r(0.4 * u), r1: r(2 * u), r2: r(-2 * u) } };
    case "CircleGlass":
    case "Protractor":
      return { ...base, p1: pt(x, y), p2: pt(x + u, y) };
    case "CircleGrinGlass":
      return { ...base, p1: pt(x, y), p2: pt(x + u, y), origin: pt(x, y) };
    case "CircleBlocker":
      return { ...base, p1: pt(x, y), p2: pt(x + 0.5 * u, y) };
    case "Glass":
      return {
        ...base,
        path: [
          { ...pt(x, y - u), arc: false },
          { ...pt(x + 0.866 * u, y + 0.5 * u), arc: false },
          { ...pt(x - 0.866 * u, y + 0.5 * u), arc: false },
        ],
      };
    case "GrinGlass":
      return {
        ...base,
        path: [
          { ...pt(x - u, y - u), arc: false },
          { ...pt(x + u, y - u), arc: false },
          { ...pt(x + u, y + u), arc: false },
          { ...pt(x - u, y + u), arc: false },
        ],
        origin: pt(x, y),
      };
    case "Aperture":
      return { ...base, p1: pt(x, y - 1.2 * u), p2: pt(x, y + 1.2 * u), p3: pt(x, y - 0.3 * u), p4: pt(x, y + 0.3 * u) };
    case "DiffractionGrating":
      return { ...base, ...vertical, lineDensity: 600 };
    case "Ruler":
      return { ...base, p1: pt(x - u, y + u), p2: pt(x + 2 * u, y + u), scaleInterval: Math.max(1, Math.round(u / 3)) };
    case "TextLabel":
      return { type, name, x: r(x), y: r(y), text: "标注", fontSize: 18 };
  }
  throw Error("元件类型无效。");
}
