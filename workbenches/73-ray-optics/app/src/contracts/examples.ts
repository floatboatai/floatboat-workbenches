import { portedExamples } from "./examples-data.ts";
import { seedScene } from "./optics.ts";

export interface Example {
  id: string;
  title: string;
  topic: string;
  summary: string;
  /** Upstream gallery contributors, or empty for scenes authored for this workbench. */
  contributors: string[];
  origin: "upstream" | "workbench";
  upstreamPath?: string;
  scene: string;
}

const mirrorImaging = {
  version: 5,
  name: "凹面镜与凸面镜成像",
  mode: "images",
  objs: [
    { type: "ArcMirror", name: "凹面镜", p1: { x: 420, y: 140 }, p2: { x: 420, y: 460 }, p3: { x: 452, y: 300 } },
    { type: "PointSource", name: "物（底）", x: 40, y: 300, brightness: 0.5 },
    { type: "PointSource", name: "物（顶）", x: 40, y: 240, brightness: 0.5 },
    { type: "Blocker", name: "隔板", p1: { x: 640, y: 60 }, p2: { x: 640, y: 540 } },
    { type: "ArcMirror", name: "凸面镜", p1: { x: 880, y: 140 }, p2: { x: 880, y: 460 }, p3: { x: 848, y: 300 } },
    { type: "PointSource", name: "物（底）", x: 1180, y: 300, brightness: 0.5 },
    { type: "PointSource", name: "物（顶）", x: 1180, y: 240, brightness: 0.5 },
    { type: "Ruler", name: "主光轴", p1: { x: -120, y: 300 }, p2: { x: 620, y: 300 }, scaleInterval: 40 },
    { type: "TextLabel", x: -110, y: 110, text: "凹面镜：物在 2f 外，成倒立缩小的实像（黄点）", fontSize: 16 },
    { type: "TextLabel", x: 700, y: 110, text: "凸面镜：总成正立缩小的虚像（橙点）", fontSize: 16 },
    { type: "TextLabel", x: -110, y: 580, text: "拖动物点或镜面控制点，观察像点如何移动；切到“光线”模式看光路。", fontSize: 14 },
  ],
  width: 1500,
  height: 800,
  origin: { x: 210, y: 70 },
  scale: 1,
  imageModeDensity: 1.5,
  rayModeDensity: 0.3,
  showGrid: false,
};

const fibre = {
  version: 5,
  name: "光纤 · 全内反射",
  mode: "rays",
  objs: [
    {
      type: "Glass",
      name: "纤芯 n=1.5",
      path: [
        { x: 100, y: 270, arc: false },
        { x: 520, y: 270, arc: false },
        { x: 860, y: 383, arc: false },
        { x: 847, y: 421, arc: false },
        { x: 513, y: 310, arc: false },
        { x: 100, y: 310, arc: false },
      ],
      refIndex: 1.5,
    },
    { type: "AngleSource", name: "入射光", p1: { x: 40, y: 290 }, p2: { x: 100, y: 290 }, brightness: 0.6, emisAngle: 24 },
    { type: "Detector", name: "出射探测器", p1: { x: 930, y: 340 }, p2: { x: 900, y: 470 } },
    { type: "Detector", name: "侧面漏光", p1: { x: 300, y: 200 }, p2: { x: 700, y: 200 } },
    { type: "TextLabel", x: 110, y: 160, text: "光在纤芯与空气界面上发生全内反射（临界角约 41.8°）", fontSize: 16 },
    { type: "TextLabel", x: 110, y: 520, text: "增大发射角或折射率变小，侧面探测器开始收到漏光", fontSize: 14 },
  ],
  width: 1100,
  height: 650,
  origin: { x: 60, y: 40 },
  scale: 1,
  rayModeDensity: 0.4,
  maxRayDepth: 400,
};

export const examples: Example[] = [
  {
    id: "lens-focus",
    title: "凸透镜 · 平行光会聚",
    topic: "透镜",
    summary: "平行光经理想凸透镜会聚，探测器读数随焦点位置变化。",
    contributors: [],
    origin: "workbench",
    scene: JSON.stringify(seedScene),
  },
  {
    id: "mirror-imaging",
    title: mirrorImaging.name,
    topic: "成像",
    summary: "成像模式下比较凹面镜的倒立实像与凸面镜的正立虚像。",
    contributors: [],
    origin: "workbench",
    scene: JSON.stringify(mirrorImaging),
  },
  {
    id: "optical-fibre",
    title: fibre.name,
    topic: "折射",
    summary: "弯折的玻璃纤芯靠全内反射导光，两个探测器对比出射与漏光。",
    contributors: [],
    origin: "workbench",
    scene: JSON.stringify(fibre),
  },
  ...portedExamples.map((e) => ({ ...e, origin: "upstream" as const })),
];
export const exampleTopics = [...new Set(examples.map((e) => e.topic))];
export function findExample(id: string): Example | undefined {
  return examples.find((e) => e.id === id);
}
