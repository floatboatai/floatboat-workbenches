import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  Component,
} from "react";
import { getPageConnection } from "./connection";
import {
  isRecord,
  isSummary,
  type Project,
  type ProjectSummary,
} from "../contracts/project";
export async function request(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  if (
    typeof options.body === "string" &&
    new TextEncoder().encode(options.body).length > 1500000
  )
    throw new Error("请求过大，请减少内容。");
  const page = await getPageConnection();
  const response = await page.fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      isRecord(value) &&
      isRecord(value.error) &&
      typeof value.error.message === "string"
        ? value.error.message
        : "请求失败，请重试。",
    );
  return value;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
export function useProjects<T>(
  seed: T,
  validate: (value: unknown) => T,
  defaultTitle: string,
  externalDirty = false,
) {
  const [items, setItems] = useState<ProjectSummary[]>([]),
    [current, setCurrent] = useState<Project<T> | null>(null),
    [data, setData] = useState<T>(() => structuredClone(seed)),
    [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [aiBusy, setAiBusy] = useState(false),
    [suggestion, setSuggestion] = useState<T | null>(null);
  const epoch = useRef(0);
  const dirty =
    externalDirty ||
    (current
      ? title !== current.title ||
        JSON.stringify(data) !== JSON.stringify(current.data)
      : JSON.stringify(data) !== JSON.stringify(seed) ||
        title !== defaultTitle);
  const report = (error: unknown) =>
    setError(error instanceof Error ? error.message : "操作失败，请重试。");
  const refresh = useCallback(async () => {
    const result = await request("/api/projects");
    if (!Array.isArray(result) || !result.every(isSummary))
      throw new Error("项目列表无效。");
    setItems(result);
  }, []);
  useEffect(() => {
    let active = true;
    void refresh()
      .catch((error) => {
        if (active) report(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      epoch.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const decode = (value: unknown): Project<T> => {
    if (!isSummary(value) || !isRecord(value))
      throw new Error("项目响应无效。");
    return { ...value, data: validate(value.data) };
  };
  async function save(override?: T) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = override ?? data;
      const result = decode(
        await request(
          current ? `/api/projects/${current.id}` : "/api/projects",
          {
            method: current ? "PUT" : "POST",
            body: JSON.stringify({
              title,
              data: payload,
              revision: current?.revision,
            }),
          },
        ),
      );
      setCurrent(result);
      if (override !== undefined) setData(payload);
      setNotice("已保存");
      await refresh();
      return result;
    } catch (error) {
      report(error);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (
      dirty &&
      !confirm("有未保存的修改或未应用的 JSON，确定放弃并打开其他项目吗？")
    )
      return false;
    setBusy(true);
    setError("");
    epoch.current++;
    setSuggestion(null);
    try {
      const result = decode(await request(`/api/projects/${id}`));
      setCurrent(result);
      setTitle(result.title);
      setData(result.data);
      setNotice("");
      return true;
    } catch (error) {
      report(error);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function fresh() {
    if (dirty && !confirm("有未保存的修改或未应用的 JSON，确定放弃并新建吗？"))
      return false;
    epoch.current++;
    setCurrent(null);
    setData(structuredClone(seed));
    setTitle(defaultTitle);
    setSuggestion(null);
    setError("");
    setNotice("");
    return true;
  }
  async function remove() {
    if (
      !current ||
      !confirm(
        `删除「${current.title}」及答卷？此操作不能撤销，当前未保存的修改也将放弃。`,
      )
    )
      return false;
    setBusy(true);
    setError("");
    try {
      await request(`/api/projects/${current.id}`, {
        method: "DELETE",
        body: JSON.stringify({ revision: current.revision }),
      });
      epoch.current++;
      setCurrent(null);
      setData(structuredClone(seed));
      setTitle(defaultTitle);
      setSuggestion(null);
      await refresh();
      return true;
    } catch (error) {
      report(error);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function generate(prompt: string) {
    const token = ++epoch.current;
    setAiBusy(true);
    setError("");
    setSuggestion(null);
    try {
      const result = validate(
        await request("/api/generate", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        }),
      );
      if (epoch.current === token) setSuggestion(result);
    } catch (error) {
      if (epoch.current === token) report(error);
    } finally {
      setAiBusy(false);
    }
  }
  function applySuggestion() {
    if (suggestion) {
      setData(suggestion);
      setSuggestion(null);
      setNotice("已采用生成稿，请检查后保存。");
    }
  }
  return {
    items,
    current,
    data,
    setData,
    title,
    setTitle,
    busy,
    error,
    setError,
    report,
    notice,
    loading,
    dirty,
    aiBusy,
    suggestion,
    refresh,
    save,
    open,
    fresh,
    remove,
    generate,
    applySuggestion,
  };
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
        <option value="">未保存的新项目</option>
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
