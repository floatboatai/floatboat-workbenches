// ABOUTME: 产品自有的页面外壳辅助：渲染失败时保留已保存内容并提供刷新。
import { Component, type ReactNode } from "react";
export class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="render-error">
        <p>校样界面加载失败，已保存的设计与草稿仍在。</p>
        <button type="button" onClick={() => location.reload()}>
          刷新重试
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
