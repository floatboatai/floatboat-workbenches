import { Component, type ReactNode } from "react";

export class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="editor-loading" role="alert">
          <p>编辑器加载失败。已保存的画布仍在，请刷新页面重试。</p>
          <button onClick={() => location.reload()}>刷新编辑器</button>
        </section>
      );
    return this.props.children;
  }
}
