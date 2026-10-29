// ABOUTME: 工作台通用的提示条与渲染兜底；文件导航由推演档案自己维护。
import { Component, type ReactNode } from "react";
export function Notice({ error, notice, onClose }: { error: string; notice: string; onClose: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={"notice" + (error ? " error" : "")} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button type="button" className="ghost" aria-label="关闭提示" onClick={onClose}>
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
        <p>界面加载失败，已保存的推演仍在。</p>
        <button onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
