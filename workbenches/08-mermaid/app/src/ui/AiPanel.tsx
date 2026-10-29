// ABOUTME: AI 起草条：提示词、候选稿采用/丢弃，以及 Host 模型未连接时的状态卡与重新检测。
import { useCallback, useEffect, useState } from "react";
import { isAppInfo, type AppInfo } from "../contracts/app";
import { text } from "./messages";
import { request, type useDiagramFiles } from "./workspace";

export function AiPanel({
  project,
}: {
  project: ReturnType<typeof useDiagramFiles>;
}) {
  const prompt =
    typeof project.draft.aiPrompt === "string" ? project.draft.aiPrompt : "";
  const [platform, setPlatform] = useState("");
  const [state, setState] = useState<"checking" | AppInfo["platform"]>(
    "checking",
  );
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
  const offline =
    state === "not-connected" ||
    (project.aiError?.host === true && state !== "connected");
  useEffect(() => {
    void checkPlatform();
  }, [checkPlatform]);

  return (
    <section id="ai-panel" className="ai-panel" aria-label="AI 起草">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void project.generate(prompt);
        }}
      >
        <label htmlFor="prompt">描述想画的图</label>
        <input
          id="prompt"
          name="prompt"
          maxLength={12000}
          autoComplete="off"
          required
          value={prompt}
          onChange={(event) =>
            project.setDraft((old) => ({
              ...old,
              aiPrompt: event.target.value,
            }))
          }
          placeholder="例如：员工报销从提交到打款的审批流程…"
        />
        <button
          type="submit"
          className="primary"
          disabled={project.aiBusy || state === "checking" || offline}
        >
          {project.aiBusy ? "正在起草…" : "生成候选稿"}
        </button>
      </form>
      {offline ? (
        <div className="status-card" role="alert">
          <strong>模型服务未连接</strong>
          <p>
            AI 起草使用 Floatboat 的模型能力。独立本地预览没有连接 Floatboat
            时无法生成； 编辑、模板、导入和导出都不受影响。
          </p>
          <p>
            处理：启动并登录 Floatboat 桌面端，在「设置 → 模型」中启用模型，再从
            Floatboat 打开本工作台（或保持本地预览运行），然后点击“重新检测”。
          </p>
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
            "生成内容先作为候选稿显示，不会自动覆盖当前源码。"
          )}{" "}
          <span className="platform" role="status">
            {platform}
          </span>
        </p>
      )}
      {project.suggestion ? (
        <div className="candidate">
          <pre>{project.suggestion.source}</pre>
          <div className="candidate-actions">
            <button
              type="button"
              className="primary"
              onClick={project.applySuggestion}
            >
              采用候选稿
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
