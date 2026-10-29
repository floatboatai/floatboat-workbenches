// ABOUTME: 规则报告与数据导出：由推演指标生成可编辑的 Markdown 报告，并导出 CSV/JSONL 数据。
import type { SimResult } from "./engine.ts";
import { stanceLabel, type RunRecord, type Scenario } from "./scenario.ts";
import { content } from "./simulation.ts";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2);
const ENGINE_LABEL = { local: "本地规则推演", mirofish: "MiroFish 后端", import: "导入的 MiroFish 结果" } as const;

export function turningPoints(result: SimResult, count = 3) {
  const deltas = result.rounds.slice(1).map((r, i) => ({ round: r.round, delta: r.mean - result.rounds[i].mean, time: r.time }));
  return deltas
    .filter((d) => Math.abs(d.delta) >= 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.round - b.round)
    .slice(0, count)
    .sort((a, b) => a.round - b.round);
}
export function topPosts(result: SimResult, side: 1 | -1, count = 2) {
  const engagement = new Map<number, number>();
  for (const a of result.actions) {
    const id = Number(a.action_args.post_id ?? a.action_args.quoted_id);
    if (Number.isFinite(id) && a.action_type !== "CREATE_POST") engagement.set(id, (engagement.get(id) ?? 0) + 1);
  }
  return result.actions
    .map((a, i) => ({ a, s: result.actionStance[i] ?? 0 }))
    .filter(({ a, s }) => a.action_type === "CREATE_POST" && s * side > 0.2)
    .map(({ a, s }) => {
      const r = a.result as { post_id?: number } | null;
      return { a, s, n: engagement.get(Number(r?.post_id)) ?? 0 };
    })
    .sort((x, y) => y.n - x.n || x.a.round_num - y.a.round_num)
    .slice(0, count);
}

