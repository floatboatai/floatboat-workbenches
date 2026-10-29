import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from "react";
import { isRecord } from "../contracts/project";

export interface TryCall {
  id: number;
  method: string;
  target: string;
  status?: number;
  durationMs?: number;
  code?: string;
  message?: string;
  local?: boolean;
  truncated?: boolean;
  at: number;
}
export interface DocsHandle {
  focus(path: string, method: string, tags: string[], takeFocus: boolean): void;
  section(name: "models" | "authorize" | "top"): void;
}

let callId = 0;
function decodeCall(value: Record<string, unknown>): TryCall | null {
  if (typeof value.method !== "string" || typeof value.target !== "string") return null;
  return {
    id: ++callId,
    method: value.method.slice(0, 10),
    target: value.target.slice(0, 200),
    status: typeof value.status === "number" ? value.status : undefined,
    durationMs: typeof value.durationMs === "number" ? value.durationMs : undefined,
    code: typeof value.code === "string" ? value.code.slice(0, 40) : undefined,
    message: typeof value.message === "string" ? value.message.slice(0, 400) : undefined,
    local: value.local === true,
    truncated: value.truncated === true,
    at: Date.now(),
  };
}

/** 官方 Swagger UI 运行在同源 iframe 中；切换模式时保持挂载，授权值随 iframe 内存存在。 */
export function ApiDocs({
  spec,
  allowPrivate,
  onCall,
  onMissing,
  ref,
}: {
  spec: Record<string, unknown> | null;
  allowPrivate: boolean;
  onCall: (call: TryCall) => void;
  onMissing: (what: string) => void;
  ref?: Ref<DocsHandle>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const latest = useRef({ spec, allowPrivate });
  latest.current = { spec, allowPrivate };
  const send = (message: Record<string, unknown>) =>
    frame.current?.contentWindow?.postMessage(message, location.origin);
  const sync = () => {
    send({ kind: "swagger-settings", allowPrivate: latest.current.allowPrivate });
    if (latest.current.spec) send({ kind: "swagger-spec", spec: latest.current.spec });
  };
  const receive = useEffectEvent((event: MessageEvent) => {
    if (
      event.origin !== location.origin ||
      event.source !== frame.current?.contentWindow ||
      !isRecord(event.data)
    )
      return;
    const data = event.data;
    if (data.kind === "swagger-ready") {
      ready.current = true;
      sync();
    } else if (data.kind === "swagger-call") {
      const call = decodeCall(data);
      if (call) onCall(call);
    } else if (data.kind === "swagger-missing")
      onMissing(typeof data.section === "string" ? data.section : "operation");
  });
  useEffect(() => {
    const listener = (event: MessageEvent) => receive(event);
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    if (ready.current && spec) send({ kind: "swagger-spec", spec });
  }, [spec]);
  useEffect(() => {
    if (ready.current) send({ kind: "swagger-settings", allowPrivate });
  }, [allowPrivate]);
  useImperativeHandle(
    ref,
    () => ({
      focus: (path, method, tags, takeFocus) =>
        send({ kind: "swagger-focus", path, method, tags, takeFocus }),
      section: (name) => send({ kind: "swagger-section", section: name }),
    }),
    [],
  );
  return (
    <iframe
      ref={frame}
      className="docs-frame"
      title="Swagger 接口参考"
      src="/api/swagger-view"
    />
  );
}
