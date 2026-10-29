// ABOUTME: 两个可选外部通道的状态：Floatboat 模型（起草大纲）与 Presenton 服务（远端成稿）；都可重新检查，失败只影响各自按钮。
import { useCallback, useEffect, useState } from "react";
import { isRecord } from "../contracts/project";
import { request } from "./requests";

export type ChannelState = { phase: "checking" | "ready" | "off"; message: string; origin?: string; configured?: boolean };

export function useModelStatus() {
  const [state, setState] = useState<ChannelState>({ phase: "checking", message: "正在检查 Floatboat 模型…" });
  const check = useCallback(async () => {
    setState((s) => ({ ...s, phase: "checking", message: "正在检查 Floatboat 模型…" }));
    try {
      const v = await request("/api/model-status");
      if (!isRecord(v) || typeof v.available !== "boolean" || typeof v.message !== "string") throw new Error("模型状态无效。");
      setState({ phase: v.available ? "ready" : "off", message: v.message });
    } catch (e) {
      setState({ phase: "off", message: e instanceof Error ? e.message : "无法检查模型状态。" });
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  return { state, check };
}

export function usePresentonStatus() {
  const [state, setState] = useState<ChannelState>({ phase: "checking", message: "正在读取 Presenton 配置…" });
  const read = useCallback(async (probe: boolean) => {
    setState((s) => ({ ...s, phase: "checking", message: probe ? "正在连接 Presenton…" : "正在读取 Presenton 配置…" }));
    try {
      const v = await request(probe ? "/api/presenton/check" : "/api/presenton", probe ? { method: "POST" } : {});
      if (!isRecord(v) || typeof v.configured !== "boolean" || typeof v.message !== "string") throw new Error("Presenton 状态无效。");
      const reachable = v.reachable === true;
      setState({
        phase: reachable ? "ready" : "off",
        configured: v.configured,
        origin: typeof v.origin === "string" ? v.origin : "",
        message: v.configured && v.reachable === null ? `${v.message}点“重新检查”确认可用。` : v.message,
      });
    } catch (e) {
      setState({ phase: "off", configured: false, message: e instanceof Error ? e.message : "无法读取 Presenton 状态。" });
    }
  }, []);
  useEffect(() => {
    void read(false);
  }, [read]);
  return { state, check: () => read(true) };
}
