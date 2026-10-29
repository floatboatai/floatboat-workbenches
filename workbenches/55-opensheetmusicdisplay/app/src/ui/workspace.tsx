// ABOUTME: 工作台通用的提示条与渲染错误边界；文件导航由乐谱库菜单负责。
import { Component, type ReactNode } from "react";
export { request, download } from "./requests";

export function Notice({ error, notice, onDismiss }: { error: string; notice: string; onDismiss: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={`notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      <p>{error || notice}</p>
      <button type="button" className="quiet" onClick={onDismiss} aria-label="关闭提示">
        关闭
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
        <p>谱面组件加载失败，已保存的审校与批注不受影响。</p>
        <button type="button" onClick={() => location.reload()}>
          刷新重试
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
