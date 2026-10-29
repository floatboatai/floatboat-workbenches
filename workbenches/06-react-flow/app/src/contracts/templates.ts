// ABOUTME: 模板库中的示例流水线（普通演示数据），第一个同时作为首次打开的种子。
import type { FlowDocument, PipelineEdge, PipelineNode } from "./flow.ts";
import { defaultConfig, spec, type OpKind } from "./ops.ts";

const X = 256;
function n(id: string, op: OpKind, col: number, y: number, config: Record<string, unknown> = {}, label = spec(op).title): PipelineNode {
  return { id, type: "op", position: { x: col * X, y }, data: { op, label, config: { ...defaultConfig(op), ...config } } };
}
function e(source: string, target: string, sourceHandle = "out", targetHandle = "in"): PipelineEdge {
  return { id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle };
}

const ordersCsv = `订单号,下单日期,地区,客户,商品,数量,金额,状态
SO-1001,2026-10-01,华东,上海晨光文具,办公椅,4,1960,已完成
SO-1002,2026-10-01,华南,广州启航科技,显示器,2,2598,已完成
SO-1003,2026-10-02,华北,北京青禾咨询,打印纸,30,690,已完成
SO-1004,2026-10-02,华东,杭州云栖设计,升降桌,1,2399,已取消
SO-1005,2026-10-03,西南,成都锦城教育,投影仪,1,3299,已完成
SO-1002,2026-10-01,华南,广州启航科技,显示器,2,2598,已完成
SO-1006,2026-10-03,华东,南京紫金律所,碎纸机,2,1180,已完成
SO-1007,2026-10-04,华北,天津港湾物流,办公椅,6,2940,待发货
SO-1008,2026-10-04,华南,深圳前海数据,机械键盘,10,3990,已完成
SO-1009,2026-10-05,华中,武汉光谷医疗,显示器,3,3897,已完成
SO-1010,2026-10-05,西南,重庆山城餐饮,打印纸,0,0,已完成
SO-1011,2026-10-06,华东,苏州园区制造,投影仪,2,6598,已完成
SO-1012,2026-10-06,华中,长沙岳麓书院,升降桌,2,4798,待发货
SO-1013,2026-10-07,华北,北京青禾咨询,机械键盘,5,1995,已完成
SO-1014,2026-10-07,华南,厦门鹭岛贸易,碎纸机,1,590,已取消
SO-1015,2026-10-08,华东,上海晨光文具,打印纸,50,1150,已完成
SO-1016,2026-10-08,西南,成都锦城教育,办公椅,8,3920,已完成
SO-1017,2026-10-09,华中,武汉光谷医疗,机械键盘,4,1596,已完成
SO-1018,2026-10-09,华北,石家庄恒信会计,显示器,1,1299,已完成
SO-1019,2026-10-10,华南,广州启航科技,升降桌,3,7197,已完成
SO-1020,2026-10-10,华东,杭州云栖设计,显示器,4,5196,已完成
SO-1016,2026-10-08,西南,成都锦城教育,办公椅,8,3920,已完成
`;

/** 订单 CSV 清洗与按地区汇总（首次打开的种子）。 */
export const ordersPipeline: FlowDocument = {
  version: 2,
  nodes: [
    n("orders", "csvInput", 0, 120, { csv: ordersCsv, fileName: "10月订单.csv" }, "10 月订单 CSV"),
    n("clean", "filter", 1, 120, {
      mode: "all",
      conditions: [
        { column: "状态", op: "neq", value: "已取消" },
        { column: "数量", op: "gt", value: "0" },
      ],
    }, "剔除取消与零数量"),
    n("unique", "dedupe", 2, 40, { columns: ["订单号"] }, "按订单号去重"),
    n("rejected", "tableOutput", 2, 330, {}, "被剔除的订单"),
    n("byRegion", "group", 3, 40, {
      by: ["地区"],
      aggregations: [
        { op: "count", column: "", as: "订单数" },
        { op: "sum", column: "金额", as: "销售额" },
        { op: "avg", column: "金额", as: "客单价" },
      ],
    }, "按地区汇总"),
    n("chart", "chartOutput", 4, -150, { label: "地区", value: "销售额", order: "desc" }, "地区销售额"),
    n("summary", "tableOutput", 4, 110, {}, "地区汇总表"),
    n("download", "fileOutput", 4, 360, { format: "csv", fileName: "地区销售汇总" }, "下载汇总 CSV"),
  ],
  edges: [
    e("orders", "clean"),
    e("clean", "unique"),
    e("clean", "rejected", "rest"),
    e("unique", "byRegion"),
    e("byRegion", "chart"),
    e("byRegion", "summary"),
    e("byRegion", "download"),
  ],
};

