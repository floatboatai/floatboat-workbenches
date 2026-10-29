// ABOUTME: 规格检查器中的 CodeMirror 6 JSON 编辑器：语法高亮、折叠、括号匹配、schema 补全与悬停说明、行内诊断。
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { lintGutter, lintKeymap, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import type { SpecProblem } from "../contracts/spec-analysis";
import { schemaCompletion, schemaHover, type AssistSource } from "./schema-assist";

export interface EditorHandle {
  focus: () => void;
  focusAt: (from: number, to?: number) => void;
  /** 以一次可撤销的编辑替换全文。 */
  replaceAll: (text: string) => void;
}
const External = Annotation.define<boolean>();

const jsonHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--code-key)" },
  { tag: tags.string, color: "var(--code-string)" },
  { tag: tags.number, color: "var(--code-number)" },
  { tag: [tags.bool, tags.null], color: "var(--code-keyword)", fontWeight: "600" },
  { tag: [tags.separator, tags.punctuation, tags.brace, tags.squareBracket], color: "var(--code-punct)" },
]);
const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--code-bg)", color: "var(--code-ink)" },
  ".cm-scroller": { fontFamily: "var(--mono)", fontSize: "12.5px", lineHeight: "1.6" },
  ".cm-content": { padding: "8px 0 48px", caretColor: "var(--accent)" },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-gutters": { backgroundColor: "var(--code-gutter)", color: "var(--muted)", borderRight: "1px solid var(--line)" },
  ".cm-activeLine": { backgroundColor: "var(--code-active)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--code-active)", color: "var(--ink)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--code-selection) !important",
  },
  ".cm-matchingBracket": { backgroundColor: "var(--code-match)", outline: "1px solid var(--accent-soft)" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--danger)", textUnderlineOffset: "3px" },
  ".cm-lintRange-warning": { backgroundImage: "none", textDecoration: "underline wavy var(--warn)", textUnderlineOffset: "3px" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line-strong)", borderRadius: "6px" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--accent)", color: "#fff" },
  ".cm-completionDetail": { fontStyle: "normal", color: "var(--muted)", marginLeft: "8px" },
  ".cm-completionInfo": { maxWidth: "340px", fontSize: "12px", lineHeight: "1.5", padding: "6px 8px" },
  ".cm-panels": { backgroundColor: "var(--panel-2)", color: "var(--ink)" },
  ".cm-foldGutter span": { color: "var(--muted)" },
});

function toDiagnostics(problems: SpecProblem[], length: number): Diagnostic[] {
  return problems.map((item) => {
    const from = Math.min(item.from, length);
    let to = Math.min(Math.max(item.to, from), length);
    if (to === from && from < length) to = from + 1;
    return { from: to === from && from > 0 ? from - 1 : from, to, severity: item.severity, message: item.message, source: item.source };
  });
}

export function SpecEditor({
  value,
  resetKey,
  problems,
  problemSource,
  assist,
  onChange,
  handle,
}: {
  value: string;
  resetKey: string;
  problems: SpecProblem[];
  problemSource: string;
  assist: AssistSource;
  onChange: (value: string) => void;
  handle: Ref<EditorHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const source = useRef(assist);
  source.current = assist;
  const setup = useRef<Extension[] | null>(null);
  const wrap = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return;
    setup.current = [
      lineNumbers(),
      foldGutter(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      json(),
      syntaxHighlighting(jsonHighlight),
      autocompletion({ override: [schemaCompletion(() => source.current)], icons: false, maxRenderedOptions: 80 }),
      schemaHover(() => source.current),
      lintGutter(),
      theme,
      wrap.current.of([]),
      EditorState.tabSize.of(2),
      EditorView.contentAttributes.of({
        "aria-label": "Vega-Lite JSON 规格",
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
      }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(External)))
          change.current(update.state.doc.toString());
      }),
    ];
    const editor = new EditorView({ parent: host.current, state: EditorState.create({ doc: value, extensions: setup.current }) });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // 编辑器只创建一次；切换文件由 resetKey 重建状态。
  }, []);

  const lastKey = useRef(resetKey);
  useEffect(() => {
    const editor = view.current;
    if (!editor || !setup.current || lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    editor.setState(EditorState.create({ doc: value, extensions: setup.current }));
  }, [resetKey]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value)
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value }, annotations: External.of(true) });
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() !== problemSource) return;
    editor.dispatch(setDiagnostics(editor.state, toDiagnostics(problems, editor.state.doc.length)));
  }, [problems, problemSource]);

  useImperativeHandle(
    handle,
    () => ({
      focus: () => view.current?.focus(),
      focusAt(from, to = from) {
        const editor = view.current;
        if (!editor) return;
        const anchor = Math.min(from, editor.state.doc.length);
        editor.dispatch({
          selection: { anchor, head: Math.min(to, editor.state.doc.length) },
          effects: EditorView.scrollIntoView(anchor, { y: "center" }),
        });
        editor.focus();
      },
      replaceAll(text) {
        const editor = view.current;
        if (!editor) return;
        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text }, userEvent: "input.replace" });
      },
    }),
    [],
  );

  return <div className="spec-editor" translate="no" ref={host} />;
}
