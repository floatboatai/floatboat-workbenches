import { useEffect, useState, type RefObject } from "react";
import type { EditorDocument, OasisEditorClient } from "oasis-editor";
import { addComment, updateComment, type Selection } from "../contracts/review";
import { setRevisionAuthor } from "./engine";

const AUTHOR_KEY = "oasis.reviewAuthor";
/** The reviewer name is a per-viewer preference, not document data. */
function storedAuthor() {
  try {
    return localStorage.getItem(AUTHOR_KEY) || "编辑者";
  } catch {
    return "编辑者";
  }
}

/** Reviewer identity, track-changes mode and comment authoring for the mounted editor. */
export function useReview({
  editor,
  documentKey,
  refresh,
  report,
  saveTrack,
}: {
  editor: RefObject<OasisEditorClient | null>;
  documentKey: string;
  refresh: () => void;
  report: (error: unknown) => void;
  saveTrack: (enabled: boolean) => void;
}) {
  const [author, setAuthorState] = useState(storedAuthor);
  const [composing, setComposing] = useState<Selection | null>(null);
  useEffect(() => setRevisionAuthor(author), [author]);
  useEffect(() => setComposing(null), [documentKey]);
  function setAuthor(name: string) {
    setAuthorState(name);
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch {}
  }
  function setTrackChanges(enabled: boolean) {
    const c = editor.current;
    if (!c) return;
    if (!!c.getState().trackChangesEnabled !== enabled) {
      c.commands.execute("toggleTrackChanges");
      c.focus.focus();
    }
    saveTrack(enabled);
    refresh();
  }
  /** Apply a stored track-changes mode to a freshly mounted editor. */
  function applySavedTrack(client: OasisEditorClient, enabled: boolean) {
    if (!!client.getState().trackChangesEnabled !== enabled) client.commands.execute("toggleTrackChanges");
  }
  function changeComments(update: (doc: EditorDocument) => EditorDocument) {
    try {
      editor.current?.updateDocument(update);
      refresh();
      return true;
    } catch (e) {
      report(e);
      return false;
    }
  }
  return {
    author,
    setAuthor,
    composing,
    setComposing,
    setTrackChanges,
    applySavedTrack,
    /** Capture the current selection as the anchor of a new comment. */
    beginComment: () => {
      const c = editor.current;
      if (!c) return false;
      setComposing(c.getSelection());
      return true;
    },
    addComment: (selection: Selection, text: string) =>
      changeComments((doc) => addComment(doc, selection, text, author)),
    updateComment: (id: string, patch: { resolved?: boolean; remove?: boolean }) =>
      void changeComments((doc) => updateComment(doc, id, patch)),
  };
}
