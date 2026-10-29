// ABOUTME: 基于 CodeMirror 6 的 Mermaid 源码编辑器：行号、语法高亮、补全、搜索与行内错误标记。
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Annotation, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completeFromList,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  lintGutter,
  lintKeymap,
  setDiagnostics,
  type Diagnostic,
} from "@codemirror/lint";
import {
  mermaidCompletions,
  mermaidHighlight,
  mermaidLanguage,
} from "./mermaid-language";

export interface SourceProblem {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}
export interface EditorHandle {
  focusLine: (line: number, column?: number) => void;
  focus: () => void;
}

const External = Annotation.define<boolean>();

const editorTheme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "var(--ide-bg)", color: "#e6edf5" },
    ".cm-scroller": {
      fontFamily: "var(--mono)",
      fontSize: "13px",
      lineHeight: "1.65",
    },
    ".cm-content": { caretColor: "#ffd27a", padding: "10px 0 40px" },
    ".cm-cursor": { borderLeftColor: "#ffd27a", borderLeftWidth: "2px" },
    ".cm-gutters": {
      backgroundColor: "var(--ide-gutter)",
      color: "#6d7b8c",
      borderRight: "1px solid var(--ide-line)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(120,160,220,.07)" },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(120,160,220,.12)",
      color: "#c5d2e2",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: "rgba(110,150,220,.35) !important",
      },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(255,210,122,.18)",
      outline: "1px solid rgba(255,210,122,.5)",
    },
    ".cm-selectionMatch": { backgroundColor: "rgba(160,200,255,.14)" },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "underline wavy #ff6b6b",
      textUnderlineOffset: "3px",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      textDecoration: "underline wavy #f2b866",
      textUnderlineOffset: "3px",
    },
    ".cm-tooltip": {
      backgroundColor: "#1b2430",
      color: "#e6edf5",
      border: "1px solid #34465c",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "#2d4a73",
    },
    ".cm-panels": { backgroundColor: "#162029", color: "#e6edf5" },
    ".cm-panels input, .cm-panels button": { fontSize: "12px" },
    ".cm-diagnostic-error": { borderLeftColor: "#ff6b6b" },
  },
  { dark: true },
);

function extensions(
  label: string,
  onChange: (value: string) => void,
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ override: [completeFromList(mermaidCompletions)] }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    lintGutter(),
    mermaidLanguage,
    syntaxHighlighting(mermaidHighlight),
    editorTheme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      "aria-label": label,
      spellcheck: "false",
      autocorrect: "off",
      autocapitalize: "off",
    }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (
        update.docChanged &&
        !update.transactions.some((tr) => tr.annotation(External))
      )
        onChange(update.state.doc.toString());
    }),
  ];
}

function toDiagnostics(
  state: EditorState,
  problems: SourceProblem[],
): Diagnostic[] {
  return problems.map((problem) => {
    const line = state.doc.line(
      Math.max(1, Math.min(state.doc.lines, problem.line)),
    );
    const from = Math.min(line.to, line.from + Math.max(0, problem.column - 1));
    const to = from < line.to ? line.to : Math.min(state.doc.length, from + 1);
    return {
      from: from === to && from > line.from ? from - 1 : from,
      to,
      severity: problem.severity,
      message: problem.message,
      source: "Mermaid",
    };
  });
}

export function SourceEditor({
  value,
  resetKey,
  problems,
  problemSource,
  onChange,
  handle,
  label,
}: {
  value: string;
  resetKey: string;
  problems: SourceProblem[];
  problemSource: string;
  onChange: (value: string) => void;
  handle: Ref<EditorHandle>;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const setup = useRef<Extension[] | null>(null);

  useEffect(() => {
    if (!host.current) return;
    setup.current = extensions(label, (next) => change.current(next));
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: value, extensions: setup.current }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // 编辑器实例只创建一次；文档切换由 resetKey 处理。
  }, []);

  // 切换文件时重建编辑状态，清空撤销历史，避免撤销到上一个文件。
  const lastKey = useRef(resetKey);
  useEffect(() => {
    const editor = view.current;
    if (!editor || !setup.current || lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    editor.setState(
      EditorState.create({ doc: value, extensions: setup.current }),
    );
  }, [resetKey]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value)
      editor.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: External.of(true),
      });
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    if (editor.state.doc.toString() !== problemSource) return;
    editor.dispatch(
      setDiagnostics(editor.state, toDiagnostics(editor.state, problems)),
    );
  }, [problems, problemSource]);

  useImperativeHandle(
    handle,
    () => ({
      focus: () => view.current?.focus(),
      focusLine(line, column = 1) {
        const editor = view.current;
        if (!editor) return;
        const target = editor.state.doc.line(
          Math.max(1, Math.min(editor.state.doc.lines, line)),
        );
        const pos = Math.min(target.to, target.from + Math.max(0, column - 1));
        editor.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        });
        editor.focus();
      },
    }),
    [],
  );

  return <div className="source-editor" translate="no" ref={host} />;
}
