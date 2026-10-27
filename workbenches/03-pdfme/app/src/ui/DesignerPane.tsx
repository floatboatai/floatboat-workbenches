import { memo, useEffect, useRef, useState } from "react";
import { isDesignerProperty, designerDraftApplied, type DesignerDraft } from "../contracts/designer-draft";
import type { Template } from "@pdfme/common";
import { loadFont } from "./fonts";
import { loadPdfEngine } from "./browser-engine";
export const DesignerPane = memo(function DesignerPane({
  initial,
  onChange,
  onDraft,
}: {
  initial: Template;
  onChange: (template: Template) => void;
  onDraft: (draft: DesignerDraft, applied: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    callback = useRef(onChange), draftCallback = useRef(onDraft);
  callback.current = onChange;
  draftCallback.current = onDraft;
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
        const node = container.current;
        let selectedField = "";
        const select = () => {const name = node.querySelector<HTMLInputElement>("#name")?.value; if(name && instance.getTemplate().schemas.flat().some(field => field.name === name)) selectedField = name;};
        const capture = (event: Event) => {
          const input = event.target;
          if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || input.readOnly || !isDesignerProperty(input.id) || !selectedField || input.value.length > 5000) return;
          const draft: DesignerDraft = {field: selectedField, property: input.id, value: input.value};
          queueMicrotask(() => {if(active) draftCallback.current(draft, designerDraftApplied(instance.getTemplate(), draft));});
        };
        node.addEventListener("focusin", select);
        node.addEventListener("input", capture);
        destroy = () => {node.removeEventListener("focusin", select);node.removeEventListener("input", capture);instance.destroy();};
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
