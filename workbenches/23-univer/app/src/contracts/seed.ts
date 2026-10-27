import type { IWorkbookData } from "@univerjs/presets";
import type { SheetModel } from "./workbook";
export const seed: SheetModel = {
  workbook: {
    id: "community-budget",
    name: "社区工作坊 · 秋季预算",
    appVersion: "1.2.0",
    locale: "zhCN" as IWorkbookData["locale"],
    styles: {
      header: { bg: { rgb: "#16624f" }, cl: { rgb: "#ffffff" }, bl: 1, fs: 11 },
      money: { n: { pattern: "¥#,##0.00" } },
      total: {
        bg: { rgb: "#e5f2ed" },
        cl: { rgb: "#123e33" },
        bl: 1,
        n: { pattern: "¥#,##0.00" },
      },
    },
    sheetOrder: ["budget", "notes"],
    sheets: {
      budget: {
        id: "budget",
        name: "活动预算",
        rowCount: 100,
        columnCount: 20,
        defaultRowHeight: 30,
        defaultColumnWidth: 110,
        columnData: {
          0: { w: 180 },
          1: { w: 120 },
          2: { w: 100 },
          3: { w: 140 },
          4: { w: 200 },
        },
        freeze: { startRow: 1, startColumn: 0, xSplit: 0, ySplit: 1 },
        cellData: {
          0: {
            0: { v: "项目", s: "header" },
            1: { v: "单价", s: "header" },
            2: { v: "数量", s: "header" },
            3: { v: "预算小计", s: "header" },
            4: { v: "备注", s: "header" },
          },
          1: {
            0: { v: "手工材料包" },
            1: { v: 45, s: "money" },
            2: { v: 24 },
            3: { f: "=B2*C2", s: "money" },
            4: { v: "含纸材与颜料" },
          },
          2: {
            0: { v: "场地布置" },
            1: { v: 320, s: "money" },
            2: { v: 1 },
            3: { f: "=B3*C3", s: "money" },
            4: { v: "社区活动室" },
          },
          3: {
            0: { v: "茶点" },
            1: { v: 18, s: "money" },
            2: { v: 30 },
            3: { f: "=B4*C4", s: "money" },
            4: { v: "参与者与志愿者" },
          },
          4: {
            0: { v: "印刷物料" },
            1: { v: 6, s: "money" },
            2: { v: 40 },
            3: { f: "=B5*C5", s: "money" },
            4: { v: "海报与活动手册" },
          },
          6: {
            0: { v: "预算合计", s: "total" },
            3: { f: "=SUM(D2:D5)", s: "total" },
          },
          7: {
            0: { v: "预留 10%", s: "total" },
            3: { f: "=D7*10%", s: "total" },
          },
          8: {
            0: { v: "计划总额", s: "total" },
            3: { f: "=SUM(D7:D8)", s: "total" },
          },
        },
      },
      notes: {
        id: "notes",
        name: "筹备清单",
        rowCount: 100,
        columnCount: 20,
        defaultRowHeight: 30,
        columnData: { 0: { w: 220 }, 1: { w: 180 } },
        cellData: {
          0: { 0: { v: "任务", s: "header" }, 1: { v: "进度", s: "header" } },
          1: { 0: { v: "确认参加人数" }, 1: { v: "进行中" } },
          2: { 0: { v: "采购材料" }, 1: { v: "待开始" } },
          3: { 0: { v: "活动前布置" }, 1: { v: "待开始" } },
        },
      },
    },
  },
};
