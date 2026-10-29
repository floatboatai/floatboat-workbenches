// ABOUTME: 评测台自有的页面辅助：自动保存工作副本、提示条与渲染兜底。
import { Component, type ReactNode } from "react";
import { useWorkbenchState, type AutosaveOptions } from "./autosave-client";
export { request, download } from "./requests";

export function useProjects<T>(seed: T, validate: (value: unknown) => T, defaultTitle: string, options: AutosaveOptions<T> = {}) {
  return useWorkbenchState(seed, validate, defaultTitle, options);
}
export function Notice({ error, notice, onClose }: { error: string; notice: string; onClose: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button className="ghost small" onClick={onClose} aria-label="关闭提示">
        ×
      </button>
    </div>
  );
}
export class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="render-error">
        <p>界面加载失败，已保存内容仍在。</p>
        <button onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
