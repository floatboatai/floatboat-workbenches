import { isRecord, boundedText } from "./project.ts";
export type Action = {
  round_num: number;
  timestamp: string;
  platform: "twitter" | "reddit";
  agent_id: number;
  agent_name: string;
  action_type: string;
  action_args: Record<string, unknown>;
  result: unknown;
  success: boolean;
};
export type Review = {
  simulationId: string;
  origin: "example" | "file" | "service";
  sourceName: string;
  background: string;
  assumptions: string;
  conclusion: string;
  actions: Action[];
  annotations: Record<string, { note: string; reviewed: boolean }>;
  actors: Record<string, string>;
};
function jsonLimit(v: unknown, max: number) {
  const text = JSON.stringify(v);
  if (typeof text !== "string" || text.length > max)
    throw new Error("动作内容过大，请按轮次拆分导出。");
  return v;
}
export function actionValue(v: unknown, platform = ""): Action {
  if (!isRecord(v)) throw new Error("动作记录必须是对象");
  const round = v.round_num ?? v.round ?? 0,
    p = v.platform || platform;
  if (
    typeof round !== "number" ||
    !Number.isInteger(round) ||
    round < 0 ||
    round > 100000 ||
    typeof v.agent_id !== "number" ||
    !Number.isInteger(v.agent_id) ||
    v.agent_id < 0 ||
    !["twitter", "reddit"].includes(String(p)) ||
    !isRecord(v.action_args ?? {})
  )
    throw new Error(
      "动作缺少有效轮次、平台或角色编号。JSONL未带平台时请先选择日志平台。",
    );
  if (v.success !== undefined && typeof v.success !== "boolean")
    throw new Error("动作success必须为布尔值");
  return {
    round_num: round,
    timestamp: boundedText(v.timestamp ?? "", 100),
    platform: p as Action["platform"],
    agent_id: v.agent_id,
    agent_name: boundedText(v.agent_name ?? "", 200),
    action_type: boundedText(v.action_type ?? "", 100),
    action_args: jsonLimit(v.action_args ?? {}, 30000) as Record<
      string,
      unknown
    >,
    result: jsonLimit(v.result ?? null, 30000),
    success: v.success ?? true,
  };
}
export const actorKey = (a: Action) => a.platform + ":" + a.agent_id;
export const actionKey = (a: Action, i: number) =>
  `${i}:${a.platform}:${a.agent_id}:${a.round_num}`;
