import { Component, type ReactNode } from "react";
export { request, download } from "./requests";

export function Notice({ error, notice }: { error: string; notice: string }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : notice ? (
    <p className="notice" role="status">
      {notice}
    </p>
  ) : null;
}

export class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="render-error">
        <p>画布加载失败，已保存的内容仍在。</p>
        <button type="button" onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
