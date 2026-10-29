// ABOUTME: 画布上的就地编辑层：节点搜索、多行文本编辑、下拉选择与小地图。

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import type { NodeDef } from "../contracts/comfy";
import { search, type LibraryEntry, type SearchFilter } from "./search";
import type { GraphEditor, SearchRequest, TextEditRequest, ComboRequest } from "./graph/editor";

function clampBox(x: number, y: number, w: number, h: number): CSSProperties {
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  const top = Math.max(8, Math.min(window.innerHeight - h - 8, y));
  return { left, top, width: w };
}

export function NodeSearch({
  request,
  entries,
  onPick,
  onClose,
}: {
  request: SearchRequest;
  entries: LibraryEntry[];
  onPick: (def: NodeDef) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const filter: SearchFilter = request.from ? { side: request.from.side, type: request.from.type } : {};
  const results = useMemo(() => search(entries, query, filter), [entries, query, request]);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    document.getElementById("search-option-" + index)?.scrollIntoView({ block: "nearest" });
  }, [index]);
  const style = clampBox(request.screenPos[0] - 20, request.screenPos[1] - 20, 380, 360);
  return createPortal(
    <div className="scrim" onPointerDown={onClose}>
      <div
        className="search-pop"
        role="dialog"
        aria-label="搜索节点"
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && results[index]) {
            e.preventDefault();
            onPick(results[index]);
          }
        }}
      >
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={request.from ? `搜索可连接 ${request.from.type} 的节点…` : "搜索节点：名称、分类…"}
            aria-label="节点名称"
            aria-controls="search-results"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <ul id="search-results" role="listbox" className="search-results">
          {results.map((def, i) => (
            <li
              key={def.name}
              id={"search-option-" + i}
              role="option"
              aria-selected={i === index}
              className={i === index ? "on" : ""}
              onPointerEnter={() => setIndex(i)}
              onClick={() => onPick(def)}
            >
              <span className="name">{def.display_name}</span>
              <span className="cat">{def.category || "未分类"}</span>
            </li>
          ))}
          {!results.length && <li className="none">没有匹配的节点。连接服务后会出现其自定义节点。</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export function TextEditor({
  request,
  editor,
  onClose,
}: {
  request: TextEditRequest;
  editor: GraphEditor;
  onClose: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const rect = editor.widgetRect(request.node, request.widget);
  const [value, setValue] = useState(String(request.widget.value ?? ""));
  useEffect(() => {
    area.current?.focus();
    area.current?.setSelectionRange(value.length, value.length);
  }, []);
  const width = Math.max(300, rect.w),
    height = Math.max(150, rect.h);
  const style = clampBox(rect.x, rect.y, width, height);
  return createPortal(
    <div className="scrim clear" onPointerDown={onClose}>
      <div className="text-pop" style={{ ...style, height }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="text-pop-head">
          <span>{request.title} · {request.widget.name}</span>
          <kbd>Esc 完成</kbd>
        </div>
        <textarea
          ref={area}
          value={value}
          aria-label={`${request.title} ${request.widget.name}`}
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            request.widget.value = e.target.value as never;
            editor.touch();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

export function ComboPicker({
  request,
  editor,
  onClose,
}: {
  request: ComboRequest;
  editor: GraphEditor;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const rect = editor.widgetRect(request.node, request.widget);
  const items = useMemo(() => {
    const q = query.toLowerCase();
    return request.options.filter((o) => o.toLowerCase().includes(q)).slice(0, 300);
  }, [query, request.options]);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => setIndex(0), [query]);
  const pick = (value: string) => {
    request.widget.value = value as never;
    request.widget.callback?.(value, editor.canvas, request.node);
    editor.touch();
    onClose();
  };
  const style = clampBox(rect.x, rect.y + rect.h, Math.max(300, rect.w), 320);
  return createPortal(
    <div className="scrim clear" onPointerDown={onClose}>
      <div
        className="search-pop"
        role="dialog"
        aria-label={`选择 ${request.widget.name}`}
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && items[index]) {
            e.preventDefault();
            pick(items[index]);
          }
        }}
      >
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`筛选 ${request.options.length} 项…`} aria-label="筛选选项" autoComplete="off" spellCheck={false} />
        </label>
        <ul role="listbox" className="search-results">
          {items.map((o, i) => (
            <li key={o} role="option" aria-selected={i === index} className={i === index ? "on" : ""} onPointerEnter={() => setIndex(i)} onClick={() => pick(o)}>
              <span className="name">{o}</span>
              {o === request.widget.value && <span className="cat">当前</span>}
            </li>
          ))}
          {!items.length && <li className="none">没有匹配项。</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export function Minimap({ editor, version }: { editor: GraphEditor; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width,
      H = c.height;
    ctx.clearRect(0, 0, W, H);
    const b = editor.bounds();
    const v = editor.viewport();
    const x0 = Math.min(b.x, v.x),
      y0 = Math.min(b.y, v.y),
      x1 = Math.max(b.x + b.w, v.x + v.w),
      y1 = Math.max(b.y + b.h, v.y + v.h);
    const s = Math.min((W - 8) / (x1 - x0), (H - 8) / (y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2 - x0 * s,
      oy = (H - (y1 - y0) * s) / 2 - y0 * s;
    for (const n of b.nodes) {
      ctx.fillStyle = n.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(n.x * s + ox, n.y * s + oy, Math.max(2, n.w * s), Math.max(2, n.h * s));
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#f0b24a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(v.x * s + ox, v.y * s + oy, v.w * s, v.h * s);
    (c as HTMLCanvasElement & { map?: { s: number; ox: number; oy: number } }).map = { s, ox, oy };
  }, [editor, version]);
  return (
    <canvas
      ref={ref}
      className="minimap"
      width={176}
      height={112}
      role="img"
      aria-label="小地图：点击跳转"
      onPointerDown={(e) => {
        const c = ref.current as (HTMLCanvasElement & { map?: { s: number; ox: number; oy: number } }) | null;
        if (!c?.map) return;
        const r = c.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * c.width,
          py = ((e.clientY - r.top) / r.height) * c.height;
        editor.panTo((px - c.map.ox) / c.map.s, (py - c.map.oy) / c.map.s);
      }}
    />
  );
}
