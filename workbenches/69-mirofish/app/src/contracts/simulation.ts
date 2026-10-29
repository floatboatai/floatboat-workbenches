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
export const NATIVE_LIMITS = { bytes: 40 * 1024 * 1024, actions: 100_000 };
export function parseNative(text: string, fallbackPlatform = "") {
  if (text.length > NATIVE_LIMITS.bytes)
    throw new Error("结果超过40MB，请按轮次分段导出。");
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
  if (actions.length > NATIVE_LIMITS.actions)
    throw new Error("最多读取100000条动作，请按轮次拆分。");
  return { simulationId, actions, ignoredEvents: events };
}
export function nativeResult(simulationId: string, actions: Action[]) {
  return {
    success: true,
    data: { simulation_id: simulationId, all_actions: actions },
  };
}
export function content(a: Action) {
  for (const key of ["content", "quote_content", "text", "message", "title"])
    if (typeof a.action_args[key] === "string")
      return a.action_args[key] as string;
  return JSON.stringify(a.action_args);
}
/** Hand-written native records used by contract tests; not a simulation. */
export const nativeExample: Action[] = [
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
