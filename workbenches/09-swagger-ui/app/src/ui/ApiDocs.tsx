import { useEffect, useRef, useState } from "react";
import { isRecord } from "../contracts/project";
export function ApiDocs({ spec }: { spec: Record<string, unknown> }) {
  const frame = useRef<HTMLIFrameElement>(null),
    latest = useRef(spec);
  const [height, setHeight] = useState(600);
  latest.current = spec;
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        !isRecord(event.data)
      )
        return;
      if (event.data.kind === "swagger-ready")
        frame.current?.contentWindow?.postMessage(
          { kind: "swagger-spec", spec: latest.current },
          location.origin,
        );
      if (
        event.data.kind === "swagger-height" &&
        typeof event.data.height === "number" &&
        Number.isFinite(event.data.height)
      )
        setHeight(Math.min(16000, Math.max(480, event.data.height)));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { kind: "swagger-spec", spec },
      location.origin,
    );
  }, [spec]);
  return (
    <iframe
      ref={frame}
      title="Swagger 接口参考"
      src="/api/swagger-view"
      style={{ width: "100%", height, border: 0, display: "block" }}
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          { kind: "swagger-spec", spec: latest.current },
          location.origin,
        )
      }
    />
  );
}
