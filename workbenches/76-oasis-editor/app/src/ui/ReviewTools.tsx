import { useState } from "react";
import { Check, CheckCheck, ChevronLeft, ChevronRight, FilePen, MessageSquare, MessageSquarePlus, X, XCircle } from "lucide-react";
import type { OasisEditorClient } from "oasis-editor";
import {
  adjacentRevision,
  bodyParagraphs,
  commentSelection,
  listComments,
  listRevisions,
  positionOrder,
  type Comment,
  type RevisionMark,
  type Selection,
} from "../contracts/review";
import { Group, Tool, type EditorSnapshot, type Run } from "./ribbon-kit";

const isCollapsed = (s: Selection) =>
  s.anchor.paragraphId === s.focus.paragraphId && s.anchor.runId === s.focus.runId && s.anchor.offset === s.focus.offset;
/** Revision containing the caret, if any. */
function revisionAtCaret(client: OasisEditorClient, marks: RevisionMark[]): RevisionMark | undefined {
  const doc = client.getDocument();
  const here = positionOrder(doc, client.getSelection().focus);
  return marks.find((m) => {
    const a = positionOrder(doc, m.selection.anchor),
      b = positionOrder(doc, m.selection.focus);
    return here >= Math.floor(a) && here <= b;
  });
}
/** Select a range and scroll it into view (the engine does not scroll for programmatic selections). */
export function selectInEditor(client: OasisEditorClient, selection: Selection) {
  client.setSelection(selection);
  client.focus.focus();
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      document
        .querySelector(".native-host .oasis-editor-selection-box, .native-host .oasis-editor-caret")
        ?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" }),
    ),
  );
}

export function ReviewTools({
  client,
  snapshot,
  disabled,
  run,
  author,
  setAuthor,
  onTrackChange,
  onComment,
  commentsOpen,
  toggleComments,
}: {
  client: OasisEditorClient | null;
  snapshot: EditorSnapshot;
  disabled: boolean;
  run: Run;
  author: string;
  setAuthor: (name: string) => void;
  onTrackChange: (enabled: boolean) => void;
  onComment: () => void;
  commentsOpen: boolean;
  toggleComments: (trigger: HTMLElement) => void;
}) {
  const [status, setStatus] = useState("");
  const none = snapshot.revisions === 0;
  function go(direction: 1 | -1) {
    if (!client) return;
    const doc = client.getDocument();
    const marks = listRevisions(doc);
    const target = adjacentRevision(doc, marks, client.getSelection().focus, direction);
    if (!target) return setStatus("没有修订");
    selectInEditor(client, target.selection);
    setStatus(`${target.author}${target.type === "insert" ? "插入" : "删除"}：“${target.text.slice(0, 24)}”`);
  }
  function decide(action: "acceptRevisions" | "rejectRevisions") {
    if (!client) return;
    const marks = listRevisions(client.getDocument());
    if (isCollapsed(client.getSelection())) {
      const current = revisionAtCaret(client, marks);
      if (!current) {
        go(1);
        return;
      }
      client.setSelection(current.selection);
    }
    run(action);
    setStatus(action === "acceptRevisions" ? "已接受所选修订" : "已拒绝所选修订");
    requestAnimationFrame(() => {
      if (listRevisions(client.getDocument()).length) go(1);
    });
  }
  function decideAll(action: "acceptRevisions" | "rejectRevisions") {
    if (!client) return;
    run("selectAll");
    run(action);
    const first = bodyParagraphs(client.getDocument())[0];
    if (first?.runs[0]) selectInEditor(client, { anchor: { paragraphId: first.id, runId: first.runs[0].id, offset: 0 }, focus: { paragraphId: first.id, runId: first.runs[0].id, offset: 0 } });
    setStatus(action === "acceptRevisions" ? "已接受全部修订" : "已拒绝全部修订");
  }
  return (
    <>
      <Group label="修订">
        <Tool label="修订" wide icon={<FilePen size={16} />} title="开启后，插入与删除都会记为修订" active={snapshot.track} disabled={disabled} onClick={() => onTrackChange(!snapshot.track)} />
        <label className="author-field">
          <span>修订者</span>
          <input
            name="review-author"
            autoComplete="name"
            spellCheck={false}
            maxLength={40}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="编辑者…"
          />
        </label>
      </Group>
      <Group label="更改">
        <span className="revision-count" aria-live="polite">
          {none ? "无修订" : `${snapshot.revisions} 处修订`}
        </span>
        <Tool label="上一处修订" icon={<ChevronLeft size={16} />} disabled={disabled || none} onClick={() => go(-1)} />
        <Tool label="下一处修订" icon={<ChevronRight size={16} />} disabled={disabled || none} onClick={() => go(1)} />
        <Tool label="接受" wide icon={<Check size={16} />} title="接受选中或光标处的修订，并移到下一处" disabled={disabled || none} onClick={() => decide("acceptRevisions")} />
        <Tool label="拒绝" wide icon={<X size={16} />} title="拒绝选中或光标处的修订，并移到下一处" disabled={disabled || none} onClick={() => decide("rejectRevisions")} />
        <Tool label="全部接受" wide icon={<CheckCheck size={16} />} disabled={disabled || none} onClick={() => decideAll("acceptRevisions")} />
        <Tool label="全部拒绝" wide icon={<XCircle size={16} />} disabled={disabled || none} onClick={() => decideAll("rejectRevisions")} />
      </Group>
      <Group label="批注">
        <Tool label="新建批注" wide icon={<MessageSquarePlus size={16} />} title={snapshot.collapsed ? "先选中要批注的文字" : "为选中文字添加批注"} disabled={disabled || snapshot.collapsed} onClick={onComment} />
        <button
          type="button"
          className={"tool tool-wide" + (commentsOpen ? " is-active" : "")}
          aria-haspopup="dialog"
          aria-expanded={commentsOpen}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => toggleComments(e.currentTarget)}
        >
          <MessageSquare size={16} />
          <span>批注 {snapshot.comments || ""}</span>
        </button>
      </Group>
      <p className="ribbon-status" role="status">
        {status}
      </p>
    </>
  );
}

