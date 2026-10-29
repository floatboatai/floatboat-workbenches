// ABOUTME: 可选的 Floatboat Host 模型通道：查询 llm 能力状态、按资料起草大纲候选；Host 未连接时给出可读说明，不影响本地生成。
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project.ts";
import { restoreDeck, blank, type OutlineItem } from "../contracts/model.ts";
import { outlinePrompt, parseModelOutline } from "../contracts/model-outline.ts";

export type HostModel = {
  llm: {
    generateText(
      input: { prompt: string; system?: string; maxOutputTokens?: number; temperature?: number },
      options?: { timeoutMs?: number; requestId?: string },
    ): Promise<{ text: string; model: string; finishReason: string }>;
  };
  capabilities: { list(input: { domain: string }): Promise<{ capabilities: { operation: string; status: string }[] }> };
};

export function hostMessage(e: unknown): string {
  if (e instanceof WorkbenchHostError || (isRecord(e) && typeof (e as { code?: unknown }).code === "string")) {
    const raw = String((e as { code: string }).code);
    const code = /^[A-Z0-9_]{1,80}$/.test(raw) ? raw : "HOST_ERROR";
    return code === "HOST_NOT_CONNECTED"
      ? "未连接 Floatboat：打开并登录 Floatboat 桌面端后点“重新检查”。本地生成不受影响。"
      : `模型请求未完成（${code}）。资料与大纲已保留，可改用本地生成。`;
  }
  return e instanceof Error ? e.message : "模型请求失败。";
}

export function createModelChannel(host: HostModel) {
  return {
    async status(): Promise<{ available: boolean; message: string }> {
      try {
        const r = await host.capabilities.list({ domain: "llm" });
        const available = r.capabilities.some((x) => x.operation === "generateText" && x.status === "available");
        return {
          available,
          message: available ? "Floatboat 模型可用：起草会发送资料正文，可能产生模型费用。" : "Floatboat 已连接，但没有可用的文本模型。",
        };
      } catch (e) {
        return { available: false, message: hostMessage(e) };
      }
    },
    async draft(body: unknown, requestId?: string): Promise<{ items: OutlineItem[]; model: string }> {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      const brief = restoreDeck({ ...blank, brief: body.brief }).brief;
      if (brief.source.trim().length < 20) throw new Error("资料太少，至少写几句再起草。");
      const { system, prompt } = outlinePrompt(brief);
      let result;
      try {
        result = await host.llm.generateText({ system, prompt, maxOutputTokens: 8000, temperature: 0.3 }, { timeoutMs: 150000, requestId });
      } catch (e) {
        throw new Error(hostMessage(e));
      }
      if (result.finishReason === "length") throw new Error("模型输出被截断，请减少目标页数后重试。");
      return { items: parseModelOutline(result.text), model: result.model };
    },
  };
}