const serviceLog = `2026-10-28 09:00:01 INFO [gateway] request id=8812 path=/api/orders 200 34ms
2026-10-28 09:00:04 ERROR [payment] E1042 支付渠道超时 order=SO-1019
2026-10-28 09:00:05 WARN [inventory] W201 库存低于安全线 sku=KB-104
2026-10-28 09:00:09 ERROR [payment] E1042 支付渠道超时 order=SO-1021
2026-10-28 09:00:12 INFO [gateway] request id=8813 path=/api/cart 200 18ms
2026-10-28 09:00:15 ERROR [auth] E2001 令牌已过期 user=u_3381
2026-10-28 09:00:21 ERROR [inventory] E3007 扣减库存冲突 sku=MN-270
2026-10-28 09:00:22 INFO [scheduler] job=reconcile started
2026-10-28 09:00:30 ERROR [payment] E1050 签名校验失败 order=SO-1022
2026-10-28 09:00:31 ERROR [auth] E2001 令牌已过期 user=u_1029
2026-10-28 09:00:40 WARN [gateway] W110 响应变慢 path=/api/report 1890ms
2026-10-28 09:00:41 ERROR [payment] E1042 支付渠道超时 order=SO-1023
2026-10-28 09:00:47 ERROR [inventory] E3007 扣减库存冲突 sku=KB-104
2026-10-28 09:00:52 INFO [gateway] request id=8820 path=/api/orders 200 29ms
2026-10-28 09:01:03 ERROR [auth] E2004 账号已锁定 user=u_7710
2026-10-28 09:01:09 ERROR [payment] E1042 支付渠道超时 order=SO-1024
2026-10-28 09:01:15 WARN [inventory] W201 库存低于安全线 sku=MN-270
2026-10-28 09:01:20 ERROR [auth] E2001 令牌已过期 user=u_2290
`;

export const logPipeline: FlowDocument = {
  version: 2,
  nodes: [
    n("log", "textInput", 0, 100, { text: serviceLog, fileName: "service.log" }, "服务日志"),
    n("parse", "regexExtract", 1, 100, {
      pattern: "^(?<时间>\\S+ \\S+) (?<级别>ERROR|WARN) \\[(?<服务>[\\w-]+)\\] (?<代码>[EW]\\d{3,4}) (?<说明>\\S+)",
      flags: "m",
    }, "解析级别与错误码"),
    n("errors", "filter", 2, 100, { conditions: [{ column: "级别", op: "eq", value: "ERROR" }] }, "只看 ERROR"),
    n("byCode", "group", 3, -20, {
      by: ["代码", "说明"],
      aggregations: [{ op: "count", column: "", as: "次数" }, { op: "distinct", column: "服务", as: "涉及服务" }],
    }, "按错误码计数"),
    n("byService", "group", 3, 300, { by: ["服务"], aggregations: [{ op: "count", column: "", as: "错误数" }] }, "按服务计数"),
    n("codeChart", "chartOutput", 4, -120, { label: "代码", value: "次数", order: "desc" }, "错误码排行"),
    n("serviceTable", "tableOutput", 4, 300, {}, "各服务错误数"),
    n("errorFile", "fileOutput", 3, 560, { format: "csv", fileName: "错误明细" }, "下载错误明细"),
  ],
  edges: [
    e("log", "parse"),
    e("parse", "errors"),
    e("errors", "byCode"),
    e("errors", "byService"),
    e("errors", "errorFile"),
    e("byCode", "codeChart"),
    e("byService", "serviceTable"),
  ],
};

const apiJson = JSON.stringify(
  {
    code: 0,
    data: {
      page: 1,
      items: [
        { id: "INV-2041", customer: "上海晨光文具", amount: 12800, status: "overdue", due: "2026-10-20", owner: "王敏" },
        { id: "INV-2042", customer: "广州启航科技", amount: 5600, status: "paid", due: "2026-10-22", owner: "李响" },
        { id: "INV-2043", customer: "成都锦城教育", amount: 21450, status: "overdue", due: "2026-10-18", owner: "王敏" },
        { id: "INV-2044", customer: "武汉光谷医疗", amount: 3980, status: "pending", due: "2026-11-05", owner: "赵琳" },
        { id: "INV-2045", customer: "北京青禾咨询", amount: 9900, status: "overdue", due: "2026-10-25", owner: "李响" },
      ],
    },
  },
  null,
  2,
);

