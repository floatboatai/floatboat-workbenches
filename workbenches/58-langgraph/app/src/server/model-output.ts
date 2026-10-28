import { isRecord } from "../contracts/project.ts";
import { recordValue, type ReviewRecord } from "../contracts/review.ts";
const fields = ["subject", "owner", "dueDate", "summary", "checklist"].sort();
export function parseModelRecord(
  text: string,
  finishReason = "STOP",
): ReviewRecord {
  if (typeof text !== "string" || text.length > 100000)
    throw new Error("模型输出超出可处理范围，请缩短原始资料。");
  if (finishReason !== "STOP")
    throw new Error(
      "模型输出未完整结束，运行记录已保留，请缩短资料后新建任务。",
    );
  const trimmed = text.trim();
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  const json = fence ? fence[1].trim() : trimmed;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("模型返回的内容不是完整JSON，输入与运行记录已保留。");
  }
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== fields.join(",")
  )
    throw new Error("模型返回的交付字段不完整或包含未知字段。");
  return recordValue(value);
}

export function hostModelErrorMessage(code: string): string {
  const safe = /^[A-Z][A-Z0-9_]{1,79}$/.test(code)
    ? code
    : "HOST_REQUEST_FAILED";
  if (safe === "HOST_NOT_CONNECTED")
    return "Floatboat连接已断开，请打开客户端后检查连接；输入与运行记录已保留。";
  if (safe === "HOST_ACCOUNT_REQUIRED")
    return "请先在Floatboat登录账号；输入与运行记录已保留。";
  if (safe === "HOST_FEATURE_ACCESS_DENIED")
    return "当前账号没有此模型调用权限，请检查Floatboat授权；输入与运行记录已保留。";
  return `模型请求未完成（${safe}），请检查Floatboat模型设置。输入与运行记录已保留。`;
}
