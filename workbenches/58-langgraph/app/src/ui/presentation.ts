import type { RunView } from "../contracts/review";
export const statusLabels: Record<RunView["status"], string> = {
  running: "执行中",
  waiting: "等待人工复核",
  completed: "已交付",
  rejected: "已退回",
  failed: "执行失败",
  interrupted: "进程已中断",
  cancelled: "已取消",
};
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
