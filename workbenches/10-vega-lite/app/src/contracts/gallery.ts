// ABOUTME: 示例库：覆盖图层、拼接、分面、重复、扇形、箱线图、回归、窗口变换与交互参数的真实规格。

export interface GalleryExample {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  /** 依赖的内置数据集名称（见 samples.ts）。 */
  datasets: string[];
  spec: Record<string, unknown>;
}
const SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";
const cityColors = { domain: ["北京", "上海", "广州"], range: ["#3b6fb6", "#d1634a", "#3c9a76"] };

export const gallery: GalleryExample[] = [
  {
    id: "seasonal-temperature",
    title: "三城气温季节变化",
    summary: "月均最高/最低气温区间带叠加均值折线，点击图例突出某个城市。",
    tags: ["layer", "area", "params", "图例交互"],
    datasets: ["weather"],
    spec: {
      $schema: SCHEMA,
      title: { text: "2024 年三城月均气温", subtitle: "区间为月均最低—最高气温，线为月均最高气温", anchor: "start" },
      data: { name: "weather" },
      encoding: {
        x: { timeUnit: "month", field: "date", type: "temporal", title: null, axis: { format: "%-m月", labelOverlap: true } },
        color: { field: "city", type: "nominal", title: "城市", scale: cityColors },
      },
      layer: [
        {
          mark: { type: "area", interpolate: "monotone" },
          encoding: {
            opacity: { condition: { param: "pick", value: 0.2 }, value: 0.04 },
            y: { aggregate: "mean", field: "temp_min", type: "quantitative", title: "气温 (°C)" },
            y2: { aggregate: "mean", field: "temp_max" },
          },
        },
        {
          params: [{ name: "pick", select: { type: "point", fields: ["city"] }, bind: "legend" }],
          mark: { type: "line", interpolate: "monotone", strokeWidth: 2.5, point: true },
          encoding: {
            opacity: { condition: { param: "pick", value: 1 }, value: 0.15 },
            y: { aggregate: "mean", field: "temp_max", type: "quantitative" },
            tooltip: [
              { field: "city", title: "城市" },
              { timeUnit: "month", field: "date", title: "月份", format: "%-m月" },
              { aggregate: "mean", field: "temp_max", title: "月均最高", format: ".1f" },
              { aggregate: "mean", field: "temp_min", title: "月均最低", format: ".1f" },
            ],
          },
        },
      ],
    },
  },
  {
    id: "monthly-revenue-stack",
    title: "区域月度营收",
    summary: "按月堆叠五个大区的营收，悬停查看明细。",
    tags: ["bar", "stack", "timeUnit"],
    datasets: ["sales"],
    spec: {
      $schema: SCHEMA,
      title: { text: "区域月度营收（万元）", anchor: "start" },
      data: { name: "sales" },
      mark: { type: "bar", cornerRadiusEnd: 2 },
      encoding: {
        x: { timeUnit: "yearmonth", field: "month", type: "ordinal", title: null, axis: { format: "%y/%m", labelAngle: 0, labelOverlap: true } },
        y: { aggregate: "sum", field: "revenue", type: "quantitative", title: "营收" },
        color: { field: "region", type: "nominal", title: "大区", sort: ["华东", "华南", "华北", "西南", "西北"] },
        tooltip: [
          { timeUnit: "yearmonth", field: "month", title: "月份" },
          { field: "region", title: "大区" },
          { aggregate: "sum", field: "revenue", title: "营收", format: ",.1f" },
        ],
      },
    },
  },
  {
    id: "category-donut",
    title: "品类营收占比",
    summary: "环形图与外圈百分比标签，使用 joinaggregate 计算占比。",
    tags: ["arc", "layer", "transform"],
    datasets: ["sales"],
    spec: {
      $schema: SCHEMA,
      title: { text: "2024 年品类营收占比", anchor: "start" },
      data: { name: "sales" },
      transform: [
        { filter: "year(datum.month) === 2024" },
        { aggregate: [{ op: "sum", field: "revenue", as: "revenue" }], groupby: ["category"] },
        { joinaggregate: [{ op: "sum", field: "revenue", as: "total" }] },
        { calculate: "datum.revenue / datum.total", as: "share" },
      ],
      encoding: {
        theta: { field: "revenue", type: "quantitative", stack: true },
        color: { field: "category", type: "nominal", title: "品类", scale: { scheme: "tableau10" } },
        order: { field: "revenue", sort: "descending" },
      },
      layer: [
        { mark: { type: "arc", innerRadius: { expr: "min(width, height) * 0.2" }, outerRadius: { expr: "min(width, height) / 2 - 26" }, padAngle: 0.01, cornerRadius: 3 } },
        {
          mark: { type: "text", radius: { expr: "min(width, height) / 2 - 10" }, fontSize: 12 },
          encoding: { text: { field: "share", type: "quantitative", format: ".0%" }, color: { value: "#4a4f5c" } },
        },
      ],
      view: { stroke: null },
    },
  },
  {
    id: "temperature-boxplot",
    title: "月度最高气温箱线图",
    summary: "boxplot 复合标记，以 xOffset 并排比较三座城市。",
    tags: ["boxplot", "xOffset"],
    datasets: ["weather"],
    spec: {
      $schema: SCHEMA,
      title: { text: "各月日最高气温分布", anchor: "start" },
      data: { name: "weather" },
      mark: { type: "boxplot", extent: 1.5, size: 9 },
      encoding: {
        x: { timeUnit: "month", field: "date", type: "ordinal", title: null, axis: { format: "%-m月", labelAngle: 0 } },
        xOffset: { field: "city", type: "nominal", sort: cityColors.domain },
        y: { field: "temp_max", type: "quantitative", title: "日最高气温 (°C)" },
        color: { field: "city", type: "nominal", title: "城市", sort: cityColors.domain, scale: { range: cityColors.range } },
      },
    },
  },
  {
    id: "region-facet",
    title: "大区 × 品类小多面",
    summary: "按大区分面，每格比较五个品类两年的营收。",
    tags: ["facet", "bar", "xOffset"],
    datasets: ["sales"],
    spec: {
      $schema: SCHEMA,
      title: { text: "各大区品类营收（万元）", anchor: "start" },
      data: { name: "sales" },
      facet: { column: { field: "region", type: "nominal", title: null, sort: ["华东", "华南", "华北", "西南", "西北"] } },
      spec: {
        width: 150,
        height: 220,
        mark: "bar",
        encoding: {
          x: { field: "category", type: "nominal", title: null, axis: { labelAngle: 0 } },
          xOffset: { field: "year", type: "nominal" },
          y: { aggregate: "sum", field: "revenue", type: "quantitative", title: "营收" },
          color: { field: "year", type: "nominal", title: "年份", scale: { range: ["#b8c4d6", "#3b6fb6"] } },
        },
      },
      transform: [{ calculate: "year(datum.month) + ''", as: "year" }],
    },
  },
  {
    id: "weather-repeat",
    title: "气象指标分布",
    summary: "repeat 同一张直方图到四个字段，颜色区分城市。",
    tags: ["repeat", "bin", "histogram"],
    datasets: ["weather"],
    spec: {
      $schema: SCHEMA,
      title: { text: "气象指标分布", anchor: "start" },
      data: { name: "weather" },
      repeat: ["temp_max", "temp_min", "precipitation", "wind"],
      columns: 2,
      spec: {
        width: 260,
        height: 150,
        mark: { type: "bar", opacity: 0.85 },
        encoding: {
          x: { field: { repeat: "repeat" }, bin: { maxbins: 30 }, type: "quantitative" },
          y: { aggregate: "count", type: "quantitative", title: "天数" },
          color: { field: "city", type: "nominal", title: "城市", scale: cityColors },
        },
      },
    },
  },
  {
    id: "store-brush",
    title: "门店散点刷选联动",
    summary: "在散点图上框选，下方柱图只统计选中的门店。",
    tags: ["vconcat", "params", "interval", "filter"],
    datasets: ["stores"],
    spec: {
      $schema: SCHEMA,
      title: { text: "门店面积与月营收", subtitle: "拖动框选门店，下方按城市级别汇总", anchor: "start" },
      data: { name: "stores" },
      vconcat: [
        {
          width: 560,
          height: 260,
          params: [{ name: "brush", select: { type: "interval" } }],
          mark: { type: "point", filled: true, size: 60 },
          encoding: {
            x: { field: "area", type: "quantitative", title: "面积 (m²)" },
            y: { field: "monthly_revenue", type: "quantitative", title: "月营收（万元）" },
            color: {
              condition: { param: "brush", field: "tier", type: "nominal", title: "城市级别", sort: ["一线", "新一线", "二线", "三线"] },
              value: "#c9ccd4",
            },
            tooltip: [
              { field: "store_id", title: "门店" },
              { field: "city", title: "城市" },
              { field: "monthly_revenue", title: "月营收", format: ".1f" },
            ],
          },
        },
        {
          width: 560,
          height: 120,
          transform: [{ filter: { param: "brush" } }],
          mark: "bar",
          encoding: {
            y: { field: "tier", type: "nominal", title: null, sort: ["一线", "新一线", "二线", "三线"] },
            x: { aggregate: "sum", field: "monthly_revenue", type: "quantitative", title: "选中门店月营收合计（万元）" },
            color: { field: "tier", type: "nominal", legend: null, sort: ["一线", "新一线", "二线", "三线"] },
          },
        },
      ],
    },
  },
  {
    id: "weather-calendar",
    title: "上海气温日历热力图",
    summary: "rect 标记按日 × 月排布，颜色表示当日最高气温。",
    tags: ["rect", "timeUnit", "heatmap"],
    datasets: ["weather"],
    spec: {
      $schema: SCHEMA,
      title: { text: "上海 2024 日最高气温", anchor: "start" },
      data: { name: "weather" },
      transform: [{ filter: "datum.city === '上海'" }],
      mark: { type: "rect", cornerRadius: 1.5 },
      encoding: {
        x: { timeUnit: "date", field: "date", type: "ordinal", title: "日", axis: { labelAngle: 0, format: "%e" } },
        y: { timeUnit: "month", field: "date", type: "ordinal", title: null, axis: { format: "%-m月" } },
        color: { aggregate: "max", field: "temp_max", type: "quantitative", title: "°C", scale: { scheme: "redyellowblue", reverse: true } },
        tooltip: [
          { field: "date", type: "temporal", title: "日期", format: "%Y-%m-%d" },
          { aggregate: "max", field: "temp_max", title: "最高气温" },
        ],
      },
      config: { view: { strokeWidth: 0, step: 15 }, axis: { domain: false } },
    },
  },
  {
    id: "store-matrix",
    title: "门店指标散点矩阵",
    summary: "二维 repeat 生成散点矩阵，框选在所有格子间联动。",
    tags: ["repeat", "matrix", "params"],
    datasets: ["stores"],
    spec: {
      $schema: SCHEMA,
      title: { text: "门店指标散点矩阵", anchor: "start" },
      data: { name: "stores" },
      repeat: { row: ["area", "daily_visitors", "avg_ticket"], column: ["avg_ticket", "daily_visitors", "area"] },
      spec: {
        width: 160,
        height: 160,
        params: [{ name: "brush", select: { type: "interval", resolve: "global" } }],
        mark: { type: "point", filled: true, size: 22 },
        encoding: {
          x: { field: { repeat: "column" }, type: "quantitative", scale: { zero: false } },
          y: { field: { repeat: "row" }, type: "quantitative", scale: { zero: false } },
          color: {
            condition: { param: "brush", field: "tier", type: "nominal", title: "城市级别", sort: ["一线", "新一线", "二线", "三线"] },
            value: "#d3d6dd",
          },
        },
      },
    },
  },
  {
    id: "area-regression",
    title: "面积与营收回归",
    summary: "散点叠加线性回归与 LOESS 平滑曲线。",
    tags: ["layer", "regression", "loess"],
    datasets: ["stores"],
    spec: {
      $schema: SCHEMA,
      title: { text: "门店面积越大，月营收越高吗？", anchor: "start" },
      data: { name: "stores" },
      encoding: {
        x: { field: "area", type: "quantitative", title: "面积 (m²)" },
        y: { field: "monthly_revenue", type: "quantitative", title: "月营收（万元）" },
      },
      layer: [
        { mark: { type: "circle", opacity: 0.55, color: "#6b7a99" } },
        {
          mark: { type: "line", color: "#d1634a", strokeWidth: 2.5 },
          transform: [{ regression: "monthly_revenue", on: "area" }],
        },
        {
          mark: { type: "line", color: "#3c9a76", strokeDash: [5, 4], strokeWidth: 2 },
          transform: [{ loess: "monthly_revenue", on: "area", bandwidth: 0.5 }],
        },
      ],
    },
  },
  {
    id: "rolling-precipitation",
    title: "气温与 15 日滑动均值",
    summary: "window 变换计算滑动均值，叠加在逐日散点上。",
    tags: ["window", "layer", "transform"],
    datasets: ["weather"],
    spec: {
      $schema: SCHEMA,
      title: { text: "北京日最高气温与 15 日滑动均值", anchor: "start" },
      data: { name: "weather" },
      transform: [
        { filter: "datum.city === '北京'" },
        { window: [{ op: "mean", field: "temp_max", as: "rolling" }], frame: [-7, 7], sort: [{ field: "date" }] },
      ],
      encoding: { x: { field: "date", type: "temporal", title: null, axis: { format: "%-m月" } } },
      layer: [
        { mark: { type: "point", size: 14, opacity: 0.45, color: "#8a94a8" }, encoding: { y: { field: "temp_max", type: "quantitative", title: "最高气温 (°C)" } } },
        { mark: { type: "line", color: "#3b6fb6", strokeWidth: 2.5 }, encoding: { y: { field: "rolling", type: "quantitative" } } },
      ],
    },
  },
  {
    id: "threshold-slider",
    title: "高温日阈值滑块",
    summary: "参数绑定到滑块，拖动即可改变高温阈值并重新统计。",
    tags: ["params", "bind", "滑块", "xOffset"],
    datasets: ["weather"],
    spec: {
      $schema: SCHEMA,
      title: { text: "各城市高温日数", subtitle: "拖动图下方的滑块修改阈值", anchor: "start" },
      data: { name: "weather" },
      params: [{ name: "threshold", value: 32, bind: { input: "range", min: 20, max: 38, step: 1, name: "高温阈值 °C " } }],
      transform: [{ calculate: "datum.temp_max >= threshold ? 1 : 0", as: "hot" }],
      mark: { type: "bar", cornerRadiusEnd: 3 },
      encoding: {
        x: { timeUnit: "month", field: "date", type: "ordinal", title: null, axis: { format: "%-m月", labelAngle: 0 } },
        xOffset: { field: "city", type: "nominal" },
        y: { aggregate: "sum", field: "hot", type: "quantitative", title: "高温日数" },
        color: { field: "city", type: "nominal", title: "城市", scale: cityColors },
      },
    },
  },
  {
    id: "region-hconcat",
    title: "大区排行与趋势",
    summary: "hconcat 并排条形排行和月度趋势，点击条形高亮对应折线。",
    tags: ["hconcat", "params", "point"],
    datasets: ["sales"],
    spec: {
      $schema: SCHEMA,
      title: { text: "大区营收排行与月度趋势", anchor: "start" },
      data: { name: "sales" },
      hconcat: [
        {
          width: 200,
          height: 240,
          params: [{ name: "pick", select: { type: "point", fields: ["region"] } }],
          mark: "bar",
          encoding: {
            y: { field: "region", type: "nominal", sort: "-x", title: null },
            x: { aggregate: "sum", field: "revenue", type: "quantitative", title: "两年营收（万元）" },
            color: { condition: { param: "pick", value: "#3b6fb6" }, value: "#c3cbd9" },
          },
        },
        {
          width: 420,
          height: 240,
          mark: { type: "line", point: { size: 24 } },
          encoding: {
            x: { timeUnit: "yearmonth", field: "month", type: "temporal", title: null, axis: { format: "%y/%m" } },
            y: { aggregate: "sum", field: "revenue", type: "quantitative", title: "月营收" },
            detail: { field: "region" },
            color: { condition: { param: "pick", field: "region", type: "nominal", legend: null }, value: "#d5dae3" },
            opacity: { condition: { param: "pick", value: 1 }, value: 0.35 },
          },
        },
      ],
    },
  },
];
