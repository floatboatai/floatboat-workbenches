import { useEffect, useRef } from "react";
import grapesjs, { type Editor, type Component, type CssRule } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import zh from "./locale";
import { blocks } from "../contracts/templates";
import {
  escapeHtml,
  renderHtml,
  renderCss,
  validatePage,
  type PageData,
  type PageNode,
} from "../contracts/page";
import { bindInspector } from "./inspector";

export interface EditorHandle {
  editor: Editor;
  capture: () => PageData;
}
interface Props {
  initial: PageData;
  draft: Record<string, unknown>;
  onChange: (data: PageData) => void;
  onDraft: (key: string, value: unknown) => void;
  onReady: (handle: EditorHandle | null) => void;
  onError: (error: unknown) => void;
}
const supportedTags = new Set(
  "div section header footer main nav article aside h1 h2 h3 h4 p span strong b em i u s br a ul ol li hr".split(
    " ",
  ),
);
function textNodes(el: HTMLElement): PageNode[] {
  const walk = (node: ChildNode): PageNode[] => {
    if (node.nodeType === 3)
      return [
        {
          tagName: "span",
          type: "textnode",
          content: escapeHtml(node.textContent ?? ""),
        },
      ];
    if (!(node instanceof el.ownerDocument.defaultView!.HTMLElement)) return [];
    const tag = node.tagName.toLowerCase();
    if (!supportedTags.has(tag))
      return Array.from(node.childNodes).flatMap(walk);
    const attributes: Record<string, string> = {};
    for (const key of ["id", "class", "title", "href", "aria-label", "role"]) {
      const value = node.getAttribute(key);
      if (value !== null) attributes[key] = value;
    }
    const style: Record<string, string> = {};
    for (const key of Array.from(node.style))
      style[key] = node.style.getPropertyValue(key);
    return [
      {
        tagName: tag,
        ...(["span", "strong", "b", "em", "i", "u", "s"].includes(tag)
          ? { type: "text" as const }
          : tag === "a"
            ? { type: "link" as const }
            : {}),
        attributes,
        ...(Object.keys(style).length ? { style } : {}),
        components: Array.from(node.childNodes).flatMap(walk),
      },
    ];
  };
  return Array.from(el.childNodes).flatMap(walk);
}
function capture(editor: Editor): PageData {
  const node = (c: Component): PageNode => {
    const raw = c.getAttributes();
    const attributes: Record<string, string> = {};
    for (const key of ["id", "class", "title", "href", "aria-label", "role"])
      if (typeof raw[key] === "string") attributes[key] = raw[key];
    if (c.get("type") !== "textnode") attributes.id = c.getId();
    const out: PageNode = {
      tagName: String(c.get("tagName") || "span").toLowerCase(),
      attributes,
    };
    const type = c.get("type");
    if (type === "text" || type === "textnode" || type === "link")
      out.type = type;
    const style: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.getStyle())) style[k] = String(v);
    if (Object.keys(style).length) out.style = style;
    const el = c.getEl();
    if (type === "textnode") out.content = escapeHtml(c.get("content") ?? "");
    else if ((type === "text" || type === "link") && el)
      out.components = textNodes(el);
    else {
      out.components = c.components().map(node);
      const content = c.get("content");
      if (content) {
        const holder = document.createElement("div");
        holder.innerHTML = content;
        out.components.unshift(...textNodes(holder));
      }
    }
    return out;
  };
  const rules: CssRule[] = editor.Css.getAll().models;
  return validatePage({
    version: 1,
    components: editor.getComponents().map(node),
    rules: rules
      .map((rule) => ({
        selector: rule.selectorsToString(),
        style: Object.fromEntries(
          Object.entries(rule.getStyle()).map(([k, v]) => [k, String(v)]),
        ),
        ...(rule.get("mediaText") ? { media: rule.get("mediaText") } : {}),
      }))
      .filter((rule) => rule.selector),
  });
}
export function PageEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    layers = useRef<HTMLDivElement>(null),
    styles = useRef<HTMLDivElement>(null),
    blockHost = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (
      !host.current ||
      !layers.current ||
      !styles.current ||
      !blockHost.current
    )
      return;
    let disposed = false;
    const editor = grapesjs.init({
      container: host.current,
      height: "100%",
      width: "auto",
      storageManager: false,
      telemetry: false,
      cssIcons: "",
      jsInHtml: false,
      fromElement: false,
      panels: { defaults: [] },
      noticeOnUnload: false,
      selectorManager: { componentFirst: true },
      canvas: { scripts: [], styles: [], allowExternalDrop: false },
      assetManager: { assets: [], upload: false, autoAdd: false },
      parser: {
        optionsHtml: {
          allowScripts: false,
          allowUnsafeAttr: false,
          allowUnsafeAttrValue: false,
        },
      },
      i18n: { locale: "zh", localeFallback: "en", messages: { zh } },
      richTextEditor: {
        actions: ["bold", "italic", "underline", "strikethrough"],
        onPaste: ({ ev, rte }) => {
          ev.preventDefault();
          rte.exec(
            "insertHTML",
            escapeHtml(ev.clipboardData?.getData("text/plain") ?? "").replace(
              /\n/g,
              "<br>",
            ),
          );
        },
      },
      blockManager: {
        appendTo: blockHost.current,
        blocks: blocks.map((block) => ({
          id: block.id,
          label: `<span class="block-symbol">${block.symbol}</span>${block.label}`,
          content: renderHtml({
            version: 1,
            components: [block.content],
            rules: [],
          }),
        })),
      },
      layerManager: { appendTo: layers.current, showWrapper: false },
      styleManager: {
        appendTo: styles.current,
        sectors: [
          {
            name: "排版",
            open: true,
            properties: [
              {
                property: "font-size",
                name: "字号",
                type: "integer",
                units: ["px", "rem", "em"],
                defaults: "16px",
              },
              {
                property: "font-weight",
                name: "字重",
                type: "select",
                options: [
                  { id: "400", label: "常规" },
                  { id: "600", label: "中等" },
                  { id: "700", label: "粗体" },
                  { id: "800", label: "特粗" },
                ],
              },
              { property: "color", name: "文字颜色", type: "color" },
              {
                property: "line-height",
                name: "行高",
                type: "number",
                defaults: "1.5",
              },
              {
                property: "text-align",
                name: "对齐",
                type: "select",
                options: [
                  { id: "left", label: "左对齐" },
                  { id: "center", label: "居中" },
                  { id: "right", label: "右对齐" },
                ],
              },
            ],
          },
          {
            name: "尺寸与间距",
            open: true,
            properties: [
              {
                property: "width",
                name: "宽度",
                type: "integer",
                units: ["px", "%", "vw"],
                defaults: "auto",
              },
              { property: "padding", name: "内边距", type: "text" },
              { property: "margin", name: "外边距", type: "text" },
              { property: "gap", name: "间距", type: "integer", units: ["px"] },
            ],
          },
          {
            name: "外观",
            open: true,
            properties: [
              { property: "background-color", name: "背景颜色", type: "color" },
              {
                property: "border-radius",
                name: "圆角",
                type: "integer",
                units: ["px", "%"],
              },
              { property: "border", name: "边框", type: "text" },
              {
                property: "display",
                name: "布局",
                type: "select",
                options: [
                  { id: "block", label: "块" },
                  { id: "flex", label: "弹性" },
                  { id: "inline-block", label: "行内块" },
                  { id: "none", label: "隐藏" },
                ],
              },
            ],
          },
        ],
      },
      deviceManager: {
        devices: [
          { id: "desktop", name: "桌面", width: "" },
          { id: "tablet", name: "平板", width: "768px", widthMedia: "768px" },
          { id: "mobile", name: "手机", width: "375px", widthMedia: "480px" },
        ],
      },
      components: renderHtml(props.initial),
      style: renderCss(props.initial),
    });
    let textView: { disableEditing: () => Promise<void> } | undefined;
    editor.on("rte:enable", (view) => {
      textView = view;
    });
    const sync = () => {
      if (!disposed)
        try {
          latest.current.onChange(capture(editor));
        } catch (error) {
          latest.current.onError(error);
        }
    };
    const onInput = () => sync();
    const inspector = bindInspector(
      styles.current,
      editor,
      props.draft.nativeInputs,
      (value) => latest.current.onDraft("nativeInputs", value),
      (error) => latest.current.onError(error),
    );
    const select = (component: Component) => {
      if (!disposed) {
        sync();
        latest.current.onDraft("selectedId", component.getId());
        inspector.restore();
      }
    };
    editor.on("component:selected", select);
    let canvasDoc: Document | null = null;
    editor.on("load", () => {
      if (disposed) return;
      canvasDoc = editor.Canvas.getDocument();
      canvasDoc?.addEventListener("input", onInput);
      const frame = editor.Canvas.getFrameEl();
      frame.title = "可视化页面画布";
      editor.setDevice(window.innerWidth < 700 ? "手机" : "桌面");
      const selectedId = latest.current.draft.selectedId;
      if (
        typeof selectedId === "string" &&
        /^[a-zA-Z0-9_-]{1,300}$/.test(selectedId)
      ) {
        const component = editor.getWrapper()?.find(`#${selectedId}`)[0];
        if (component) editor.select(component);
      }
      inspector.restore();
      blockHost.current
        ?.querySelectorAll<HTMLElement>(".gjs-block")
        .forEach((element, index) => {
          element.tabIndex = 0;
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", `添加${blocks[index]?.label}`);
          element.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              const block = blocks[index];
              if (block) {
                const added = editor.addComponents(
                  renderHtml({
                    version: 1,
                    components: [block.content],
                    rules: [],
                  }),
                )[0];
                if (added) editor.select(added);
              }
            }
          });
          element.addEventListener("click", () => {
            const block = blocks[index];
            if (block) {
              const added = editor.addComponents(
                renderHtml({
                  version: 1,
                  components: [block.content],
                  rules: [],
                }),
              )[0];
              if (added) editor.select(added);
            }
          });
        });
      latest.current.onReady({ editor, capture: () => capture(editor) });
    });
    editor.on("update", sync);
    return () => {
      disposed = true;
      inspector.dispose();
      canvasDoc?.removeEventListener("input", onInput);
      latest.current.onReady(null);
      void (textView?.disableEditing() ?? Promise.resolve())
        .finally(() => editor.destroy())
        .catch((error) => latest.current.onError(error));
    };
  }, []);
  return (
    <>
      <aside className="left-tools">
        <div className="panel-heading">
          添加组件<span>拖入画布</span>
        </div>
        <div ref={blockHost} className="blocks" />
        <div className="panel-heading layer-heading">页面图层</div>
        <div ref={layers} className="layers" />
      </aside>
      <section id="canvas" className="canvas-zone" aria-label="页面编辑区域">
        <div className="canvas-ruler">
          <span>0</span>
          <span>200</span>
          <span>400</span>
          <span>600</span>
          <span>800</span>
        </div>
        <div ref={host} className="editor-host" />
      </section>
      <aside className="right-tools">
        <div className="panel-heading">
          样式<span>选择元素后调整</span>
        </div>
        <div ref={styles} className="styles" />
      </aside>
    </>
  );
}