export function reviewValue(v: unknown): Review {
  if (
    !isRecord(v) ||
    !Array.isArray(v.actions) ||
    v.actions.length > 500 ||
    !["example", "file", "service"].includes(String(v.origin)) ||
    !isRecord(v.annotations) ||
    !isRecord(v.actors)
  )
    throw new Error("复核工程格式无效，最多500条动作。");
  const actions = v.actions.map((a) => actionValue(a)),
    keys = new Set(actions.map(actionKey)),
    actors = new Set(actions.map(actorKey));
  const annotations: Review["annotations"] = {},
    profiles: Review["actors"] = {};
  for (const [k, value] of Object.entries(v.annotations)) {
    if (!keys.has(k) || !isRecord(value) || typeof value.reviewed !== "boolean")
      throw new Error("批注与动作不匹配");
    annotations[k] = {
      note: boundedText(value.note, 5000),
      reviewed: value.reviewed,
    };
  }
  for (const [k, value] of Object.entries(v.actors)) {
    if (!actors.has(k)) throw new Error("角色说明与来源不匹配");
    profiles[k] = boundedText(value, 5000);
  }
  const out = {
    simulationId: boundedText(v.simulationId, 120),
    origin: v.origin as Review["origin"],
    sourceName: boundedText(v.sourceName, 200),
    background: boundedText(v.background, 15000),
    assumptions: boundedText(v.assumptions, 15000),
    conclusion: boundedText(v.conclusion, 15000),
    actions,
    annotations,
    actors: profiles,
  };
  jsonLimit(out, 850000);
  return out;
}
export function parseNative(text: string, fallbackPlatform = "") {
  if (text.length > 850000) throw new Error("结果超过850KB，请分段导出。");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((line, i) => {
        try {
          return JSON.parse(line);
        } catch {
          throw new Error(`第${i + 1}行不是完整JSON`);
        }
      });
  }
  let simulationId = "",
    list: unknown = raw;
  if (isRecord(raw) && ("agent_id" in raw || "event_type" in raw)) list = [raw];
  else if (isRecord(raw)) {
    if (raw.success === false)
      throw new Error("这是上游失败响应，不是模拟结果。");
    const data = isRecord(raw.data) ? raw.data : raw;
    simulationId =
      typeof data.simulation_id === "string" ? data.simulation_id : "";
    list = data.all_actions ?? data.actions ?? data.recent_actions;
    if (!Array.isArray(list))
      throw new Error(
        "请选择完整actions或run-status/detail结果；单独状态文件不含完整动作。",
      );
    if (data.recent_actions === list)
      throw new Error(
        "recent_actions只含近期动作，请导出all_actions或actions。",
      );
  }
  if (!Array.isArray(list)) throw new Error("未找到动作数组");
  const events = list.filter((v) => isRecord(v) && "event_type" in v).length;
  const actions = list
    .filter((v) => !(isRecord(v) && "event_type" in v))
    .map((v) => actionValue(v, fallbackPlatform));
  if (actions.length > 500)
    throw new Error("最多读取500条动作，请按轮次拆分。");
  return { simulationId, actions, ignoredEvents: events };
}
export function fromNative(
  text: string,
  name: string,
  platform = "",
  origin: Review["origin"] = "file",
): Review {
  const r = parseNative(text, platform);
  return reviewValue({
    simulationId: r.simulationId,
    origin,
    sourceName: name,
    background: "",
    assumptions: "",
    conclusion: "",
    actions: r.actions,
    annotations: {},
    actors: {},
  });
}
export function nativeResult(v: Review) {
  return {
    success: true,
    data: { simulation_id: v.simulationId, all_actions: v.actions },
  };
}
export function content(a: Action) {
  for (const key of ["content", "text", "message", "title"])
    if (typeof a.action_args[key] === "string")
      return a.action_args[key] as string;
  return JSON.stringify(a.action_args);
}
export function markdown(v: Review) {
  return (
    `# ${v.simulationId || "情景复核"}\n\n来源：${v.sourceName}\n\n## 背景\n${v.background}\n\n## 假设与限制\n${v.assumptions}\n\n## 人工结论\n${v.conclusion}\n\n## 动作审阅\n\n` +
    v.actions
      .map((a, i) => {
        const n = v.annotations[actionKey(a, i)];
        return `### 轮次${a.round_num} · ${a.agent_name || a.agent_id} · ${a.action_type}\n\n${content(a)}\n\n执行：${a.success ? "成功" : "失败"} / 审阅：${n?.reviewed ? "已复核" : "待复核"}\n\n${n?.note ?? ""}\n`;
      })
      .join("\n")
  );
}
const example: Action[] = [
  {
    round_num: 1,
    timestamp: "2026-10-27T09:00:00",
    platform: "reddit",
    agent_id: 0,
    agent_name: "社区组织者",
    action_type: "CREATE_POST",
    action_args: {
      content: "如果公园增加周末市集，你更关心噪声、交通还是摊位种类？",
    },
    result: "示例帖子1",
    success: true,
  },
  {
    round_num: 1,
    timestamp: "2026-10-27T09:15:00",
    platform: "reddit",
    agent_id: 1,
    agent_name: "附近居民",
    action_type: "CREATE_COMMENT",
    action_args: {
      content: "希望限制扩音设备，并保留日常通行空间。",
      post_id: 1,
    },
    result: "示例回复1",
    success: true,
  },
  {
    round_num: 2,
    timestamp: "2026-10-27T10:00:00",
    platform: "twitter",
    agent_id: 2,
    agent_name: "手作摊主",
    action_type: "CREATE_POST",
    action_args: {
      content: "愿意尝试预约制摊位，提前说明垃圾分类和收摊时间。",
    },
    result: "示例帖子2",
    success: true,
  },
  {
    round_num: 2,
    timestamp: "2026-10-27T10:15:00",
    platform: "reddit",
    agent_id: 0,
    agent_name: "社区组织者",
    action_type: "CREATE_POST",
    action_args: { content: "将试办范围缩小到上午，并设置安静区域。" },
    result: null,
    success: true,
  },
];
export const seed: Review = {
  simulationId: "示例 · 周末市集",
  origin: "example",
  sourceName: "人工编写的原生格式示例",
  background: "讨论社区公园周末市集的组织方式。",
  assumptions:
    "这些动作仅用于演示复核流程，未运行模型模拟；不代表真实居民意见。",
  conclusion: "",
  actions: example,
  annotations: {},
  actors: {},
};