const when = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
function quote(client: OasisEditorClient, comment: Comment) {
  const paragraphs = bodyParagraphs(client.getDocument());
  const start = paragraphs.find((p) => p.id === comment.start?.paragraphId);
  if (!start || !comment.start) return "";
  const text = start.runs.map((r) => r.text).join("");
  const end = comment.end?.paragraphId === start.id ? comment.end.offset : text.length;
  return text.slice(comment.start.offset, end).replace(/￼/g, "").slice(0, 60);
}

export function CommentsPanel({
  open,
  close,
  client,
  version,
  composing,
  setComposing,
  onAdd,
  onUpdate,
}: {
  open: boolean;
  close: () => void;
  client: OasisEditorClient | null;
  /** Changes whenever comments are added, resolved or removed. */
  version: string;
  composing: Selection | null;
  setComposing: (s: Selection | null) => void;
  onAdd: (selection: Selection, text: string) => boolean;
  onUpdate: (id: string, patch: { resolved?: boolean; remove?: boolean }) => void;
}) {
  const [draft, setDraft] = useState("");
  const comments = client && open ? listComments(client.getDocument()) : [];
  void version;
  return (
    <aside hidden={!open} className="margin-note comments-panel" role="dialog" aria-labelledby="comments-title">
      <header>
        <h2 id="comments-title">批注</h2>
        <button aria-label="关闭批注" onClick={close}>
          ×
        </button>
      </header>
      {composing && (
        <form
          className="comment-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (onAdd(composing, draft)) {
              setDraft("");
              setComposing(null);
            }
          }}
        >
          <label htmlFor="comment-draft">为选中文字添加批注</label>
          <textarea
            id="comment-draft"
            name="comment"
            autoFocus
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="写下修改意见…"
          />
          <div className="comment-actions">
            <button type="submit" className="primary" disabled={!draft.trim()}>
              添加批注
            </button>
            <button type="button" onClick={() => setComposing(null)}>
              取消
            </button>
          </div>
        </form>
      )}
      {comments.length ? (
        <ol className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className={c.resolved ? "resolved" : undefined}>
              <p className="comment-meta">
                <strong>{c.author}</strong>
                {c.date ? <time dateTime={new Date(c.date).toISOString()}>{when.format(c.date)}</time> : null}
                {c.resolved && <span className="badge">已解决</span>}
              </p>
              {client && <blockquote>{quote(client, c)}</blockquote>}
              <p className="comment-text">{c.text}</p>
              <div className="comment-actions">
                <button
                  type="button"
                  onClick={() => {
                    const sel = client && commentSelection(client.getDocument(), c);
                    if (client && sel) selectInEditor(client, sel);
                  }}
                >
                  定位
                </button>
                <button type="button" onClick={() => onUpdate(c.id, { resolved: !c.resolved })}>
                  {c.resolved ? "重新打开" : "解决"}
                </button>
                <button type="button" className="danger" onClick={() => onUpdate(c.id, { remove: true })}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        !composing && <p className="empty-comments">选中正文文字后，在“审阅 → 新建批注”中添加意见。批注随 DOCX 导出。</p>
      )}
    </aside>
  );
}