export function buildReport(s: Scenario, run: RunRecord, result: SimResult): string {
  const first = result.rounds[0],
    last = result.rounds[result.rounds.length - 1];
  const lexicon = result.stanceKind === "lexicon";
  const question = run.input?.question ?? s.question;
  const topic = run.input?.topic ?? s.topic;
  const lines: string[] = [];
  lines.push(`# ${topic || question || "群体推演"} · 推演报告`, "");
  lines.push(`> ${run.label} · ${ENGINE_LABEL[run.engine]} · ${result.rounds.length - 1} 轮 · ${result.agents.length} 个智能体 · ${result.actions.length} 条动作${run.fingerprint ? ` · 指纹 ${run.fingerprint}` : ""}`, "");
  lines.push("## 一、推演问题与设定", "");
  if (question) lines.push(`推演问题：${question}`, "");
  if (run.input) {
    const p = run.input.params;
    lines.push(
      `- 随机种子 \`${p.seed}\`，每轮 ${p.minutesPerRound} 分钟，自 ${p.start.replace("T", " ")} 起`,
      `- 平台：${p.platform === "parallel" ? "Twitter 与 Reddit 并行" : p.platform}；信任阈值 ${p.confidence}，影响速率 ${p.influenceRate}，回音室强度 ${p.echoChamber}，逆火强度 ${p.backfire}`,
      `- 事件注入 ${run.input.events.length} 项；议题要点：${run.input.aspects.map((a) => `${a.label}（${a.lean > 0 ? "利好" : "关切"}）`).join("、") || "未设置"}`,
      "",
    );
  } else lines.push(`- 来源：${run.sourceName || "导入文件"}`, "");
  lines.push("## 二、主要结论", "");
  if (lexicon)
    lines.push("> 立场为根据动作文本的词典估计，不是 MiroFish 模型给出的立场，仅用于发现趋势线索。", "");
  lines.push(
    `- 结束时 **${pct(last.support)} 支持、${pct(last.neutral)} 中立、${pct(last.oppose)} 反对**（开始时 ${pct(first.support)} / ${pct(first.neutral)} / ${pct(first.oppose)}）。`,
    `- 平均立场由 ${signed(first.mean)} 变为 ${signed(last.mean)}，整体${stanceLabel(last.mean)}；净变化 ${signed(last.mean - first.mean)}。`,
    `- 极化指数（4×支持占比×反对占比）由 ${first.polarization.toFixed(2)} 变为 ${last.polarization.toFixed(2)}，${last.polarization > first.polarization + 0.05 ? "两极分化加深" : last.polarization < first.polarization - 0.05 ? "分歧有所收敛" : "分化程度大体稳定"}。`,
  );
  if (run.robustness) {
    const r = run.robustness;
    const lo = Math.min(...r.endSupport),
      hi = Math.max(...r.endSupport);
    lines.push(`- 稳健性：另用 ${r.seeds.length} 个随机种子重跑，结束时支持占比在 ${pct(lo)}–${pct(hi)} 之间，平均立场 ${signed(Math.min(...r.endMean))} 至 ${signed(Math.max(...r.endMean))}。`);
  }
  lines.push("");
  lines.push("## 三、关键转折", "");
  const turns = turningPoints(result);
  if (!turns.length) lines.push("没有出现明显的单轮立场跳变。", "");
  for (const t of turns) {
    const ev = result.events.filter((e) => Math.abs(e.round - t.round) <= 1);
    lines.push(`- 第 ${t.round} 轮${t.time ? `（${t.time.replace("T", " ").slice(0, 16)}）` : ""}：平均立场 ${signed(t.delta)}${ev.length ? `，与事件“${ev.map((e) => e.title).join("”“")}”同期` : ""}。`);
  }
  if (result.events.length) {
    lines.push("", "事件注入的即时效果：", "");
    lines.push("| 轮次 | 事件 | 触达智能体 | 平均立场变化 |", "| --- | --- | --- | --- |");
    for (const e of result.events) lines.push(`| ${e.round} | ${e.title} | ${e.affected} | ${signed(e.after - e.before)} |`);
  }
  lines.push("");
  const types = Object.keys(last.byType);
  if (types.length) {
    lines.push("## 四、群体分化", "", "| 类型 | 开始 | 结束 | 变化 |", "| --- | --- | --- | --- |");
    for (const t of types) {
      const a = first.byType[t] ?? 0,
        b = last.byType[t];
      lines.push(`| ${t} | ${signed(a)} | ${signed(b)} | ${signed(b - a)} |`);
    }
    lines.push("");
  }
  lines.push("## 五、关键角色", "");
  const loud = [...result.agents].sort((a, b) => b.received - a.received || a.id - b.id).slice(0, 5);
  const moved = [...result.agents].sort((a, b) => Math.abs(b.end - b.start) - Math.abs(a.end - a.start) || a.id - b.id).slice(0, 3);
  lines.push(`- 获得互动最多：${loud.map((a) => `${a.name}（${a.received}次）`).join("、")}。`);
  if (!lexicon) lines.push(`- 立场变化最大：${moved.map((a) => `${a.name}（${signed(a.start)} → ${signed(a.end)}）`).join("、")}。`);
  lines.push("");
  lines.push("## 六、代表性言论", "");
  for (const [label, side] of [["支持方", 1], ["反对方", -1]] as const) {
    const posts = topPosts(result, side);
    lines.push(`**${label}**`, "");
    if (!posts.length) lines.push("- （本次推演中没有明确的此方帖子）");
    for (const p of posts) lines.push(`- 第 ${p.a.round_num} 轮 · ${p.a.agent_name}：${content(p.a)}（互动 ${p.n}）`);
    lines.push("");
  }
  lines.push("## 七、不确定性与局限", "");
  lines.push(
    lexicon
      ? "- 立场来自词典估计，讽刺、反语和引用会被误判；活动量与时间线是原始动作的精确统计。"
      : "- 本地推演是基于规则与概率的意见动力学模型（有界信任 + 推荐流 + 事件注入），帖子文本由模板生成，用于比较不同假设下的趋势，不是对现实的预测。",
    "- 结论对初始立场、影响力与事件推力的设定敏感，建议调整参数或种子重跑后对照。",
    "- 智能体与关系来自种子资料的抽取和人工修订，未出现在资料中的相关方没有被模拟。",
  );
  if (s.notes.trim()) lines.push("", "## 附：研究者备注", "", s.notes.trim());
  return lines.join("\n") + "\n";
}

const csvCell = (v: unknown) => {
  const t = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export const csv = (rows: unknown[][]) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
export function roundsCsv(result: SimResult) {
  const types = Object.keys(result.rounds[0]?.byType ?? {});
  return csv([
    ["round", "time", "mean", "sd", "support", "neutral", "oppose", "polarization", "posts", "comments", "likes", "reposts", "active", ...types.map((t) => "mean_" + t)],
    ...result.rounds.map((r) => [r.round, r.time, r.mean, r.sd, r.support, r.neutral, r.oppose, r.polarization, r.posts, r.comments, r.likes, r.reposts, r.active, ...types.map((t) => r.byType[t] ?? "")]),
  ]);
}
export function agentsCsv(result: SimResult) {
  return csv([
    ["agent_id", "name", "type", "stance_start", "stance_end", "posts", "engagement_received", "followers"],
    ...result.agents.map((a) => [a.id, a.name, a.type, a.start, a.end, a.posts, a.received, a.followers]),
  ]);
}
export function actionsJsonl(result: SimResult) {
  return result.actions.map((a) => JSON.stringify(a)).join("\n") + "\n";
}
export function graphJson(s: Scenario) {
  return JSON.stringify({ entities: s.entities, relations: s.relations }, null, 2);
}
