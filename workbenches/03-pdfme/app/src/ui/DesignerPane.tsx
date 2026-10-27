import { memo, useEffect, useRef, useState } from "react";
import type { Template } from "@pdfme/common";
import { loadFont } from "./fonts";
import { loadPdfEngine } from "./browser-engine";
export const DesignerPane = memo(function DesignerPane({
  initial,
  onChange,
}: {
  initial: Template;
  onChange: (template: Template) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    callback = useRef(onChange);
  callback.current = onChange;
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let destroy: (() => void) | undefined;
    void Promise.all([loadPdfEngine(), loadFont()])
      .then(([ui, font]) => {
        if (!active || !container.current) return;
        const instance = new ui.Designer({
          domContainer: container.current,
          template: initial,
          options: { lang: "zh", font, zoomLevel: 0.8, sidebarOpen: true },
          plugins: { text: ui.text, rectangle: ui.rectangle },
        });
        instance.onChangeTemplate((template) => callback.current(template));
        destroy = () => instance.destroy();
        setLoading(false);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "设计器加载失败");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      destroy?.();
    };
  }, [initial]);
  return (
    <section className="designer-shell" aria-label="模板版式设计器">
      {loading ? (
        <p className="engine-state" role="status">
          正在准备纸张与字体…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="engine-state error">
          {error}
        </p>
      ) : null}
      <div className="designer-viewport">
        <div ref={container} className="designer-root" />
      </div>
    </section>
  );
});
