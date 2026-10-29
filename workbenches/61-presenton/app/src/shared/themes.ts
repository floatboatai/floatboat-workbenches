// ABOUTME: 演示主题（颜色角色、标题/正文字体）；舞台、PDF 位图与 PPTX 共用同一份定义。
import type { ThemeId } from "../contracts/model.ts";

export type Theme = {
  id: ThemeId;
  name: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  onAccent: string;
  line: string;
  serifHead: boolean;
  chart: string[];
};
export const THEME_DEFS: Record<ThemeId, Theme> = {
  paper: {
    id: "paper",
    name: "纸本",
    bg: "FBF8F1",
    surface: "F1EBDD",
    ink: "1F2A3A",
    muted: "6B6F78",
    accent: "2F5DA8",
    accent2: "C98A2B",
    onAccent: "FFFFFF",
    line: "DCD3C1",
    serifHead: true,
    chart: ["2F5DA8", "C98A2B", "5E8C6A", "A4566B", "7A6FA8", "4E8FA6"],
  },
  forest: {
    id: "forest",
    name: "林荫",
    bg: "F4F6F0",
    surface: "E2E9DC",
    ink: "1D3326",
    muted: "5E6E62",
    accent: "2E6B47",
    accent2: "B4823A",
    onAccent: "FFFFFF",
    line: "C9D4C2",
    serifHead: false,
    chart: ["2E6B47", "B4823A", "6FA37C", "8C5A3C", "3F7F8C", "A8A04A"],
  },
  night: {
    id: "night",
    name: "夜航",
    bg: "141B2D",
    surface: "1F2942",
    ink: "F2F0EA",
    muted: "A9B0C2",
    accent: "F0B34A",
    accent2: "6FC3D6",
    onAccent: "141B2D",
    line: "34405E",
    serifHead: false,
    chart: ["F0B34A", "6FC3D6", "E07A5F", "9CCB86", "B79CE0", "F2F0EA"],
  },
  clay: {
    id: "clay",
    name: "赭石",
    bg: "FAF4EE",
    surface: "F0E2D6",
    ink: "3A2621",
    muted: "7D6A62",
    accent: "B5523B",
    accent2: "3C6E71",
    onAccent: "FFFFFF",
    line: "E2CFC0",
    serifHead: true,
    chart: ["B5523B", "3C6E71", "D9A35B", "7F5A83", "6E8B5B", "C47A6B"],
  },
  mono: {
    id: "mono",
    name: "简白",
    bg: "FFFFFF",
    surface: "F1F2F4",
    ink: "111418",
    muted: "5F6670",
    accent: "D6332E",
    accent2: "111418",
    onAccent: "FFFFFF",
    line: "D9DCE1",
    serifHead: false,
    chart: ["111418", "D6332E", "8A9099", "E3A13A", "3D6FB6", "6BA368"],
  },
};
export const fontStack = (serif: boolean) =>
  serif
    ? '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",Georgia,serif'
    : '"Noto Sans SC","Source Han Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
/** Font names written into PPTX (latin + East Asian runs); PowerPoint substitutes when absent. */
export const pptxFont = (serif: boolean) => (serif ? "SimSun" : "Microsoft YaHei");

export function mix(a: string, b: string, t: number): string {
  const pa = [0, 2, 4].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [0, 2, 4].map((i) => parseInt(b.slice(i, i + 2), 16));
  return pa
    .map((v, i) => Math.round(v + (pb[i] - v) * t))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
