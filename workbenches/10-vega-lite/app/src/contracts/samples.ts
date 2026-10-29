// ABOUTME: 内置示例数据集（确定性生成的普通演示数据）：城市日气象、区域品类销售、门店经营指标。
import { parseDataset, type DatasetRef } from "./datasets.ts";

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (value: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
const pad = (n: number) => String(n).padStart(2, "0");

function weatherCsv(): string {
  const next = random(20240101);
  const gauss = () => {
    let s = 0;
    for (let i = 0; i < 4; i++) s += next();
    return (s - 2) * 1.7;
  };
  const cities = [
    { name: "北京", mean: 18.5, amp: 15.5, spread: 10.5, wet: 0.08, summerWet: 0.42, rain: 9 },
    { name: "上海", mean: 21, amp: 11.5, spread: 7, wet: 0.28, summerWet: 0.45, rain: 10 },
    { name: "广州", mean: 27, amp: 7, spread: 7.5, wet: 0.2, summerWet: 0.6, rain: 15 },
  ];
  const lines = ["date,city,temp_max,temp_min,precipitation,wind,weather"];
  for (const city of cities) {
    const start = Date.UTC(2024, 0, 1);
    for (let day = 0; day < 366; day++) {
      const date = new Date(start + day * 86400000);
      const season = -Math.cos((2 * Math.PI * (day - 18)) / 366);
      const max = city.mean + city.amp * season + gauss() * 2.2;
      const min = max - city.spread + gauss() * 1.3;
      const summer = Math.max(0, Math.sin((2 * Math.PI * (day - 100)) / 366));
      const wetChance = city.wet + (city.summerWet - city.wet) * summer;
      const rainy = next() < wetChance;
      const precipitation = rainy ? round(-Math.log(1 - next()) * city.rain * (0.6 + summer), 1) : 0;
      const wind = round(1.2 + next() * 3.6 + (season < -0.6 ? 1 : 0), 1);
      const weather = rainy
        ? max < 2
          ? "雪"
          : "雨"
        : next() < (season < 0 ? 0.14 : 0.04)
          ? "雾"
          : next() < 0.45
            ? "多云"
            : "晴";
      lines.push(
        [
          `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
          city.name,
          round(max),
          round(min),
          precipitation,
          wind,
          weather,
        ].join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}

function salesCsv(): string {
  const next = random(7302);
  const regions = [
    { name: "华东", base: 1.35 },
    { name: "华南", base: 1.1 },
    { name: "华北", base: 0.95 },
    { name: "西南", base: 0.7 },
    { name: "西北", base: 0.42 },
  ];
  const categories = [
    { name: "家电", base: 520, ticket: 1680, peak: [6, 11] },
    { name: "数码", base: 460, ticket: 2350, peak: [9, 11] },
    { name: "服饰", base: 380, ticket: 268, peak: [3, 10] },
    { name: "食品", base: 300, ticket: 96, peak: [1, 2] },
    { name: "家居", base: 260, ticket: 455, peak: [5, 11] },
  ];
  const lines = ["month,region,category,revenue,orders,return_rate"];
  for (let year = 2023; year <= 2024; year++)
    for (let month = 1; month <= 12; month++)
      for (const region of regions)
        for (const category of categories) {
          const growth = year === 2024 ? 1.08 + (month / 12) * 0.04 : 1;
          const seasonal =
            (category.peak.includes(month) ? 1.32 : 1) * (month === 11 ? 1.18 : 1) * (month === 2 ? 0.86 : 1);
          const revenue = round(category.base * region.base * growth * seasonal * (0.9 + next() * 0.2), 1);
          const orders = Math.round((revenue * 10000) / (category.ticket * (0.92 + next() * 0.16)));
          const returns = round(
            (category.name === "服饰" ? 0.065 : category.name === "食品" ? 0.008 : 0.025) * (0.75 + next() * 0.5),
            3,
          );
          lines.push([`${year}-${pad(month)}`, region.name, category.name, revenue, orders, returns].join(","));
        }
  return lines.join("\n") + "\n";
}

function storesCsv(): string {
  const next = random(160);
  const tiers = [
    { name: "一线", cities: ["上海", "北京", "深圳", "广州"], visitors: 2.6, ticket: 58 },
    { name: "新一线", cities: ["成都", "杭州", "武汉", "南京", "西安"], visitors: 2.2, ticket: 49 },
    { name: "二线", cities: ["厦门", "合肥", "昆明", "济南"], visitors: 1.8, ticket: 43 },
    { name: "三线", cities: ["洛阳", "绵阳", "芜湖", "柳州"], visitors: 1.45, ticket: 37 },
  ];
  const lines = ["store_id,city,tier,area,staff,daily_visitors,avg_ticket,monthly_revenue,rating,opened"];
  for (let i = 1; i <= 160; i++) {
    const tier = tiers[Math.min(3, Math.floor(next() * 4.2))];
    const city = tier.cities[Math.floor(next() * tier.cities.length)];
    const area = Math.round(70 + next() ** 1.4 * 300);
    const staff = Math.max(3, Math.round(area / 28 + (next() - 0.5) * 4));
    const visitors = Math.round(area * tier.visitors * (0.75 + next() * 0.5) + 60);
    const ticket = round(tier.ticket * (0.85 + next() * 0.3), 1);
    const revenue = round((visitors * ticket * 30) / 10000, 1);
    const rating = round(Math.min(4.9, 3.5 + (staff / (area / 25)) * 0.55 + next() * 0.6), 1);
    const opened = 2014 + Math.floor(next() * 11);
    lines.push(
      [`S${String(i).padStart(3, "0")}`, city, tier.name, area, staff, visitors, ticket, revenue, rating, opened].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export interface SampleDataset {
  id: string;
  name: string;
  file: string;
  title: string;
  text: () => string;
}
export const sampleDatasets: SampleDataset[] = [
  { id: "sample-weather-2024", name: "weather", file: "weather.csv", title: "三城日气象 2024", text: weatherCsv },
  { id: "sample-sales-2023", name: "sales", file: "sales.csv", title: "区域品类月销售", text: salesCsv },
  { id: "sample-stores-160", name: "stores", file: "stores.csv", title: "160 家门店经营指标", text: storesCsv },
];

const cache = new Map<string, { text: string; ref: DatasetRef }>();
/** 生成示例数据集的文本与引用（结果缓存）。 */
export function sampleDataset(name: string): { text: string; ref: DatasetRef } {
  const hit = cache.get(name);
  if (hit) return hit;
  const sample = sampleDatasets.find((item) => item.name === name);
  if (!sample) throw new Error("示例数据不存在。");
  const text = sample.text();
  const table = parseDataset(text, "csv");
  const entry = {
    text,
    ref: {
      id: sample.id,
      name: sample.name,
      file: sample.file,
      format: "csv" as const,
      bytes: new TextEncoder().encode(text).length,
      rows: table.rows.length,
      columns: table.columns,
    },
  };
  cache.set(name, entry);
  return entry;
}
