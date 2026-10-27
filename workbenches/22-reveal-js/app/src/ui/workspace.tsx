import { Component, type ReactNode } from "react";
import type { ProjectSummary } from "../contracts/project";
import { useWorkbenchState, type AutosaveOptions } from "./autosave-client";
export { request, download } from "./requests";
export function useProjects<T>(
  seed: T,
  validate: (value: unknown) => T,
  defaultTitle: string,
  options: AutosaveOptions<T> = {},
) {
  return useWorkbenchState(seed, validate, defaultTitle, options);
}
export function ProjectPicker({
  items,
  id,
  disabled,
  onOpen,
}: {
  items: ProjectSummary[];
  id?: string;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <label className="project-picker">
      <span className="sr-only">打开已保存项目</span>
      <select
        aria-label="打开已保存项目"
        value={id ?? ""}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value) onOpen(event.target.value);
        }}
      >
        <option value="">当前草稿</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}
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
export class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
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
