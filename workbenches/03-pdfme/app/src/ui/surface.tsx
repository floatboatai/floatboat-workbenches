// ABOUTME: pdfme 原生 Form（填写）与 Viewer（逐行预览）的挂载，以及三种视图共用的主题和跳页。
import { memo, useEffect, useRef, useState } from "react";
import type { Template } from "@pdfme/common";
import type { Form, Viewer } from "@pdfme/ui";
import { engineWithFont } from "./pdf";

export interface PageRequest {
  page: number;
  nonce: number;
}
/** antd tokens so pdfme's own panels match the workbench chrome. */
export const PDFME_THEME = { token: { colorPrimary: "#1f5f5b", borderRadius: 4, fontSize: 13 } };

/** pdfme renders every page as a sibling block inside its scroll container; bring page `index` into view. */
export function scrollToPage(root: HTMLElement, index: number) {
  const pages = [...root.querySelectorAll<HTMLElement>("[data-pdfme-page], .pdfme-paper")];
  const target = pages[index] ?? findPaper(root)[index];
  target?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
/** Papers are the white page boxes with a background image; locate them by geometry when no marker exists. */
function findPaper(root: HTMLElement): HTMLElement[] {
  const papers: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>("div").forEach((node) => {
    const style = node.style;
    if (style.backgroundImage && style.backgroundImage.startsWith("url(") && node.offsetWidth > 80) papers.push(node);
  });
  return papers;
}

type Instance = Form | Viewer;
export const PreviewPane = memo(function PreviewPane({
  kind,
  template,
  inputs,
  inputsKey,
  onInput,
  pageRequest,
  label,
}: {
  kind: "form" | "viewer";
  template: Template;
  inputs: Record<string, string>;
  /** Form inputs are only pushed when this changes, so typing on the paper is never reset. */
  inputsKey: string;
  onInput?: (name: string, value: string) => void;
  pageRequest: PageRequest | null;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Instance | null>(null);
  const latest = useRef(inputs);
  latest.current = inputs;
  const callback = useRef(onInput);
  callback.current = onInput;
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void engineWithFont()
      .then(({ engine, font, plugins }) => {
        if (!active || !container.current) return;
        const props = {
          domContainer: container.current,
          template,
          inputs: [latest.current],
          options: { lang: "zh" as const, font, zoomLevel: 1, theme: PDFME_THEME },
          plugins,
        };
        if (kind === "form") {
          const form = new engine.Form(props);
          form.onChangeInput(({ name, value }) => callback.current?.(name, value));
          instance.current = form;
        } else {
          // pdfme 5.4.6 logs a deprecation notice from the Viewer constructor; the pinned Viewer is still the
          // read-only preview this view needs, so only that one known notice is filtered.
          const warn = console.warn;
          console.warn = (...args: unknown[]) => {
            if (typeof args[0] === "string" && args[0].includes("Viewer component is deprecated")) return;
            warn(...args);
          };
          try {
            instance.current = new engine.Viewer(props);
          } finally {
            console.warn = warn;
          }
        }
        setLoading(false);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "预览加载失败");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      instance.current?.destroy();
      instance.current = null;
    };
  }, [kind, template]);
  useEffect(() => {
    instance.current?.setInputs([latest.current]);
  }, [inputsKey]);
  useEffect(() => {
    if (pageRequest && container.current) scrollToPage(container.current, pageRequest.page);
  }, [pageRequest]);
  return (
    <section className={`surface ${kind}-shell`} aria-label={label}>
      {loading ? (
        <p className="engine-state" role="status">
          正在排版纸张…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="engine-state error">
          {error}
        </p>
      ) : null}
      <div ref={container} className="pdfme-root" />
    </section>
  );
});
