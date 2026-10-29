// ABOUTME: AI 拟定规格条：提示词、候选规格采用/丢弃，以及 Host 模型未连接时的状态卡与重新检测。
import { useCallback, useEffect, useState } from "react";
import { isAppInfo, type AppInfo } from "../contracts/app";
import { text } from "./messages";
import { request, type ChartFiles } from "./workspace";

export function AiPanel({ project, onAdopt }: { project: ChartFiles; onAdopt: (spec: Record<string, unknown>) => void }) {
  const prompt = typeof project.draft.aiPrompt === "string" ? project.draft.aiPrompt : "";
  const [platform, setPlatform] = useState("");
  const [state, setState] = useState<"checking" | AppInfo["platform"]>("checking");
  const checkPlatform = useCallback(async () => {
    setState("checking");
    setPlatform("正在检测平台连接…");
    try {
      const info = await request("/api/app");
      const next = isAppInfo(info) ? info.platform : "unavailable";
      setState(next);
      setPlatform(text(next));
    } catch {
      setState("unavailable");
      setPlatform(text("unavailable"));
    }
  }, []);
  const offline = state === "not-connected" || (project.aiError?.host === true && state !== "connected");
  useEffect(() => {
    void checkPlatform();
  }, [checkPlatform]);
  const names = project.data.datasets.map((item) => item.name).join("、");

  return (
    <section id="ai-panel" className="ai-panel" aria-label="AI 拟定规格">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void project.generate(prompt);
        }}
      >
        <label htmlFor="prompt">描述想要的图表</label>
        <input
          id="prompt"
          name="prompt"
          maxLength={12000}
          autoComplete="off"
          required
          value={prompt}
          onChange={(event) => project.setDraft((old) => ({ ...old, aiPrompt: event.target.value }))}
          placeholder={names ? `例如：用 ${project.data.datasets[0]?.name} 比较各城市每月降水量…` : "例如：比较四个渠道本周的有效线索…"}
        />
        <button type="submit" className="primary" disabled={project.aiBusy || state === "checking" || offline}>
          {project.aiBusy ? "正在生成…" : "生成候选规格"}
        </button>
      </form>
      {offline ? (
        <div className="status-card" role="alert">
          <strong>模型服务未连接</strong>
          <p>AI 拟定使用 Floatboat 的模型能力。独立本地预览没有连接 Floatboat 时无法生成；编辑、示例库、数据导入和导出都不受影响。</p>
          <p>处理：启动并登录 Floatboat 桌面端，在「设置 → 模型」中启用模型，再从 Floatboat 打开本工作台（或保持本地预览运行），然后点击“重新检测”。</p>
          <div className="status-row">
            <button type="button" onClick={() => void checkPlatform()}>
              重新检测
            </button>
            <span role="status">{platform}</span>
          </div>
        </div>
      ) : (
        <p className="hint">
          {project.aiError ? (
            <span role="alert" className="error-text">
              {project.aiError.message}
            </span>
          ) : (
            `候选规格会先显示在这里，不会自动覆盖当前规格。${names ? `模型会看到数据集 ${names} 的字段与前 3 行样例。` : ""}`
          )}{" "}
          <span className="platform" role="status">
            {platform}
          </span>
        </p>
      )}
      {project.suggestion ? (
        <div className="candidate">
          <pre translate="no">{JSON.stringify(project.suggestion.spec, null, 2)}</pre>
          <div className="candidate-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (project.suggestion) onAdopt(project.suggestion.spec);
                project.discardSuggestion();
              }}
            >
              采用候选规格
            </button>
            <button type="button" onClick={project.discardSuggestion}>
              丢弃
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
