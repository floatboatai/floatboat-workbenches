// ABOUTME: 链接编辑浮层：只接受 http(s)、mailto 与页内锚点，自动补全 https://；Esc 关闭并把焦点还给正文。
import { useEffect, useId, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { posToDOMRect } from "@tiptap/core";
import { normalizeLinkInput } from "../contracts/domain";

export interface LinkTarget {
  from: number;
  to: number;
  href: string;
  /** 光标处没有选中文字时需要填写链接文字。 */
  needsText: boolean;
}

/** 根据当前选区确定要编辑的范围：在已有链接内时扩展到整段链接。 */
export function linkTarget(editor: Editor): LinkTarget {
  const href = String(editor.getAttributes("link").href ?? "");
  if (href) {
    editor.chain().extendMarkRange("link").run();
  }
  const { from, to } = editor.state.selection;
  return { from, to, href, needsText: from === to };
}

export function LinkPopover({
  editor,
  target,
  onClose,
}: {
  editor: Editor;
  target: LinkTarget;
  onClose: () => void;
}) {
  const id = useId();
  const [href, setHref] = useState(target.href);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLFormElement>(null);
  const rect = posToDOMRect(editor.view, target.from, target.to);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [onClose]);
  const close = () => {
    onClose();
    editor.commands.focus();
  };
  const apply = () => {
    const normalized = normalizeLinkInput(href);
    if (!normalized) {
      setError("请输入 http(s) 网址、邮箱或以 # 开头的页内锚点。");
      return;
    }
    const chain = editor.chain().focus().setTextSelection({ from: target.from, to: target.to });
    if (target.needsText) {
      const text = label.trim() || normalized.replace(/^mailto:/, "");
      chain
        .insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href: normalized } }] })
        .run();
    } else chain.extendMarkRange("link").setLink({ href: normalized }).run();
    onClose();
  };
  const remove = () => {
    editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).extendMarkRange("link").unsetLink().run();
    onClose();
  };
  const width = Math.min(340, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = rect.bottom + 8 + 190 > window.innerHeight ? Math.max(8, rect.top - 8 - 190) : rect.bottom + 8;
  return (
    <form
      ref={panel}
      className="link-popover"
      role="dialog"
      aria-label={target.href ? "编辑链接" : "添加链接"}
      style={{ left, top, width }}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <label htmlFor={`${id}-href`}>链接地址</label>
      <input
        ref={input}
        id={`${id}-href`}
        name="linkHref"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={href}
        placeholder="https://example.com 或 name@example.com…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setHref(event.target.value);
          setError("");
        }}
      />
      {target.needsText ? (
        <>
          <label htmlFor={`${id}-text`}>链接文字</label>
          <input
            id={`${id}-text`}
            name="linkText"
            autoComplete="off"
            value={label}
            placeholder="留空则显示地址…"
            onChange={(event) => setLabel(event.target.value)}
          />
        </>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="popover-actions">
        <button type="submit" className="primary">
          应用
        </button>
        {target.href ? (
          <>
            <button type="button" onClick={remove}>
              移除链接
            </button>
            <a href={normalizeLinkInput(target.href) ?? "#"} target="_blank" rel="noopener noreferrer">
              打开 ↗
            </a>
          </>
        ) : null}
        <button type="button" onClick={close}>
          取消
        </button>
      </div>
    </form>
  );
}
