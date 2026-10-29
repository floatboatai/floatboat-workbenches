// ABOUTME: 页面通用件：请求与下载、提示条、渲染错误边界。文件导航由文稿菜单负责。
import { Component, type ReactNode } from "react";
export { request, download } from "./requests";

export function Notice({ error, notice, onClose }: { error: string; notice: string; onClose: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button type="button" className="ghost small" onClick={onClose} aria-label="关闭提示">
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
        <p>编辑器加载失败，已保存内容仍在。</p>
        <button onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