export const reminderPipeline: FlowDocument = {
  version: 2,
  nodes: [
    n("api", "jsonInput", 0, 80, { json: apiJson, fileName: "invoices.json" }, "账单接口返回"),
    n("items", "jsonPick", 1, 80, { path: "$.data.items", as: "table" }, "取出账单列表"),
    n("overdue", "filter", 2, 80, { conditions: [{ column: "status", op: "eq", value: "overdue" }] }, "逾期账单"),
    n("message", "template", 3, -40, {
      template: "{{#}}. {{customer}}：账单 {{id}} 金额 ¥{{amount}} 已于 {{due}} 到期，请联系 {{owner}} 处理。",
      header: "【逾期提醒】",
    }, "生成提醒文案"),
    n("rename", "mapFields", 3, 260, {
      keepOthers: false,
      fields: [
        { from: "id", to: "账单号", cast: "keep" },
        { from: "customer", to: "客户", cast: "keep" },
        { from: "amount", to: "金额", cast: "number" },
        { from: "due", to: "到期日", cast: "keep" },
        { from: "{{owner}}（客户经理）", to: "跟进人", cast: "text" },
      ],
    }, "整理字段"),
    n("preview", "textOutput", 4, -40, {}, "提醒文案"),
    n("json", "fileOutput", 4, 260, { format: "json", fileName: "逾期账单" }, "下载 JSON"),
  ],
  edges: [
    e("api", "items"),
    e("items", "overdue"),
    e("overdue", "message"),
    e("overdue", "rename"),
    e("message", "preview"),
    e("rename", "json"),
  ],
};

const september = `订单号,客户编号,金额,月份备注
A-301,C01,1200,
A-302,C02,860,
A-303,C03,2300,
A-304,C01,450,补发
`;
const october = `订单号,客户编号,金额,月份备注
A-304,C01,480,补发改价
A-305,C04,3100,
A-306,C02,990,
A-307,C05,1500,
`;
const customers = `客户编号,客户名称,等级
C01,上海晨光文具,A
C02,广州启航科技,B
C03,成都锦城教育,A
C04,武汉光谷医疗,B
`;

export const mergePipeline: FlowDocument = {
  version: 2,
  nodes: [
    n("sep", "csvInput", 0, -40, { csv: september }, "9 月订单"),
    n("oct", "csvInput", 0, 220, { csv: october }, "10 月订单"),
    n("customers", "csvInput", 2, 330, { csv: customers }, "客户档案"),
    n("all", "concat", 1, 90, { sourceColumn: "来源", labelA: "9 月", labelB: "10 月" }, "合并两月"),
    n("latest", "dedupe", 2, 60, { columns: ["订单号"], keep: "last" }, "同单号取最新"),
    n("withName", "join", 3, 120, { leftKey: "客户编号", kind: "left" }, "关联客户档案"),
    n("table", "tableOutput", 4, 0, {}, "对账明细"),
    n("file", "fileOutput", 4, 260, { format: "csv", fileName: "两月对账" }, "下载对账 CSV"),
  ],
  edges: [
    e("sep", "all", "out", "a"),
    e("oct", "all", "out", "b"),
    e("all", "latest"),
    e("latest", "withName", "out", "left"),
    e("customers", "withName", "out", "right"),
    e("withName", "table"),
    e("withName", "file"),
  ],
};

const keywords = `  Data Pipeline
data pipeline
ETL
Dashboard
  etl
数据清洗
dashboard
报表自动化
数据清洗
`;

export const keywordPipeline: FlowDocument = {
  version: 2,
  nodes: [
    n("raw", "textInput", 0, 0, { text: keywords }, "关键词草稿"),
    n("lower", "textTransform", 1, 0, { mode: "lower" }, "统一小写"),
    n("lines", "splitLines", 2, 0, { column: "关键词" }, "按行拆分"),
    n("uniq", "dedupe", 3, 0, { columns: ["关键词"] }, "去重"),
    n("sorted", "sort", 4, 0, { keys: [{ column: "关键词", direction: "asc" }] }, "排序"),
    n("list", "template", 5, 0, { template: "- {{关键词}}" }, "生成清单"),
    n("out", "textOutput", 6, 0, {}, "整理结果"),
  ],
  edges: [e("raw", "lower"), e("lower", "lines"), e("lines", "uniq"), e("uniq", "sorted"), e("sorted", "list"), e("list", "out")],
};

export interface PipelineTemplate {
  id: string;
  title: string;
  description: string;
  doc: FlowDocument;
}

export const templates: PipelineTemplate[] = [
  { id: "orders", title: "订单 CSV 清洗与按地区汇总", description: "剔除取消/零数量订单、按订单号去重、按地区计数与求和，输出柱状图、汇总表与 CSV。", doc: ordersPipeline },
  { id: "logs", title: "日志提取错误码统计", description: "用命名分组正则解析服务日志，筛出 ERROR，按错误码与服务分别计数。", doc: logPipeline },
  { id: "reminder", title: "接口 JSON 转逾期提醒", description: "从接口返回中取出账单列表，筛选逾期，生成提醒文案并导出整理后的 JSON。", doc: reminderPipeline },
  { id: "merge", title: "两月订单合并对账", description: "上下合并两个月的订单，同单号保留最新一条，再关联客户档案。", doc: mergePipeline },
  { id: "keywords", title: "关键词清单去重排序", description: "统一大小写、按行拆分、去重排序后生成 Markdown 清单。", doc: keywordPipeline },
];

export const seed: FlowDocument = ordersPipeline;
export const seedTitle = "订单 CSV 清洗与按地区汇总";
