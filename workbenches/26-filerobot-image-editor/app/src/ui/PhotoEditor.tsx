import Konva from "konva";
import { useEffect, useRef, useState, type FormEvent } from "react";
import FilerobotImageEditor, {
  type FilerobotImageEditorConfig,
  type getCurrentImgDataFunction,
} from "react-filerobot-image-editor";
import {
  type Design,
  type PhotoProject,
  serializeDesign,
  designValue,
} from "../contracts/editor";
import { isRecord } from "../contracts/project";
import { translations, editorTheme } from "./editor-config";
interface Props {
  project: PhotoProject;
  draft: Record<string, unknown>;
  onDesign: (d: Design) => void;
  onDraft: (d: Record<string, unknown>) => void;
  onError: (e: unknown) => void;
  exportRef: { current: getCurrentImgDataFunction | null };
}
export function PhotoEditor(props: Props) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const container = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => {
    const d = structuredClone(props.project.design),
      pending = props.draft.nativeAnnotation;
    if (
      isRecord(pending) &&
      typeof pending.id === "string" &&
      Array.isArray(pending.tmpText) &&
      isRecord(d.annotations) &&
      isRecord(d.annotations[pending.id])
    ) {
      d.annotations[pending.id] = {
        ...(d.annotations[pending.id] as Design),
        ...pending,
        text: pending.tmpText,
      };
      delete (d.annotations[pending.id] as Design).tmpText;
    }
    return designValue(
      d,
      true,
    ) as FilerobotImageEditorConfig["loadableDesignState"];
  });
  const [source] = useState(() => "/api/images/" + props.project.source?.id);
  const [modify] = useState(() => (raw: unknown) => {
    try {
      callbacks.current.onDesign(
        serializeDesign(raw, (value, kind) =>
          typeof value === "function"
            ? Object.entries(Konva.Filters).find(
                ([, fn]) => fn === value,
              )?.[0] ||
              Reflect.get(value, kind) ||
              value.name
            : value,
        ),
      );
    } catch (e) {
      callbacks.current.onError(e);
    }
  });
  useEffect(() => {
    function annotation(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isRecord(detail) || !isRecord(detail.annotation)) return;
      const a = detail.annotation;
      if (Array.isArray(a.tmpText)) {
        try {
          const clean = serializeDesign({ annotations: { [String(a.id)]: a } });
          if (isRecord(clean.annotations))
            callbacks.current.onDraft({
              nativeAnnotation: clean.annotations[String(a.id)],
            });
        } catch (e) {
          callbacks.current.onError(e);
        }
      } else callbacks.current.onDraft({ nativeAnnotation: null });
    }
    window.addEventListener("fie-annotation-edit", annotation);
    const restored = new Set<string>();
    const initialFields = isRecord(props.draft.nativeInputs)
      ? props.draft.nativeInputs
      : {};
    const enhance = () => {
      const root = container.current;
      if (!root) return;
      root
        .querySelectorAll<HTMLElement>(
          '.FIE_tab,.FIE_filters-item,[data-testid^="FIE-tools-bar-item-button-"]',
        )
        .forEach((el) => {
          el.setAttribute(
            "role",
            el.classList.contains("FIE_tab") ? "tab" : "button",
          );
          el.tabIndex = 0;
          if (el.classList.contains("FIE_tab"))
            el.parentElement?.setAttribute("role", "tablist");
        });
      root
        .querySelector('[data-testid="FIE-topbar-menu-button"]')
        ?.setAttribute("aria-label", "编辑工具菜单");
      root
        .querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >("input,textarea")
        .forEach((el) => {
          const key = inputKey(el);
          if (key && !el.getAttribute("aria-label"))
            el.setAttribute("aria-label", el.title || el.name || key);
          if (
            key &&
            !restored.has(key) &&
            typeof initialFields[key] === "string" &&
            (initialFields[key] === "" ||
              /^[-+.]+$/.test(String(initialFields[key])))
          ) {
            restored.add(key);
            const value = String(initialFields[key]);
            if (el.value !== value) {
              const setter = Object.getOwnPropertyDescriptor(
                el instanceof HTMLInputElement
                  ? HTMLInputElement.prototype
                  : HTMLTextAreaElement.prototype,
                "value",
              )?.set;
              setter?.call(el, value);
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        });
    };
    const observer = new MutationObserver(enhance);
    if (container.current)
      observer.observe(container.current, { childList: true, subtree: true });
    let previousWidth = 0,
      resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (previousWidth && Math.abs(width - previousWidth) > 40) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(
          () =>
            container.current
              ?.querySelector<HTMLButtonElement>(
                '[data-testid="FIE-fit-button"]',
              )
              ?.click(),
          180,
        );
      }
      previousWidth = width;
    });
    if (container.current) resizeObserver.observe(container.current);
    enhance();
    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
      window.removeEventListener("fie-annotation-edit", annotation);
      observer.disconnect();
    };
  }, []);
  const [editor] = useState(() => (
    <FilerobotImageEditor
      source={source}
      loadableDesignState={initial}
      onModify={modify}
      getCurrentImgDataFnRef={props.exportRef}
      theme={editorTheme}
      translations={translations}
      useBackendTranslations={false}
      language="zh-CN"
      tabsIds={["Adjust", "Finetune", "Filters", "Annotate", "Resize"]}
      defaultTabId="Adjust"
      savingPixelRatio={1}
      previewPixelRatio={1}
      removeSaveButton
      avoidChangesNotSavedAlertOnLeave
      observePluginContainerSize
      previewBgColor="#15181b"
      Text={{
        text: "在此输入文字",
        fontFamily: "Arial",
        fontSize: 40,
        fonts: ["Arial", "Georgia", "monospace"],
      }}
      annotationsCommon={{ fill: "#ffffff", stroke: "#eab96b" }}
      Image={{ disableUpload: true, gallery: [] }}
      Crop={{ presetsItems: [{ titleKey: "square", ratio: 1 }] }}
      Rotate={{ angle: 90, componentType: "buttons" }}
    />
  ));
  function capture(event: FormEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) ||
      target.type === "file"
    )
      return;
    const key = inputKey(target);
    if (key && target.value.length <= 20000) {
      const value = target.value;
      queueMicrotask(() =>
        callbacks.current.onDraft({
          nativeInput: { name: key, value },
          nativeInputs: {
            ...(isRecord(callbacks.current.draft.nativeInputs)
              ? callbacks.current.draft.nativeInputs
              : {}),
            [key]: value,
          },
        }),
      );
    }
  }
  return (
    <div
      className="photo-editor"
      ref={container}
      onInputCapture={capture}
      onClickCapture={(e) => {
        const tab = (e.target as HTMLElement)
          .closest(".FIE_tab")
          ?.getAttribute("data-testid")
          ?.replace("FIE-tab-", "");
        const names: Record<string, string> = {
          adjust: "Adjust",
          finetune: "Finetune",
          filters: "Filters",
          annotate: "Annotate",
          resize: "Resize",
        };
        if (tab && names[tab])
          queueMicrotask(() =>
            callbacks.current.onDraft({ editorTab: names[tab] }),
          );
      }}
      onKeyDown={(e) => {
        const el = e.target as HTMLElement;
        if (
          (e.key === "Enter" || e.key === " ") &&
          (el.matches(".FIE_tab,.FIE_filters-item") ||
            el.matches('[data-testid^="FIE-tools-bar-item-button-"]'))
        ) {
          e.preventDefault();
          el.click();
        }
      }}
      aria-label="图片编辑画布"
    >
      {editor}
    </div>
  );
}

function inputKey(el: HTMLInputElement | HTMLTextAreaElement) {
  return (
    el.getAttribute("name") ||
    el.getAttribute("title") ||
    el.closest("[data-testid]")?.getAttribute("data-testid")
  );
}
